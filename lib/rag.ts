import { generateEmbedding } from "./gemini";
import { supabaseAdmin } from "./supabase";

export async function getRelevantContext(query: string, agentSlug: string, limit: number = 5): Promise<string> {
    try {
        // Generate embedding for the query using the 768d model
        const queryEmbedding = await generateEmbedding(query);

        // Call Supabase function for vector match
        const { data: matches, error } = await supabaseAdmin.rpc("match_kb_entries", {
            query_embedding: queryEmbedding,
            match_threshold: 0.1, // Even lower threshold to catch specific technical identifiers
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
