import OpenAI from 'openai'
import { createServerClient } from '@/lib/supabase'
import { makeSearch } from '@/lib/search'
import { makeToolExecutor, coachTools } from '@/lib/tools'
import { runCoach } from '@/lib/agent'
import { SYSTEM_PROMPT } from '@/lib/prompt'
import { CHAT_MODEL } from '@/lib/config'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const messages = Array.isArray(body?.messages) ? body.messages : []
    if (messages.length === 0) {
      return Response.json({ error: 'messages required' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const supabase = createServerClient()
    const search = makeSearch(openai, supabase)
    const executeTool = makeToolExecutor({ search })

    const result = await runCoach({
      openai,
      model: CHAT_MODEL,
      systemPrompt: SYSTEM_PROMPT,
      tools: coachTools,
      executeTool,
      userMessages: messages,
    })

    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ error: message }, { status: 500 })
  }
}
