import '@/lib/env' // must be first — loads .env.local before other modules read process.env
import { createLLMClient } from '@/lib/llm'
import { createServerClient } from '@/lib/supabase'
import { makeSearch } from '@/lib/search'
import { makeToolExecutor, coachTools } from '@/lib/tools'
import { runCoach } from '@/lib/agent'
import { SYSTEM_PROMPT } from '@/lib/prompt'
import { CHAT_MODEL } from '@/lib/config'

const IN_CORPUS = [
  { q: 'How do I do box breathing?', expectType: 'breathwork' },
  { q: 'Give me a grounding exercise for overwhelm.', expectType: 'meditation' },
  { q: 'How can I work with my inner critic?', expectType: 'shadow-work' },
]
const OFF_CORPUS = ['What is the capital of France?', 'Write me a SQL query to join two tables.']

async function main() {
  const openai = createLLMClient()
  const supabase = createServerClient()
  const executeTool = makeToolExecutor({ search: makeSearch(openai, supabase) })
  const run = (q: string) =>
    runCoach({
      openai,
      model: CHAT_MODEL,
      systemPrompt: SYSTEM_PROMPT,
      tools: coachTools,
      executeTool,
      userMessages: [{ role: 'user', content: q }],
    })

  let pass = 0
  let fail = 0
  for (const c of IN_CORPUS) {
    const r = await run(c.q)
    const ok = r.sources.some((s) => s.type === c.expectType)
    console.log(
      `${ok ? 'PASS' : 'FAIL'} in-corpus: "${c.q}" -> sources: ${r.sources.map((s) => s.title).join(', ') || 'none'}`
    )
    if (ok) pass++
    else fail++
  }
  for (const q of OFF_CORPUS) {
    const r = await run(q)
    const ok = r.sources.length === 0
    console.log(
      `${ok ? 'PASS' : 'FAIL'} off-corpus: "${q}" -> ${ok ? 'declined (no sources)' : 'LEAKED sources: ' + r.sources.map((s) => s.title).join(', ')}`
    )
    if (ok) pass++
    else fail++
  }
  console.log(`\n${pass} passed, ${fail} failed.`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
