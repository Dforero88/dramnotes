'use client'

import { useRef, useEffect, useState } from 'react'

interface BarcodeCropperProps {
  image: string
  onCropComplete: (croppedImage: string) => void
  onCancel: () => void
}

declare global {
  interface Window {
    Cropper: any
  }
}

export default function BarcodeCropper({ image, onCropComplete, onCancel }: BarcodeCropperProps) {
  const imageRef = useRef<HTMLImageElement>(null)
  const cropperRef = useRef<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [cropperLoaded, setCropperLoaded] = useState(false)

  // Charger Cropper.js depuis CDN
  useEffect(() => {
    if (window.Cropper) {
      setCropperLoaded(true)
      return
    }

    const link = document.createElement('link')
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.12/cropper.min.css'
    link.rel = 'stylesheet'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.12/cropper.min.js'
    script.async = true
    
    script.onload = () => {
      setCropperLoaded(true)
    }
    
    document.head.appendChild(script)
  }, [])

  // Initialiser Cropper
  useEffect(() => {
    if (!cropperLoaded || !imageRef.current || !window.Cropper) return
    
    if (cropperRef.current) {
      cropperRef.current.destroy()
    }

    cropperRef.current = new window.Cropper(imageRef.current, {
      aspectRatio: 3,
      viewMode: 1,
      dragMode: 'crop',
      autoCropArea: 0.8,
      restore: false,
      guides: true,
      center: true,
      highlight: true,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
      minCropBoxWidth: 100,
      minCropBoxHeight: 30,
    })

    return () => {
      if (cropperRef.current) {
        cropperRef.current.destroy()
      }
    }
  }, [cropperLoaded, image])

  const handleCrop = () => {
    if (!cropperRef.current || !window.Cropper) return

    setIsProcessing(true)

    try {
      // EXACTEMENT COMME PRESTASHOP : juste le crop
      const canvas = cropperRef.current.getCroppedCanvas({
        width: 800,
        height: 200
      })

      if (!canvas) {
        throw new Error('Canvas non disponible')
      }

      // EXACTEMENT COMME PRESTASHOP : direct en base64
      const croppedImage = canvas.toDataURL('image/jpeg', 0.9)
      
      onCropComplete(croppedImage)
      
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors du crop.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleZoomIn = () => {
    if (cropperRef.current) {
      cropperRef.current.zoom(0.1)
    }
  }

  const handleZoomOut = () => {
    if (cropperRef.current) {
      cropperRef.current.zoom(-0.1)
    }
  }

  const handleRotateLeft = () => {
    if (cropperRef.current) {
      cropperRef.current.rotate(-15)
    }
  }

  const handleRotateRight = () => {
    if (cropperRef.current) {
      cropperRef.current.rotate(15)
    }
  }

  const handleReset = () => {
    if (cropperRef.current) {
      cropperRef.current.reset()
    }
  }

  if (!cropperLoaded) {
    return (
      <div className="text-center p-8">
        <div className="animate-spin inline-block w-8 h-8 border-2 border-blue-600 rounded-full border-t-transparent"></div>
        <p className="mt-2">Chargement Cropper.js...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Crop le code-barre</h3>
          <p className="text-sm text-gray-600">
            Même système que le module PrestaShop
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
            title="Zoom Out"
          >
            −
          </button>
          <button
            onClick={handleZoomIn}
            className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={handleRotateLeft}
            className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
            title="Rotate Left"
          >
            ↶
          </button>
          <button
            onClick={handleRotateRight}
            className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
            title="Rotate Right"
          >
            ↷
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
            title="Reset"
          >
            ⟲
          </button>
        </div>
      </div>

      <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
        <img
          ref={imageRef}
          src={image}
          alt="À crop"
          className="block max-w-full"
          crossOrigin="anonymous"
        />
      </div>

      <div className="text-sm p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="font-medium text-yellow-800">💡 Utilisez votre téléphone pour une meilleure qualité !</p>
        <p className="text-yellow-700 mt-1">
          La webcam d'ordinateur a souvent une qualité médiocre. 
          Pour de meilleurs résultats, prenez la photo avec votre téléphone et transférez-la.
        </p>
      </div>

      {isProcessing && (
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-600 rounded-full border-t-transparent"></div>
          <p className="mt-2 text-blue-700">Préparation...</p>
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={onCancel}
          className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 flex-1"
          disabled={isProcessing}
        >
          Annuler
        </button>
        <button
          onClick={handleCrop}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex-1 font-medium"
          disabled={isProcessing}
        >
          Crop & Scanner
        </button>
      </div>
    </div>
  )
}