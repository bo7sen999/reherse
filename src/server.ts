import { routeAgentRequest } from "agents";
import { z } from "zod";
import {
  seedPresetsToKV,
  listPersonasFromKV,
  getPersonaFromKV,
  generatePersonaFromWeb,
  type PersonaType
} from "./lib/personas";

// Export the REHEARSE Durable Object agents
export { AudienceMember } from "./agents/audience-member";
export { RehearseSession } from "./agents/rehearse-session";
export { SharedSession } from "./agents/shared-session"; // Feature 2

// ─── Input validation schemas ─────────────────────────────────────────────────

const CreateSessionSchema = z.object({
  speechDescription: z.string().min(3).max(300),
  domain: z.enum(["technology", "business", "science", "education", "health", "social", "general"]),
  difficultyLevel: z.number().int().min(1).max(5).default(3),
  customPersonaIds: z.array(z.string()).max(4).optional(), // Feature 3
  userId: z.string().max(100).optional(),                  // Feature 1
});

const CreateRoomSchema = z.object({
  speechDescription: z.string().min(3).max(300),
  domain: z.enum(["technology", "business", "science", "education", "health", "social", "general"]),
  difficultyLevel: z.number().int().min(1).max(5).default(3),
  hostName: z.string().min(1).max(50).default("Host"),
});

// ─── Structured logger ────────────────────────────────────────────────────────

function log(level: "info" | "warn" | "error", event: string, extra?: Record<string, unknown>) {
  console.log(JSON.stringify({ level, event, timestamp: Date.now(), ...extra }));
}

// ─── Worker entry point ───────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    // Route agent WebSocket connections
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) return agentResponse;

    // API routes
    if (url.pathname.startsWith("/api/")) {
      return handleApiRequest(request, env, url);
    }

    return new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;

// ─── CORS headers ─────────────────────────────────────────────────────────────

function corsHeaders(env: Env) {
  // Default to localhost in dev; set ALLOWED_ORIGIN secret in production
  const origin = env.ALLOWED_ORIGIN ?? "http://localhost:5173";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  } as const;
}

// ─── API handler ──────────────────────────────────────────────────────────────

async function handleApiRequest(
  request: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const cors = corsHeaders(env);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    // POST /api/sessions — create a new session
    if (url.pathname === "/api/sessions" && request.method === "POST") {
      const raw = await request.json();
      const parsed = CreateSessionSchema.safeParse(raw);

      if (!parsed.success) {
        log("warn", "create_session_validation_error", { errors: parsed.error.flatten() });
        return new Response(
          JSON.stringify({ error: "Invalid request", details: parsed.error.flatten() }),
          { status: 400, headers: { "Content-Type": "application/json", ...cors } }
        );
      }

      const body = parsed.data;
      const sessionId = crypto.randomUUID();
      const doId = env.RehearseSession.idFromName(sessionId);
      const session = env.RehearseSession.get(doId) as unknown as import("./agents/rehearse-session").RehearseSession;
      await session.setName(sessionId);

      const data = await session.createSession({
        speechDescription: body.speechDescription,
        domain: body.domain,
        difficultyLevel: body.difficultyLevel,
        ...(body.customPersonaIds ? { customPersonaIds: body.customPersonaIds } : {}),
        ...(body.userId         ? { userId: body.userId }                       : {}),
      });

      // Increment global session counter in KV (best-effort)
      try {
        const raw = await env.REHEARSE_META.get("stats");
        const stats = raw ? JSON.parse(raw) : { totalSessions: 0 };
        stats.totalSessions = (stats.totalSessions ?? 0) + 1;
        await env.REHEARSE_META.put("stats", JSON.stringify(stats));
      } catch { /* KV failure is non-fatal */ }

      log("info", "session_created", { sessionId });
      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json", ...cors }
      });
    }

    // GET /api/sessions/:id/report
    const reportMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/report$/);
    if (reportMatch && request.method === "GET") {
      const sessionId = reportMatch[1];
      const doId = env.RehearseSession.idFromName(sessionId);
      const session = env.RehearseSession.get(doId) as unknown as import("./agents/rehearse-session").RehearseSession;
      await session.setName(sessionId);

      const report = await session.endSession();
      log("info", "report_generated", { sessionId });
      return new Response(JSON.stringify(report), {
        headers: { "Content-Type": "application/json", ...cors }
      });
    }

    // GET /api/dashboard — real stats from KV
    if (url.pathname === "/api/dashboard" && request.method === "GET") {
      let totalSessions = 0;
      try {
        const raw = await env.REHEARSE_META.get("stats");
        if (raw) totalSessions = JSON.parse(raw)?.totalSessions ?? 0;
      } catch { /* KV not available locally */ }

      return new Response(
        JSON.stringify({
          totalSessions,
          personasPerSession: 4,
          message: "Each audience member is a live Durable Object.",
        }),
        { headers: { "Content-Type": "application/json", ...cors } }
      );
    }

    // POST /api/rooms — create a shared multiplayer session
    if (url.pathname === "/api/rooms" && request.method === "POST") {
      const raw    = await request.json();
      const parsed = CreateRoomSchema.safeParse(raw);

      if (!parsed.success) {
        log("warn", "create_room_validation_error", { errors: parsed.error.flatten() });
        return new Response(
          JSON.stringify({ error: "Invalid request", details: parsed.error.flatten() }),
          { status: 400, headers: { "Content-Type": "application/json", ...cors } }
        );
      }

      const { speechDescription, domain, difficultyLevel, hostName } = parsed.data;

      // Generate a 6-char room code (uppercase letters)
      const roomCode = Array.from({ length: 6 }, () =>
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]
      ).join("");

      // Create 4 audience member DOs (named by roomCode + persona)
      const personaTypes = ["skeptic", "enthusiast", "distracted", "expert"] as const;
      const audienceDoIds: Record<string, string> = {};

      for (const persona of personaTypes) {
        const doId = env.AudienceMember.idFromName(`${roomCode}-${persona}`);
        const ado  = env.AudienceMember.get(doId) as unknown as import("./agents/audience-member").AudienceMember;
        audienceDoIds[persona] = doId.toString();

        await ado.setName(`${roomCode}-${persona}`);
        // Initialize each audience member
        await ado.initialize(
          persona,
          roomCode,
          {} as Record<PersonaType, string>, // peerIds
          difficultyLevel,
          "shared-" + roomCode,
          null
        );
      }

      // Setup the shared room DO
      const roomDoId = env.SharedSession.idFromName(roomCode);
      const roomDO   = env.SharedSession.get(roomDoId) as unknown as import("./agents/shared-session").SharedSession;
      await roomDO.setName(roomCode);
      await roomDO.setupRoom(
        roomCode,
        speechDescription,
        domain,
        difficultyLevel,
        audienceDoIds as Record<PersonaType, string>
      );

      // Store room info in KV so participants can look it up
      await env.REHEARSE_META.put(`room:${roomCode}`, JSON.stringify({
        roomCode,
        speechDescription,
        domain,
        difficultyLevel,
        createdAt: Date.now(),
        hostName
      }), { expirationTtl: 86400 }); // expires in 24h

      log("info", "room_created", { roomCode });
      return new Response(JSON.stringify({ roomCode, speechDescription, domain, difficultyLevel }), {
        headers: { "Content-Type": "application/json", ...cors }
      });
    }

    // GET /api/rooms/:code — get room info
    const roomInfoMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})$/);
    if (roomInfoMatch && request.method === "GET") {
      const roomCode = roomInfoMatch[1];
      const raw      = await env.REHEARSE_META.get(`room:${roomCode}`);
      if (!raw) {
        return new Response(JSON.stringify({ error: "Room not found" }), {
          status: 404, headers: { "Content-Type": "application/json", ...cors }
        });
      }
      return new Response(raw, { headers: { "Content-Type": "application/json", ...cors } });
    }

    // ── Feature 3: Custom Personas ──────────────────────────────────────────

    // GET /api/personas — list all (seeds presets on first call)
    if (url.pathname === "/api/personas" && request.method === "GET") {
      await seedPresetsToKV(env.PERSONAS_KV);
      const personas = await listPersonasFromKV(env.PERSONAS_KV);
      return new Response(JSON.stringify(personas), {
        headers: { "Content-Type": "application/json", ...cors }
      });
    }

    // GET /api/personas/:id — get single persona by normalized id
    const personaGetMatch = url.pathname.match(/^\/api\/personas\/([a-z0-9_]+)$/);
    if (personaGetMatch && request.method === "GET") {
      const persona = await getPersonaFromKV(env.PERSONAS_KV, personaGetMatch[1]);
      if (!persona) return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...cors }
      });
      return new Response(JSON.stringify(persona), {
        headers: { "Content-Type": "application/json", ...cors }
      });
    }

    // POST /api/personas/generate — scrape Wikipedia + Workers AI extraction + KV cache
    if (url.pathname === "/api/personas/generate" && request.method === "POST") {
      const body = await request.json() as { name?: string };
      if (!body.name || body.name.trim().length < 2) {
        return new Response(JSON.stringify({ error: "name is required (min 2 chars)" }), {
          status: 400, headers: { "Content-Type": "application/json", ...cors }
        });
      }
      log("info", "persona_generate_start", { name: body.name });
      const result = await generatePersonaFromWeb(body.name.trim(), env);

      if ("error" in result) {
        log("warn", "persona_generate_failed", { name: body.name, error: result.error });
        return new Response(JSON.stringify(result), {
          status: 422, headers: { "Content-Type": "application/json", ...cors }
        });
      }

      log("info", "persona_generate_success", { id: result.id });
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json", ...cors }
      });
    }

    return new Response("Not found", { status: 404, headers: cors });


  } catch (e) {
    log("error", "api_error", { error: String(e) });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors }
    });
  }
}
