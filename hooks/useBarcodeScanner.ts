import { useEffect, useState } from 'react'

const QUAGGA_CDN = 'https://cdn.jsdelivr.net/npm/@ericblade/quagga2@1.7.7/dist/quagga.min.js'

export const useBarcodeScanner = () => {
  const [barcode, setBarcode] = useState<string>('')
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string>('')
  const [image, setImage] = useState<string>('')
  const [isDetecting, setIsDetecting] = useState(false)
  const [scannerAvailable, setScannerAvailable] = useState(false)
  const [scannerStatus, setScannerStatus] = useState<'loading' | 'ready' | 'unsupported'>('loading')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hasNative = typeof (window as any).BarcodeDetector !== 'undefined'
    const hasQuagga = typeof (window as any).Quagga !== 'undefined'
    if (hasNative || hasQuagga) {
      setScannerAvailable(true)
      setScannerStatus('ready')
      return
    }

    const existingScript = document.querySelector(`script[src="${QUAGGA_CDN}"]`) as HTMLScriptElement | null
    if (existingScript) {
      const checkInterval = window.setInterval(() => {
        if (typeof (window as any).Quagga !== 'undefined') {
          setScannerAvailable(true)
          setScannerStatus('ready')
          clearInterval(checkInterval)
        }
      }, 200)
      const timeout = window.setTimeout(() => {
        if (typeof (window as any).Quagga === 'undefined' && typeof (window as any).BarcodeDetector === 'undefined') {
          setScannerStatus('unsupported')
        }
      }, 4000)
      return () => {
        clearInterval(checkInterval)
        clearTimeout(timeout)
      }
    }

    const script = document.createElement('script')
    script.src = QUAGGA_CDN
    script.async = true
    script.onload = () => {
      setScannerAvailable(true)
      setScannerStatus('ready')
    }
    script.onerror = () => {
      setScannerAvailable(hasNative)
      setScannerStatus(hasNative ? 'ready' : 'unsupported')
    }
    document.head.appendChild(script)
  }, [])

  const detectBarcodeFromImage = async (imageSrc: string): Promise<string> => {
    setIsDetecting(true)
    setError('')

    try {
      const Quagga = (window as any).Quagga
      if (Quagga) {
        const raw = await new Promise<string>((resolve) => {
          Quagga.decodeSingle(
            {
              decoder: {
                readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'code_128_reader', 'code_39_reader'],
              },
              locate: true,
              src: imageSrc,
              numOfWorkers: 0,
              inputStream: {
                size: 800,
                type: 'ImageStream',
                src: imageSrc,
              },
              patchSize: 'medium',
              halfSample: true,
            },
            (result: any) => {
              const code = result?.codeResult?.code
              resolve(typeof code === 'string' ? code.trim() : '')
            }
          )
        })
        if (raw) return raw
      }

      const Detector = (window as any).BarcodeDetector
      if (!Detector) return ''
      const detector = new Detector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
      })
      const img = new Image()
      const loaded = await new Promise<boolean>((resolve) => {
        img.onload = () => resolve(true)
        img.onerror = () => resolve(false)
        img.src = imageSrc
      })
      if (!loaded) return ''
      const found = await detector.detect(img)
      const raw = found?.[0]?.rawValue
      return typeof raw === 'string' ? raw.trim() : ''
    } catch {
      return ''
    } finally {
      setIsDetecting(false)
    }
  }

  const startScanning = () => {
    setIsScanning(true)
    setError('')
  }

  const stopScanning = () => {
    setIsScanning(false)
  }

  const captureImage = (imageData: string) => {
    setImage(imageData)
  }

  const scanImage = async (imageData: string): Promise<boolean> => {
    if (!scannerAvailable) {
      setError('Scanner indisponible')
      return false
    }

    const detectedBarcode = await detectBarcodeFromImage(imageData)
    if (detectedBarcode) {
      setBarcode(detectedBarcode)
      setError('')
      return true
    }

    setError('Aucun code-barres détecté. Essayez manuellement.')
    return false
  }

  return {
    barcode,
    setBarcode,
    isScanning,
    isDetecting,
    scannerAvailable,
    scannerStatus,
    startScanning,
    stopScanning,
    captureImage,
    image,
    setImage,
    error,
    scanImage,
  }
}
