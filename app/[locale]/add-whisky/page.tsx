'use client'

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

  const [step, setStep] = useState<'scan' | 'crop' | 'result' | 'label' | 'edit' | 'exists'>('scan')
  const [manualEntry, setManualEntry] = useState(false)
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
    setStep('crop')
    setScanError('')
  }

  const handleCropComplete = async (croppedImage: string) => {
    setImage(croppedImage)
    
    if (!quaggaLoaded) {
      setScanError('Scanner non disponible. Rechargez la page.');
      return;
    }
    
    // Affiche l'image cropée pour débogage
    console.log('🖼️ Image cropée (début):', croppedImage.substring(0, 100));
    console.log('📏 Taille image:', croppedImage.length);
    
    // Scanner l'image cropée
    const success = await scanImage(croppedImage)
    
    if (success) {
      setStep('result')
    } else {
      setScanError(error || 'Pas de code-barre détecté. Crop plus serré ?')
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
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Navigation */}
        <div className="mb-8">
          <Link 
            href={`/${locale}/catalogue`}
            className="hover:underline"
            style={{ color: 'var(--color-primary)' }}
          >
            ← Retour au catalogue
          </Link>
        </div>

        {/* État de Quagga */}
        {!quaggaLoaded && step === 'scan' && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-700">
              <span className="inline-block animate-pulse">⏳</span> Chargement du scanner...
            </p>
          </div>
        )}

        {/* Étapes visuelles */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-8">
            <div className={`step ${step === 'scan' || step === 'crop' ? 'active' : ''}`}>
              <div className="step-number">1</div>
              <div className="step-label">Photo</div>
            </div>
            <div className="step-line"></div>
            <div className={`step ${step === 'crop' ? 'active' : ''}`}>
              <div className="step-number">2</div>
              <div className="step-label">Crop</div>
            </div>
            <div className="step-line"></div>
            <div className={`step ${step === 'result' ? 'active' : ''}`}>
              <div className="step-number">3</div>
              <div className="step-label">Résultat</div>
            </div>
          </div>
        </div>

        {/* Contenu principal */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {!manualEntry ? (
            <>
              {/* Étape 1: Photo */}
              {step === 'scan' && !isScanning && !image && (
                <div className="text-center p-8">
                  <h2 className="text-2xl font-bold mb-6">📸 Prendre une photo du code-barre</h2>
                  {barcodeExists && (
                    <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
                      Ce code-barres existe déjà dans le catalogue.
                    </div>
                  )}
                  <button
                    onClick={startScanning}
                    className="px-8 py-4 text-white rounded-lg text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                    disabled={!quaggaLoaded}
                  >
                    {quaggaLoaded ? 'Ouvrir la caméra' : 'Chargement scanner...'}
                  </button>
                  <div className="mt-8 text-gray-600">
                    <p>Ou</p>
                    <button
                      onClick={() => setManualEntry(true)}
                      className="mt-4 px-6 py-3 border rounded-lg"
                      style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                    >
                      Pas de code-barre
                    </button>
                  </div>
                </div>
              )}

              {/* Caméra */}
              {step === 'scan' && isScanning && (
                <Camera 
                  onCapture={handleImageCaptured}
                  isActive={isScanning}
                  autoOpen
                  showButton={false}
                />
              )}

              {/* Crop */}
              {step === 'crop' && image && (
                <div className="space-y-6">
                  <BarcodeCropper
                    image={image}
                    onCropComplete={handleCropComplete}
                    onCancel={() => {
                      setStep('scan')
                      setImage('')
                      setScanError('')
                    }}
                  />
                  
                  {isDetecting && (
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-600 rounded-full border-t-transparent"></div>
                      <p className="mt-2 text-blue-700">Scan en cours avec Quagga...</p>
                    </div>
                  )}
                  
                  {scanError && !isDetecting && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-yellow-700 whitespace-pre-line">{scanError}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Résultat */}
              {step === 'result' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold">Résultat du scan</h2>
                  
                  <div className="bg-gray-50 p-6 rounded-lg">
                    {barcode ? (
                      <div>
                        <p className="text-green-600 font-semibold">✅ Code-barre détecté !</p>
                        <div className="mt-4 p-4 bg-white border border-green-200 rounded-lg">
                          <p className="font-mono text-2xl">{barcode}</p>
                          <p className="text-sm text-gray-500 mt-2">Format EAN-13</p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-yellow-600">⚠️ Pas de code-barre détecté</p>
                        <p className="text-sm text-gray-600 mt-2">
                          Vous pouvez continuer et entrer les détails manuellement
                        </p>
                      </div>
                    )}

                    <div className="mt-8 flex gap-4">
                      <button
                        onClick={() => setStep('crop')}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                      >
                        ← Réessayer
                      </button>
                      <button
                        onClick={proceedToNextStep}
                        className="px-6 py-2 text-white rounded-lg"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                      >
                        {barcode ? 'Continuer avec code-barre →' : 'Continuer sans code-barre →'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {step === 'label' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold">Étape 2: Scanner l'étiquette</h2>
                  <p className="text-gray-600">Prenez une photo nette de l'étiquette.</p>
                  <div>
                    <button
                      type="button"
                      onClick={() => document.getElementById('label-image')?.click()}
                      className="px-6 py-3 text-white rounded-lg"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      📸 Prendre une photo de l’étiquette
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
                        setOcrError('Veuillez choisir une photo de l’étiquette.')
                        return
                      }
                      handleLabelProcess()
                    }}
                    disabled={ocrLoading}
                    className="px-6 py-2 text-white rounded-lg"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    {ocrLoading ? 'Analyse en cours...' : 'Analyser l’étiquette'}
                  </button>
                </div>
              )}

              {step === 'edit' && (
                <form className="space-y-4" onSubmit={handleCreateWhisky}>
                  <h2 className="text-2xl font-bold">Étape 3: Vérifier & valider</h2>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nom</label>
                    <input name="name" defaultValue={whiskyData.name || ''} className="w-full border rounded px-3 py-2" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Distiller</label>
                      <input name="distiller" defaultValue={whiskyData.distiller || ''} className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Bottler</label>
                      <input name="bottler" defaultValue={whiskyData.bottler || ''} className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Country</label>
                      <select name="country_id" defaultValue={whiskyData.country_id || ''} className="w-full border rounded px-3 py-2">
                        <option value="">--</option>
                        {countries.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Barcode (EAN13)</label>
                      <input name="ean13" value={barcode || ''} readOnly disabled className="w-full border rounded px-3 py-2 bg-gray-50" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Bottling type</label>
                      <select name="bottling_type" defaultValue={whiskyData.bottling_type || ''} className="w-full border rounded px-3 py-2">
                        <option value="">--</option>
                        <option value="DB">Distiller Bottling (DB)</option>
                        <option value="IB">Independent Bottling (IB)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Type</label>
                      <select name="type" defaultValue={whiskyData.type || ''} className="w-full border rounded px-3 py-2">
                        <option value="">--</option>
                        {typeOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Distilled year</label>
                      <input name="distilled_year" defaultValue={whiskyData.distilled_year || ''} className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Bottled year</label>
                      <input name="bottled_year" defaultValue={whiskyData.bottled_year || ''} className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Age</label>
                      <input name="age" defaultValue={whiskyData.age || ''} className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Cask type</label>
                      <input name="cask_type" defaultValue={whiskyData.cask_type || ''} className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Batch ID</label>
                      <input name="batch_id" defaultValue={whiskyData.batch_id || ''} className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Alcohol volume</label>
                      <input name="alcohol_volume" defaultValue={whiskyData.alcohol_volume || ''} className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Bottled for</label>
                      <input name="bottled_for" defaultValue={whiskyData.bottled_for || ''} className="w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Region</label>
                      <input name="region" defaultValue={whiskyData.region || ''} className="w-full border rounded px-3 py-2" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Photo bouteille</label>
                    <button
                      type="button"
                      onClick={() => document.getElementById('bottle-image')?.click()}
                      className="px-6 py-3 text-white rounded-lg"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      📸 Prendre une photo de la bouteille
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
                    Créer le whisky
                  </button>
                </form>
              )}

              {step === 'exists' && (
                <div className="p-6 border rounded-lg" style={{ borderColor: 'var(--color-primary)' }}>
                  {createStatus === 'success' && (
                    <p className="text-green-700">✅ Whisky créé avec succès.</p>
                  )}
                  {createStatus === 'duplicate' && (
                    <div className="space-y-4">
                      <p className="text-yellow-700">⚠️ Un whisky identique existe déjà (nom + années).</p>
                      <button
                        onClick={() => {
                          setStep('edit')
                          setCreateStatus(null)
                        }}
                        className="px-6 py-2 rounded-lg border"
                        style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                      >
                        ← Retour modifier
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Entrée manuelle */
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Entrer le code-barre manuellement</h2>
              
              <div>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  placeholder="Code-barre EAN-13 (optionnel)"
                />
                <p className="text-sm text-gray-500 mt-2">Laissez vide si pas de code-barre</p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setManualEntry(false)}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  ← Retour au scan
                </button>
                <button
                  onClick={proceedToNextStep}
                  className="px-6 py-3 text-white rounded-lg"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  Continuer →
                </button>
              </div>
            </div>
          )}
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
            background: #3b82f6;
            color: white;
          }
          .step-label {
            margin-top: 8px;
            font-size: 14px;
            color: #6b7280;
          }
          .step.active .step-label {
            color: #3b82f6;
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
