import type { Source } from '@/lib/types'

export function SourceChips({ sources }: { sources: Source[] }) {
  if (!sources || sources.length === 0) return null
  return (
    <div className="chips">
      <span className="chips-label">drawn from</span>
      {sources.map((s, i) => (
        <span key={`${s.title}-${i}`} className="chip" title={s.type}>
          {s.title}
        </span>
      ))}
    </div>
  )
}
