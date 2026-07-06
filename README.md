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
