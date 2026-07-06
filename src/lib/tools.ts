import type { Source } from '@/lib/types'
import type { SearchFn } from '@/lib/search'
import { TOP_K } from '@/lib/config'

export const coachTools = [
  {
    type: 'function' as const,
    function: {
      name: 'search_library',
      description:
        "Search the coaching content library for material relevant to the member's question about the methodology, breathwork, meditation, or shadow work.",
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'What to look up' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'recommend_practice',
      description: 'Recommend a practice based on how the member feels or what they want.',
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: 'The feeling or goal, e.g. "anxious before a meeting"' },
          type: {
            type: 'string',
            enum: ['breathwork', 'meditation', 'shadow-work'],
            description: 'Optional practice type to filter by',
          },
        },
        required: ['goal'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_journal_prompt',
      description: 'Retrieve material on a theme so you can write a personalized journal or future-self prompt.',
      parameters: {
        type: 'object',
        properties: { theme: { type: 'string', description: 'The theme, e.g. "self-trust"' } },
        required: ['theme'],
      },
    },
  },
]

export function makeToolExecutor(deps: { search: SearchFn }) {
  return async function executeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ content: string; sources: Source[] }> {
    let chunks
    if (name === 'search_library') {
      chunks = await deps.search(String(args.query ?? ''), { k: TOP_K })
    } else if (name === 'recommend_practice') {
      chunks = await deps.search(String(args.goal ?? ''), {
        type: args.type ? String(args.type) : undefined,
        k: TOP_K,
      })
    } else if (name === 'generate_journal_prompt') {
      chunks = await deps.search(String(args.theme ?? ''), { k: TOP_K })
    } else {
      return { content: `Unknown tool: ${name}`, sources: [] }
    }

    if (chunks.length === 0) {
      return { content: 'No relevant material found in the library.', sources: [] }
    }
    const content = chunks
      .map((c, i) => `[${i + 1}] (${c.doc_title}) ${c.content}`)
      .join('\n\n')
    const sources: Source[] = chunks.map((c) => ({ title: c.doc_title, type: c.doc_type }))
    return { content, sources }
  }
}
