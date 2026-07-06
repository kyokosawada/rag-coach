import { describe, it, expect, vi } from 'vitest'
import { embedText } from '@/lib/embed'

describe('embedText', () => {
  it('returns the embedding vector for the given text', async () => {
    const create = vi.fn().mockResolvedValue({ data: [{ embedding: [0.1, 0.2, 0.3] }] })
    const fakeOpenAI = { embeddings: { create } } as any

    const vec = await embedText(fakeOpenAI, 'hello')

    expect(vec).toEqual([0.1, 0.2, 0.3])
    expect(create).toHaveBeenCalledWith({ model: 'gemini-embedding-001', input: 'hello', dimensions: 1536 })
  })
})
