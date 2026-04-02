import { Agent, callable, type Connection } from "agents";
import { createClient, streamToDataUri } from "../lib/elevenlabs";
import { type PersonaType, PERSONAS } from "../lib/personas";

// ─── Session State ────────────────────────────────────────────────────────

export interface SessionConfig {
  speechDescription: string;
  domain: string;
  difficultyLevel: number; // 1–5
  customPersonaIds?: string[];  // Feature 3: up to 4 custom persona KV IDs
  userId?: string;              // Feature 1: for cross-session memory
}

export interface AudienceMemberRef {
  persona: PersonaType;
  doId: string;
}

export interface InterventionEvent {
  timestamp: number;
  persona: PersonaType;
  personaName: string;
  color: string;
  text: string;
  audioDataUri?: string;
}

export interface RehearseSessionState {
  phase: "idle" | "active" | "ended";
  config: SessionConfig;
  audienceMembers: AudienceMemberRef[];
  startedAt: number;
  endedAt?: number;
  interventions: InterventionEvent[];
  transcriptSegments: string[];
  speakerScore: number;
}

// ─── RehearseSession Durable Object ──────────────────────────────────────

export class RehearseSession extends Agent<Env, RehearseSessionState> {
  initialState: RehearseSessionState = {
    phase: "idle",
    config: { speechDescription: "", domain: "general", difficultyLevel: 3 },
    audienceMembers: [],
    startedAt: 0,
    interventions: [],
    transcriptSegments: [],
    speakerScore: 0
  };

  // Minimum ms between AI analysis calls (rate limit — avoids credit burn and AI queue congestion)
  readonly #MIN_INTERVAL_MS = 3000;
  #lastAnalysisAt = 0;

  // Outbound WebSocket to ElevenLabs Realtime STT
  #sttSocket: WebSocket | null = null;

  /**
   * Intercept raw WebSocket messages from the browser.
   * audio-chunk messages are forwarded to ElevenLabs STT.
   */
  onMessage(_conn: Connection, message: string | ArrayBuffer) {
    if (typeof message === "string") {
      try {
        const data = JSON.parse(message);
        if (data.type === "audio-chunk" && this.#sttSocket) {
          this.#sttSocket.send(
            JSON.stringify({
              message_type: "input_audio_chunk",
              audio_base_64: data.data,
              commit: false,
              sample_rate: 16000
            })
          );
          return;
        }
      } catch { /* not our message */ }
    }
  }

  /** Create a new session with 4 audience members */
  @callable()
  async createSession(config: SessionConfig): Promise<{
    sessionId: string;
    audienceMembers: AudienceMemberRef[];
  }> {
    const sessionId = this.name || crypto.randomUUID();
    const personas: PersonaType[] = ["skeptic", "enthusiast", "distracted", "expert"];
    const userId = config.userId ?? "guest";

    // Create 4 AudienceMember DOs
    const audienceMembers: AudienceMemberRef[] = personas.map((persona) => {
      const doId = this.env.AudienceMember.newUniqueId();
      return { persona, doId: doId.toString() };
    });

    // Build peer ID map
    const peerIds: Record<PersonaType, string> = {
      skeptic: "", enthusiast: "", distracted: "", expert: ""
    };
    for (const member of audienceMembers) {
      peerIds[member.persona] = member.doId;
    }

    // Initialize each audience member DO (with optional custom character)
    for (let i = 0; i < audienceMembers.length; i++) {
      const member = audienceMembers[i];
      const doId = this.env.AudienceMember.idFromString(member.doId);
      const do_ = this.env.AudienceMember.get(doId) as unknown as import("./audience-member").AudienceMember;
      const myPeers = { ...peerIds };
      myPeers[member.persona] = ""; // no self-reference

      // Custom persona: assign the selected character ID (if any)
      const characterId = config.customPersonaIds?.[i] ?? null;

      // Use native DO RPC instead of fetch to avoid PartyKit envelope issues
      await do_.setName(member.doId);
      await do_.initialize(
        member.persona,
        sessionId,
        myPeers,
        config.difficultyLevel,
        userId,
        characterId
      );
    }

    this.setState({
      ...this.state,
      phase: "active",
      config,
      audienceMembers,
      startedAt: Date.now(),
      interventions: [],
      transcriptSegments: []
    });

    return { sessionId, audienceMembers };
  }

  /** Process a transcript segment — ask all audience members if they want to respond */
  @callable()
  async processTranscript(text: string): Promise<InterventionEvent[]> {
    if (!text.trim() || this.state.phase !== "active") return [];

    // Rate limit: skip analysis if called too soon after the last one
    const now = Date.now();
    if (now - this.#lastAnalysisAt < this.#MIN_INTERVAL_MS) return [];
    this.#lastAnalysisAt = now;

    this.setState({
      ...this.state,
      transcriptSegments: [...this.state.transcriptSegments, text]
    });

    const newInterventions: InterventionEvent[] = [];

    // Analyze text with each persona using Workers AI (self-contained, no DO.fetch)
    const personas: PersonaType[] = ["skeptic", "enthusiast", "distracted", "expert"];
    const results = await Promise.allSettled(
      personas.map(async (persona) => this.analyzeWithPersona(text, persona))
    );

    // Collect up to 1 intervention per segment to avoid chaos
    for (const result of results) {
      if (result.status === "fulfilled" && result.value?.shouldIntervene) {
        const { response, persona } = result.value;
        if (!response) continue;

        let audioDataUri: string | undefined;
        try {
          const client = createClient(this.env.ELEVENLABS_API_KEY);
          const audio = await client.textToSpeech.convert(PERSONAS[persona].voiceId, {
            text: response,
            modelId: "eleven_flash_v2_5",
            outputFormat: "mp3_44100_128"
          });
          audioDataUri = await streamToDataUri(audio);
        } catch (e) {}

        const intervention: InterventionEvent = {
          timestamp: Date.now(),
          persona,
          personaName: PERSONAS[persona].nameEn,
          color: PERSONAS[persona].color,
          text: response,
          audioDataUri
        };

        newInterventions.push(intervention);
        break; // Only 1 intervention per segment
      }
    }

    if (newInterventions.length > 0) {
      this.setState({
        ...this.state,
        interventions: [...this.state.interventions, ...newInterventions]
      });

      // Broadcast to all connected clients
      this.broadcast(
        JSON.stringify({
          type: "intervention",
          events: newInterventions
        })
      );
    }

    return newInterventions;
  }

  /** Start ElevenLabs realtime STT */
  @callable()
  async startTranscription(): Promise<void> {
    if (this.#sttSocket) {
      this.#sttSocket.close();
      this.#sttSocket = null;
    }

    const STT_URL =
      "https://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&audio_format=pcm_16000";

    const resp = await fetch(STT_URL, {
      headers: {
        Upgrade: "websocket",
        "xi-api-key": this.env.ELEVENLABS_API_KEY
      }
    });

    const ws = resp.webSocket;
    if (!ws) throw new Error("STT WebSocket upgrade failed");
    ws.accept();
    this.#sttSocket = ws;

    ws.addEventListener("message", async (event) => {
      try {
        const data = JSON.parse(event.data as string);

        if (data.message_type === "committed_transcript" && data.text) {
          // Relay to browser
          this.broadcast(
            JSON.stringify({
              type: "transcript",
              text: data.text,
              partial: false
            })
          );

          // Process for audience interventions
          await this.processTranscript(data.text);
        } else if (data.message_type === "partial_transcript" && data.text) {
          this.broadcast(
            JSON.stringify({
              type: "transcript",
              text: data.text,
              partial: true
            })
          );
        }
      } catch {
        // ignore parse errors
      }
    });

    ws.addEventListener("close", () => {
      this.#sttSocket = null;
    });
  }

  /** Analyze text with a single persona (self-contained, no sub-DO calls) */
  private async analyzeWithPersona(
    speakerText: string,
    persona: PersonaType
  ): Promise<{ shouldIntervene: boolean; response: string; audioDataUri?: string; persona: PersonaType }> {
    const personaDef = PERSONAS[persona];
    const diff = this.state.config.difficultyLevel;

    let shouldIntervene = false;
    let response = "";

    try {
      const result = await this.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          {
            role: "system",
            content: `${personaDef.systemPrompt}\n\nDifficulty: ${diff}/5. Higher = more interventions.\nCRITICAL: YOU MUST RESPOND ENTIRELY IN ENGLISH AT ALL TIMES, regardless of the speaker's language.\nRespond ONLY with JSON: {"shouldIntervene":true/false,"response":"your english comment"}`
          },
          { role: "user", content: `Speaker just said: "${speakerText}"` }
        ]
      });

      const raw = typeof result === "string" ? result : result?.response ?? "";
      const match = raw.match(/\{[\s\S]*?\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        shouldIntervene = parsed.shouldIntervene === true;
        response = parsed.response || "";
      }
      
      // Override: If AI was lazy but heuristic detects a clear trigger, force it to intervene
      if (!shouldIntervene && this.heuristicCheck(speakerText, persona)) {
        shouldIntervene = true;
        const fallbacks: Record<PersonaType, string> = {
          skeptic: "Where are you getting those big numbers from?",
          enthusiast: "That sounds huge, tell me more!",
          distracted: "Wait, can you simplify what that paradigm actually means?",
          expert: "I want to challenge you on that specific methodology."
        };
        response = fallbacks[persona];
      }
    } catch {
      // Heuristic fallback
      shouldIntervene = this.heuristicCheck(speakerText, persona);
      if (shouldIntervene) {
        const fallbacks: Record<PersonaType, string> = {
          skeptic: "Where are you getting those numbers from?",
          enthusiast: "That makes a lot of sense, keep going!",
          distracted: "Sorry to interrupt, but could you simplify that?",
          expert: "I think there's a technical nuance missing there."
        };
        response = fallbacks[persona];
      }
    }

    if (!shouldIntervene || !response) return { shouldIntervene: false, response: "", persona };

    return { shouldIntervene: true, response, persona };
  }

  private heuristicCheck(text: string, persona: PersonaType): boolean {
    if (persona === "skeptic") return /\d+%|million|billion|always|never|proven|fact/i.test(text);
    if (persona === "enthusiast") return text.includes("...") || text.trim().length < 20;
    if (persona === "distracted") return text.split(" ").length > 30;
    if (persona === "expert") return /algorithm|methodology|framework|paradigm|technically/i.test(text);
    return false;
  }

  /** Forward audio chunk from browser to ElevenLabs STT (fallback callable) */
  @callable()
  async sendAudioChunk(audioBase64: string): Promise<void> {
    if (!this.#sttSocket) return;
    this.#sttSocket.send(
      JSON.stringify({
        message_type: "input_audio_chunk",
        audio_base_64: audioBase64,
        commit: false,
        sample_rate: 16000
      })
    );
  }

  /** Stop transcription */
  @callable()
  async stopTranscription(): Promise<void> {
    if (!this.#sttSocket) return;
    try {
      this.#sttSocket.send(
        JSON.stringify({
          message_type: "input_audio_chunk",
          audio_base_64: "",
          commit: true,
          sample_rate: 16000
        })
      );
      await new Promise((r) => setTimeout(r, 500));
    } finally {
      this.#sttSocket.close();
      this.#sttSocket = null;
    }
  }

  /** End session, generate report, and save memories to each audience DO */
  @callable()
  async endSession(): Promise<SessionReport> {
    this.setState({ ...this.state, phase: "ended", endedAt: Date.now() });

    if (this.#sttSocket) {
      this.#sttSocket.close();
      this.#sttSocket = null;
    }

    const report = await this.generateReport();

    // Fan-out: ask every audience DO to save its own memory record (best-effort)
    const fullTranscript = this.state.transcriptSegments.join(" ");
    const topic = this.state.config.speechDescription;
    await Promise.allSettled(
      this.state.audienceMembers.map(async (ref) => {
        try {
          const doId = this.env.AudienceMember.idFromString(ref.doId);
          const ado = this.env.AudienceMember.get(doId) as unknown as import("./audience-member").AudienceMember;
          await ado.setName(ref.doId);
          await ado.saveSessionMemory(topic, fullTranscript, report.score);
        } catch (e) {
          console.warn(`[RehearseSession] saveSessionMemory failed for ${ref.persona}:`, e);
        }
      })
    );

    return report;
  }


  /** Generate post-session report via Workers AI */
  @callable()
  async generateReport(): Promise<SessionReport> {
    const duration = this.state.endedAt
      ? Math.round((this.state.endedAt - this.state.startedAt) / 1000)
      : Math.round((Date.now() - this.state.startedAt) / 1000);

    const fullTranscript = this.state.transcriptSegments.join(" ");
    const interventionCount = this.state.interventions.length;

    let score = 7;
    let bestMoment = "When you spoke with confidence and flow in the first section.";
    let hardestMoment = "The moment the Skeptic interrupted about your claims.";
    let improvement = "Back up your arguments with specific numbers next time.";

    try {
      const result = await this.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          {
            role: "system",
            content: `You analyze speech practice sessions and give constructive feedback in English. 
Be specific and encouraging. 
Return JSON only:
{
  "score": <number 1-10>,
  "bestMoment": "<one sentence about the best moment>",
  "hardestMoment": "<one sentence about the hardest moment>", 
  "improvement": "<one specific thing to improve>"
}`
          },
          {
            role: "user",
            content: `Session analysis:
- Topic: ${this.state.config.speechDescription}
- Domain: ${this.state.config.domain}
- Duration: ${duration} seconds
- Number of audience interventions: ${interventionCount}
- Transcript: "${fullTranscript.slice(0, 1000)}"
- Interventions received: ${this.state.interventions.map((i) => `${i.personaName}: "${i.text}"`).join(", ")}

Generate the performance report.`
          }
        ]
      });

      const text =
        typeof result === "string"
          ? result
          : result?.response || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        score = Math.min(10, Math.max(1, Number(parsed.score) || 7));
        bestMoment = parsed.bestMoment || bestMoment;
        hardestMoment = parsed.hardestMoment || hardestMoment;
        improvement = parsed.improvement || improvement;
      }
    } catch (e) {
      console.error("Report generation failed:", e);
    }

    // Generate TTS for the report
    let reportAudioUri: string | undefined;
    try {
      const reportText = `Your overall score is ${score} out of ten. ${bestMoment}. For next time, remember to ${improvement.toLowerCase()}.`;
      const client = createClient(this.env.ELEVENLABS_API_KEY);
      const audio = await client.textToSpeech.convert(
        "JBFqnCBsd6RMkjVDRZzb",
        {
          text: reportText,
          modelId: "eleven_flash_v2_5",
          outputFormat: "mp3_44100_128"
        }
      );
      reportAudioUri = await streamToDataUri(audio);
    } catch (e) {
      console.error("Report TTS failed:", e);
    }

    return {
      score,
      duration,
      bestMoment,
      hardestMoment,
      improvement,
      interventionCount,
      reportAudioUri
    };
  }

  /** Get current session status for UI */
  @callable()
  async getStatus(): Promise<{
    phase: string;
    duration: number;
    interventionCount: number;
    audienceMembers: AudienceMemberRef[];
  }> {
    return {
      phase: this.state.phase,
      duration:
        this.state.startedAt > 0
          ? Math.round((Date.now() - this.state.startedAt) / 1000)
          : 0,
      interventionCount: this.state.interventions.length,
      audienceMembers: this.state.audienceMembers
    };
  }
}

export interface SessionReport {
  score: number;
  duration: number;
  bestMoment: string;
  hardestMoment: string;
  improvement: string;
  interventionCount: number;
  reportAudioUri?: string;
}
