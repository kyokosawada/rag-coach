import { describe, it, expect, vi } from 'vitest'
import { coachTools, makeToolExecutor } from '@/lib/tools'

describe('coachTools', () => {
  it('exposes the three coach tools', () => {
    const names = coachTools.map((t) => t.function.name)
    expect(names).toEqual(['search_library', 'recommend_practice', 'generate_journal_prompt'])
  })
})

describe('makeToolExecutor', () => {
  it('recommend_practice searches with the type filter and returns sources', async () => {
    const search = vi.fn().mockResolvedValue([
      { id: 1, doc_title: 'Box Breathing', doc_type: 'breathwork', content: 'inhale 4', similarity: 0.9 },
    ])
    const execute = makeToolExecutor({ search })

    const out = await execute('recommend_practice', { goal: 'anxious', type: 'breathwork' })

    expect(search).toHaveBeenCalledWith('anxious', { type: 'breathwork', k: 5 })
    expect(out.sources).toEqual([{ title: 'Box Breathing', type: 'breathwork' }])
    expect(out.content).toContain('Box Breathing')
  })

  it('returns a no-material message when search is empty', async () => {
    const search = vi.fn().mockResolvedValue([])
    const execute = makeToolExecutor({ search })
    const out = await execute('search_library', { query: 'quantum physics' })
    expect(out.content).toMatch(/no relevant material/i)
    expect(out.sources).toEqual([])
  })
})
