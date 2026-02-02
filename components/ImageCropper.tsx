'use client'

import { useState, useRef, useEffect } from 'react'

interface ImageCropperProps {
  image: string
  onCropComplete: (croppedImage: string) => void
  onCancel: () => void
}

export default function ImageCropper({ image, onCropComplete, onCancel }: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 600, height: 200 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const hiddenImageRef = useRef<HTMLImageElement>(null)

  // Charger l'image originale une fois pour obtenir ses dimensions
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      console.log('📏 Dimensions originales:', img.width, 'x', img.height)
      setOriginalDimensions({ width: img.width, height: img.height })
      
      // Initialiser le crop au centre
      const centerX = (img.width - 600) / 2
      const centerY = (img.height - 200) / 2
      setCrop({ 
        x: Math.max(0, centerX), 
        y: Math.max(0, centerY), 
        width: 600,
        height: 200
      })
    }
    img.src = image
  }, [image])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({
      x: e.clientX - crop.x,
      y: e.clientY - crop.y
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return
    
    const container = containerRef.current.getBoundingClientRect()
    const newX = e.clientX - dragStart.x - container.left
    const newY = e.clientY - dragStart.y - container.top
    
    // Limites basées sur les dimensions affichées (container)
    const maxX = container.width - crop.width
    const maxY = container.height - crop.height
    
    setCrop({
      ...crop,
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleResize = (corner: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const startCrop = { ...crop }

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY

      let newCrop = { ...startCrop }

      switch (corner) {
        case 'se': // bottom-right
          newCrop.width = Math.max(400, startCrop.width + deltaX)
          newCrop.height = Math.max(100, startCrop.height + deltaY)
          break
        case 'sw': // bottom-left
          newCrop.x = startCrop.x + deltaX
          newCrop.width = Math.max(400, startCrop.width - deltaX)
          newCrop.height = Math.max(100, startCrop.height + deltaY)
          break
        case 'ne': // top-right
          newCrop.y = startCrop.y + deltaY
          newCrop.width = Math.max(400, startCrop.width + deltaX)
          newCrop.height = Math.max(100, startCrop.height - deltaY)
          break
        case 'nw': // top-left
          newCrop.x = startCrop.x + deltaX
          newCrop.y = startCrop.y + deltaY
          newCrop.width = Math.max(400, startCrop.width - deltaX)
          newCrop.height = Math.max(100, startCrop.height - deltaY)
          break
      }

      // Garder dans les limites affichées
      if (containerRef.current) {
        const container = containerRef.current.getBoundingClientRect()
        newCrop.x = Math.max(0, Math.min(newCrop.x, container.width - newCrop.width))
        newCrop.y = Math.max(0, Math.min(newCrop.y, container.height - newCrop.height))
      }

      setCrop(newCrop)
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const handleCrop = () => {
    if (originalDimensions.width === 0) return

    // Créer une image en mémoire pour travailler avec les dimensions réelles
    const img = new Image()
    img.onload = () => {
      console.log('🖼️ Image originale chargée:', img.naturalWidth, 'x', img.naturalHeight)
      
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Calculer le ratio entre l'affichage et la réalité
      const displayWidth = containerRef.current?.clientWidth || 640
      const displayHeight = containerRef.current?.clientHeight || 480
      
      const ratioX = img.naturalWidth / displayWidth
      const ratioY = img.naturalHeight / displayHeight

      console.log('📐 Ratios:', { ratioX, ratioY, displayWidth, displayHeight })

      // Convertir le crop (coordonnées d'affichage) en coordonnées réelles
      const realCrop = {
        x: crop.x * ratioX,
        y: crop.y * ratioY,
        width: crop.width * ratioX,
        height: crop.height * ratioY
      }

      console.log('✂️ Crop réel:', realCrop)

      // FORCER 800x200 pour Quagga
      canvas.width = 400
      canvas.height = 200

      // Fond blanc
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Dessiner la portion cropée, étirée à 800x200
      ctx.drawImage(
        img,
        realCrop.x, realCrop.y, realCrop.width, realCrop.height,
        0, 0, canvas.width, canvas.height
      )

      // Qualité maximum pour Quagga
      const croppedImage = canvas.toDataURL('image/jpeg', 1.0)
      console.log('✅ Image finale pour Quagga:', canvas.width, 'x', canvas.height, 'taille:', croppedImage.length)
      
      onCropComplete(croppedImage)
    }
    
    img.src = image
  }

  if (originalDimensions.width === 0) {
    return (
      <div className="text-center p-8">
        <div className="animate-spin inline-block w-8 h-8 border-2 border-blue-600 rounded-full border-t-transparent"></div>
        <p className="mt-2">Chargement de l'image...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Positionnez le cadre sur le code-barre</h3>
          <p className="text-sm text-gray-600">
            Glissez pour déplacer • Poignées pour redimensionner
          </p>
        </div>
        <div className="text-sm text-gray-700 bg-gray-100 px-3 py-1 rounded">
          {Math.round(crop.width)} × {Math.round(crop.height)} px
        </div>
      </div>

      {/* Conteneur pour l'affichage seulement */}
      <div 
        ref={containerRef}
        className="relative border-2 border-gray-300 rounded-lg overflow-hidden bg-black"
        style={{ height: '400px' }} // Fixer la hauteur pour avoir des ratios constants
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={image}
          alt="À crop"
          className="w-full h-full object-contain"
          draggable={false}
        />

        {/* Zone de crop */}
        <div
          className="absolute border-2 border-yellow-400 cursor-move"
          style={{
            left: `${crop.x}px`,
            top: `${crop.y}px`,
            width: `${crop.width}px`,
            height: `${crop.height}px`,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
          }}
          onMouseDown={handleMouseDown}
        >
          {/* Poignées */}
          {['nw', 'ne', 'sw', 'se'].map((corner) => (
            <div
              key={corner}
              className={`absolute w-4 h-4 bg-yellow-400 border border-white rounded-full`}
              style={{
                [corner.includes('n') ? 'top' : 'bottom']: '-2px',
                [corner.includes('w') ? 'left' : 'right']: '-2px',
              }}
              onMouseDown={(e) => {
                e.stopPropagation()
                handleResize(corner, e)
              }}
            />
          ))}
        </div>
      </div>

      <div className="text-sm p-3 bg-blue-50 rounded-lg">
        <p className="font-medium text-blue-800 mb-1">📐 Calcul des dimensions :</p>
        <p className="text-blue-600">
          Original: {originalDimensions.width} × {originalDimensions.height} px
        </p>
        <p className="text-blue-600">
          Affiché: {containerRef.current?.clientWidth || '...'} × 400 px
        </p>
        <p className="text-blue-600">
          Crop → Quagga: <strong>800 × 200 px</strong> (fixe)
        </p>
      </div>

      <div className="flex gap-4">
        <button
          onClick={onCancel}
          className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 flex-1"
        >
          Annuler
        </button>
        <button
          onClick={handleCrop}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex-1 font-medium"
        >
          Analyser avec Quagga (800×200)
        </button>
      </div>
    </div>
  )
}