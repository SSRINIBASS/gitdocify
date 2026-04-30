/**
 * Gitdocify — Local AI Client
 * 
 * Uses Transformers.js to run embeddings locally in the Node.js process.
 * Model: Xenova/all-MiniLM-L6-v2 (384 dimensions)
 */

import { pipeline, env } from '@xenova/transformers';

// Configure transformers.js to run entirely locally, downloading models to cache.
env.allowRemoteModels = true;
env.localModelPath = './models';

// Singleton instance to keep model loaded in memory across requests
let embeddingPipeline: any = null;

async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    // We use all-MiniLM-L6-v2 because it's tiny (22MB), fast, and outputs 384 dimensions.
    embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embeddingPipeline;
}

/**
 * Generate a single embedding vector (384 dimensions).
 */
export async function generateLocalEmbedding(text: string): Promise<number[]> {
  const extractor = await getEmbeddingPipeline();
  
  // pooling: 'mean' and normalize: true are standard for sentence embeddings
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  
  return Array.from(output.data);
}

/**
 * Generate embeddings for a batch of texts.
 */
export async function generateLocalEmbeddingsBatch(
  texts: string[],
  batchSize: number = 20
): Promise<number[][]> {
  const extractor = await getEmbeddingPipeline();
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    
    // Process batch concurrently
    const batchOutput = await extractor(batch, { pooling: 'mean', normalize: true });
    
    // Transformer.js feature extraction for arrays returns a tensor.
    // The shape is [batchSize, dimensions]. We need to split it back into an array of arrays.
    for (let j = 0; j < batch.length; j++) {
      const singleEmbedding = Array.from(batchOutput[j].data) as number[];
      embeddings.push(singleEmbedding);
    }
  }

  return embeddings;
}
