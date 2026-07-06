import { describe, it, expect, vi } from 'vitest'
import { matchChunksByEmbedding } from '@/lib/retrieve'

describe('matchChunksByEmbedding', () => {
  it('calls the RPC with embedding, count, and type filter, and returns rows', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: 1, doc_title: 'Box Breathing', doc_type: 'breathwork', content: '...', similarity: 0.9 }],
      error: null,
    })
    const fakeSupabase = { rpc } as any

    const rows = await matchChunksByEmbedding(fakeSupabase, [0.1, 0.2], { k: 3, type: 'breathwork' })

    expect(rpc).toHaveBeenCalledWith('match_chunks', {
      query_embedding: [0.1, 0.2],
      match_count: 3,
      filter_type: 'breathwork',
    })
    expect(rows[0].doc_title).toBe('Box Breathing')
  })

  it('throws when the RPC returns an error', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
    const fakeSupabase = { rpc } as any
    await expect(matchChunksByEmbedding(fakeSupabase, [0.1], {})).rejects.toThrow(/boom/)
  })
})
