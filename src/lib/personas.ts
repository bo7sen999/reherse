/**
 * personas.ts — Custom persona management
 *
 * Stores 10 preset famous personas in KV and allows generating new ones
 * via Cloudflare Browser Rendering API + Workers AI extraction.
 *
 * Key format: personas:{name_normalized}
 * e.g. personas:steve_jobs, personas:elon_musk
 */
// ─── Persona definitions ────────────────────────────────────────────────────

export type PersonaType = "skeptic" | "enthusiast" | "distracted" | "expert";

export interface Persona {
  id: PersonaType;
  nameAr: string;
  nameEn: string;
  color: string;
  voiceId: string;
  triggerType: "big-claim" | "hesitation" | "complexity" | "factual-error";
  systemPrompt: string;
  interventionStyle: string;
}

export const PERSONAS: Record<PersonaType, Persona> = {
  skeptic: {
    id: "skeptic",
    nameAr: "المشكك",
    nameEn: "The Skeptic",
    color: "#6B7FD7",
    voiceId: "JBFqnCBsd6RMkjVDRZzb",
    triggerType: "big-claim",
    systemPrompt: `You are a sharp analytical audience member who questions every big claim.
You ask about sources, data, and logic. You never accept statements without evidence.
Your tone is neutral and measured — not hostile, just precise.
Ask ONE short, pointed question. Start directly with your question.
Max 2 sentences. No pleasantries.`,
    interventionStyle: "challenges"
  },
  enthusiast: {
    id: "enthusiast",
    nameAr: "المتحمس",
    nameEn: "The Enthusiast",
    color: "#C77DBA",
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    triggerType: "hesitation",
    systemPrompt: `You are an encouraging audience member who genuinely supports the speaker.
When they hesitate or stumble, you offer real encouragement (not fake hype).
You might say "Take your time" or "That's a great point, expand on it."
Keep it to ONE short phrase. Warm and authentic. Max 1 sentence.`,
    interventionStyle: "encourages"
  },
  distracted: {
    id: "distracted",
    nameAr: "المشتت",
    nameEn: "The Distracted One",
    color: "#F4A261",
    voiceId: "pNInz6obpgDQGcFmaJgB",
    triggerType: "complexity",
    systemPrompt: `You are a regular audience member who gets confused by complex language.
You ask very basic, simple questions. Sometimes slightly off-topic.
You represent everyone who didn't follow along.
Ask ONE simple, slightly naive question. Casual tone. Max 1 sentence.`,
    interventionStyle: "simplifies"
  },
  expert: {
    id: "expert",
    nameAr: "الخبير",
    nameEn: "The Expert",
    color: "#52B788",
    voiceId: "VR6AewLTigWG4xSOukaG",
    triggerType: "factual-error",
    systemPrompt: `You are a domain expert in the audience. You notice technical inaccuracies.
You gently correct or expand on what was said. You're not condescending — you teach.
Share ONE correction or additional insight. Authoritative but kind. Max 2 sentences.`,
    interventionStyle: "corrects"
  }
};

export interface CustomPersonaData {
  id: string;              // normalized name, e.g. "steve_jobs"
  displayName: string;     // "Steve Jobs"
  questionStyle: string;   // how they ask questions
  values: string;          // core values/beliefs
  interruptionStyle: string; // how they interrupt
  topicsOfInterest: string;  // what they care about
  vocabulary: string;      // characteristic phrases/terms
  voiceId: string;         // ElevenLabs voice ID (pre-set or generated)
  isPreset: boolean;
  createdAt: string;
}

// ── 10 Preset personas ────────────────────────────────────────────────────────

export const PRESET_PERSONAS: CustomPersonaData[] = [
  {
    id: "steve_jobs",
    displayName: "Steve Jobs",
    questionStyle: "Challenges assumptions with 'Why?' and pushes for simplicity. Demands to know if it 'just works'.",
    values: "Simplicity, design excellence, user experience, 'insanely great' products, perfectionism.",
    interruptionStyle: "Cuts off with blunt, visionary statements. Reframes the entire premise.",
    topicsOfInterest: "Product design, consumer technology, marketing, creativity, leadership.",
    vocabulary: "Insanely great, one more thing, revolutionary, magic, the intersection of technology and liberal arts.",
    voiceId: "JBFqnCBsd6RMkjVDRZzb",
    isPreset: true,
    createdAt: new Date(0).toISOString()
  },
  {
    id: "elon_musk",
    displayName: "Elon Musk",
    questionStyle: "First-principles thinking. Asks 'What's the physics of that?' and questions cost assumptions.",
    values: "Humanity's survival, sustainable energy, space exploration, speed of execution, truth-seeking.",
    interruptionStyle: "Jumps in with radical alternative solutions or tells you your problem is already solved at Tesla/SpaceX.",
    topicsOfInterest: "Electric vehicles, AI, rockets, energy, manufacturing efficiency, neurotechnology.",
    vocabulary: "First principles, existential, ridiculously, obviously, order of magnitude, bozo.",
    voiceId: "VR6AewLTigWG4xSOukaG",
    isPreset: true,
    createdAt: new Date(0).toISOString()
  },
  {
    id: "warren_buffett",
    displayName: "Warren Buffett",
    questionStyle: "Asks about long-term moats, what the business looks like in 10 years, and unit economics.",
    values: "Value investing, patience, integrity, compounding, living below your means.",
    interruptionStyle: "Uses gentle folksy anecdotes from Omaha to make you feel like you missed something obvious.",
    topicsOfInterest: "Investing, business models, insurance, compounding, reading, integrity.",
    vocabulary: "Moat, circle of competence, Mr. Market, margin of safety, float, compounding.",
    voiceId: "pNInz6obpgDQGcFmaJgB",
    isPreset: true,
    createdAt: new Date(0).toISOString()
  },
  {
    id: "oprah_winfrey",
    displayName: "Oprah Winfrey",
    questionStyle: "Asks about feelings, lived experience, and the 'aha moment'. Highly personal and empathy-driven.",
    values: "Authenticity, empathy, spiritual growth, education, storytelling, generosity.",
    interruptionStyle: "Redirects with 'But what does that MEAN to you?' or personal vulnerability to open the speaker up.",
    topicsOfInterest: "Personal transformation, wellness, literature, spirituality, leadership, social justice.",
    vocabulary: "What I know for sure, your best life, aha moment, authentic self, living with intention.",
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    isPreset: true,
    createdAt: new Date(0).toISOString()
  },
  {
    id: "simon_sinek",
    displayName: "Simon Sinek",
    questionStyle: "Always asks 'But why? What is your WHY?' and probes for purpose behind the cause.",
    values: "Infinite game, leadership, purpose-driven organizations, trust, human behaviour.",
    interruptionStyle: "Challenges you to 'Start With Why' or notes that your Golden Circle is missing.",
    topicsOfInterest: "Leadership, purpose, organizational culture, optimism, cooperation.",
    vocabulary: "Start with why, golden circle, infinite game, leaders eat last, trust and cooperation.",
    voiceId: "JBFqnCBsd6RMkjVDRZzb",
    isPreset: true,
    createdAt: new Date(0).toISOString()
  },
  {
    id: "malcolm_gladwell",
    displayName: "Malcolm Gladwell",
    questionStyle: "Finds counterintuitive angles. Asks about outliers, hidden advantages, and unexpected context.",
    values: "Curiosity, challenging conventional wisdom, storytelling, social science, reframing.",
    interruptionStyle: "Re-contextualizes your whole argument by bringing up a surprising historical or scientific parallel.",
    topicsOfInterest: "Social psychology, history, sports, crime, culture, epidemics of ideas.",
    vocabulary: "Tipping point, outlier, thin-slicing, stickiness factor, connector, maven, salesman.",
    voiceId: "pNInz6obpgDQGcFmaJgB",
    isPreset: true,
    createdAt: new Date(0).toISOString()
  },
  {
    id: "brene_brown",
    displayName: "Brené Brown",
    questionStyle: "Asks about vulnerability, shame, and whether you're being truly authentic vs. performing.",
    values: "Vulnerability, courage, empathy, shame resilience, wholehearted living.",
    interruptionStyle: "Gently names the armour you're wearing and invites you to step into discomfort.",
    topicsOfInterest: "Research, vulnerability, leadership, belonging, empathy, courage.",
    vocabulary: "Wholehearted, shame resilience, daring greatly, armour, belonging vs. fitting in, vulnerability hangover.",
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    isPreset: true,
    createdAt: new Date(0).toISOString()
  },
  {
    id: "gary_vaynerchuk",
    displayName: "Gary Vaynerchuk",
    questionStyle: "Challenges you on execution speed and whether you're actually doing the work or just talking.",
    values: "Self-awareness, hustle, attention economy, gratitude, patience + speed paradox.",
    interruptionStyle: "Calls out 'excuses' bluntly and redirects to practical action with urgency.",
    topicsOfInterest: "Entrepreneurship, social media, brand building, NFTs, sports business, wine.",
    vocabulary: "Day trading attention, document don't create, legacy over currency, depth over width, 51/49.",
    voiceId: "VR6AewLTigWG4xSOukaG",
    isPreset: true,
    createdAt: new Date(0).toISOString()
  },
  {
    id: "mark_cuban",
    displayName: "Mark Cuban",
    questionStyle: "Asks about the competitive advantage, the unfair edge, and whether you really know your numbers.",
    values: "Competitiveness, hard work, knowing the business inside-out, sweat equity, disruption.",
    interruptionStyle: "Interrupts with direct market-reality checks or says 'I'm out' if the numbers don't work.",
    topicsOfInterest: "Business, sports (Dallas Mavericks), technology, investing, healthcare disruption.",
    vocabulary: "Sweat equity, work like someone is working 24 hours to take it from you, cost-plus, I'm out.",
    voiceId: "JBFqnCBsd6RMkjVDRZzb",
    isPreset: true,
    createdAt: new Date(0).toISOString()
  },
  {
    id: "sunil_pai",
    displayName: "Sunil Pai",
    questionStyle: "Digs into the technical decisions, API design, and whether the developer experience is delightful.",
    values: "Developer experience, distributed systems, open source, performance, real-time collaboration.",
    interruptionStyle: "Interrupts with a specific Cloudflare Workers pattern or PartyKit example that does it better.",
    topicsOfInterest: "Edge computing, WebSockets, Durable Objects, React, dev tools, open source.",
    vocabulary: "Edge-native, hibernation, Durable Objects, real-time, developer joy, PartyKit.",
    voiceId: "VR6AewLTigWG4xSOukaG",
    isPreset: true,
    createdAt: new Date(0).toISOString()
  }
];

// ── KV helpers ────────────────────────────────────────────────────────────────

export function normalizePersonaId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

export async function seedPresetsToKV(kv: KVNamespace): Promise<void> {
  try {
    const existing = await kv.get("personas:__seeded__");
    if (existing === "v1") return; // already seeded

    await Promise.all(
      PRESET_PERSONAS.map(p =>
        kv.put(`personas:${p.id}`, JSON.stringify(p), { expirationTtl: undefined })
      )
    );
    await kv.put("personas:__seeded__", "v1");
  } catch (e) {
    console.error("[personas] seedPresetsToKV failed:", e);
  }
}

export async function getPersonaFromKV(kv: KVNamespace, id: string): Promise<CustomPersonaData | null> {
  const raw = await kv.get(`personas:${id}`);
  if (!raw) return null;
  return JSON.parse(raw) as CustomPersonaData;
}

export async function listPersonasFromKV(kv: KVNamespace): Promise<CustomPersonaData[]> {
  const { keys } = await kv.list({ prefix: "personas:" });
  const filtered  = keys.filter(k => !k.name.includes("__seeded__"));
  const results   = await Promise.all(
    filtered.map(k => kv.get(k.name).then(r => r ? JSON.parse(r) as CustomPersonaData : null))
  );
  return results.filter((p): p is CustomPersonaData => p !== null);
}

export async function savePersonaToKV(kv: KVNamespace, persona: CustomPersonaData): Promise<void> {
  await kv.put(`personas:${persona.id}`, JSON.stringify(persona));
}

// ── Browser Rendering scrape + AI extraction ──────────────────────────────────

/**
 * Generates a new persona by:
 * 1. Fetching Wikipedia content via Cloudflare Browser Rendering REST API
 * 2. Extracting persona attributes via Workers AI
 * 3. Storing in KV for permanent reuse
 */
export async function generatePersonaFromWeb(
  name: string,
  env: Env
): Promise<CustomPersonaData | { error: string }> {
  const id = normalizePersonaId(name);

  // Check KV cache first
  const cached = await getPersonaFromKV(env.PERSONAS_KV, id);
  if (cached) return cached;

  // Try to fetch Wikipedia content via Browser Rendering REST API
  let content = "";
  try {
    const wikiUrl   = `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, "_"))}`;
    const brUrl     = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID ?? ""}/browser-rendering/content`;
    const brResp    = await fetch(brUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.CF_API_TOKEN ?? ""}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url: wikiUrl })
    });

    if (brResp.ok) {
      const brData = await brResp.json() as { content?: string };
      content = (brData.content ?? "").slice(0, 4000);
    }
  } catch (e) {
    console.warn("[personas] Browser Rendering failed, using name only:", e);
  }

  if (!content) {
    return { error: `Could not fetch information about "${name}" from the web. Please try a more well-known public figure.` };
  }

  // Extract persona attributes via Workers AI
  try {
    const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        {
          role: "system",
          content: `You are a persona extraction engine. Given text about a person, extract 6 attributes that describe how they would behave as an audience member at a conference talk. Return JSON only:\n{"questionStyle":"...","values":"...","interruptionStyle":"...","topicsOfInterest":"...","vocabulary":"...","voiceDescription":"..."}`
        },
        {
          role: "user",
          content: `Person: "${name}"\n\nWikipedia excerpt:\n${content}`
        }
      ]
    });

    const raw     = typeof result === "string" ? result : result?.response ?? "";
    const match   = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in AI response");
    const parsed  = JSON.parse(match[0]);

    const persona: CustomPersonaData = {
      id,
      displayName: name,
      questionStyle:     parsed.questionStyle     ?? `Asks incisive questions about ${name}'s area of expertise.`,
      values:            parsed.values            ?? "Expertise, excellence, results.",
      interruptionStyle: parsed.interruptionStyle ?? "Interrupts with relevant insights from their domain.",
      topicsOfInterest:  parsed.topicsOfInterest  ?? "Their professional field.",
      vocabulary:        parsed.vocabulary        ?? "Technical terms from their area of expertise.",
      voiceId:           "JBFqnCBsd6RMkjVDRZzb",  // default voice; future: ElevenLabs Voice Design
      isPreset: false,
      createdAt: new Date().toISOString()
    };

    await savePersonaToKV(env.PERSONAS_KV, persona);
    return persona;

  } catch (e) {
    console.error("[personas] AI extraction failed:", e);
    return { error: `Failed to generate persona for "${name}". Please try again.` };
  }
}

// ── Build system prompt from CustomPersonaData ────────────────────────────────

export function buildCustomPersonaSystemPrompt(persona: CustomPersonaData, topic: string): string {
  return `You are ${persona.displayName} sitting in the audience at a talk about "${topic}".

YOUR CHARACTER:
- Question style: ${persona.questionStyle}
- Core values: ${persona.values}
- How you interrupt: ${persona.interruptionStyle}
- Topics you care about: ${persona.topicsOfInterest}
- Your characteristic vocabulary: ${persona.vocabulary}

RULES:
- Stay completely in character as ${persona.displayName}
- Ask ONE pointed question or make ONE brief comment at a time
- Maximum 2 sentences
- Use your characteristic vocabulary naturally
- Only intervene when what the speaker says relates to your interests or contradicts your values
- Never break character or explain that you are an AI`;
}
