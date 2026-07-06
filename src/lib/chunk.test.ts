import { describe, it, expect } from 'vitest'
import { chunkText } from '@/lib/chunk'

describe('chunkText', () => {
  it('keeps a short doc as a single chunk', () => {
    const chunks = chunkText('One short paragraph.', 500)
    expect(chunks).toEqual(['One short paragraph.'])
  })

  it('splits on blank lines when over the budget', () => {
    const para = 'x'.repeat(300)
    const chunks = chunkText(`${para}\n\n${para}`, 400)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toBe(para)
  })

  it('packs multiple small paragraphs into one chunk', () => {
    const chunks = chunkText('a\n\nb\n\nc', 500)
    expect(chunks).toEqual(['a\n\nb\n\nc'])
  })
})
