import { NextRequest, NextResponse } from 'next/server'
import { callGoogleVision, parseWithOpenAI } from '@/lib/whisky/ocr'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('label_image') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Image manquante' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')

    const ocrText = await callGoogleVision(base64)
    if (!ocrText) {
      return NextResponse.json({ error: 'Aucun texte détecté sur l\'image' }, { status: 400 })
    }

    const whiskyData = await parseWithOpenAI(ocrText)

    return NextResponse.json({
      success: true,
      ocr_text: ocrText,
      whisky_data: whiskyData,
    })
  } catch (error) {
    console.error('❌ Erreur OCR:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
