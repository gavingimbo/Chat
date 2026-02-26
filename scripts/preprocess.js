const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

const OUTPUT_DIR = path.join(__dirname, '../lib/data');
const CHUNKS_FILE = path.join(OUTPUT_DIR, 'chunks.json');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function extractTextFromPdf(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    // Specify options to minimize memory usage
    const options = {
        // pagerender: (pageData) => { return ""; } // If we only need text, but pdf-parse extracts it by default
    };
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
            id: `${source}-${start}`,
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
    const batchSize = 25; // Even smaller batch size
    const processedChunks = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(chunks.length / batchSize)}`);

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
            await new Promise(resolve => setTimeout(resolve, 500)); // Longer delay
        } catch (error) {
            console.error(`Error embedding batch ${i}:`, error.message);
            batch.forEach(chunk => processedChunks.push(chunk));
        }
    }
    return processedChunks;
}

async function main() {
    const allChunks = [];
    const files = [
        // Process smaller files first to confirm logic
        { path: path.join(__dirname, '../Documents/PDPA/22-2025_E_251104_201549.pdf'), label: 'PDPA 2025' },
        { path: path.join(__dirname, '../Documents/PDPA/Data Protection Act SL - English (2).pdf'), label: 'PDPA SL' },
        { path: path.join(__dirname, '../Documents/GDPR/CELEX%3A32016R0679%3AEN%3ATXT.pdf'), label: 'GDPR' }
    ];

    for (const file of files) {
        console.log(`Step 1: Reading ${file.label}...`);
        try {
            if (!fs.existsSync(file.path)) {
                console.warn(`File not found: ${file.path}`);
                continue;
            }
            const text = await extractTextFromPdf(file.path);
            console.log(`Step 2: Chunking ${file.label}...`);
            const chunks = chunkText(text, file.label);
            console.log(`Step 3: Embedding ${chunks.length} chunks from ${file.label}...`);

            const chunksWithEmbeddings = await generateEmbeddings(chunks);
            allChunks.push(...chunksWithEmbeddings);
            console.log(`Completed ${file.label}`);
        } catch (err) {
            console.error(`Failed to process ${file.label}:`, err.message);
        }
    }

    process.stdout.write(`Step 4: Saving ${allChunks.length} chunks...`);
    fs.writeFileSync(CHUNKS_FILE, JSON.stringify(allChunks, null, 2));
    console.log(`\nSuccessfully saved to ${CHUNKS_FILE}`);
}

main().catch(console.error);
