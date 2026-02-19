'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type HeroSlide = {
  href: string
  image: string
  title: string
  description: string
}

type HomeHeroCarouselProps = {
  slides: HeroSlide[]
}

export default function HomeHeroCarousel({ slides }: HomeHeroCarouselProps) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (slides.length <= 1) return
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length)
    }, 6000)
    return () => window.clearInterval(timer)
  }, [slides.length])

  if (slides.length === 0) return null

  const goPrev = () => setIndex((prev) => (prev - 1 + slides.length) % slides.length)
  const goNext = () => setIndex((prev) => (prev + 1) % slides.length)

  return (
    <div className="relative overflow-hidden">
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((slide) => (
          <Link
            key={slide.href}
            href={slide.href}
            className="relative block h-[380px] xl:h-[460px] w-full shrink-0"
          >
            <img
              src={slide.image}
              alt={slide.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="relative z-10 flex h-full items-end p-8">
              <div className="max-w-2xl rounded-2xl bg-black/40 px-5 py-4 backdrop-blur-[1px]">
                <div
                  className="text-4xl xl:text-5xl font-semibold text-white"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  {slide.title}
                </div>
                <div className="mt-2 text-lg text-white/95">{slide.description}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {slides.length > 1 ? (
        <>
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/35 text-white hover:bg-black/50 transition"
            aria-label="Previous slide"
          >
            ←
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/35 text-white hover:bg-black/50 transition"
            aria-label="Next slide"
          >
            →
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {slides.map((_, dotIndex) => (
              <button
                key={`dot-${dotIndex}`}
                type="button"
                onClick={() => setIndex(dotIndex)}
                className={`h-2.5 rounded-full transition ${
                  dotIndex === index ? 'w-7 bg-white' : 'w-2.5 bg-white/55'
                }`}
                aria-label={`Go to slide ${dotIndex + 1}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
