import type { SupabaseClient } from '@supabase/supabase-js'

export interface LibraryDoc {
  title: string
  type: string
  content: string
}

// Lists the distinct source documents currently indexed, with their full text
// (chunks re-joined per doc). Used by the UI to show what the coach is grounded in.
export async function listDocs(supabase: SupabaseClient): Promise<LibraryDoc[]> {
  const { data, error } = await supabase.from('chunks').select('doc_title, doc_type, content')
  if (error) throw new Error(`listDocs failed: ${error.message}`)

  const byTitle = new Map<string, LibraryDoc>()
  for (const row of (data ?? []) as { doc_title: string; doc_type: string; content: string }[]) {
    const existing = byTitle.get(row.doc_title)
    if (existing) existing.content += `\n\n${row.content}`
    else byTitle.set(row.doc_title, { title: row.doc_title, type: row.doc_type, content: row.content })
  }

  return [...byTitle.values()].sort(
    (a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title)
  )
}
