import type OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Chunk } from '@/lib/types'
import { embedText } from '@/lib/embed'
import { matchChunksByEmbedding } from '@/lib/retrieve'

export type SearchFn = (query: string, opts?: { k?: number; type?: string }) => Promise<Chunk[]>

export function makeSearch(openai: OpenAI, supabase: SupabaseClient): SearchFn {
  return async (query, opts = {}) => {
    const embedding = await embedText(openai, query)
    return matchChunksByEmbedding(supabase, embedding, opts)
  }
}
