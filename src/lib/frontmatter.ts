import matter from 'gray-matter'
import type { ParsedDoc, DocType } from '@/lib/types'

const VALID_TYPES: DocType[] = ['breathwork', 'meditation', 'shadow-work', 'framework']

export function parseDoc(raw: string): ParsedDoc {
  const { data, content } = matter(raw)
  const title = typeof data.title === 'string' ? data.title.trim() : ''
  const type = typeof data.type === 'string' ? (data.type.trim() as DocType) : undefined
  if (!title) throw new Error('Document frontmatter missing "title"')
  if (!type || !VALID_TYPES.includes(type)) {
    throw new Error(`Document "${title}" has invalid or missing "type"`)
  }
  return { title, type, body: content.trim() }
}
