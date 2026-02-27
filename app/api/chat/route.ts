import { NextRequest } from "next/server";
export const dynamic = "force-dynamic";
import { genAI, COMMON_INSTRUCTIONS } from "@/lib/gemini";
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
        console.log(`[RAG Debug] Agent: ${agentSlug}, Query: "${lastMessage.substring(0, 80)}", Context length: ${context.length}, Preview: "${context.substring(0, 200)}"`);

        const formattedHistory = messages.map((m: any) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n");

        // Initialize model with dynamic system instructions for this specific agent
        const dynamicModel = genAI.getGenerativeModel({
            model: "models/gemini-flash-latest",
            systemInstruction: `${agent?.instruction || "You are a helpful assistant."}\n${COMMON_INSTRUCTIONS}`,
        });

        const prompt = `=== KNOWLEDGE BASE CONTEXT ===
${context || "No specific documents found for this query. Use your existing knowledge while maintaining professional tone."}
==============================

CONVERSATION HISTORY:
${formattedHistory}

INSTRUCTION: 
Provide a detailed, expert response. 
STRICT GROUNDING: You MUST strictly extract specific data (like IP addresses, login URLs, hostnames such as CLFCB-WSD01, port numbers, or system IDs) from the provided Knowledge Base Context. 

CRITICAL: If the user asks for a specific device IP or hostname (e.g. "IP of CLFCB-WSD01"), and a match exists in the context, YOU MUST PROVIDE IT. Do NOT say it is not defined if it appears anywhere in the context.

If information is in the context, prioritize it and mention the source (e.g. "[Source: Document name]"). 
Always maintain the persona and tone defined in your system instructions. 
If the query is outside the scope of Cinnamon Intelligence, answer politely as a brand representative.`;

        const result = await dynamicModel.generateContentStream(prompt);

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
