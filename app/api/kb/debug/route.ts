import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/gemini";

export const dynamic = "force-dynamic";

/**
 * Debug endpoint to inspect KB entries and fix NULL embeddings.
 * GET /api/kb/debug?agentSlug=simphony  → list entries with embedding status
 * POST /api/kb/debug { action: "reembed_all", agentSlug: "simphony" } → regenerate all NULL embeddings
 */
export async function GET(req: NextRequest) {
    const agentSlug = req.nextUrl.searchParams.get("agentSlug") || "simphony";

    // Get all entries for this agent, showing whether they have embeddings
    const { data, error } = await supabaseAdmin
        .from("kb_entries")
        .select(`
            id,
            content,
            source,
            embedding,
            section_id,
            kb_sections!inner (
                agent_id,
                title,
                agents!inner (
                    slug
                )
            )
        `)
        .eq("kb_sections.agents.slug", agentSlug);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const entries = (data || []).map((e: any) => ({
        id: e.id,
        content: e.content?.substring(0, 200) + (e.content?.length > 200 ? "..." : ""),
        source: e.source,
        hasEmbedding: e.embedding !== null && e.embedding !== undefined,
        sectionTitle: e.kb_sections?.title,
    }));

    const nullCount = entries.filter((e: any) => !e.hasEmbedding).length;

    return NextResponse.json({
        agentSlug,
        totalEntries: entries.length,
        withEmbedding: entries.length - nullCount,
        withoutEmbedding: nullCount,
        entries,
    });
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { action, agentSlug } = body;

    if (action === "reembed_all") {
        // Find all entries with NULL embeddings for this agent
        const { data: entries, error } = await supabaseAdmin
            .from("kb_entries")
            .select(`
                id,
                content,
                kb_sections!inner (
                    agents!inner (
                        slug
                    )
                )
            `)
            .eq("kb_sections.agents.slug", agentSlug || "simphony")
            .is("embedding", null);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!entries || entries.length === 0) {
            return NextResponse.json({ message: "No entries with NULL embeddings found.", fixed: 0 });
        }

        let fixed = 0;
        const errors: string[] = [];

        for (const entry of entries) {
            try {
                const embedding = await generateEmbedding(entry.content);
                const { error: updateError } = await supabaseAdmin
                    .from("kb_entries")
                    .update({ embedding })
                    .eq("id", entry.id);

                if (updateError) throw updateError;
                fixed++;
            } catch (err: any) {
                errors.push(`Entry ${entry.id}: ${err.message}`);
            }
        }

        return NextResponse.json({
            message: `Re-embedded ${fixed}/${entries.length} entries.`,
            fixed,
            total: entries.length,
            errors: errors.length > 0 ? errors : undefined,
        });
    }

    // Test RAG retrieval directly
    if (action === "test_rag") {
        const { query } = body;
        const { getRelevantContext } = await import("@/lib/rag");
        const context = await getRelevantContext(query, agentSlug || "simphony");
        return NextResponse.json({
            query,
            agentSlug: agentSlug || "simphony",
            contextLength: context.length,
            context: context || "(empty - no matches found)",
        });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
