'use client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

import NotebookPage from '@/components/NotebookPage'

export default function Page() {
  return <NotebookPage mode="self" />
}
