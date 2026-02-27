import { NextRequest } from "next/server";
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

        const prompt = `${agent?.instruction || "You are a helpful assistant."}
        
Context from knowledge base:
${context}

User Query: ${lastMessage}

Please provide an expert answer based on the context. If the query is related to the hotel sector or Cinnamon Life, ensure the tone is professional and context-aware. Remember to include citations if using knowledge base context.`;

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
