/**
 * SharedSession — Multiplayer rehearsal room
 *
 * Architecture:
 *  - One DO instance per room code (e.g. "ABC123")
 *  - Uses WebSocket Hibernation so the DO sleeps between messages
 *  - Each WebSocket stores participant metadata via serializeAttachment()
 *  - Transcripts from any speaker are forwarded to the shared audience DOs
 *  - Audience responses are broadcast to ALL participants in the room
 */

import { Agent, callable } from "agents";
import { type PersonaType, PERSONAS } from "../lib/personas";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Participant {
  participantId: string; // UUID
  name: string;
  joinedAt: number;
}

// Stored on each WebSocket via serializeAttachment (survives hibernation)
interface WsAttachment {
  participantId: string;
  name: string;
  joinedAt: number;
  roomCode: string;
}

export interface SharedSessionState {
  roomCode: string;
  speechDescription: string;
  domain: string;
  difficultyLevel: number;
  audienceDoIds: Record<PersonaType, string>;
  createdAt: number;
  isActive: boolean;
}

export interface SharedInterventionEvent {
  timestamp: number;
  persona: PersonaType;
  personaName: string;
  color: string;
  text: string;
  audioDataUri?: string;
  triggeredBy: string; // participantId who triggered it
}

// ─── SharedSession Durable Object ─────────────────────────────────────────────

export class SharedSession extends Agent<Env, SharedSessionState> {
  initialState: SharedSessionState = {
    roomCode: "",
    speechDescription: "",
    domain: "general",
    difficultyLevel: 3,
    audienceDoIds: { skeptic: "", enthusiast: "", distracted: "", expert: "" },
    createdAt: 0,
    isActive: false
  };

  // ── Room setup ──────────────────────────────────────────────────────────────

  @callable()
  async setupRoom(
    roomCode: string,
    speechDescription: string,
    domain: string,
    difficultyLevel: number,
    audienceDoIds: Record<PersonaType, string>
  ): Promise<void> {
    this.setState({
      ...this.state,
      roomCode,
      speechDescription,
      domain,
      difficultyLevel,
      audienceDoIds,
      createdAt: Date.now(),
      isActive: true
    });
  }

  // ── WebSocket connection handling ───────────────────────────────────────────

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;

    let data: Record<string, unknown>;
    try { data = JSON.parse(message); }
    catch { return; }

    const attachment = ws.deserializeAttachment() as WsAttachment | null;
    if (!attachment) return;

    switch (data.type) {
      // Transcript from a speaker — forward to audience DOs
      case "transcript": {
        const text = String(data.text ?? "");
        if (!text.trim()) return;

        await this.#forwardToAudience(text, attachment.participantId, attachment.name);
        break;
      }

      // Audio chunk — re-broadcast to all peers (so each participant hears others)
      case "audio-chunk": {
        this.#broadcast(JSON.stringify({
          type: "peer-audio",
          from: attachment.participantId,
          name: attachment.name,
          data: data.data
        }), ws);
        break;
      }

      // Participant sends a chat message visible to everyone
      case "chat": {
        this.#broadcast(JSON.stringify({
          type: "chat",
          from: attachment.name,
          text: data.text
        }));
        break;
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as WsAttachment | null;
    if (att) {
      this.#broadcast(JSON.stringify({
        type: "participant-left",
        participantId: att.participantId,
        name: att.name
      }), ws);
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("[SharedSession] WebSocket error:", error);
  }

  // ── HTTP handler ─────────────────────────────────────────────────────────────
  // Cloudflare Agents SDK routes WebSocket upgrades through onRequest

  async onRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // WebSocket upgrade — participant joins the room
    if (req.headers.get("Upgrade") === "websocket") {
      const participantId = url.searchParams.get("participantId") ?? crypto.randomUUID();
      const name = url.searchParams.get("name") ?? "Anonymous";

      // Accept the WebSocket using Hibernation pattern
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      this.ctx.acceptWebSocket(server);

      // Store participant data on the WebSocket (survives hibernation)
      server.serializeAttachment({
        participantId,
        name,
        joinedAt: Date.now(),
        roomCode: this.state.roomCode
      } satisfies WsAttachment);

      // Tell everyone someone joined
      this.#broadcast(JSON.stringify({
        type: "participant-joined",
        participantId,
        name,
        roomCode: this.state.roomCode
      }), server);

      // Send current room state to the new participant
      server.send(JSON.stringify({
        type: "room-state",
        roomCode: this.state.roomCode,
        speechDescription: this.state.speechDescription,
        domain: this.state.domain,
        difficultyLevel: this.state.difficultyLevel,
        participants: this.#getParticipants()
      }));

      return new Response(null, {
        status: 101,
        webSocket: client
      });
    }

    // GET /status
    if (url.pathname.endsWith("/status")) {
      return Response.json({
        roomCode: this.state.roomCode,
        isActive: this.state.isActive,
        speechDescription: this.state.speechDescription,
        participantCount: this.ctx.getWebSockets().length
      });
    }

    return new Response("Not found", { status: 404 });
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /** Broadcast a message to all connected participants, optionally skipping one */
  #broadcast(message: string, skip?: WebSocket): void {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === skip) continue;
      try { ws.send(message); } catch { /* disconnected */ }
    }
  }

  /** Get list of currently connected participants */
  #getParticipants(): Participant[] {
    return this.ctx.getWebSockets()
      .map(ws => {
        const att = ws.deserializeAttachment() as WsAttachment | null;
        return att ? { participantId: att.participantId, name: att.name, joinedAt: att.joinedAt } : null;
      })
      .filter((p): p is Participant => p !== null);
  }

  #lastForwardAt = 0;

  /** Forward transcript text to all audience DOs and broadcast their responses sequentially */
  async #forwardToAudience(text: string, participantId: string, participantName: string): Promise<void> {
    const now = Date.now();
    if (now - this.#lastForwardAt < 3000) return; // 3s rate limit
    this.#lastForwardAt = now;

    const personas: PersonaType[] = ["skeptic", "enthusiast", "distracted", "expert"];
    const reactions: { persona: string; text: string }[] = [];

    for (const persona of personas) {
      const doIdStr = this.state.audienceDoIds[persona];
      if (!doIdStr) continue;

      try {
        const doId = this.env.AudienceMember.idFromString(doIdStr);
        const ado = this.env.AudienceMember.get(doId) as unknown as import("./audience-member").AudienceMember;
        await ado.setName(doIdStr);
        
        const result = await ado.analyzeAndRespond(text, reactions);

        if (result.shouldIntervene && result.response) {
          const intervention: SharedInterventionEvent = {
            timestamp: Date.now(),
            persona,
            personaName: PERSONAS[persona].nameEn,
            color: PERSONAS[persona].color,
            text: result.response,
            audioDataUri: result.audioDataUri,
            triggeredBy: participantId
          };

          // Record reaction so subsequent personas in this loop are aware of it
          reactions.push({ persona: PERSONAS[persona].nameEn, text: result.response });

          // Broadcast to ALL participants so everyone hears the intervention
          this.#broadcast(JSON.stringify({
            type: "intervention",
            ...intervention,
            triggeredByName: participantName
          }));
        }
      } catch (e) {
        console.error(`[SharedSession] audience DO error (${persona}):`, e);
      }
    }
  }
}
