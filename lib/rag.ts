import { embeddingModel } from "./gemini";
import chunksData from "./data/chunks.json";

interface Chunk {
    id: string;
    content: string;
    source: string;
    embedding?: number[];
}

const chunks: Chunk[] = chunksData as Chunk[];

function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function getRelevantContext(query: string, limit: number = 5): Promise<string> {
    try {
        // Generate embedding for the query
        // Use gemini-embedding-001 since it worked in the script
        const result = await embeddingModel.embedContent(query);
        const queryEmbedding = result.embedding.values;

        // Filter chunks that have embeddings
        const chunksWithEmbeddings = chunks.filter(c => c.embedding && c.embedding.length > 0);

        // Calculate similarities
        const scoredChunks = chunksWithEmbeddings.map(chunk => ({
            ...chunk,
            similarity: cosineSimilarity(queryEmbedding, chunk.embedding!)
        }));

        // Sort and take top results
        const topChunks = scoredChunks
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);

        // Format context for the prompt
        return topChunks.map(c => `[Source: ${c.source}]\n${c.content}`).join("\n\n---\n\n");
    } catch (error) {
        console.error("Error retrieving context:", error);
        return "";
    }
}
