'use client'

export const dynamic = 'force-dynamic'

export default function UserNotebookPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">User notebook</h1>
      <p>En construction</p>
    </div>
  )
}

/*
import { useParams } from 'next/navigation'
import NotebookPage from '@/components/NotebookPage'

export default function UserNotebookPage() {
  const params = useParams()
  const pseudo = params.pseudo as string
  return <NotebookPage mode="public" pseudo={pseudo} />
}
*/
