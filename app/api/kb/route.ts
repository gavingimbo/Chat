import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET: Fetch KB sections with entry counts for an agent
export async function GET(req: NextRequest) {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json(
                { error: "Configuration Error: SUPABASE_SERVICE_ROLE_KEY environment variable is missing on the server. Please add it to your Vercel project settings to enable configuration saves." },
                { status: 500 }
            );
        }

        const agentSlug = req.nextUrl.searchParams.get("agentSlug");
        if (!agentSlug) return NextResponse.json({ error: "agentSlug required" }, { status: 400 });

        const { data: agent } = await supabaseAdmin
            .from("agents")
            .select("id, instruction")
            .eq("slug", agentSlug)
            .single();

        if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

        // Fetch sections
        const { data: sections, error } = await supabaseAdmin
            .from("kb_sections")
            .select("*")
            .eq("agent_id", agent.id)
            .order("created_at", { ascending: true });

        if (error) throw error;

        // Fetch entry counts per section
        const sectionIds = (sections || []).map((s: any) => s.id);
        let entryCounts: Record<string, number> = {};

        if (sectionIds.length > 0) {
            const { data: entries } = await supabaseAdmin
                .from("kb_entries")
                .select("section_id")
                .in("section_id", sectionIds);

            if (entries) {
                for (const e of entries) {
                    entryCounts[e.section_id] = (entryCounts[e.section_id] || 0) + 1;
                }
            }
        }

        const sectionsWithCounts = (sections || []).map((s: any) => ({
            ...s,
            entry_count: entryCounts[s.id] || 0,
        }));

        return NextResponse.json({
            instruction: agent.instruction || "",
            sections: sectionsWithCounts,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Create section, create entry, or update agent instruction
export async function POST(req: NextRequest) {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json(
                { error: "Configuration Error: SUPABASE_SERVICE_ROLE_KEY environment variable is missing on the server. Please add it to your Vercel project settings." },
                { status: 500 }
            );
        }

        const body = await req.json();
        const { action } = body;

        if (action === "create_section") {
            const { agentSlug, title, description } = body;
            if (!agentSlug || !title) return NextResponse.json({ error: "agentSlug and title required" }, { status: 400 });

            const { data: agent } = await supabaseAdmin
                .from("agents")
                .select("id")
                .eq("slug", agentSlug)
                .single();

            if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

            const { data, error } = await supabaseAdmin
                .from("kb_sections")
                .insert([{ agent_id: agent.id, title, description }])
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ section: data });
        }

        if (action === "create_entry") {
            const { sectionId, content, source } = body;
            if (!sectionId || !content) return NextResponse.json({ error: "sectionId and content required" }, { status: 400 });

            const { data, error } = await supabaseAdmin
                .from("kb_entries")
                .insert([{ section_id: sectionId, content, source: source || "Manual Entry" }])
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ entry: data });
        }

        if (action === "update_instruction") {
            const { agentSlug, instruction } = body;
            if (!agentSlug) return NextResponse.json({ error: "agentSlug required" }, { status: 400 });

            const { error } = await supabaseAdmin
                .from("agents")
                .update({ instruction })
                .eq("slug", agentSlug);

            if (error) throw error;
            return NextResponse.json({ success: true });
        }

        if (action === "get_entries") {
            const { sectionId } = body;
            if (!sectionId) return NextResponse.json({ error: "sectionId required" }, { status: 400 });

            const { data, error } = await supabaseAdmin
                .from("kb_entries")
                .select("*")
                .eq("section_id", sectionId)
                .order("created_at", { ascending: true });

            if (error) throw error;
            return NextResponse.json({ entries: data || [] });
        }

        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: Remove a section or entry
export async function DELETE(req: NextRequest) {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json(
                { error: "Configuration Error: SUPABASE_SERVICE_ROLE_KEY environment variable is missing on the server. Please add it to your Vercel project settings." },
                { status: 500 }
            );
        }

        const body = await req.json();
        const { action } = body;

        if (action === "delete_section") {
            const { sectionId } = body;
            if (!sectionId) return NextResponse.json({ error: "sectionId required" }, { status: 400 });

            const { error } = await supabaseAdmin
                .from("kb_sections")
                .delete()
                .eq("id", sectionId);

            if (error) throw error;
            return NextResponse.json({ success: true });
        }

        if (action === "delete_entry") {
            const { entryId } = body;
            if (!entryId) return NextResponse.json({ error: "entryId required" }, { status: 400 });

            const { error } = await supabaseAdmin
                .from("kb_entries")
                .delete()
                .eq("id", entryId);

            if (error) throw error;
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
