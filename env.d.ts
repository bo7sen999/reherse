// REHEARSE — Cloudflare Workers type definitions
// Binding names MUST match wrangler.jsonc exactly

// ─── Vite environment variable types ─────────────────────────────────────────
// Declared here so they work alongside @cloudflare/workers-types without
// needing vite/client in tsconfig (which would conflict with workers-types).

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// ─── Workers AI binding type ──────────────────────────────────────────────────

interface WorkersAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface WorkersAIResponse {
  response?: string;
}

interface WorkersAIBinding {
  run(
    model: string,
    options: { messages: WorkersAIMessage[] }
  ): Promise<string | WorkersAIResponse>;
  [key: string]: any; // To satisfy @cloudflare/workers-types compatibility
}

declare module '*.css' {
  const styles: { [className: string]: string };
  export default styles;
}

  // Cloudflare Workers Env
interface Env {
  // Workers AI (typed — no more @ts-ignore)
  AI: WorkersAIBinding;

  // ElevenLabs API key (secret)
  ELEVENLABS_API_KEY: string;

  // Durable Objects — class_name = binding name
  AudienceMember:  DurableObjectNamespace;
  RehearseSession: DurableObjectNamespace;
  SharedSession:   DurableObjectNamespace; // Feature 2: multiplayer rooms

  // KV Namespaces
  REHEARSE_META: KVNamespace;
  PERSONAS_KV:  KVNamespace; // Feature 3: custom personas cache

  // R2 Bucket for session audio recordings
  AUDIO_BUCKET: R2Bucket;

  // Browser Rendering API (Feature 3: persona scraping)
  BROWSER: Fetcher;

  // Allowed CORS origin (set in wrangler secrets for production)
  ALLOWED_ORIGIN?: string;

  // Cloudflare account credentials (for Browser Rendering REST API in Feature 3)
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
}
