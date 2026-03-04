import { NextRequest } from "next/server";
export const dynamic = "force-dynamic";

import { sendWhatsAppMessage } from "@/lib/wasender";

/**
 * Internal API to send a WhatsApp message.
 * POST body: { to: string, text: string }
 */
export async function POST(req: NextRequest) {
    try {
        const { to, text } = await req.json();

        if (!to || !text) {
            return new Response(
                JSON.stringify({ error: "Missing 'to' or 'text' field" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        await sendWhatsAppMessage(to, text);

        return new Response(
            JSON.stringify({ ok: true, message: "Sent" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error: any) {
        console.error("[WhatsApp Send] Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
