import { NextRequest } from "next/server";
export const dynamic = "force-dynamic";

import { genAI, COMMON_INSTRUCTIONS } from "@/lib/gemini";
import { getRelevantContext } from "@/lib/rag";
import { supabaseAdmin } from "@/lib/supabase";
import { sendWhatsAppMessage, verifyWebhookSignature } from "@/lib/wasender";

/**
 * WhatsApp Webhook Handler
 * Receives incoming messages from WaSender, processes them through Gemini,
 * and sends the AI response back via WhatsApp.
 */
export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.text();
        const signature = req.headers.get("x-webhook-signature");

        // Verify webhook authenticity
        if (!verifyWebhookSignature(rawBody, signature)) {
            console.error("[WhatsApp Webhook] Invalid signature");
            return new Response("Unauthorized", { status: 401 });
        }

        const payload = JSON.parse(rawBody);
        const eventType = payload.event;

        // Only process incoming received messages
        if (eventType !== "messages.received") {
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        const messageData = payload.data;

        // Extract sender and message text
        const senderPhone = messageData?.key?.remoteJid?.replace("@s.whatsapp.net", "") || "";
        const messageText = messageData?.message?.conversation
            || messageData?.message?.extendedTextMessage?.text
            || "";

        if (!senderPhone || !messageText) {
            return new Response(JSON.stringify({ ok: true, skipped: "no text" }), { status: 200 });
        }

        // Ignore messages from self (status broadcasts)
        if (messageData?.key?.fromMe) {
            return new Response(JSON.stringify({ ok: true, skipped: "own message" }), { status: 200 });
        }

        console.log(`[WhatsApp] Incoming from +${senderPhone}: "${messageText.substring(0, 100)}"`);

        // Use the default "privacy" agent for WhatsApp conversations
        const agentSlug = "privacy";

        // Fetch agent instructions
        const { data: agent } = await supabaseAdmin
            .from("agents")
            .select("name, instruction")
            .eq("slug", agentSlug)
            .single();

        // Get RAG context
        const context = await getRelevantContext(messageText, agentSlug);

        // Build the prompt (same pipeline as /api/chat)
        const dynamicModel = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            systemInstruction: `${agent?.instruction || "You are a helpful assistant."}\n${COMMON_INSTRUCTIONS}\n\nIMPORTANT: You are responding via WhatsApp. Keep responses concise and well-formatted for mobile reading. Use short paragraphs. Avoid complex markdown tables. Use bullet points and bold text sparingly.`,
        });

        const prompt = `=== KNOWLEDGE BASE CONTEXT ===
${context || "No specific documents found for this query."}
==============================

User message: ${messageText}

INSTRUCTION: 
Provide a helpful, concise response suitable for WhatsApp. Keep it brief but thorough. 
If information is in the context, prioritize it and mention the source.`;

        // Generate response (non-streaming for WhatsApp)
        const result = await dynamicModel.generateContent(prompt);
        const aiResponse = result.response.text();

        // Send the response back via WhatsApp
        await sendWhatsAppMessage(senderPhone, aiResponse);

        console.log(`[WhatsApp] Replied to +${senderPhone} (${aiResponse.length} chars)`);

        return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error("[WhatsApp Webhook] Error:", error);
        // Always return 200 to WaSender to prevent retries
        return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }
}

/**
 * GET handler for webhook verification (if WaSender pings the URL).
 */
export async function GET() {
    return new Response(JSON.stringify({ status: "WhatsApp webhook is active" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}
