import OpenAI from 'openai'
import { LLM_BASE_URL } from '@/lib/config'

// Creates the LLM client. Uses the OpenAI SDK pointed at LLM_BASE_URL
// (Gemini's OpenAI-compatible endpoint by default).
export function createLLMClient(): OpenAI {
  const apiKey = process.env.LLM_API_KEY
  if (!apiKey) throw new Error('Missing LLM_API_KEY')
  return new OpenAI({ apiKey, baseURL: LLM_BASE_URL })
}
