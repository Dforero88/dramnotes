'use client'

import { useEffect, useRef, useState } from 'react'

type Tag = { id: string; name: string }

export default function TagInput({
  label,
  value,
  onChange,
  lang,
  placeholder,
  createLabel,
}: {
  label: string
  value: Tag[]
  onChange: (tags: Tag[]) => void
  lang: string
  placeholder: string
  createLabel: string
}) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Tag[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  useEffect(() => {
    const run = async () => {
      if (query.trim().length < 2) {
        setSuggestions([])
        return
      }
      const res = await fetch(`/api/tags/suggest?q=${encodeURIComponent(query.trim())}&lang=${lang}`)
      const json = await res.json()
      setSuggestions(json?.tags || [])
    }
    const t = setTimeout(run, 300)
    return () => clearTimeout(t)
  }, [query, lang])

  const addTag = (tag: Tag) => {
    if (value.some((t) => t.id === tag.id)) return
    onChange([...value, tag])
    setQuery('')
    setOpen(false)
  }

  const createTag = async () => {
    const name = query.trim()
    if (!name) return
    const res = await fetch('/api/tags/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, lang }),
    })
    const json = await res.json()
    if (res.ok && json?.tag) {
      addTag(json.tag)
    }
  }

  const removeTag = (id: string) => {
    onChange(value.filter((t) => t.id !== id))
  }

  return (
    <div ref={containerRef} className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="border rounded-xl px-3 py-2 bg-white">
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map((tag) => (
            <span key={tag.id} className="px-2 py-1 text-xs rounded-full bg-gray-100">
              {tag.name}
              <button
                type="button"
                className="ml-2 text-gray-500"
                onClick={() => removeTag(tag.id)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              createTag()
            }
          }}
          placeholder={placeholder}
          className="w-full outline-none text-sm"
        />
      </div>
      {open && (suggestions.length > 0 || query.trim().length >= 2) && (
        <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
          {suggestions.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => addTag(s)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            >
              {s.name}
            </button>
          ))}
          {suggestions.length === 0 && (
            <button
              type="button"
              onClick={createTag}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            >
              {createLabel} "{query.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  )
}
