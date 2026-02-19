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
  createDisabledLabel,
  allowCreate = true,
  disabled = false,
}: {
  label: string
  value: Tag[]
  onChange: (tags: Tag[]) => void
  lang: string
  placeholder: string
  createLabel: string
  createDisabledLabel?: string
  allowCreate?: boolean
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Tag[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
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
      if (disabled) {
        setSuggestions([])
        return
      }
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
  }, [query, lang, disabled])

  const addTag = (tag: Tag) => {
    if (value.some((t) => t.id === tag.id)) return
    setError('')
    onChange([...value, tag])
    setQuery('')
    setOpen(false)
  }

  const createTag = async () => {
    if (!allowCreate) return
    if (disabled) return
    const name = query.trim()
    if (!name) return
    const res = await fetch('/api/tags/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, lang }),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok && json?.tag) {
      setError('')
      addTag(json.tag)
      return
    }
    setError(json?.error || 'Erreur lors de la création du tag')
  }

  const removeTag = (id: string) => {
    if (disabled) return
    onChange(value.filter((t) => t.id !== id))
  }

  return (
    <div ref={containerRef} className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="border border-gray-200 rounded-xl px-3 py-2 bg-white focus-within:ring-2" style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}>
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map((tag) => (
            <span key={tag.id} className="px-2 py-1 text-xs rounded-full bg-gray-100">
              {tag.name}
              <button
                type="button"
                className="ml-2 text-gray-500"
                disabled={disabled}
                onClick={() => removeTag(tag.id)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (allowCreate) createTag()
            }
          }}
          placeholder={placeholder}
          className="w-full outline-none text-sm disabled:text-gray-400"
        />
      </div>
      {!disabled && open && (suggestions.length > 0 || query.trim().length >= 2) && (
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
          {allowCreate && suggestions.length === 0 && (
            <button
              type="button"
              onClick={createTag}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            >
              {createLabel} "{query.trim()}"
            </button>
          )}
          {!allowCreate && suggestions.length === 0 && (
            <div className="w-full px-3 py-2 text-sm text-gray-500 bg-gray-50">
              {createDisabledLabel || createLabel}
            </div>
          )}
        </div>
      )}
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  )
}
