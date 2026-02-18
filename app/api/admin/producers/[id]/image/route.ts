import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import path from 'path'
import fs from 'fs/promises'
import { eq } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import { db, bottlers, distillers, generateId, whiskies } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const kindParam = (request.nextUrl.searchParams.get('kind') || 'distiller').toLowerCase()
    const kind = kindParam === 'bottler' ? 'bottler' : kindParam === 'whisky' ? 'whisky' : 'distiller'
    const formData = await request.formData()
    const image = formData.get('image') as File | null
    if (!image) return NextResponse.json({ error: 'Image is required' }, { status: 400 })

    const filename = `${generateId()}.webp`
    const uploadsRoot = process.env.UPLOADS_DIR || path.join(process.cwd(), 'public', 'uploads')
    const publicBase = process.env.UPLOADS_PUBLIC_URL || '/uploads/bottles'
    const targetBase = kind === 'whisky' ? publicBase : publicBase.replace(/\/bottles\/?$/i, '/producers')
    const publicPath = targetBase.replace(/^\/+/, '')
    const relativePath = publicPath.startsWith('uploads/')
      ? publicPath.slice('uploads/'.length)
      : publicPath
    const uploadDir = path.join(uploadsRoot, relativePath)
    await fs.mkdir(uploadDir, { recursive: true })
    const filePath = path.join(uploadDir, filename)

    const rawBuffer = await image.arrayBuffer()
    const buffer = Buffer.from(new Uint8Array(rawBuffer))
    let outputBuffer: Buffer = buffer
    try {
      const sharpModule = await import('sharp')
      const sharp = sharpModule.default || sharpModule
      outputBuffer = Buffer.from(
        await sharp(buffer).rotate().resize({ width: 1200, height: 1200, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).webp({ quality: 85 }).toBuffer()
      )
    } catch (_e) {
      // keep original buffer if sharp unavailable
    }

    await fs.writeFile(filePath, outputBuffer)
    const imageUrl = `${targetBase}/${filename}`

    if (kind === 'distiller') {
      await db.update(distillers).set({ imageUrl }).where(eq(distillers.id, id))
    } else if (kind === 'bottler') {
      await db.update(bottlers).set({ imageUrl }).where(eq(bottlers.id, id))
    } else {
      await db.update(whiskies).set({ bottleImageUrl: imageUrl, imageUrl }).where(eq(whiskies.id, id))
    }

    return NextResponse.json({ success: true, imageUrl })
  } catch (error) {
    console.error('❌ admin producers image upload error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
