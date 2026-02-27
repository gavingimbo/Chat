import { NextRequest } from "next/server";
export const dynamic = "force-dynamic";
import { model } from "@/lib/gemini";
import { getRelevantContext } from "@/lib/rag";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
    try {
        const { messages, agentId } = await req.json();
        const lastMessage = messages[messages.length - 1].content;
        const agentSlug = agentId || "privacy";

        // Fetch agent specific instructions from Supabase
        const { data: agent, error: agentError } = await supabaseAdmin
            .from("agents")
            .select("name, instruction")
            .eq("slug", agentSlug)
            .single();

        if (agentError) {
            console.error("Error fetching agent:", agentError);
        }

        // Get context from documents using vector search
        const context = await getRelevantContext(lastMessage, agentSlug);

        const formattedHistory = messages.map((m: any) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n");

        const prompt = `${agent?.instruction || "You are a helpful assistant."}
        
=== KNOWLEDGE BASE CONTEXT ===
${context || "No specific documents found for this query. Use your existing knowledge while maintaining professional tone."}
==============================

CONVERSATION HISTORY:
${formattedHistory}

INSTRUCTION: 
Provide a detailed, expert response grounded in the provided Knowledge Base Context. 
If the information is in the context, prioritize it and mention the source (e.g. "[Source: Document name]"). 
Always maintain the persona and tone defined in your system instructions. 
If the query is outside the scope of Cinnamon Intelligence, answer politely as a brand representative.`;

        const result = await model.generateContentStream(prompt);

        const encoder = new TextEncoder();
        const readableStream = new ReadableStream({
            async start(controller) {
                for await (const chunk of result.stream) {
                    const text = chunk.text();
                    if (text) {
                        controller.enqueue(encoder.encode(text));
                    }
                }
                controller.close();
            },
        });

        return new Response(readableStream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
            },
        });
    } catch (error: any) {
        console.error("Chat API error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
