import type { SupabaseClient } from '@supabase/supabase-js'
import type { Chunk } from '@/lib/types'
import { TOP_K } from '@/lib/config'

export async function matchChunksByEmbedding(
  supabase: SupabaseClient,
  embedding: number[],
  opts: { k?: number; type?: string } = {}
): Promise<Chunk[]> {
  const { data, error } = await supabase.rpc('match_chunks', {
    query_embedding: embedding,
    match_count: opts.k ?? TOP_K,
    filter_type: opts.type ?? null,
  })
  if (error) throw new Error(`match_chunks failed: ${error.message}`)
  return (data ?? []) as Chunk[]
}
