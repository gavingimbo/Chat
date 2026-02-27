import { embeddingModel } from "./gemini";
import { supabaseAdmin } from "./supabase";

export async function getRelevantContext(query: string, agentSlug: string, limit: number = 5): Promise<string> {
    try {
        // Generate embedding for the query
        const result = await embeddingModel.embedContent(query);
        const queryEmbedding = result.embedding.values;

        // Call Supabase function for vector match
        const { data: matches, error } = await supabaseAdmin.rpc("match_kb_entries", {
            query_embedding: queryEmbedding,
            match_threshold: 0.3,
            match_count: limit,
            p_agent_slug: agentSlug
        });

        if (error) throw error;

        if (!matches || matches.length === 0) return "";

        // Format context for the prompt
        return matches
            .map((m: any) => `[Source: ${m.source}]\n${m.content}`)
            .join("\n\n---\n\n");
    } catch (error) {
        console.error("Error retrieving context from Supabase:", error);
        return "";
    }
}
