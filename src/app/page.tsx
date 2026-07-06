import { Chat } from '@/components/Chat'
import { Library } from '@/components/Library'

export default function Home() {
  return (
    <main className="page">
      <header className="header">
        <h1>AI Transformation Coach</h1>
        <p className="sub">
          A RAG demo. Answers come only from the sample content library shown here — sources appear under each reply.
        </p>
      </header>
      <div className="layout">
        <div className="col-chat">
          <Chat />
        </div>
        <div className="col-lib">
          <Library />
        </div>
      </div>
    </main>
  )
}
