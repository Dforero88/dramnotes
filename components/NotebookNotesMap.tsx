'use client'

import { useEffect, useRef, useState } from 'react'
import { buildWhiskyPath } from '@/lib/whisky-url'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

type MapNote = {
  whiskyId: string
  whiskyName: string | null
  tastingDate: string
  rating: number | null
  latitude: number | null
  longitude: number | null
}

type Props = {
  notes: MapNote[]
  locale: string
  viewWhiskyLabel: string
}

export default function NotebookNotesMap({ notes, locale, viewWhiskyLabel }: Props) {
  const [mapReady, setMapReady] = useState(false)
  const leafletRef = useRef<any>(null)
  const mapRef = useRef<any>(null)
  const clusterRef = useRef<any>(null)

  useEffect(() => {
    let cancelled = false

    const initMap = async () => {
      const leafletModule = await import('leaflet')
      const L = leafletModule.default || leafletModule
      if (typeof window !== 'undefined') {
        ;(window as any).L = L
      }
      await import('leaflet.markercluster')
      if (cancelled) return
      if (mapRef.current) return

      const container = document.getElementById('notebook-notes-map')
      if (!container) return

      const map = L.map('notebook-notes-map', { zoomControl: true }).setView([46.2276, 2.3522], 5)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      const cluster = L.markerClusterGroup({
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        maxClusterRadius: 50,
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount()
          const size = count > 50 ? 60 : count > 10 ? 50 : 40
          const fontSize = count > 50 ? 18 : count > 10 ? 16 : 15
          return L.divIcon({
            html: `<div style="width:${size}px;height:${size}px;background:#fff;border:3px solid #333;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${fontSize}px;color:#333;box-shadow:0 0 10px rgba(0,0,0,0.2);">${count}</div>`,
            className: 'custom-cluster',
            iconSize: L.point(size + 10, size + 10),
          })
        },
      })
      map.addLayer(cluster)

      leafletRef.current = L
      mapRef.current = map
      clusterRef.current = cluster
      setMapReady(true)
    }

    initMap()

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        clusterRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!mapReady || !clusterRef.current) return
    const L = leafletRef.current
    if (!L) return

    const geolocated = notes.filter(
      (n) => typeof n.latitude === 'number' && typeof n.longitude === 'number'
    )

    clusterRef.current.clearLayers()

    geolocated.forEach((note) => {
      const whiskyPath = buildWhiskyPath(locale, note.whiskyId, note.whiskyName || undefined)
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background-color:#3498db;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 8px rgba(0,0,0,0.4);transform: translate(-50%,-50%);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })

      const marker = L.marker([note.latitude as number, note.longitude as number], { icon }).bindPopup(`
        <div style="min-width:220px;font-family:inherit;">
          <div style="font-weight:600;color:#111827;margin-bottom:4px;">${note.whiskyName || ''}</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
            <div style="font-size:12px;color:#6b7280;">${note.tastingDate || ''}</div>
            ${typeof note.rating === 'number'
              ? `<span style="display:inline-flex;align-items:center;gap:4px;border-radius:999px;background:#fffbeb;color:#b45309;padding:2px 8px;font-size:11px;font-weight:600;">★ ${note.rating}/10</span>`
              : ''}
          </div>
          <a
            href="${whiskyPath}"
            style="
              display:inline-flex;
              align-items:center;
              justify-content:center;
              padding:6px 10px;
              border-radius:999px;
              background:var(--color-primary);
              color:#fff;
              text-decoration:none;
              font-size:12px;
              font-weight:600;
            "
          >${viewWhiskyLabel}</a>
        </div>
      `)
      clusterRef.current.addLayer(marker)
    })

    if (geolocated.length > 0) {
      const bounds = clusterRef.current.getBounds()
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds.pad(0.1))
      }
    }
  }, [mapReady, notes, locale, viewWhiskyLabel])

  return <div id="notebook-notes-map" className="w-full rounded-2xl border border-gray-200 bg-white" style={{ height: 560 }} />
}
