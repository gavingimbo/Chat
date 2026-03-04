import crypto from "crypto";

const WASENDER_API_URL = "https://api.wasenderapi.com/api/send-message";

/**
 * Send a WhatsApp text message via WaSender API.
 */
export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
    const apiKey = process.env.WASENDER_API_KEY;
    if (!apiKey) throw new Error("WASENDER_API_KEY is not configured");

    const response = await fetch(WASENDER_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ to, text }),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error("[WaSender] Failed to send message:", error);
        throw new Error(`WaSender send failed: ${response.status}`);
    }
}

/**
 * Verify the webhook signature from WaSender.
 * Returns true if the signature is valid or if no secret is configured (development mode).
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
    const secret = process.env.WASENDER_WEBHOOK_SECRET;

    // If no secret configured, skip verification (dev mode)
    if (!secret) return true;
    if (!signature) return false;

    const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
}
