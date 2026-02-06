'use client'

import { useParams } from 'next/navigation'
import NotebookPage from '@/components/NotebookPage'

export default function UserNotebookPage() {
  const params = useParams()
  const pseudo = params.pseudo as string
  return <NotebookPage mode="public" pseudo={pseudo} />
}
