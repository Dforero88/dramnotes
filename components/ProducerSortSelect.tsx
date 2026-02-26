'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type Props = {
  value: string
  label: string
  options: Array<{ value: string; label: string }>
}

export default function ProducerSortSelect({ value, label, options }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const onChange = (nextSort: string) => {
    const params = new URLSearchParams(searchParams?.toString() || '')
    params.set('sort', nextSort)
    params.set('page', '1')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm font-semibold text-gray-700">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

