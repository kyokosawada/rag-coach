import { describe, it, expect, vi } from 'vitest'
import { makeSearch } from '@/lib/search'

describe('makeSearch', () => {
  it('embeds the query then retrieves chunks with the same options', async () => {
    const create = vi.fn().mockResolvedValue({ data: [{ embedding: [0.5, 0.5] }] })
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: 2, doc_title: 'Grounding', doc_type: 'meditation', content: 'c', similarity: 0.8 }],
      error: null,
    })
    const search = makeSearch({ embeddings: { create } } as any, { rpc } as any)

    const chunks = await search('calm me down', { type: 'meditation', k: 2 })

    expect(create).toHaveBeenCalledWith({ model: 'text-embedding-3-small', input: 'calm me down' })
    expect(rpc).toHaveBeenCalledWith('match_chunks', {
      query_embedding: [0.5, 0.5],
      match_count: 2,
      filter_type: 'meditation',
    })
    expect(chunks[0].doc_title).toBe('Grounding')
  })
})
