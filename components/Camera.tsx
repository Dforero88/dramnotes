'use client'

import { useRef } from 'react'

interface CameraProps {
  onCapture: (imageData: string) => void
  isActive: boolean
}

export default function Camera({ onCapture, isActive }: CameraProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  if (!isActive) return null

  const openCamera = () => {
    inputRef.current?.click()
  }

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const imageData = e.target?.result as string
      if (imageData) {
        onCapture(imageData)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />

      <div className="text-center">
        <p className="text-sm text-gray-600 mb-4">
          Prends une photo nette du code-barre avec la caméra du téléphone.
        </p>
        <button
          onClick={openCamera}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          📸 Prendre photo
        </button>
      </div>
    </div>
  )
}
