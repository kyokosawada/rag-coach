import type OpenAI from 'openai'
import type { Source } from '@/lib/types'

type Message = OpenAI.Chat.ChatCompletionMessageParam

export interface CoachResult {
  reply: string
  sources: Source[]
}

export interface RunCoachDeps {
  openai: OpenAI
  model: string
  systemPrompt: string
  tools: OpenAI.Chat.ChatCompletionTool[]
  executeTool: (name: string, args: Record<string, unknown>) => Promise<{ content: string; sources: Source[] }>
  userMessages: Message[]
  maxSteps?: number
}

function dedupe(sources: Source[]): Source[] {
  const seen = new Set<string>()
  return sources.filter((s) => {
    const key = `${s.type}::${s.title}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function runCoach(deps: RunCoachDeps): Promise<CoachResult> {
  const messages: Message[] = [{ role: 'system', content: deps.systemPrompt }, ...deps.userMessages]
  const collected: Source[] = []
  const maxSteps = deps.maxSteps ?? 4

  for (let step = 0; step < maxSteps; step++) {
    const completion = await deps.openai.chat.completions.create({
      model: deps.model,
      messages,
      tools: deps.tools,
      tool_choice: 'auto',
    })
    const msg = completion.choices[0].message
    messages.push(msg as Message)

    const toolCalls = msg.tool_calls ?? []
    if (toolCalls.length === 0) {
      return { reply: msg.content ?? '', sources: dedupe(collected) }
    }

    for (const call of toolCalls) {
      if (call.type !== 'function') continue
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(call.function.arguments || '{}')
      } catch {
        args = {}
      }
      const { content, sources } = await deps.executeTool(call.function.name, args)
      collected.push(...sources)
      messages.push({ role: 'tool', tool_call_id: call.id, content })
    }
  }

  // Safety net: ask for a final answer without tools.
  const final = await deps.openai.chat.completions.create({ model: deps.model, messages })
  return { reply: final.choices[0].message.content ?? '', sources: dedupe(collected) }
}
