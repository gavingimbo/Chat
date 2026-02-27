import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/gemini";

// We force dynamic so it doesn't try to statically generate
export const dynamic = "force-dynamic";

// Increase max duration for Vercel Hobby tier (max is 60s, but we'll try to keep it under)
export const maxDuration = 60;

// Simple text chunker (~500 words per chunk, keeping paragraphs whole if possible)
function chunkText(text: string, maxWords: number = 500): string[] {
    const paragraphs = text.split(/\n\n+/);
    const chunks: string[] = [];
    let currentChunk = "";

    for (const p of paragraphs) {
        const wordCount = (currentChunk + " " + p).split(/\s+/).length;
        if (wordCount > maxWords && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = p;
        } else {
            currentChunk += (currentChunk ? "\n\n" : "") + p;
        }
    }

    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

export async function POST(req: NextRequest) {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json(
                { error: "Configuration Error: SUPABASE_SERVICE_ROLE_KEY environment variable is missing on the server. Please add it to your Vercel project settings." },
                { status: 500 }
            );
        }

        const formData = await req.formData();
        const file = formData.get("file") as File;
        const agentSlug = formData.get("agentSlug") as string;

        if (!file || !agentSlug) {
            return NextResponse.json({ error: "File and agentSlug are required" }, { status: 400 });
        }

        // Validate agent exists
        const { data: agent } = await supabaseAdmin
            .from("agents")
            .select("id")
            .eq("slug", agentSlug)
            .single();

        if (!agent) {
            return NextResponse.json({ error: "Agent not found" }, { status: 404 });
        }

        // Extract Text from File
        let textContent = "";
        const fileBuffer = Buffer.from(await file.arrayBuffer());

        if (file.type === "application/pdf") {
            try {
                // Dynamically import pdf-parse to avoid build-time file system issues
                const pdfParse = (await import("pdf-parse")).default;
                const pdfData = await pdfParse(fileBuffer);
                textContent = pdfData.text;
            } catch (err: any) {
                return NextResponse.json({ error: `Failed to parse PDF: ${err.message}` }, { status: 400 });
            }
        } else if (
            file.type === "text/plain" ||
            file.name.endsWith(".md") ||
            file.name.endsWith(".txt") ||
            file.type === "text/markdown"
        ) {
            textContent = fileBuffer.toString("utf-8");
        } else {
            return NextResponse.json({ error: "Unsupported file format. Only PDF, TXT, and MD are supported." }, { status: 400 });
        }

        if (!textContent.trim()) {
            return NextResponse.json({ error: "No readable text found in the file." }, { status: 400 });
        }

        // Create Section (Title = Filename)
        const { data: section, error: sectionError } = await supabaseAdmin
            .from("kb_sections")
            .insert([{ agent_id: agent.id, title: file.name }])
            .select()
            .single();

        if (sectionError) throw sectionError;

        // Chunking
        const chunks = chunkText(textContent);
        let entriesInserted = 0;
        const errors = [];

        // Process chunks in batches to avoid rate limits
        for (let i = 0; i < chunks.length; i++) {
            const chunkContent = chunks[i];

            // Skip tiny useless chunks
            if (chunkContent.trim().length < 20) continue;

            try {
                // Generate Embedding
                const queryEmbedding = await generateEmbedding(chunkContent);

                // Insert into DB
                const { error: insertError } = await supabaseAdmin
                    .from("kb_entries")
                    .insert([{
                        section_id: section.id,
                        content: chunkContent,
                        source: `${file.name} (Chunk ${i + 1})`,
                        embedding: queryEmbedding
                    }]);

                if (insertError) throw insertError;
                entriesInserted++;
            } catch (err: any) {
                console.error(`Failed to process chunk ${i}:`, err);
                errors.push(`Chunk ${i}: ${err.message || "Unknown error"}`);
            }
        }

        return NextResponse.json({
            success: true,
            sectionId: section.id,
            chunksFound: chunks.length,
            entriesInserted,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error: any) {
        console.error("Upload handler error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
