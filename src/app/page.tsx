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
