import { describe, it, expect, vi } from 'vitest'
import { runCoach } from '@/lib/agent'

describe('runCoach', () => {
  it('executes a tool call, then returns the final reply with collected sources', async () => {
    const create = vi
      .fn()
      // First call: model asks to use a tool
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                { id: 'call_1', type: 'function', function: { name: 'search_library', arguments: '{"query":"box breathing"}' } },
              ],
            },
          },
        ],
      })
      // Second call: model gives a final answer
      .mockResolvedValueOnce({
        choices: [{ message: { role: 'assistant', content: 'Try box breathing. What feels tight right now?' } }],
      })

    const executeTool = vi.fn().mockResolvedValue({
      content: '[1] (Box Breathing) inhale 4',
      sources: [{ title: 'Box Breathing', type: 'breathwork' }],
    })

    const result = await runCoach({
      openai: { chat: { completions: { create } } } as any,
      model: 'gpt-4o-mini',
      systemPrompt: 'sys',
      tools: [] as any,
      executeTool,
      userMessages: [{ role: 'user', content: 'help me relax' }],
    })

    expect(executeTool).toHaveBeenCalledWith('search_library', { query: 'box breathing' })
    expect(result.reply).toContain('box breathing')
    expect(result.sources).toEqual([{ title: 'Box Breathing', type: 'breathwork' }])
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('returns immediately when the model answers with no tool calls', async () => {
    const create = vi.fn().mockResolvedValueOnce({
      choices: [{ message: { role: 'assistant', content: 'Hello, how are you feeling?' } }],
    })
    const result = await runCoach({
      openai: { chat: { completions: { create } } } as any,
      model: 'gpt-4o-mini',
      systemPrompt: 'sys',
      tools: [] as any,
      executeTool: vi.fn(),
      userMessages: [{ role: 'user', content: 'hi' }],
    })
    expect(result.reply).toBe('Hello, how are you feeling?')
    expect(result.sources).toEqual([])
  })
})
