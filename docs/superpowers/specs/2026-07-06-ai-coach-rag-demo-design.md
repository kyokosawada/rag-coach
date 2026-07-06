# AI Transformation Coach — RAG Demo (Credential)

**Date:** 2026-07-06
**Status:** Design approved, ready for implementation plan
**Author:** Giusippi Apa

## Purpose

Build a small, **working, deployed RAG "AI coach"** that proves the exact stack AI-coaching
job posts ask for: RAG, vector database, knowledge base, OpenAI, prompt engineering, and a
tool-using agent.

It directly mirrors the "women's transformation brand AI coach" V1 — RAG over a content
library + a coach persona + recommend/generate tools — with one substitution: **no Circle
integration**. Circle is swapped for a plain public chat page so anyone can click the link.

The result is a **reusable portfolio piece**: honest to present as "a RAG coach I built,
live link," usable for this application and any future AI role.

### Non-goals

- **Not** the employer's real product. Runs on clearly-labeled **sample content**, not their IP.
- **Not** Phase 2/3: no audio generation, no voice, no guided visualizations, no progress
  tracking, no transformation plans.
- **Not** Circle integration (swapped for a standalone chat page).
- **No** model fine-tuning — this is retrieval + prompting, not training.
- **No** auth / accounts / long-term member history. Single-session demo.

## What it does (V1 scope)

1. **Grounded Q&A** — answers **only** from the indexed content, shows the source doc(s) it
   used, and says "I don't have anything on that" when the question is off-corpus (no
   hallucinating). This is the core credibility proof.
2. **Recommend a practice** — given how a member feels or what they ask for, recommends a
   session / meditation / breathwork from the library, with a one-line why.
3. **Generate a journal prompt** — produces a personalized journal or future-self prompt,
   grounded in the retrieved material.
4. **Coach persona** — warm, reflective voice; asks a coaching-style follow-up question.

## Architecture

Six focused units, each independently understandable and testable.

### 1. Content corpus (`content/`)
~30–50 sample documents representing a transformation methodology: breathwork guides,
meditation scripts, shadow-work worksheets, journaling exercises, short framework notes.
Sourced from openly-licensed / public-domain wellness material or synthetic content authored
for the demo. Every doc carries a visible "sample content for demonstration" marker. Stored as
markdown/txt files with light frontmatter (`title`, `type`).

### 2. Ingestion (seed script)
Read files → chunk by heading/paragraph (~500–800 tokens, small overlap) → attach metadata
(`doc_title`, `doc_type`) → embed each chunk via OpenAI embeddings → upsert into Supabase.
Run once to populate the vector table; idempotent re-runs.

### 3. Storage (Supabase Postgres + pgvector)
One `chunks` table: `id`, `doc_title`, `doc_type`, `content`, `embedding vector`, `metadata`.
Vector index (hnsw) for similarity. A SQL `match_chunks(query_embedding, k, type_filter)`
function returning top-k by cosine similarity, with optional `doc_type` filter (used by the
recommend tool).

### 4. Retrieval
Embed the query → call `match_chunks` → return chunks + their source titles. Type-filtered
variant for recommendations.

### 5. Agent (tool-using loop)
A single chat endpoint running a small function-calling loop (same pattern as the
`gemini-slack-assistant` agent). The model decides which tool to call:
- `search_library(query)` → grounded answer material (default path).
- `recommend_practice(feeling_or_goal, type?)` → type-filtered retrieval → recommendation.
- `generate_journal_prompt(theme)` → retrieval → personalized prompt.

System prompt enforces the rules: **answer only from retrieved context, cite the source,
decline when nothing relevant is found, hold a warm coach voice, end with a follow-up
question.**

### 6. UI (Next.js chat page)
Message list, input, streamed responses, and **citation chips** showing which doc(s) informed
each answer. Calm/warm styling, mobile-friendly. A short "what is this?" note stating it's a
demo on sample content. Deployed on Netlify.

## Data flow

user message → API route → agent loop (embed query → tool call → `match_chunks` retrieval →
LLM composes grounded answer + citations) → streamed to UI → UI renders answer + source chips.

## Tech stack

- **Next.js** (chat UI + API routes) → deploy on **Netlify** (matches the portfolio).
- **Supabase Postgres + pgvector** for vector search (leverages existing Supabase strength).
- **OpenAI** for embeddings + generation.
- TypeScript throughout. Keys server-side via env vars.

(The existing Python `~/dev/RAG` "DocuChat" scaffold covers the same idea but in a slower-to-ship
stack; TS gets a polished live demo faster and stays coherent with the rest of the portfolio.)

## Testing

- **Unit:** chunking, frontmatter/tag parsing, the `match_chunks` retrieval wrapper, tool routing.
- **Grounding eval (the key one):** ~10 in-corpus Q&A pairs (assert the answer cites the right
  doc) + a few off-corpus questions (assert it declines rather than invents). "Answers from the
  library, refuses when off-corpus" is the credibility the demo exists to prove.

## Rough milestones (for the implementation plan)

- **M1** — repo + Supabase pgvector schema + `match_chunks`; seed one doc; retrieval returns a chunk.
- **M2** — ingestion over the full sample corpus.
- **M3** — chat endpoint: grounded answer + citations.
- **M4** — tool loop: `recommend_practice` + `generate_journal_prompt`.
- **M5** — UI polish, coach voice, deploy live on Netlify.
- **M6** — grounding eval set + README + shareable link.

## How this feeds the application

Once live, the job application leads with: *"Here's a working RAG coach I built — [live link]."*
The "how I'd build it" answer then comes from having actually built it, and the one gap (no
shipped RAG project) is closed with something they can click.
