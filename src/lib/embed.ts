import type OpenAI from 'openai'
import { EMBED_MODEL, EMBED_DIMS } from '@/lib/config'

export async function embedText(openai: OpenAI, text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: text,
    dimensions: EMBED_DIMS,
  })
  return res.data[0].embedding
}
