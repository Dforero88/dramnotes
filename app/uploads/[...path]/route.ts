import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'

export const dynamic = 'force-dynamic'

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: requestPath } = await context.params
    const segments = requestPath || []
    const baseDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'public', 'uploads')
    const requestedPath = path.join(baseDir, ...segments)
    const resolvedBase = path.resolve(baseDir)
    const resolvedFile = path.resolve(requestedPath)

    if (!resolvedFile.startsWith(resolvedBase)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    const file = await fs.readFile(resolvedFile)
    const ext = path.extname(resolvedFile).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    return new NextResponse(file, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    console.error('❌ Erreur serve upload:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
