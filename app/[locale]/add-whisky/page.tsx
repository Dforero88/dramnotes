'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { getTranslations, type Locale } from '@/lib/i18n'
import Link from 'next/link'
import Camera from '@/components/Camera'
import BarcodeCropper from '@/components/BarcodeCropper'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { useSession } from 'next-auth/react'

export default function AddWhiskyPage({
  params
}: {
  params: { locale: Locale }
}) {
  const { locale } = params
  const t = getTranslations(locale)
  const { data: session, status } = useSession()
  
  const {
    barcode,
    setBarcode,
    isScanning,
    isDetecting,
    startScanning,
    stopScanning,
    captureImage,
    image,
    setImage,
    error,
    scanImage,
  } = useBarcodeScanner()

  const [step, setStep] = useState<'scan' | 'label' | 'edit' | 'exists'>('scan')
  const [scanError, setScanError] = useState('')
  const [quaggaLoaded, setQuaggaLoaded] = useState(false)
  const [labelImage, setLabelImage] = useState<string>('')
  const [labelFile, setLabelFile] = useState<File | null>(null)
  const [bottleFile, setBottleFile] = useState<File | null>(null)
  const [bottlePreview, setBottlePreview] = useState<string>('')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState('')
  const [whiskyData, setWhiskyData] = useState<any>({})
  const [createError, setCreateError] = useState('')
  const [createStatus, setCreateStatus] = useState<'success' | 'duplicate' | null>(null)
  const [createdWhisky, setCreatedWhisky] = useState<{ id: string; name: string; imageUrl?: string | null } | null>(null)
  const [barcodeExists, setBarcodeExists] = useState(false)
  const [countries, setCountries] = useState<Array<{ id: string; name: string; nameFr?: string | null }>>([])

  const typeOptions = [
    'American whiskey',
    'Blend',
    'Blended Grain',
    'Blended Malt',
    'Bourbon',
    'Canadian Whisky',
    'Corn',
    'Rye',
    'Single Grain',
    'Single Malt',
    'Single Pot Still',
    'Spirit',
    'Tennesse',
    'Wheat',
  ]

  const normalizeType = (value: string) => value.trim().toLowerCase()
  const mapTypeToOption = (value: string) => {
    const needle = normalizeType(value)
    return typeOptions.find((opt) => normalizeType(opt) === needle) || ''
  }

  const mapCountryToId = (value: string) => {
    const needle = value.trim().toLowerCase()
    const match = countries.find((c) => c.name?.toLowerCase() === needle)
    return match?.id || ''
  }

  // Charge Quagga au montage
  useEffect(() => {
    // Vérifier si déjà chargé
    if ((window as any).Quagga) {
      setQuaggaLoaded(true)
      return
    }
    
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/@ericblade/quagga2@1.7.7/dist/quagga.min.js'
    script.async = true
    
    script.onload = () => {
      setQuaggaLoaded(true)
    }
    
    script.onerror = () => {
      console.error('❌ Échec chargement Quagga')
    }
    
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    const loadCountries = async () => {
      try {
        const res = await fetch('/api/countries')
        const json = await res.json()
        setCountries(json?.countries || [])
      } catch (e) {
        console.error('❌ Erreur load countries', e)
      }
    }
    loadCountries()
  }, [])

  const handleImageCaptured = (imageData: string) => {
    captureImage(imageData)
    setScanError('')
    stopScanning()
  }

  const handleCropComplete = async (croppedImage: string) => {
    setImage(croppedImage)
    
    if (!quaggaLoaded) {
      setScanError(t('whisky.scanUnavailable'))
      return;
    }
    
    // Affiche l'image cropée pour débogage
    console.log('🖼️ Image cropée (début):', croppedImage.substring(0, 100));
    console.log('📏 Taille image:', croppedImage.length);
    
    // Scanner l'image cropée
    const success = await scanImage(croppedImage)
    
    if (success) {
      setScanError('')
      // On a un code-barres -> on peut masquer l'image
      setImage('')
    } else {
      setScanError(t('whisky.barcodeUnreadable'))
    }
  }

  const checkBarcodeExistence = async (value: string) => {
    const res = await fetch('/api/whisky/check-barcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: value }),
    })
    const json = await res.json()
    return Boolean(json?.exists)
  }

  const proceedToNextStep = async () => {
    const value = barcode?.trim()
    if (!value) {
      setStep('label')
      return
    }

    const exists = await checkBarcodeExistence(value)
    if (exists) {
      setBarcodeExists(true)
      setImage('')
      stopScanning()
      setStep('scan')
    } else {
      setBarcodeExists(false)
      setStep('label')
    }
  }

  const onLabelSelected = (file: File) => {
    setLabelFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      setLabelImage(String(e.target?.result || ''))
    }
    reader.readAsDataURL(file)
  }

  const onBottleSelected = (file: File | null) => {
    setBottleFile(file)
    if (!file) {
      setBottlePreview('')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      setBottlePreview(String(e.target?.result || ''))
    }
    reader.readAsDataURL(file)
  }

  const handleLabelProcess = async () => {
    if (!labelFile) return
    setOcrLoading(true)
    setOcrError('')
    try {
      const form = new FormData()
      form.append('label_image', labelFile)
      const res = await fetch('/api/whisky/ocr', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Erreur OCR')
      }
      const parsed = json.whisky_data || {}
      if (parsed?.type && typeof parsed.type === 'string') {
        parsed.type = mapTypeToOption(parsed.type)
      }
      if (!parsed?.bottling_type && typeof parsed?.bottler === 'string') {
        const bottlerLower = parsed.bottler.toLowerCase()
        if (bottlerLower.includes('distillery bottling')) {
          parsed.bottling_type = 'DB'
        }
      }
      if (parsed?.country && typeof parsed.country === 'string') {
        parsed.country_id = mapCountryToId(parsed.country)
      }
      setWhiskyData(parsed)
      setStep('edit')
    } catch (err: any) {
      setOcrError(err?.message || 'Erreur OCR')
    } finally {
      setOcrLoading(false)
    }
  }

  const handleCreateWhisky = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCreateError('')
    setCreateStatus(null)
    if (!session?.user?.id) {
      setCreateError('Vous devez être connecté pour ajouter un whisky')
      return
    }
    if (!bottleFile) {
      setCreateError('Veuillez ajouter une photo de la bouteille')
      return
    }

    const formData = new FormData(e.currentTarget)
    const payload: any = {}
    formData.forEach((value, key) => {
      payload[key] = value
    })
    payload.ean13 = barcode || ''
    payload.added_by = session?.user?.id || ''

    if (!payload.name || String(payload.name).trim() === '') {
      setCreateError('Le nom est obligatoire')
      return
    }
    if (!payload.type || String(payload.type).trim() === '') {
      setCreateError('Le type est obligatoire')
      return
    }
    if (!payload.country_id || String(payload.country_id).trim() === '') {
      setCreateError('Le pays est obligatoire')
      return
    }
    if (payload.bottling_type === 'DB' && (!payload.distiller || String(payload.distiller).trim() === '')) {
      setCreateError('Le distiller est obligatoire pour un embouteillage DB')
      return
    }
    if (payload.bottling_type === 'IB' && (!payload.bottler || String(payload.bottler).trim() === '')) {
      setCreateError('Le bottler est obligatoire pour un embouteillage IB')
      return
    }

    const upload = new FormData()
    upload.append('whisky_data', JSON.stringify(payload))
    upload.append('bottle_image', bottleFile)

    const res = await fetch('/api/whisky/create', {
      method: 'POST',
      body: upload,
    })
    const json = await res.json()
    if (!res.ok) {
      if (json?.code === 'DUPLICATE') {
        setCreateStatus('duplicate')
        setStep('exists')
        return
      }
      setCreateError(json?.error || 'Erreur serveur')
      return
    }

    setCreateStatus('success')
    setCreatedWhisky({
      id: json?.id,
      name: payload.name,
      imageUrl: json?.bottleImageUrl || bottlePreview || null,
    })
    setStep('exists')
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">Connexion requise</h1>
            <p className="text-gray-600 mb-6">
              Vous devez être connecté pour ajouter un whisky.
            </p>
            <Link
              href={`/${locale}/login`}
              className="px-6 py-3 text-white rounded-lg inline-block"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div
        className="px-4 md:px-8 py-4"
        style={{ backgroundColor: 'var(--color-primary-light)' }}
      >
        <div className="max-w-6xl mx-auto text-sm text-gray-600 text-center">
          <Link href={`/${locale}/catalogue`} className="hover:underline">
            {t('catalogue.title')}
          </Link>
          <span className="mx-2">›</span>
          <span className="text-gray-800">{t('whisky.addWhiskyTitle')}</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">

        {/* État de Quagga */}
        {!quaggaLoaded && step === 'scan' && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-700">
              <span className="inline-block animate-pulse">⏳</span> {t('whisky.loadingScanner')}
            </p>
          </div>
        )}

        {/* Étapes visuelles */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-8">
            <div className={`step ${step === 'scan' ? 'active' : ''}`}>
              <div className="step-number">1</div>
              <div className="step-label">{t('whisky.stepBarcode')}</div>
            </div>
            <div className="step-line"></div>
            <div className={`step ${step === 'label' ? 'active' : ''}`}>
              <div className="step-number">2</div>
              <div className="step-label">{t('whisky.stepLabel')}</div>
            </div>
            <div className="step-line"></div>
            <div className={`step ${['edit', 'exists'].includes(step) ? 'active' : ''}`}>
              <div className="step-number">3</div>
              <div className="step-label">{t('whisky.stepOcrResult')}</div>
            </div>
          </div>
        </div>

        {/* Contenu principal */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <>
              {/* Étape 1: Code-barres */}
              {step === 'scan' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">{t('whisky.step1Title')}</h2>
                    {barcodeExists && (
                      <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
                        {t('whisky.barcodeExists')}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setImage('')
                        setScanError('')
                        startScanning()
                      }}
                      className="px-8 py-4 text-white rounded-lg text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                      disabled={!quaggaLoaded}
                    >
                      {quaggaLoaded ? t('whisky.openCamera') : t('whisky.loadingScanner')}
                    </button>
                  </div>

                  {isScanning && (
                    <Camera 
                      onCapture={handleImageCaptured}
                      isActive={isScanning}
                      autoOpen
                      showButton={false}
                    />
                  )}

                  {image && (
                    <div className="space-y-6">
                      <BarcodeCropper
                        image={image}
                        onCropComplete={handleCropComplete}
                        onCancel={() => {
                          setImage('')
                          setScanError('')
                        }}
                      />

                      {isDetecting && (
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-600 rounded-full border-t-transparent"></div>
                          <p className="mt-2 text-blue-700">{t('whisky.scanning')}</p>
                        </div>
                      )}
                      {scanError && !isDetecting && (
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-yellow-700 whitespace-pre-line">{scanError}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('whisky.fieldBarcode')}
                    </label>
                    <input
                      type="text"
                      value={barcode}
                      onChange={(e) => {
                        setBarcode(e.target.value)
                        setBarcodeExists(false)
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                      placeholder={t('whisky.manualBarcodePlaceholder')}
                    />
                  </div>
                  <button
                    onClick={proceedToNextStep}
                    disabled={!barcode?.trim()}
                    className="px-6 py-3 text-white rounded-lg disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    {t('whisky.verifyBarcode')}
                  </button>

                  <hr className="my-6 border-gray-200" />
                  <div className="text-gray-600">
                    <p>{t('whisky.noBarcodeLabel')}</p>
                    <button
                      onClick={() => {
                        setBarcode('')
                        setBarcodeExists(false)
                        setStep('label')
                      }}
                      className="mt-3 px-6 py-3 border rounded-lg"
                      style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                    >
                      {t('whisky.noBarcode')}
                    </button>
                  </div>
                </div>
              )}

              
              
              
              {step === 'label' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold">{t('whisky.step2Title')}</h2>
                  <p className="text-gray-600">{t('whisky.step2Subtitle')}</p>
                  <div>
                    <button
                      type="button"
                      onClick={() => document.getElementById('label-image')?.click()}
                      className="px-6 py-3 text-white rounded-lg"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      {t('whisky.takeLabelPhoto')}
                    </button>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      id="label-image"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) onLabelSelected(file)
                      }}
                    />
                  </div>
                  {labelImage && (
                    <img src={labelImage} className="max-w-full rounded-lg" alt="Label" />
                  )}
                  {ocrError && <p className="text-red-600">{ocrError}</p>}
                  <button
                    onClick={() => {
                      if (!labelFile) {
                      setOcrError(t('whisky.labelPhotoRequired'))
                      return
                    }
                    handleLabelProcess()
                  }}
                    disabled={ocrLoading}
                    className="px-6 py-2 text-white rounded-lg"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    {ocrLoading ? t('whisky.ocrLoading') : t('whisky.ocrAnalyze')}
                  </button>
                </div>
              )}

              {step === 'edit' && (
                <form className="space-y-4" onSubmit={handleCreateWhisky}>
                  <h2 className="text-2xl font-bold">{t('whisky.step3Title')}</h2>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('whisky.fieldName')}</label>
                    <input name="name" defaultValue={whiskyData.name || ''} className="w-full border rounded px-3 py-2" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('whisky.fieldDistiller')}</label>
                      <input name="distiller" defaultValue={whiskyData.distiller || ''} className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('whisky.fieldBottler')}</label>
                      <input name="bottler" defaultValue={whiskyData.bottler || ''} className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('whisky.fieldCountry')}</label>
                      <select name="country_id" defaultValue={whiskyData.country_id || ''} className="w-full border rounded px-3 py-2">
                        <option value="">{t('common.selectEmpty')}</option>
                        {countries.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('whisky.fieldBarcode')}</label>
                      <input name="ean13" value={barcode || ''} readOnly disabled className="w-full border rounded px-3 py-2 bg-gray-50" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('whisky.fieldBottlingType')}</label>
                      <select name="bottling_type" defaultValue={whiskyData.bottling_type || ''} className="w-full border rounded px-3 py-2">
                        <option value="">{t('common.selectEmpty')}</option>
                        <option value="DB">{t('whisky.bottlingDB')}</option>
                        <option value="IB">{t('whisky.bottlingIB')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('whisky.fieldType')}</label>
                      <select name="type" defaultValue={whiskyData.type || ''} className="w-full border rounded px-3 py-2">
                        <option value="">{t('common.selectEmpty')}</option>
                        {typeOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('whisky.fieldDistilledYear')}</label>
                      <input name="distilled_year" defaultValue={whiskyData.distilled_year || ''} className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('whisky.fieldBottledYear')}</label>
                      <input name="bottled_year" defaultValue={whiskyData.bottled_year || ''} className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('whisky.fieldAge')}</label>
                      <input name="age" defaultValue={whiskyData.age || ''} className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('whisky.fieldCaskType')}</label>
                      <input name="cask_type" defaultValue={whiskyData.cask_type || ''} className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('whisky.fieldBatchId')}</label>
                      <input name="batch_id" defaultValue={whiskyData.batch_id || ''} className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('whisky.fieldAlcoholVolume')}</label>
                      <input name="alcohol_volume" defaultValue={whiskyData.alcohol_volume || ''} className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('whisky.fieldBottledFor')}</label>
                      <input name="bottled_for" defaultValue={whiskyData.bottled_for || ''} className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('whisky.fieldRegion')}</label>
                      <input name="region" defaultValue={whiskyData.region || ''} className="w-full border rounded px-3 py-2" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('whisky.fieldBottlePhoto')}</label>
                    <button
                      type="button"
                      onClick={() => document.getElementById('bottle-image')?.click()}
                      className="px-6 py-3 text-white rounded-lg"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      {t('whisky.takeBottlePhoto')}
                    </button>
                    <input
                      id="bottle-image"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => onBottleSelected(e.target.files?.[0] || null)}
                    />
                    {bottlePreview && (
                      <img src={bottlePreview} className="mt-4 max-w-xs rounded-lg" alt="Bouteille" />
                    )}
                  </div>
                  {createError && <p className="text-red-600">{createError}</p>}
                  <button
                    type="submit"
                    className="px-6 py-2 text-white rounded-lg"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                    disabled={status !== 'authenticated'}
                  >
                    {t('whisky.createWhisky')}
                  </button>
                </form>
              )}

              {step === 'exists' && (
                <div className="p-6 bg-white rounded-2xl">
                  {createStatus === 'success' && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">{t('whisky.createSuccess')}</h3>
                        <p className="text-sm text-gray-600 mt-1">{t('whisky.createSuccessSubtitle')}</p>
                      </div>
                      {createdWhisky && createdWhisky.id && (
                        <Link
                          href={`/${locale}/whisky/${createdWhisky.id}`}
                          className="flex items-center gap-5 rounded-2xl border border-gray-100 bg-gray-50 p-5"
                        >
                          <div className="w-24 h-24 rounded-xl bg-white border border-gray-200 overflow-hidden flex items-center justify-center">
                            {createdWhisky.imageUrl ? (
                              <img src={createdWhisky.imageUrl} alt={createdWhisky.name} className="w-full h-full object-contain" />
                            ) : (
                              <span className="text-xs text-gray-400">{t('catalogue.noImage')}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-lg font-semibold text-gray-900 truncate">{createdWhisky.name}</div>
                            <div className="text-sm text-gray-500">{t('whisky.createdCardLabel')}</div>
                          </div>
                        </Link>
                      )}
                    </div>
                  )}
                  {createStatus === 'duplicate' && (
                    <div className="space-y-4">
                      <p className="text-yellow-700">{t('whisky.duplicateFound')}</p>
                      <button
                        onClick={() => {
                          setStep('edit')
                          setCreateStatus(null)
                        }}
                        className="px-6 py-2 rounded-lg border"
                        style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                      >
                        {t('common.backEdit')}
                      </button>
                    </div>
                  )}
                </div>
              )}
          </>
        </div>

        {/* Styles inline pour les étapes */}
        <style jsx>{`
          .step {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .step-number {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            background: #e5e7eb;
            color: #6b7280;
          }
          .step.active .step-number {
            background: var(--color-primary);
            color: white;
          }
          .step-label {
            margin-top: 8px;
            font-size: 14px;
            color: #6b7280;
          }
          .step.active .step-label {
            color: var(--color-primary);
            font-weight: 500;
          }
          .step-line {
            flex: 1;
            height: 2px;
            background: #e5e7eb;
            margin: 0 10px;
          }
        `}</style>
      </div>
    </div>
  )
}
