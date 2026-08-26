import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import type { PrismaClient } from '@prisma/client';

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return extractorPromise;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

export function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i]! * b[i]!;
  }
  return sum;
}

export async function fetchEmbeddings(
  prisma: PrismaClient,
  tagIds: string[],
): Promise<Map<string, number[]>> {
  if (tagIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<Array<{ id: string; embedding: number[] }>>`
    SELECT id, embedding FROM tags WHERE id = ANY(${tagIds}::uuid[]) AND embedding IS NOT NULL
  `;
  const map = new Map<string, number[]>();
  for (const row of rows) {
    map.set(row.id, row.embedding);
  }
  return map;
}
