'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { getTranslations, type Locale } from '@/lib/i18n'
import Link from 'next/link'
import Camera from '@/components/Camera'
import BarcodeCropper from '@/components/BarcodeCropper'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'

// Charge Quagga directement - VERSION CORRIGÉE
const loadQuagga = (): Promise<void> => {
  // Vérifie qu'on est côté client
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Quagga ne peut être chargé côté serveur'));
  }

  // Vérifie si déjà chargé
  if ((window as any).Quagga) {
    console.log('✅ Quagga déjà chargé');
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@ericblade/quagga2@1.7.7/dist/quagga.min.js';
    script.async = true;
    
    script.onload = () => {
      console.log('✅ Quagga chargé avec succès');
      resolve();
    };
    
    script.onerror = () => {
      console.error('❌ Échec chargement Quagga');
      reject(new Error('Failed to load Quagga'));
    };
    
    document.head.appendChild(script);
  });
};

export default function AddWhiskyPage({
  params
}: {
  params: { locale: Locale }
}) {
  const { locale } = params
  const t = getTranslations(locale)
  
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

  const [step, setStep] = useState<'scan' | 'crop' | 'result'>('scan')
  const [manualEntry, setManualEntry] = useState(false)
  const [scanError, setScanError] = useState('')
  const [quaggaLoaded, setQuaggaLoaded] = useState(false)

  // Charge Quagga au montage - VERSION CORRIGÉE
  useEffect(() => {
  console.log('🔧 Chargement outils PrestaShop...')
  
  // Vérifier si déjà chargé
  if ((window as any).Quagga) {
    console.log('✅ Quagga déjà chargé')
    setQuaggaLoaded(true)
    return
  }
  
  // Charger depuis le MÊME CDN que PrestaShop
  const script = document.createElement('script')
  script.src = 'https://cdn.jsdelivr.net/npm/@ericblade/quagga2@1.7.7/dist/quagga.min.js'
  script.async = true
  
  script.onload = () => {
    console.log('✅ Quagga chargé depuis CDN PrestaShop')
    setQuaggaLoaded(true)
  }
  
  script.onerror = () => {
    console.error('❌ Échec chargement Quagga')
  }
  
  document.head.appendChild(script)
  
  return () => {
    // Nettoyage optionnel
  }
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
    
    // Vérifie visuellement l'image
    const win = window.open();
    if (win) {
      win.document.write(`
        <html>
          <body style="margin:0;padding:20px;background:#f0f0f0;">
            <h3>Image cropée pour vérification :</h3>
            <img src="${croppedImage}" style="max-width:100%;border:2px solid red;">
            <p>Taille: ${croppedImage.length} caractères</p>
            <p>Si tu vois bien le code-barre ici, Quagga devrait pouvoir le lire !</p>
          </body>
        </html>
      `);
    }
    
    // Scanner l'image cropée
    const success = await scanImage(croppedImage)
    
    if (success) {
      setStep('result')
    } else {
      setScanError(error || 'Pas de code-barre détecté. Crop plus serré ?')
    }
  }

  const proceedToNextStep = () => {
    window.location.href = `/${locale}/add-whisky/details?barcode=${barcode || ''}`
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        {/* Navigation */}
        <div className="mb-8">
          <Link 
            href={`/${locale}/catalogue`}
            className="text-blue-600 hover:underline"
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

        {quaggaLoaded && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700">✅ Scanner prêt !</p>
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
                  <button
                    onClick={startScanning}
                    className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!quaggaLoaded}
                  >
                    {quaggaLoaded ? 'Ouvrir la caméra' : 'Chargement scanner...'}
                  </button>
                  <div className="mt-8 text-gray-600">
                    <p>Ou</p>
                    <button
                      onClick={() => setManualEntry(true)}
                      className="mt-4 px-6 py-3 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50"
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
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        {barcode ? 'Continuer avec code-barre →' : 'Continuer sans code-barre →'}
                      </button>
                    </div>
                  </div>
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
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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