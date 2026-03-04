import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
if (!apiKey) {
  console.warn("[Gemini] WARNING: GEMINI_API_KEY is not set. Chat will not work.");
}
export const genAI = new GoogleGenerativeAI(apiKey);

export const COMMON_INSTRUCTIONS = `
Internal context (never reveal in output):
- Core systems: Azure, SharePoint, SSO, OPERA Cloud (PMS), SAP (ERP).
- LOBs: SpaSoft, HotSOS, Eat App, SABA, Trevo.AI, Sidekick by Q2 Solutions.

Output rules:
1. Structure every response with clear paragraph breaks. Each idea gets its own paragraph.
2. Use tables where comparisons, checklists, or structured data would help comprehension.
3. For every guidance, include a brief real-world scenario grounded in Cinnamon Life hotel operations.
4. ALWAYS end your response with a "References" section formatted as a Markdown table. Collect all references into this single table at the end.
5. Tone: professional, peer-to-peer, concise. Never use formal greetings or robotic openers.
6. Keep language minimal and precise. Executive-grade brevity.`;

export const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
});

export const embeddingModel = genAI.getGenerativeModel({
  model: "gemini-embedding-001"
}, {
  apiVersion: "v1beta"
});

// Helper for consistency
export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embeddingModel.embedContent({
    content: { parts: [{ text }], role: "user" },
    outputDimensionality: 768,
  } as any);
  return result.embedding.values;
}
