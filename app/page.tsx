// app/page.tsx
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function RootPage() {
  redirect('/fr')
  return null
}
