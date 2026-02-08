'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getTranslations, type Locale } from '@/lib/i18n'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

const COLORS = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12']

type FriendItem = {
  id: string
  pseudo: string
  tastingCount: number
}

type MarkerItem = {
  latitude: number
  longitude: number
  tastingDate: string
  whiskyName: string | null
  whiskyId: string
  pseudo: string | null
  userId: string
}

export default function MapPage() {
  const params = useParams()
  const locale = params.locale as Locale
  const t = getTranslations(locale)
  const { isLoggedIn, isLoading, user: viewer } = useAuth()

  const [friends, setFriends] = useState<FriendItem[]>([])
  const [myCount, setMyCount] = useState(0)
  const [showMine, setShowMine] = useState(true)
  const [selectedFriends, setSelectedFriends] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [markers, setMarkers] = useState<MarkerItem[]>([])
  const [loadingMarkers, setLoadingMarkers] = useState(false)
  const [mapReady, setMapReady] = useState(false)

  const leafletRef = useRef<any>(null)
  const mapRef = useRef<any>(null)
  const clusterRef = useRef<any>(null)

  const filteredFriends = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return friends
    return friends.filter((f) => f.pseudo.toLowerCase().includes(q))
  }, [friends, query])

  const selectionCount = (showMine ? 1 : 0) + selectedFriends.length
  const maxSelections = 4
  const selectedLabel = t('map.selectedLabel').replace('{count}', `${selectionCount}`)
  const maxLabel = t('map.maxLabel').replace('{max}', `${maxSelections}`)
  const friendColorOffset = showMine ? 1 : 0

  useEffect(() => {
    if (!isLoggedIn) return
    const load = async () => {
      const res = await fetch('/api/map/summary', { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      setFriends(json.friends || [])
      setMyCount(json.myTastingCount || 0)
    }
    load()
  }, [isLoggedIn])

  useEffect(() => {
    if (!isLoggedIn) return
    const loadMarkers = async () => {
      setLoadingMarkers(true)
      const users: string[] = []
      if (showMine) users.push('me')
      selectedFriends.forEach((id) => users.push(id))

      if (users.length === 0) {
        setMarkers([])
        setLoadingMarkers(false)
        return
      }

      const res = await fetch('/api/map/markers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users }),
      })
      if (res.ok) {
        const json = await res.json()
        setMarkers(json.items || [])
      }
      setLoadingMarkers(false)
    }
    loadMarkers()
  }, [showMine, selectedFriends, isLoggedIn])

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

      if (!mapRef.current) {
        const container = document.getElementById('tasting-map')
        if (!container) return
        const map = L.map('tasting-map', { zoomControl: true }).setView([46.2276, 2.3522], 5)
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

        mapRef.current = map
        clusterRef.current = cluster
        leafletRef.current = L
        setMapReady(true)
      }
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

    clusterRef.current.clearLayers()

    const selectedOrder = selectedFriends.slice(0)

    markers.forEach((marker) => {
      const isMe = marker.userId === viewer?.id
      let color = COLORS[0]
      if (!isMe) {
        const index = selectedOrder.indexOf(marker.userId)
        color = COLORS[Math.min(index + friendColorOffset, COLORS.length - 1)] || COLORS[0]
      }

      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background-color:${color};width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 8px rgba(0,0,0,0.4);transform: translate(-50%,-50%);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })

      const popupHtml = `
        <div style="min-width:220px;font-family:inherit;">
          <div style="font-weight:600;color:#111827;margin-bottom:4px;">
            ${marker.whiskyName || ''}
          </div>
          <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">
            ${marker.pseudo || ''} • ${marker.tastingDate || ''}
          </div>
          <a
            href="/${locale}/whisky/${marker.whiskyId}"
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
          >
            ${t('map.viewWhisky')}
          </a>
        </div>
      `

      const leafletMarker = L.marker([marker.latitude, marker.longitude], { icon }).bindPopup(popupHtml)
      clusterRef.current.addLayer(leafletMarker)
    })

    if (markers.length > 0) {
      const bounds = clusterRef.current.getBounds()
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds.pad(0.1))
      }
    }
  }, [markers, mapReady, selectedFriends, locale, t, viewer?.id])

  if (isLoading) return <div className="p-8">{t('common.loading')}</div>
  if (!isLoggedIn) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-sm text-center border border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-800 mb-3">{t('map.loginTitle')}</h2>
          <p className="text-gray-600 mb-6">{t('map.loginSubtitle')}</p>
          <div className="flex gap-4 justify-center">
            <Link
              href={`/${locale}/login`}
              className="py-2 px-6 text-white rounded-lg"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {t('navigation.signIn')}
            </Link>
            <Link
              href={`/${locale}/register`}
              className="py-2 px-6 bg-white rounded-lg border"
              style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
            >
              {t('navigation.signUp')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const toggleFriend = (id: string) => {
    setSelectedFriends((prev) => {
      const exists = prev.includes(id)
      if (exists) return prev.filter((f) => f !== id)
      if (selectionCount >= maxSelections) return prev
      return [...prev, id]
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">{t('map.title')}</h1>
          <p className="text-gray-600 mt-2">{t('map.subtitle')}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <label className="flex items-center gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showMine}
                onChange={(e) => {
                  if (!e.target.checked && selectionCount === 1 && selectedFriends.length === 0) return
                  setShowMine(e.target.checked)
                }}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span>{t('map.showMine')} ({myCount})</span>
            </label>
            <div className="relative w-full lg:max-w-xs">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('map.searchPlaceholder')}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-gray-800">{t('map.followedTitle')}</div>
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 max-h-60 overflow-y-auto space-y-2">
              {filteredFriends.length === 0 && (
                <div className="text-sm text-gray-500">{t('map.noFollowed')}</div>
              )}
              {filteredFriends.map((friend) => {
                const disabled = friend.tastingCount === 0
                const checked = selectedFriends.includes(friend.id)
                return (
                  <label
                    key={friend.id}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm border ${disabled ? 'text-gray-400 border-transparent' : 'border-gray-200 bg-white'}`}
                  >
                    <span>{friend.pseudo}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{friend.tastingCount}</span>
                      <input
                        type="checkbox"
                        disabled={disabled || (!checked && selectionCount >= maxSelections)}
                        checked={checked}
                        onChange={() => toggleFriend(friend.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{selectedLabel}</span>
            <span>{maxLabel}</span>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-800">{t('map.mapTitle')}</div>
            {loadingMarkers && <div className="text-xs text-gray-500">{t('common.loading')}</div>}
          </div>
          <div id="tasting-map" style={{ height: 600, width: '100%' }} />
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-wrap gap-4 items-center text-sm text-gray-600">
            <span className="font-semibold">{t('map.legend')}</span>
            {showMine && (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[0] }} /> {t('map.legendMine')}
              </span>
            )}
            {selectedFriends.slice(0, maxSelections - (showMine ? 1 : 0)).map((id, idx) => {
              const friend = friends.find((f) => f.id === id)
              if (!friend) return null
              return (
                <span key={`legend-${id}`} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx + friendColorOffset] }} /> {friend.pseudo}
                </span>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
