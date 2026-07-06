import { Chat } from '@/components/Chat'
import { Library } from '@/components/Library'

export default function Home() {
  return (
    <main className="page">
      <header className="header">
        <div className="aura" aria-hidden="true" />
        <div>
          <h1>AI Transformation Coach</h1>
          <p className="tagline">a gentle space to breathe, reflect, and reframe</p>
        </div>
      </header>

      <div className="layout">
        <div className="card chat-wrap">
          <Chat />
        </div>
        <div className="card library-wrap">
          <Library />
        </div>
      </div>

      <p className="foot">
        A demo running on a small sample library — grounded, not clinical advice.
      </p>
    </main>
  )
}
