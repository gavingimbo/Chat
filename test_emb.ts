import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function run() {
    try {
        console.log("Testing text-embedding-004 (no version specified)");
        const model1 = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const res1 = await model1.embedContent("Hello world");
        console.log("Success with text-embedding-004:", res1.embedding?.values?.length);
    } catch (e: any) {
        console.error("Fail 1:", e.message);
    }

    try {
        console.log("\nTesting models/text-embedding-004");
        const model2 = genAI.getGenerativeModel({ model: "models/text-embedding-004" });
        const res2 = await model2.embedContent("Hello world");
        console.log("Success with models/text-embedding-004:", res2.embedding?.values?.length);
    } catch (e: any) {
        console.error("Fail 2:", e.message);
    }

    try {
        console.log("\nTesting embedding-001");
        const model3 = genAI.getGenerativeModel({ model: "embedding-001" });
        const res3 = await model3.embedContent("Hello world");
        console.log("Success with embedding-001:", res3.embedding?.values?.length);
    } catch (e: any) {
        console.error("Fail 3:", e.message);
    }
}

run();
