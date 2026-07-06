import 'dotenv/config'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import OpenAI from 'openai'
import { parseDoc } from '@/lib/frontmatter'
import { chunkText } from '@/lib/chunk'
import { embedText } from '@/lib/embed'
import { createServerClient } from '@/lib/supabase'

async function main() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const supabase = createServerClient()

  // Fresh load each run.
  await supabase.from('chunks').delete().neq('id', 0)

  const dir = 'content'
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'))
  let total = 0

  for (const file of files) {
    const doc = parseDoc(readFileSync(join(dir, file), 'utf8'))
    const chunks = chunkText(doc.body, 1200)
    for (const content of chunks) {
      const embedding = await embedText(openai, content)
      const { error } = await supabase.from('chunks').insert({
        doc_title: doc.title,
        doc_type: doc.type,
        content,
        embedding,
        metadata: { file },
      })
      if (error) throw new Error(`Insert failed for ${file}: ${error.message}`)
      total++
    }
    console.log(`Ingested ${doc.title} (${chunks.length} chunk(s))`)
  }
  console.log(`Done. ${total} chunks from ${files.length} docs.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
