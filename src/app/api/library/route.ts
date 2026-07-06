import { createServerClient } from '@/lib/supabase'
import { listDocs } from '@/lib/library'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = createServerClient()
    const docs = await listDocs(supabase)
    return Response.json({ docs })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ error: message }, { status: 500 })
  }
}
