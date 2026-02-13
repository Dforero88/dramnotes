import { NextRequest, NextResponse } from 'next/server'
import { callGoogleVision, parseWithOpenAI } from '@/lib/whisky/ocr'
import { resolveBottlerName, resolveDistillerName } from '@/lib/producer-resolver'

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

    const distillerResolution = whiskyData?.distiller
      ? await resolveDistillerName(String(whiskyData.distiller))
      : null
    const bottlerResolution = whiskyData?.bottler
      ? await resolveBottlerName(String(whiskyData.bottler))
      : null

    if (distillerResolution?.confidence === 'high' && distillerResolution.resolvedName) {
      whiskyData.distiller = distillerResolution.resolvedName
    }
    if (bottlerResolution?.confidence === 'high' && bottlerResolution.resolvedName) {
      whiskyData.bottler = bottlerResolution.resolvedName
    }

    return NextResponse.json({
      success: true,
      ocr_text: ocrText,
      whisky_data: whiskyData,
      producer_resolution: {
        distiller: distillerResolution,
        bottler: bottlerResolution,
      },
    })
  } catch (error) {
    console.error('❌ Erreur OCR:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
