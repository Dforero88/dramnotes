'use client'

import { useEffect, useState } from 'react'

type Props = {
  src: string | null
  alt: string
  noImageLabel: string
  locale: 'fr' | 'en'
}

export default function WhiskyImageLightbox({ src, alt, noImageLabel, locale }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!src) {
    return (
      <div className="aspect-square md:max-h-[360px] lg:max-h-none bg-white rounded-xl flex items-center justify-center overflow-hidden">
        <div className="text-gray-400">{noImageLabel}</div>
      </div>
    )
  }

  const closeLabel = locale === 'en' ? 'Close image' : 'Fermer l’image'
  const zoomLabel = locale === 'en' ? 'Open larger image' : 'Ouvrir l’image en grand'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group aspect-square md:max-h-[360px] lg:max-h-none w-full bg-white rounded-xl flex items-center justify-center overflow-hidden cursor-zoom-in"
        style={{ borderRadius: '0.75rem' }}
        aria-label={zoomLabel}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain object-center mx-auto my-auto transition-transform duration-200 group-hover:scale-[1.02]"
        />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] bg-black/80 px-4 py-6 md:p-8"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={alt}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label={closeLabel}
          >
            ×
          </button>
          <div className="flex h-full items-center justify-center">
            <img
              src={src}
              alt={alt}
              className="max-h-full max-w-full rounded-2xl object-contain"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
