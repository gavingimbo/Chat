import { NextRequest } from "next/server";
import { model } from "@/lib/gemini";
import { getRelevantContext } from "@/lib/rag";

export async function POST(req: NextRequest) {
    try {
        const { messages } = await req.json();
        const lastMessage = messages[messages.length - 1].content;

        // Get context from documents
        const context = await getRelevantContext(lastMessage);

        const prompt = `Context from GDPR and PDPA documents:
${context}

User Query: ${lastMessage}

Please provide an expert answer based on the context and hotel sector relevance. Remember to include citations.`;

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
