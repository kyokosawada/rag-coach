# AI Transformation Coach — RAG Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deployed RAG "AI coach" that answers only from an indexed content library (with citations), recommends a practice, and generates a journal prompt — proving the RAG + vector-DB + tool-using-agent stack.

**Architecture:** Next.js (App Router) chat UI + a `/api/chat` route that runs a small OpenAI tool-using loop. Tools retrieve chunks from Supabase Postgres + pgvector via a `match_chunks` SQL function. Content is chunked and embedded once by a seed script. Everything server-side; no auth.

**Tech Stack:** TypeScript, Next.js, React, Supabase (`@supabase/supabase-js`) + pgvector, OpenAI Node SDK (`openai`), Vitest.

---

## Notes for the implementer

- **Next.js may differ from your training data.** After Task 1 installs it, if any route/page code errors, read `node_modules/next/dist/docs/` or pull current docs via context7 (`/vercel/next.js`) before guessing. The App Router route-handler and client-component code below was checked against current docs, but versions move.
- **Model names:** embeddings use `text-embedding-3-small` (stable, 1536 dims). The chat model is read from `OPENAI_CHAT_MODEL` (defaults to `gpt-4o-mini`) so you can bump to a newer GPT without code changes.
- **Secrets:** never commit `.env.local`. Use the Supabase **service role** key server-side only.
- **Supabase:** use a hosted free-tier project (Netlify functions can't reach localhost). Enable the `vector` extension via the schema in Task 5.
- Run all commands from the repo root `~/dev/automation/rag-coach`.

## File structure

```
rag-coach/
  package.json, tsconfig.json, next.config.mjs, vitest.config.ts, .gitignore, .env.example
  db/schema.sql                     # chunks table + match_chunks() + hnsw index
  content/*.md                      # sample docs w/ frontmatter (title, type)
  src/lib/
    config.ts                       # model names, dims, TOP_K
    types.ts                        # Chunk, Source
    frontmatter.ts                  # parseDoc()
    chunk.ts                        # chunkText()
    embed.ts                        # embedText(openai, text)
    supabase.ts                     # server supabase client factory
    retrieve.ts                     # matchChunksByEmbedding(supabase, embedding, opts)
    search.ts                       # makeSearch(openai, supabase) -> (query, opts) => Chunk[]
    prompt.ts                       # SYSTEM_PROMPT
    tools.ts                        # coachTools schema + makeToolExecutor()
    agent.ts                        # runCoach() tool loop
  src/scripts/ingest.ts             # seed: read content/ -> chunk -> embed -> upsert
  src/app/layout.tsx, page.tsx, globals.css
  src/app/api/chat/route.ts         # POST -> runCoach()
  src/components/Chat.tsx, SourceChips.tsx
  eval/grounding.ts                 # manual eval: in-corpus cites right doc; off-corpus declines
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.example`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Scaffold Next.js + TypeScript into the existing repo**

The repo already exists with a `docs/` folder and git history. Scaffold in place:

Run:
```bash
cd ~/dev/automation/rag-coach
npx create-next-app@latest . --ts --app --src-dir --eslint --no-tailwind --import-alias "@/*" --use-npm
```
When prompted about the non-empty directory, choose to continue (the `docs/` and `.git` are safe). If it refuses, scaffold into a temp dir and copy `src/`, `package.json`, `tsconfig.json`, `next.config.*`, `.gitignore` over.

- [ ] **Step 2: Add runtime + dev dependencies**

Run:
```bash
npm install openai @supabase/supabase-js gray-matter
npm install -D vitest dotenv tsx
```

- [ ] **Step 3: Add Vitest config with the `@` alias**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Add test + ingest scripts to package.json**

In `package.json` `"scripts"`, add:
```json
"test": "vitest run",
"test:watch": "vitest",
"ingest": "tsx src/scripts/ingest.ts",
"eval": "tsx eval/grounding.ts"
```

- [ ] **Step 5: Create `.env.example` and ensure `.env.local` is ignored**

Create `.env.example`:
```
OPENAI_API_KEY=sk-...
OPENAI_CHAT_MODEL=gpt-4o-mini
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```
Confirm `.gitignore` contains `.env*.local` (create-next-app adds it). If not, append `.env*.local`.

- [ ] **Step 6: Verify the app and test runner boot**

Run:
```bash
npm run dev
```
Expected: dev server starts, `http://localhost:3000` serves the default page. Stop it (Ctrl-C).
Run:
```bash
npm test
```
Expected: Vitest runs and reports "No test files found" (exit 0) — that's fine, none exist yet.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + TypeScript + Vitest"
```

---

### Task 2: Config and shared types

**Files:**
- Create: `src/lib/config.ts`, `src/lib/types.ts`

- [ ] **Step 1: Create `src/lib/config.ts`**

```ts
export const EMBED_MODEL = 'text-embedding-3-small'
export const EMBED_DIMS = 1536
export const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini'
export const TOP_K = 5
```

- [ ] **Step 2: Create `src/lib/types.ts`**

```ts
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
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/config.ts src/lib/types.ts
git commit -m "feat: add config constants and shared types"
```

---

### Task 3: Frontmatter parser (TDD)

**Files:**
- Create: `src/lib/frontmatter.ts`
- Test: `src/lib/frontmatter.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/frontmatter.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseDoc } from '@/lib/frontmatter'

describe('parseDoc', () => {
  it('extracts title, type, and body from frontmatter', () => {
    const raw = `---\ntitle: Box Breathing\ntype: breathwork\n---\nInhale for 4 counts.`
    const doc = parseDoc(raw)
    expect(doc.title).toBe('Box Breathing')
    expect(doc.type).toBe('breathwork')
    expect(doc.body.trim()).toBe('Inhale for 4 counts.')
  })

  it('throws when title or type is missing', () => {
    const raw = `---\ntitle: No Type\n---\nBody`
    expect(() => parseDoc(raw)).toThrow(/type/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/frontmatter.test.ts`
Expected: FAIL — cannot resolve `@/lib/frontmatter`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/frontmatter.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/frontmatter.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/frontmatter.ts src/lib/frontmatter.test.ts
git commit -m "feat: add frontmatter parser"
```

---

### Task 4: Chunker (TDD)

**Files:**
- Create: `src/lib/chunk.ts`
- Test: `src/lib/chunk.test.ts`

Chunk by paragraph, greedily packing paragraphs up to a character budget so short docs stay in one chunk and long docs split on blank lines.

- [ ] **Step 1: Write the failing test**

`src/lib/chunk.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { chunkText } from '@/lib/chunk'

describe('chunkText', () => {
  it('keeps a short doc as a single chunk', () => {
    const chunks = chunkText('One short paragraph.', 500)
    expect(chunks).toEqual(['One short paragraph.'])
  })

  it('splits on blank lines when over the budget', () => {
    const para = 'x'.repeat(300)
    const chunks = chunkText(`${para}\n\n${para}`, 400)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toBe(para)
  })

  it('packs multiple small paragraphs into one chunk', () => {
    const chunks = chunkText('a\n\nb\n\nc', 500)
    expect(chunks).toEqual(['a\n\nb\n\nc'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/chunk.test.ts`
Expected: FAIL — cannot resolve `@/lib/chunk`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/chunk.ts`:
```ts
export function chunkText(text: string, maxChars = 1200): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let current = ''
  for (const p of paragraphs) {
    if (current && current.length + 2 + p.length > maxChars) {
      chunks.push(current)
      current = p
    } else {
      current = current ? `${current}\n\n${p}` : p
    }
  }
  if (current) chunks.push(current)
  return chunks
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/chunk.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/chunk.ts src/lib/chunk.test.ts
git commit -m "feat: add paragraph-packing chunker"
```

---

### Task 5: Database schema + Supabase setup

**Files:**
- Create: `db/schema.sql`

- [ ] **Step 1: Write the schema**

`db/schema.sql`:
```sql
-- Enable pgvector
create extension if not exists vector;

create table if not exists chunks (
  id bigint generated always as identity primary key,
  doc_title text not null,
  doc_type text not null,
  content text not null,
  embedding vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chunks_embedding_idx
  on chunks using hnsw (embedding vector_cosine_ops);

-- Cosine-similarity top-k retrieval, with optional doc_type filter
create or replace function match_chunks(
  query_embedding vector(1536),
  match_count int default 5,
  filter_type text default null
)
returns table (
  id bigint,
  doc_title text,
  doc_type text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    c.id,
    c.doc_title,
    c.doc_type,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  where filter_type is null or c.doc_type = filter_type
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
```

- [ ] **Step 2: Apply it to a hosted Supabase project**

Create a free Supabase project. In the dashboard → **SQL Editor**, paste and run `db/schema.sql`.
Then copy the project URL and the **service_role** key into `.env.local`:
```
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

- [ ] **Step 3: Verify the function exists**

In the SQL Editor, run:
```sql
select proname from pg_proc where proname = 'match_chunks';
```
Expected: one row, `match_chunks`.

- [ ] **Step 4: Commit**

```bash
git add db/schema.sql
git commit -m "feat: add pgvector schema and match_chunks function"
```

---

### Task 6: Embedding wrapper (TDD)

**Files:**
- Create: `src/lib/embed.ts`
- Test: `src/lib/embed.test.ts`

- [ ] **Step 1: Write the failing test** (injects a fake OpenAI client — no network)

`src/lib/embed.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { embedText } from '@/lib/embed'

describe('embedText', () => {
  it('returns the embedding vector for the given text', async () => {
    const create = vi.fn().mockResolvedValue({ data: [{ embedding: [0.1, 0.2, 0.3] }] })
    const fakeOpenAI = { embeddings: { create } } as any

    const vec = await embedText(fakeOpenAI, 'hello')

    expect(vec).toEqual([0.1, 0.2, 0.3])
    expect(create).toHaveBeenCalledWith({ model: 'text-embedding-3-small', input: 'hello' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/embed.test.ts`
Expected: FAIL — cannot resolve `@/lib/embed`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/embed.ts`:
```ts
import type OpenAI from 'openai'
import { EMBED_MODEL } from '@/lib/config'

export async function embedText(openai: OpenAI, text: string): Promise<number[]> {
  const res = await openai.embeddings.create({ model: EMBED_MODEL, input: text })
  return res.data[0].embedding
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/embed.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/embed.ts src/lib/embed.test.ts
git commit -m "feat: add OpenAI embedding wrapper"
```

---

### Task 7: Supabase client + retrieval (TDD)

**Files:**
- Create: `src/lib/supabase.ts`, `src/lib/retrieve.ts`
- Test: `src/lib/retrieve.test.ts`

- [ ] **Step 1: Create the server Supabase client factory**

`src/lib/supabase.ts`:
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function createServerClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}
```

- [ ] **Step 2: Write the failing test for retrieval** (fake supabase — no network)

`src/lib/retrieve.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { matchChunksByEmbedding } from '@/lib/retrieve'

describe('matchChunksByEmbedding', () => {
  it('calls the RPC with embedding, count, and type filter, and returns rows', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: 1, doc_title: 'Box Breathing', doc_type: 'breathwork', content: '...', similarity: 0.9 }],
      error: null,
    })
    const fakeSupabase = { rpc } as any

    const rows = await matchChunksByEmbedding(fakeSupabase, [0.1, 0.2], { k: 3, type: 'breathwork' })

    expect(rpc).toHaveBeenCalledWith('match_chunks', {
      query_embedding: [0.1, 0.2],
      match_count: 3,
      filter_type: 'breathwork',
    })
    expect(rows[0].doc_title).toBe('Box Breathing')
  })

  it('throws when the RPC returns an error', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
    const fakeSupabase = { rpc } as any
    await expect(matchChunksByEmbedding(fakeSupabase, [0.1], {})).rejects.toThrow(/boom/)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/retrieve.test.ts`
Expected: FAIL — cannot resolve `@/lib/retrieve`.

- [ ] **Step 4: Write minimal implementation**

`src/lib/retrieve.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Chunk } from '@/lib/types'
import { TOP_K } from '@/lib/config'

export async function matchChunksByEmbedding(
  supabase: SupabaseClient,
  embedding: number[],
  opts: { k?: number; type?: string } = {}
): Promise<Chunk[]> {
  const { data, error } = await supabase.rpc('match_chunks', {
    query_embedding: embedding,
    match_count: opts.k ?? TOP_K,
    filter_type: opts.type ?? null,
  })
  if (error) throw new Error(`match_chunks failed: ${error.message}`)
  return (data ?? []) as Chunk[]
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/retrieve.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase.ts src/lib/retrieve.ts src/lib/retrieve.test.ts
git commit -m "feat: add supabase client and vector retrieval"
```

---

### Task 8: Search composition (TDD)

**Files:**
- Create: `src/lib/search.ts`
- Test: `src/lib/search.test.ts`

`makeSearch` composes embed + retrieve into one `(query, opts) => Chunk[]` used by the tools.

- [ ] **Step 1: Write the failing test**

`src/lib/search.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { makeSearch } from '@/lib/search'

describe('makeSearch', () => {
  it('embeds the query then retrieves chunks with the same options', async () => {
    const create = vi.fn().mockResolvedValue({ data: [{ embedding: [0.5, 0.5] }] })
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: 2, doc_title: 'Grounding', doc_type: 'meditation', content: 'c', similarity: 0.8 }],
      error: null,
    })
    const search = makeSearch({ embeddings: { create } } as any, { rpc } as any)

    const chunks = await search('calm me down', { type: 'meditation', k: 2 })

    expect(create).toHaveBeenCalledWith({ model: 'text-embedding-3-small', input: 'calm me down' })
    expect(rpc).toHaveBeenCalledWith('match_chunks', {
      query_embedding: [0.5, 0.5],
      match_count: 2,
      filter_type: 'meditation',
    })
    expect(chunks[0].doc_title).toBe('Grounding')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/search.test.ts`
Expected: FAIL — cannot resolve `@/lib/search`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/search.ts`:
```ts
import type OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Chunk } from '@/lib/types'
import { embedText } from '@/lib/embed'
import { matchChunksByEmbedding } from '@/lib/retrieve'

export type SearchFn = (query: string, opts?: { k?: number; type?: string }) => Promise<Chunk[]>

export function makeSearch(openai: OpenAI, supabase: SupabaseClient): SearchFn {
  return async (query, opts = {}) => {
    const embedding = await embedText(openai, query)
    return matchChunksByEmbedding(supabase, embedding, opts)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/search.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/search.ts src/lib/search.test.ts
git commit -m "feat: compose embed + retrieve into search"
```

---

### Task 9: System prompt + tools (TDD)

**Files:**
- Create: `src/lib/prompt.ts`, `src/lib/tools.ts`
- Test: `src/lib/tools.test.ts`

- [ ] **Step 1: Create the system prompt**

`src/lib/prompt.ts`:
```ts
export const SYSTEM_PROMPT = `You are a warm, grounded transformation coach for a women's wellness community.

Rules:
- Answer ONLY using material returned by your tools. If the tools return no relevant material, say you don't have anything on that yet and gently ask a clarifying question. Never invent techniques or facts.
- Call a tool before answering any substantive question:
  - search_library for questions about the methodology, breathwork, meditation, or shadow work.
  - recommend_practice when the member wants something to do for how they feel.
  - generate_journal_prompt when they want a journal or future-self prompt.
- Speak in a warm, reflective coach voice. Be concise.
- End your reply with one gentle coaching follow-up question.
- This is a demonstration running on sample content, not medical or clinical advice.`
```

- [ ] **Step 2: Write the failing test for the tool executor**

`src/lib/tools.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { coachTools, makeToolExecutor } from '@/lib/tools'

describe('coachTools', () => {
  it('exposes the three coach tools', () => {
    const names = coachTools.map((t) => t.function.name)
    expect(names).toEqual(['search_library', 'recommend_practice', 'generate_journal_prompt'])
  })
})

describe('makeToolExecutor', () => {
  it('recommend_practice searches with the type filter and returns sources', async () => {
    const search = vi.fn().mockResolvedValue([
      { id: 1, doc_title: 'Box Breathing', doc_type: 'breathwork', content: 'inhale 4', similarity: 0.9 },
    ])
    const execute = makeToolExecutor({ search })

    const out = await execute('recommend_practice', { goal: 'anxious', type: 'breathwork' })

    expect(search).toHaveBeenCalledWith('anxious', { type: 'breathwork', k: 5 })
    expect(out.sources).toEqual([{ title: 'Box Breathing', type: 'breathwork' }])
    expect(out.content).toContain('Box Breathing')
  })

  it('returns a no-material message when search is empty', async () => {
    const search = vi.fn().mockResolvedValue([])
    const execute = makeToolExecutor({ search })
    const out = await execute('search_library', { query: 'quantum physics' })
    expect(out.content).toMatch(/no relevant material/i)
    expect(out.sources).toEqual([])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/tools.test.ts`
Expected: FAIL — cannot resolve `@/lib/tools`.

- [ ] **Step 4: Write minimal implementation**

`src/lib/tools.ts`:
```ts
import type { Source } from '@/lib/types'
import type { SearchFn } from '@/lib/search'
import { TOP_K } from '@/lib/config'

export const coachTools = [
  {
    type: 'function' as const,
    function: {
      name: 'search_library',
      description:
        'Search the coaching content library for material relevant to the member\'s question about the methodology, breathwork, meditation, or shadow work.',
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/tools.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/prompt.ts src/lib/tools.ts src/lib/tools.test.ts
git commit -m "feat: add system prompt and coach tools"
```

---

### Task 10: Agent loop (TDD)

**Files:**
- Create: `src/lib/agent.ts`
- Test: `src/lib/agent.test.ts`

The loop: call the model with tools; if it returns tool calls, execute them, append results, loop; otherwise return the final text plus the sources gathered along the way.

- [ ] **Step 1: Write the failing test** (fake OpenAI scripts one tool call then a final answer)

`src/lib/agent.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/agent.test.ts`
Expected: FAIL — cannot resolve `@/lib/agent`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/agent.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/agent.test.ts`
Expected: PASS (2 tests). If the `OpenAI.Chat.ChatCompletionTool` / `ChatCompletionMessageParam` type paths error against the installed SDK version, verify the exact exported names in `node_modules/openai` and adjust the imports — the runtime logic is unchanged.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — all tests from Tasks 3,4,6,7,8,9,10.

- [ ] **Step 6: Commit**

```bash
git add src/lib/agent.ts src/lib/agent.test.ts
git commit -m "feat: add tool-using coach agent loop"
```

---

### Task 11: Sample content corpus

**Files:**
- Create: `content/*.md` (15 docs)

Author sample docs, each clearly demonstration content. Frontmatter format:
```
---
title: <Doc Title>
type: breathwork | meditation | shadow-work | framework
---
<body: a few short paragraphs>
```

- [ ] **Step 1: Create three exemplar docs**

`content/box-breathing.md`:
```
---
title: Box Breathing
type: breathwork
---
Box breathing is a simple way to steady the nervous system before something stressful.

Breathe in through the nose for a count of four. Hold for four. Exhale slowly through the mouth for four. Hold empty for four. Repeat for four to six rounds.

Use it before a hard conversation, a presentation, or any moment your chest feels tight. (Sample content for demonstration.)
```

`content/grounding-meditation.md`:
```
---
title: Five Senses Grounding
type: meditation
---
When your mind is racing, grounding brings you back into the body and the present moment.

Notice five things you can see, four you can feel, three you can hear, two you can smell, and one you can taste. Move slowly through each.

This is useful for overwhelm, spiraling thoughts, or reconnecting after a triggering moment. (Sample content for demonstration.)
```

`content/shadow-inner-critic.md`:
```
---
title: Meeting the Inner Critic
type: shadow-work
---
Shadow work means turning toward the parts of ourselves we usually push away, with curiosity instead of judgment.

Bring to mind the voice of your inner critic. Write down exactly what it says. Then ask: whose voice does this sound like, and what is it trying to protect me from?

The goal is not to silence the critic but to understand the fear underneath it. (Sample content for demonstration.)
```

- [ ] **Step 2: Create the remaining 12 docs following the same format**

Create these titles (author 2–4 short paragraphs each, clearly labeled sample content). Use an LLM to draft, then read each for tone.

| file | title | type |
|------|-------|------|
| `content/478-breathing.md` | 4-7-8 Breathing | breathwork |
| `content/coherent-breathing.md` | Coherent Breathing | breathwork |
| `content/breath-of-fire.md` | Breath of Fire | breathwork |
| `content/body-scan.md` | Body Scan | meditation |
| `content/loving-kindness.md` | Loving-Kindness | meditation |
| `content/morning-intention.md` | Morning Intention | meditation |
| `content/shadow-projection.md` | Owning Projections | shadow-work |
| `content/shadow-anger.md` | Befriending Anger | shadow-work |
| `content/future-self.md` | Future Self Visualization | framework |
| `content/nervous-system-101.md` | Nervous System 101 | framework |
| `content/reframe-ladder.md` | The Reframe Ladder | framework |
| `content/self-trust.md` | Building Self-Trust | framework |

- [ ] **Step 3: Verify every doc parses**

Create a throwaway check and run it, then delete it:
```bash
npx tsx -e "import {readdirSync,readFileSync} from 'node:fs'; import {parseDoc} from './src/lib/frontmatter.ts'; for (const f of readdirSync('content')) { const d = parseDoc(readFileSync('content/'+f,'utf8')); console.log(d.type, '-', d.title) }"
```
Expected: 15 lines, each printing a valid type and title, no thrown error.

- [ ] **Step 4: Commit**

```bash
git add content/
git commit -m "feat: add sample coaching content corpus"
```

---

### Task 12: Ingestion script

**Files:**
- Create: `src/scripts/ingest.ts`

- [ ] **Step 1: Write the seed script**

`src/scripts/ingest.ts`:
```ts
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
```

Note: `tsx` resolves the `@/` alias from `tsconfig.json` `paths`. Confirm `tsconfig.json` has `"paths": { "@/*": ["./src/*"] }` (create-next-app sets this). If `tsx` fails to resolve `@/`, run with `npx tsx --tsconfig tsconfig.json src/scripts/ingest.ts`.

- [ ] **Step 2: Run ingestion against the live DB**

Run: `npm run ingest`
Expected: one "Ingested …" line per doc, then "Done. N chunks from 15 docs."

- [ ] **Step 3: Verify rows landed**

In the Supabase SQL Editor:
```sql
select doc_type, count(*) from chunks group by doc_type;
```
Expected: rows for `breathwork`, `meditation`, `shadow-work`, `framework`, summing to N.

- [ ] **Step 4: Commit**

```bash
git add src/scripts/ingest.ts
git commit -m "feat: add content ingestion script"
```

---

### Task 13: Chat API route

**Files:**
- Create: `src/app/api/chat/route.ts`

- [ ] **Step 1: Write the route handler**

`src/app/api/chat/route.ts`:
```ts
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
```

- [ ] **Step 2: Smoke-test the route**

Start the server: `npm run dev`. In another terminal:
```bash
curl -s -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"I feel anxious before a big meeting, what can I do?"}]}' | npx json 2>/dev/null || curl -s -X POST http://localhost:3000/api/chat -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"I feel anxious before a big meeting, what can I do?"}]}'
```
Expected: JSON with a `reply` mentioning a breathwork/grounding practice and a `sources` array containing at least one `{title,type}` (e.g. Box Breathing / breathwork).

- [ ] **Step 3: Verify off-corpus declines**

```bash
curl -s -X POST http://localhost:3000/api/chat -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"What is the capital of France?"}]}'
```
Expected: `reply` says it doesn't have anything on that / redirects to coaching; it does NOT confidently answer "Paris" from the library. `sources` is empty.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: add chat API route wiring the coach agent"
```

---

### Task 14: Chat UI

**Files:**
- Create: `src/components/Chat.tsx`, `src/components/SourceChips.tsx`
- Modify: `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Create the source chips component**

`src/components/SourceChips.tsx`:
```tsx
import type { Source } from '@/lib/types'

export function SourceChips({ sources }: { sources: Source[] }) {
  if (!sources || sources.length === 0) return null
  return (
    <div className="chips">
      {sources.map((s, i) => (
        <span key={`${s.title}-${i}`} className="chip" title={s.type}>
          {s.title}
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create the chat component**

`src/components/Chat.tsx`:
```tsx
'use client'

import { useState } from 'react'
import type { Source } from '@/lib/types'
import { SourceChips } from '@/components/SourceChips'

interface UiMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
}

export function Chat() {
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    const next: UiMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      })
      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply ?? data.error ?? '…', sources: data.sources },
      ])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chat">
      <div className="messages">
        {messages.length === 0 && (
          <p className="empty">Ask about breathwork, meditation, or shadow work — or tell me how you feel.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="bubble">{m.content}</div>
            {m.role === 'assistant' && <SourceChips sources={m.sources ?? []} />}
          </div>
        ))}
        {loading && <div className="msg assistant"><div className="bubble">…</div></div>}
      </div>
      <div className="composer">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Type a message…"
          aria-label="Message"
        />
        <button onClick={send} disabled={loading}>Send</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Replace the home page**

`src/app/page.tsx`:
```tsx
import { Chat } from '@/components/Chat'

export default function Home() {
  return (
    <main className="page">
      <header className="header">
        <h1>AI Transformation Coach</h1>
        <p className="sub">A RAG demo. Answers come only from a sample content library — sources shown under each reply.</p>
      </header>
      <Chat />
    </main>
  )
}
```

- [ ] **Step 4: Add styles**

Append to `src/app/globals.css`:
```css
.page { max-width: 720px; margin: 0 auto; padding: 24px 16px; font-family: ui-sans-serif, system-ui, sans-serif; }
.header h1 { font-size: 1.4rem; margin: 0 0 4px; }
.sub { color: #6b6b6b; font-size: 0.85rem; margin: 0 0 16px; }
.chat { display: flex; flex-direction: column; gap: 12px; }
.messages { display: flex; flex-direction: column; gap: 12px; min-height: 240px; }
.empty { color: #8a8a8a; }
.msg { display: flex; flex-direction: column; gap: 6px; }
.msg.user { align-items: flex-end; }
.bubble { max-width: 85%; padding: 10px 14px; border-radius: 14px; white-space: pre-wrap; line-height: 1.4; }
.msg.user .bubble { background: #2f6f6a; color: #fff; }
.msg.assistant .bubble { background: #f2efe9; color: #222; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font-size: 0.7rem; padding: 2px 8px; border-radius: 999px; background: #e3ded4; color: #5a5347; }
.composer { display: flex; gap: 8px; }
.composer input { flex: 1; padding: 10px 12px; border: 1px solid #d8d2c6; border-radius: 10px; font-size: 1rem; }
.composer button { padding: 10px 16px; border: none; border-radius: 10px; background: #2f6f6a; color: #fff; cursor: pointer; }
.composer button:disabled { opacity: 0.5; cursor: default; }
```

- [ ] **Step 5: Manually verify in the browser**

Run `npm run dev`, open `http://localhost:3000`. Send "I feel anxious before a big meeting." Expected: a warm reply recommending a practice, source chip(s) beneath it, and a follow-up question. Send "What's the capital of France?" — expected: it declines / redirects, no chips.

- [ ] **Step 6: Commit**

```bash
git add src/components src/app/page.tsx src/app/globals.css
git commit -m "feat: add chat UI with source chips"
```

---

### Task 15: Grounding eval

**Files:**
- Create: `eval/grounding.ts`

A manual eval (needs live OpenAI + a seeded DB) that proves the two behaviors that make the demo credible: in-corpus questions cite the right doc; off-corpus questions get declined.

- [ ] **Step 1: Write the eval**

`eval/grounding.ts`:
```ts
import 'dotenv/config'
import OpenAI from 'openai'
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
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const supabase = createServerClient()
  const executeTool = makeToolExecutor({ search: makeSearch(openai, supabase) })
  const run = (q: string) =>
    runCoach({
      openai, model: CHAT_MODEL, systemPrompt: SYSTEM_PROMPT,
      tools: coachTools, executeTool, userMessages: [{ role: 'user', content: q }],
    })

  let pass = 0, fail = 0
  for (const c of IN_CORPUS) {
    const r = await run(c.q)
    const ok = r.sources.some((s) => s.type === c.expectType)
    console.log(`${ok ? 'PASS' : 'FAIL'} in-corpus: "${c.q}" -> sources: ${r.sources.map((s) => s.title).join(', ') || 'none'}`)
    ok ? pass++ : fail++
  }
  for (const q of OFF_CORPUS) {
    const r = await run(q)
    const ok = r.sources.length === 0
    console.log(`${ok ? 'PASS' : 'FAIL'} off-corpus: "${q}" -> ${ok ? 'declined (no sources)' : 'LEAKED sources: ' + r.sources.map((s) => s.title).join(', ')}`)
    ok ? pass++ : fail++
  }
  console.log(`\n${pass} passed, ${fail} failed.`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Run the eval**

Run: `npm run eval`
Expected: all five lines PASS, "5 passed, 0 failed." If an in-corpus case fails, widen that doc's wording or lower similarity expectations; if an off-corpus case leaks, tighten the `SYSTEM_PROMPT` decline rule.

- [ ] **Step 3: Commit**

```bash
git add eval/grounding.ts
git commit -m "test: add grounding eval (in-corpus cites, off-corpus declines)"
```

---

### Task 16: README + deploy to Netlify

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

`README.md`:
```markdown
# AI Transformation Coach — RAG Demo

A retrieval-augmented "AI coach" that answers **only** from an indexed content library, cites its sources, recommends practices, and generates journal prompts. Built to demonstrate RAG, vector search, and a tool-using agent.

**Stack:** Next.js · Supabase Postgres + pgvector · OpenAI · TypeScript.

> Runs on clearly-labeled sample wellness content, not any real brand's material. Not medical advice.

## How it works
1. `content/*.md` is chunked and embedded (`text-embedding-3-small`) into pgvector by `npm run ingest`.
2. `/api/chat` runs an OpenAI tool-using loop. Tools (`search_library`, `recommend_practice`, `generate_journal_prompt`) retrieve chunks via the `match_chunks` SQL function.
3. The model answers only from retrieved chunks; the UI shows which docs it used.

## Run locally
1. `npm install`
2. Create a Supabase project, run `db/schema.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local` and fill in keys.
4. `npm run ingest`
5. `npm run dev`

## Tests & eval
- `npm test` — unit tests (chunking, retrieval, tools, agent loop).
- `npm run eval` — grounding eval: in-corpus cites the right doc, off-corpus is declined.
```

- [ ] **Step 2: Deploy to Netlify**

Push the repo to GitHub, then in Netlify: "Add new site" → import the repo. Netlify auto-detects Next.js (`@netlify/plugin-nextjs`). In **Site settings → Environment variables**, add `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and optionally `OPENAI_CHAT_MODEL`. Deploy.

- [ ] **Step 3: Verify the live site**

Open the Netlify URL. Send "I feel anxious before a big meeting." Expected: a warm reply with a practice recommendation and source chip(s). Send an off-topic question — expected: it declines.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README and deployment notes"
```

---

## Self-review (completed against the spec)

- **Grounded Q&A with citations** → Tasks 9 (prompt/tools), 10 (agent collects sources), 13 (route returns them), 14 (chips). ✓
- **Refuses off-corpus** → prompt rule (Task 9) + tool "no material" path (Task 9) + eval (Task 15). ✓
- **Recommend a practice** → `recommend_practice` tool with type filter (Task 9). ✓
- **Generate journal prompt** → `generate_journal_prompt` tool (Task 9). ✓
- **Vector DB / RAG** → schema + `match_chunks` (Task 5), embed (Task 6), retrieve (Task 7), ingest (Task 12). ✓
- **Deployed live link** → Task 16. ✓
- **Coach persona + follow-up question** → SYSTEM_PROMPT (Task 9). ✓
- Out-of-scope (Circle, audio, voice, auth) correctly absent. ✓

Type consistency checked: `Chunk`, `Source`, `SearchFn`, `CoachResult`, tool names (`search_library`/`recommend_practice`/`generate_journal_prompt`), and `match_chunks` params are consistent across tasks.
