import { describe, it, expect, vi } from 'vitest'
import { listDocs } from '@/lib/library'

describe('listDocs', () => {
  it('groups chunks by title, concatenates content, and sorts by type then title', async () => {
    const select = vi.fn().mockResolvedValue({
      data: [
        { doc_title: 'Box Breathing', doc_type: 'breathwork', content: 'inhale 4' },
        { doc_title: 'Body Scan', doc_type: 'meditation', content: 'scan body' },
        { doc_title: 'Box Breathing', doc_type: 'breathwork', content: 'second chunk' },
      ],
      error: null,
    })
    const from = vi.fn().mockReturnValue({ select })
    const fakeSupabase = { from } as any

    const docs = await listDocs(fakeSupabase)

    expect(from).toHaveBeenCalledWith('chunks')
    expect(docs).toHaveLength(2)
    // breathwork sorts before meditation
    expect(docs[0]).toEqual({
      title: 'Box Breathing',
      type: 'breathwork',
      content: 'inhale 4\n\nsecond chunk',
    })
    expect(docs[1].title).toBe('Body Scan')
  })

  it('throws when the query errors', async () => {
    const select = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
    const fakeSupabase = { from: vi.fn().mockReturnValue({ select }) } as any
    await expect(listDocs(fakeSupabase)).rejects.toThrow(/boom/)
  })
})
