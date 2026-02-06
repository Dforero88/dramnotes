'use client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { useParams } from 'next/navigation'
import NotebookPage from '@/components/NotebookPage'

export default function UserNotebookPage() {
  const params = useParams()
  const pseudo = params.pseudo as string
  return <NotebookPage mode="public" pseudo={pseudo} />
}
