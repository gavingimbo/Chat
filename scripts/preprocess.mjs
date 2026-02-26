import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

const OUTPUT_DIR = './lib/data';
const CHUNKS_FILE = path.join(OUTPUT_DIR, 'chunks.json');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function extractTextFromPdf(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
}

function chunkText(text, source, maxLength = 1000, overlap = 200) {
    const chunks = [];
    let start = 0;
    const cleanText = text.replace(/\s+/g, ' ').trim();

    while (start < cleanText.length) {
        const end = Math.min(start + maxLength, cleanText.length);
        let chunk = cleanText.substring(start, end);

        if (end < cleanText.length) {
            const lastSpace = chunk.lastIndexOf(' ');
            if (lastSpace > maxLength * 0.8) {
                chunk = chunk.substring(0, lastSpace);
            }
        }

        chunks.push({
            id: crypto.randomUUID(),
            content: chunk,
            source: source,
            startChar: start,
            endChar: start + chunk.length
        });

        start += chunk.length - overlap;
        if (start >= cleanText.length) break;
    }
    return chunks;
}

async function generateEmbeddings(chunks) {
    console.log(`Generating embeddings for ${chunks.length} chunks...`);
    const batchSize = 50; // Smaller batch size to avoid issues
    const processedChunks = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);

        try {
            const result = await embeddingModel.batchEmbedContents({
                requests: batch.map(chunk => ({
                    content: { role: 'user', parts: [{ text: chunk.content }] }
                }))
            });

            result.embeddings.forEach((emb, index) => {
                processedChunks.push({
                    ...batch[index],
                    embedding: emb.values
                });
            });
            console.log(`Processed ${processedChunks.length}/${chunks.length} chunks`);
            // Short delay to avoid rate limits or overwhelming the event loop
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            console.error(`Error embedding batch ${i}:`, error.message);
            batch.forEach(chunk => processedChunks.push(chunk));
        }
    }
    return processedChunks;
}

async function main() {
    let allProcessedChunks = [];
    const files = [
        { path: './Documents/GDPR/CELEX%3A32016R0679%3AEN%3ATXT.pdf', label: 'GDPR' },
        { path: './Documents/PDPA/22-2025_E_251104_201549.pdf', label: 'PDPA 2025' },
        { path: './Documents/PDPA/Data Protection Act SL - English (2).pdf', label: 'PDPA SL' }
    ];

    for (const file of files) {
        console.log(`Processing ${file.label}...`);
        try {
            if (!fs.existsSync(file.path)) {
                console.warn(`File not found: ${file.path}`);
                continue;
            }
            const text = await extractTextFromPdf(file.path);
            const chunks = chunkText(text, file.label);
            console.log(`Extracted ${chunks.length} chunks from ${file.label}`);

            const chunksWithEmbeddings = await generateEmbeddings(chunks);
            allProcessedChunks.push(...chunksWithEmbeddings);

            // Clear large text data from memory
            // (Manual GC not possible without flag, but scope and nulling help)
        } catch (err) {
            console.error(`Failed to process ${file.label}:`, err.message);
        }
    }

    fs.writeFileSync(CHUNKS_FILE, JSON.stringify(allProcessedChunks, null, 2));
    console.log(`Successfully saved ${allProcessedChunks.length} chunks to ${CHUNKS_FILE}`);
}

main().catch(console.error);
