'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { getTranslations, type Locale } from '@/lib/i18n'

export default function ContactPageClient() {
  const params = useParams()
  const locale = params.locale as Locale
  const t = getTranslations(locale)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setFeedback('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message, website, locale }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Error')
      setFeedback(t('contact.success'))
      setName('')
      setEmail('')
      setSubject('')
      setMessage('')
      setWebsite('')
    } catch (err: any) {
      setFeedback(err?.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-12">
      <h1 className="font-display text-3xl text-gray-900">{t('contact.title')}</h1>
      <p className="mt-2 text-gray-700">{t('contact.subtitle')}</p>

      <form onSubmit={onSubmit} className="mt-6 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2"
          placeholder={t('form.pseudo')}
          required
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2"
          placeholder={t('contact.emailPlaceholder')}
          required
        />
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2"
          placeholder={t('contact.subjectPlaceholder')}
          required
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2 min-h-[140px]"
          placeholder={t('contact.messagePlaceholder')}
          required
        />
        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 rounded-xl text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {loading ? t('contact.sending') : t('contact.send')}
        </button>
        {feedback ? <p className="text-sm text-gray-700">{feedback}</p> : null}
      </form>
    </div>
  )
}

