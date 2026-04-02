import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { Buffer } from "node:buffer";

/** Create an ElevenLabs SDK client. Pass the API key from env — don't hardcode it. */
export function createClient(apiKey: string): ElevenLabsClient {
  return new ElevenLabsClient({ apiKey });
}

/** Collect a ReadableStream (from ElevenLabs TTS/SFX/Music) into a base64 data URI. */
export async function streamToDataUri(
  stream: any,
  mimeType = "audio/mpeg"
): Promise<string> {
  const chunks: Buffer[] = [];
  
  // Support for Web API ReadableStream in Cloudflare Workers
  if (stream.getReader) {
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(Buffer.from(value));
    }
  } else {
    // Fallback for Node.js async iterables
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
  }
  
  const base64 = Buffer.concat(chunks).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}
