'use client'

import { useEffect, useState } from 'react'

interface LibraryDoc {
  title: string
  type: string
  content: string
}

export function Library() {
  const [docs, setDocs] = useState<LibraryDoc[]>([])
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/library')
      .then((r) => r.json())
      .then((d) => setDocs(d.docs ?? []))
      .catch(() => {})
  }, [])

  if (docs.length === 0) return null

  return (
    <aside className="library">
      <h2 className="lib-title">
        The library <span className="lib-count">{docs.length} practices</span>
      </h2>
      <p className="lib-sub">Everything the coach shares is drawn from these — nothing invented. Open any one to read it.</p>
      <ul className="lib-list">
        {docs.map((d) => (
          <li key={d.title} className="lib-li">
            <button
              className="lib-item"
              onClick={() => setOpen(open === d.title ? null : d.title)}
              aria-expanded={open === d.title}
            >
              <span className={`tag tag-${d.type}`}>{d.type}</span>
              <span className="lib-item-title">{d.title}</span>
            </button>
            {open === d.title && <p className="lib-content">{d.content}</p>}
          </li>
        ))}
      </ul>
    </aside>
  )
}
