import { Agent, callable } from "agents";
import { createClient, streamToDataUri } from "../lib/elevenlabs";
import { buildCustomPersonaSystemPrompt, type CustomPersonaData } from "../lib/personas";

import { type PersonaType, PERSONAS } from "../lib/personas";

// ─── Session memory (SQLite row) ─────────────────────────────────────────────

interface SessionMemory {
  sessionId: string;
  topic: string;
  summary: string;     // what the speaker talked about
  weaknesses: string;  // what THIS persona noticed
  score: number;       // 1-10
  date: string;        // ISO
}

// ─── AudienceMember State ────────────────────────────────────────────────────

export interface AudienceMemberState {
  persona: PersonaType;
  sessionId: string;
  satisfactionLevel: number;
  interactionCount: number;
  lastSpeakerText: string;
  peerIds: Record<PersonaType, string>;
  difficultyLevel: number;
  userId: string;
  characterId: string | null;       // Feature 3: custom persona KV id
  customSystemPrompt: string | null; // Feature 3: loaded from KV
  customDisplayName: string | null;  // Feature 3: shown in the UI
}

// ─── AudienceMember Durable Object ──────────────────────────────────────────

export class AudienceMember extends Agent<Env, AudienceMemberState> {
  initialState: AudienceMemberState = {
    persona: "skeptic",
    sessionId: "",
    satisfactionLevel: 50,
    interactionCount: 0,
    lastSpeakerText: "",
    peerIds: { skeptic: "", enthusiast: "", distracted: "", expert: "" },
    difficultyLevel: 3,
    userId: "guest",
    characterId: null,
    customSystemPrompt: null,
    customDisplayName: null,
  };

  // ── SQLite helpers ────────────────────────────────────────────────────────

  #initSchema() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS session_history (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id  TEXT NOT NULL,
        user_id     TEXT NOT NULL DEFAULT 'guest',
        topic       TEXT NOT NULL,
        summary     TEXT NOT NULL,
        weaknesses  TEXT NOT NULL,
        score       REAL NOT NULL,
        created_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_history_user
        ON session_history (user_id, created_at DESC);
    `);
  }

  #loadMemory(userId: string, limit = 3): SessionMemory[] {
    try {
      this.#initSchema();
      const rows = this.ctx.storage.sql.exec(
        `SELECT session_id, topic, summary, weaknesses, score, created_at
         FROM session_history
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        userId,
        limit
      ).toArray();
      return rows.map((r: Record<string, unknown>) => ({
        sessionId: String(r.session_id),
        topic: String(r.topic),
        summary: String(r.summary),
        weaknesses: String(r.weaknesses),
        score: Number(r.score),
        date: String(r.created_at),
      }));
    } catch {
      return [];
    }
  }

  #buildMemoryContext(memories: SessionMemory[]): string {
    if (memories.length === 0) return "";
    const lines = memories.map((m, i) =>
      `Session ${i + 1} (${new Date(m.date).toLocaleDateString()}): ` +
      `Topic="${m.topic}", Score=${m.score}/10. ` +
      `Summary: ${m.summary}. Your past observation: ${m.weaknesses}.`
    );
    return (
      `\n\n--- YOUR MEMORY OF PAST SESSIONS WITH THIS SPEAKER ---\n` +
      lines.join("\n") +
      `\nUse this naturally — only when relevant to what the speaker says now. ` +
      `Do not mention it robotically in every reply.\n---\n`
    );
  }

  // ── Callable methods ──────────────────────────────────────────────────────

  /** Initialize persona, peers, difficulty, user context, and optional custom character */
  @callable()
  async initialize(
    persona: PersonaType,
    sessionId: string,
    peerIds: Record<PersonaType, string>,
    difficultyLevel: number,
    userId = "guest",
    characterId: string | null = null
  ): Promise<void> {
    this.#initSchema();

    let customSystemPrompt: string | null = null;
    let customDisplayName: string | null = null;

    // Feature 3: load custom persona from KV if provided
    if (characterId) {
      try {
        const raw = await this.env.PERSONAS_KV.get(`personas:${characterId}`);
        if (raw) {
          const p = JSON.parse(raw) as CustomPersonaData;
          customSystemPrompt = buildCustomPersonaSystemPrompt(p, ""); // topic patched at analysis time
          customDisplayName = p.displayName;
        }
      } catch { /* fallback to default persona */ }
    }

    this.setState({ ...this.state, persona, sessionId, peerIds, difficultyLevel, userId, characterId, customSystemPrompt, customDisplayName });
  }

  /** Called by RehearseSession after session ends — saves AI-generated memory to SQLite */
  @callable()
  async saveSessionMemory(
    topic: string,
    transcript: string,
    score: number
  ): Promise<void> {
    this.#initSchema();
    const persona = PERSONAS[this.state.persona];
    let summary = transcript.slice(0, 200);
    let weaknesses = "Could not analyse.";

    try {
      const result = await this.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          {
            role: "system",
            content: `You are ${persona.nameEn}. CRITICAL: YOU MUST WRITE YOUR SUMMARY AND WEAKNESS ENTIRELY IN ENGLISH. Summarise this speech in 1 sentence and note 1 specific weakness you observed from your persona's perspective. Return JSON only: {"summary":"...","weaknesses":"..."}`
          },
          {
            role: "user",
            content: `Topic: "${topic}"\nTranscript excerpt: "${transcript.slice(0, 600)}"`
          }
        ]
      });
      const raw = typeof result === "string" ? result : result?.response ?? "";
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        summary = parsed.summary || summary;
        weaknesses = parsed.weaknesses || weaknesses;
      }
    } catch { /* keep defaults */ }

    try {
      this.ctx.storage.sql.exec(
        `INSERT INTO session_history
           (session_id, user_id, topic, summary, weaknesses, score, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        this.state.sessionId,
        this.state.userId,
        topic,
        summary,
        weaknesses,
        score,
        new Date().toISOString()
      );
    } catch (e) {
      console.error("[AudienceMember] saveSessionMemory failed:", e);
    }
  }

  /** Analyse speaker text and decide whether to intervene, optionally considering other audience reactions */
  @callable()
  async analyzeAndRespond(
    speakerText: string,
    otherReactions: { persona: string; text: string }[] = []
  ): Promise<{
    shouldIntervene: boolean;
    response?: string;
    audioDataUri?: string;
    persona: PersonaType;
  }> {
    const persona = PERSONAS[this.state.persona];
    this.setState({ ...this.state, lastSpeakerText: speakerText });

    const memories = this.#loadMemory(this.state.userId);
    const memoryContext = this.#buildMemoryContext(memories);

    let shouldIntervene = false;
    let response = "";

    const othersContext = otherReactions.length > 0
      ? `\n\nOther audience members just said:\n` +
        otherReactions.map(r => `- ${r.persona}: "${r.text}"`).join("\n") +
        `\nYou can agree, disagree, or ignore them if irrelevant. Do not talk directly to them unless necessary.`
      : "";

    try {
      // Feature 3: use custom persona system prompt when available
      const baseSystemPrompt = this.state.customSystemPrompt
        ? this.state.customSystemPrompt.replace(
          // Patch the topic placeholder (empty string → actual topic from last text)
          '""',
          `"${speakerText.slice(0, 80)}"`
        )
        : `You are ${persona.nameEn}. ${persona.systemPrompt}${memoryContext}`;

      const result = await this.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          {
            role: "system",
            content:
              baseSystemPrompt + `\n\n` +
              `Decide if you should intervene NOW. ` +
              (this.state.customSystemPrompt
                ? `Only speak when truly relevant to your interests or values.`
                : `Based on trigger type: "${persona.triggerType}".`) +
              othersContext + 
              `\n\nCRITICAL: YOU MUST WRITE YOUR "response" ENTIRELY IN ENGLISH, regardless of what language the speaker uses.\n\n` +
              `Return JSON only:\n` +
              `{"shouldIntervene":true/false,"response":"your english comment if intervening, else empty string"}\n\n` +
              `Be selective — not every segment needs an interruption.`
          },
          {
            role: "user",
            content: `Speaker just said: "${speakerText}"\n\nDifficulty: ${this.state.difficultyLevel}/5. Higher = intervene more. Should you intervene?`
          }
        ]
      });


      const text = typeof result === "string" ? result : result?.response || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        shouldIntervene = parsed.shouldIntervene === true;
        response = parsed.response || "";
      }
    } catch {
      shouldIntervene = this.#heuristicCheck(speakerText);
      if (shouldIntervene) response = this.#fallbackResponse();
    }

    if (!shouldIntervene || !response) {
      return { shouldIntervene: false, persona: this.state.persona };
    }

    // TTS via ElevenLabs
    let audioDataUri: string | undefined;
    try {
      const client = createClient(this.env.ELEVENLABS_API_KEY);
      const audio = await client.textToSpeech.convert(persona.voiceId, {
        text: response, modelId: "eleven_flash_v2_5", outputFormat: "mp3_44100_128"
      });
      audioDataUri = await streamToDataUri(audio);
    } catch (e) {
      console.error(`[AudienceMember] TTS failed for ${this.state.persona}:`, e);
    }

    this.setState({
      ...this.state,
      interactionCount: this.state.interactionCount + 1,
      satisfactionLevel: Math.min(100, this.state.satisfactionLevel + 5)
    });

    return { shouldIntervene: true, response, audioDataUri, persona: this.state.persona };
  }

  /** DO-to-DO peer message */
  @callable()
  async receivePeerMessage(fromPersona: PersonaType, message: string): Promise<void> {
    console.log(`[${this.state.persona}] peer msg from ${fromPersona}: ${message}`);
  }

  /** Consult a peer audience member */
  @callable()
  async consultPeer(targetPersona: PersonaType, message: string): Promise<void> {
    const peerId = this.state.peerIds[targetPersona];
    if (!peerId) return;
    try {
      const peerDO = this.env.AudienceMember.get(this.env.AudienceMember.idFromString(peerId)) as unknown as import("./audience-member").AudienceMember;
      await peerDO.setName(peerId);
      await peerDO.receivePeerMessage(this.state.persona, message);
    } catch { /* best-effort */ }
  }

  /** Status for the session UI */
  @callable()
  async getStatus(): Promise<{
    persona: PersonaType;
    satisfactionLevel: number;
    interactionCount: number;
    nameEn: string;
    color: string;
    sessionCount: number;
  }> {
    const persona = PERSONAS[this.state.persona];
    let sessionCount = 0;
    try {
      const rows = this.ctx.storage.sql.exec(
        `SELECT COUNT(*) as cnt FROM session_history WHERE user_id = ?`,
        this.state.userId
      ).toArray();
      sessionCount = Number((rows[0] as Record<string, unknown>)?.cnt ?? 0);
    } catch { /* table may not exist yet */ }

    return {
      persona: this.state.persona,
      satisfactionLevel: this.state.satisfactionLevel,
      interactionCount: this.state.interactionCount,
      nameEn: persona.nameEn,
      color: persona.color,
      sessionCount
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  #heuristicCheck(text: string): boolean {
    switch (this.state.persona) {
      case "skeptic": return /\d+%|million|billion|always|never|proven|fact/i.test(text);
      case "enthusiast": return text.includes("...") || text.length < 20;
      case "distracted": return text.split(" ").length > 30;
      case "expert": return /algorithm|methodology|framework|paradigm/i.test(text);
    }
  }

  #fallbackResponse(): string {
    const fallbacks: Record<PersonaType, string> = {
      skeptic: "What's the source for that claim?",
      enthusiast: "That's a great point — keep going!",
      distracted: "Wait, can you explain that more simply?",
      expert: "Technically speaking, there's a nuance worth mentioning here."
    };
    return fallbacks[this.state.persona];
  }
}
