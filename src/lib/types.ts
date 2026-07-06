export type DocType = 'breathwork' | 'meditation' | 'shadow-work' | 'framework'

export interface ParsedDoc {
  title: string
  type: DocType
  body: string
}

export interface Chunk {
  id: number
  doc_title: string
  doc_type: string
  content: string
  similarity: number
}

export interface Source {
  title: string
  type: string
}
