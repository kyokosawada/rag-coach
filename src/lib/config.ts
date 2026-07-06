// Provider-neutral LLM config. Defaults point at Gemini's OpenAI-compatible
// endpoint, but any OpenAI-compatible provider works by changing LLM_BASE_URL
// and the model names — the rest of the code is unchanged.
export const LLM_BASE_URL =
  process.env.LLM_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta/openai/'
export const CHAT_MODEL = process.env.CHAT_MODEL ?? 'gemini-2.5-flash'
export const EMBED_MODEL = process.env.EMBED_MODEL ?? 'gemini-embedding-001'
export const EMBED_DIMS = Number(process.env.EMBED_DIMS ?? 1536)
export const TOP_K = 5
