import { describe, it, expect } from 'vitest'
import { parseDoc } from '@/lib/frontmatter'

describe('parseDoc', () => {
  it('extracts title, type, and body from frontmatter', () => {
    const raw = `---\ntitle: Box Breathing\ntype: breathwork\n---\nInhale for 4 counts.`
    const doc = parseDoc(raw)
    expect(doc.title).toBe('Box Breathing')
    expect(doc.type).toBe('breathwork')
    expect(doc.body.trim()).toBe('Inhale for 4 counts.')
  })

  it('throws when title or type is missing', () => {
    const raw = `---\ntitle: No Type\n---\nBody`
    expect(() => parseDoc(raw)).toThrow(/type/)
  })
})
