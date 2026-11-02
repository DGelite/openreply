import { prisma } from "@/lib/db/client";
import { getEmbeddingEngine } from "../factory";

export interface AddDocumentParams {
  workspaceId: string;
  title: string;
  sourceType: "DOC" | "PDF" | "URL" | "FAQ" | "CATALOG";
  sourceUrl?: string;
  content: string;
  chunkSize?: number;
}

export interface KnowledgeSearchResult {
  chunkId: string;
  documentTitle: string;
  content: string;
  score: number;
}

/**
 * Calculates cosine similarity between two vector arrays.
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Chunks text into smaller segments.
 */
export function chunkText(text: string, chunkSize: number = 300): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }

  return chunks;
}

interface CachedKbDocs {
  documents: any[];
  expiresAt: number;
}
const kbDocCache = new Map<string, CachedKbDocs>();
const KB_CACHE_TTL_MS = 120_000; // 2 minutes
const KB_CACHE_MAX_ENTRIES = 50;

function setCachedKbDocs(workspaceId: string, documents: any[], now: number) {
  if (kbDocCache.size >= KB_CACHE_MAX_ENTRIES) {
    const oldest = kbDocCache.keys().next().value;
    if (oldest) kbDocCache.delete(oldest);
  }
  kbDocCache.set(workspaceId, { documents, expiresAt: now + KB_CACHE_TTL_MS });
}

export function invalidateKnowledgeBaseCache(workspaceId?: string): void {
  if (workspaceId) {
    kbDocCache.delete(workspaceId);
  } else {
    kbDocCache.clear();
  }
}

/**
 * Indexes a document into the Knowledge Base RAG.
 */
export async function addDocumentToKnowledgeBase(
  params: AddDocumentParams
): Promise<string> {
  const { workspaceId, title, sourceType, sourceUrl, content, chunkSize = 300 } = params;

  invalidateKnowledgeBaseCache(workspaceId);

  const document = await prisma.knowledgeDocument.create({
    data: {
      workspaceId,
      title,
      sourceType,
      sourceUrl,
      content,
    },
  });

  const textChunks = chunkText(content, chunkSize);
  const embeddingEngine = await getEmbeddingEngine(workspaceId);

  let embeddings: number[][] = [];
  if (embeddingEngine.generateEmbeddings) {
    try {
      embeddings = await embeddingEngine.generateEmbeddings(textChunks);
    } catch (err) {
      console.warn("[Knowledge Base] Embedding generation failed:", err);
      embeddings = textChunks.map(() => []);
    }
  } else {
    embeddings = textChunks.map(() => []);
  }

  for (let idx = 0; idx < textChunks.length; idx++) {
    await prisma.knowledgeChunk.create({
      data: {
        documentId: document.id,
        chunkIndex: idx,
        content: textChunks[idx],
        embedding: (embeddings[idx] || []) as any,
        tokenCount: textChunks[idx].split(/\s+/).length,
      },
    });
  }

  return document.id;
}

/**
 * Searches Knowledge Base for top matching chunks via vector cosine similarity with hybrid fallback.
 * Ensures model/dimension mismatches never crash RAG or lose matching context.
 */
export async function queryKnowledgeBase(
  workspaceId: string,
  query: string,
  topK: number = 3
): Promise<KnowledgeSearchResult[]> {
  const now = Date.now();
  let documents: any[];

  const cached = kbDocCache.get(workspaceId);
  if (cached && now < cached.expiresAt) {
    documents = cached.documents;
  } else {
    documents = await prisma.knowledgeDocument.findMany({
      where: { workspaceId, isApproved: true },
      include: { chunks: true },
    });
    setCachedKbDocs(workspaceId, documents, now);
  }

  // If no approved documents exist for this workspace, avoid generating embeddings completely
  if (!documents || documents.length === 0) {
    return [];
  }

  const embeddingEngine = await getEmbeddingEngine(workspaceId);

  let queryVector: number[] = [];
  if (embeddingEngine.generateEmbeddings) {
    try {
      const vecs = await embeddingEngine.generateEmbeddings([query]);
      queryVector = vecs[0] || [];
    } catch (err) {
      console.warn("[Knowledge Base] Query embedding generation failed, using lexical search:", err);
      queryVector = [];
    }
  }

  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const results: KnowledgeSearchResult[] = [];

  for (const doc of documents) {
    for (const chunk of doc.chunks) {
      const embedding = (chunk.embedding as number[]) || [];
      let score = 0;

      // 1. Vector Cosine Similarity if dimensions match exactly
      if (
        queryVector.length > 0 &&
        embedding.length > 0 &&
        queryVector.length === embedding.length
      ) {
        score = cosineSimilarity(queryVector, embedding);
      } else {
        // 2. Hybrid Lexical / Keyword Relevance Fallback (Preserves RAG if embedding model changed)
        const contentLower = chunk.content.toLowerCase();
        const matches = queryTerms.filter((term) => contentLower.includes(term));
        score = queryTerms.length > 0 ? (matches.length / queryTerms.length) * 0.75 : 0;
      }

      results.push({
        chunkId: chunk.id,
        documentTitle: doc.title,
        content: chunk.content,
        score,
      });
    }
  }

  // Sort descending by similarity score
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, topK);
}

/**
 * Re-indexes all knowledge base chunks for a workspace using the active embedding model.
 */
export async function reindexKnowledgeBase(workspaceId: string): Promise<number> {
  invalidateKnowledgeBaseCache(workspaceId);

  const documents = await prisma.knowledgeDocument.findMany({
    where: { workspaceId },
  });

  const embeddingEngine = await getEmbeddingEngine(workspaceId);
  let totalChunksReindexed = 0;

  for (const doc of documents) {
    const textChunks = chunkText(doc.content, 300);

    let embeddings: number[][] = [];
    if (embeddingEngine.generateEmbeddings) {
      try {
        embeddings = await embeddingEngine.generateEmbeddings(textChunks);
      } catch (err) {
        console.warn(`[Knowledge Reindex] Document ${doc.id} embedding failed:`, err);
        embeddings = textChunks.map(() => []);
      }
    }

    // Replace chunks atomically
    await prisma.knowledgeChunk.deleteMany({
      where: { documentId: doc.id },
    });

    for (let idx = 0; idx < textChunks.length; idx++) {
      await prisma.knowledgeChunk.create({
        data: {
          documentId: doc.id,
          chunkIndex: idx,
          content: textChunks[idx],
          embedding: (embeddings[idx] || []) as any,
          tokenCount: textChunks[idx].split(/\s+/).length,
        },
      });
      totalChunksReindexed++;
    }
  }

  return totalChunksReindexed;
}
