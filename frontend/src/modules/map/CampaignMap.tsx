import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { WARD_BOUNDARY, POLLING_STATIONS } from '../../lib/mapData'
import { computeCentroid, buildRegionPolygons, assignRegion, computeWardArea } from '../../lib/mapUtils'
import { REGION_COLOURS, REGION_NAMES } from '../../lib/constants'
import { useAppSelector } from '../../hooks/useAppDispatch'
import { isAspirant } from '../../lib/permissions'
import { useMobile } from '../../hooks/useMobile'
import { supabase } from '../../lib/supabase'
import type { AppUser } from '../../types/models'

export function CampaignMap() {
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const user = useAppSelector((s) => s.auth.user)
  const isMobile = useMobile()
  const [teamMembers, setTeamMembers] = useState<AppUser[]>([])
  const [activeRegion, setActiveRegion] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const centroid = useMemo(() => computeCentroid(), [])
  const regions = useMemo(() => buildRegionPolygons(), [])
  const wardArea = useMemo(() => computeWardArea(), [])

  // Assign regions to polling stations once
  const stationsWithRegion = useMemo(
    () => POLLING_STATIONS.map((s) => ({ ...s, region: assignRegion(s.lat, s.lng, regions) })),
    [regions]
  )

  // Region voter counts
  const regionVoters = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    stationsWithRegion.forEach((s) => { counts[s.region] = (counts[s.region] || 0) + s.voters })
    return counts
  }, [stationsWithRegion])

  // Fetch team members if aspirant (for home locations)
  useEffect(() => {
    if (!user || !isAspirant(user.role)) return
    supabase
      .from('users')
      .select('id, full_name, role, region_id, home_location, photo_url')
      .eq('is_active', true)
      .neq('role', 'aspirant')
      .then(({ data }) => { if (data) setTeamMembers(data as AppUser[]) })
  }, [user])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: centroid,
      zoom: 13,
      zoomControl: false,
    })
    mapRef.current = map

    // Base layers
    const carto = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      { attribution: '© OSM © CARTO', subdomains: 'abcd', maxZoom: 20 }
    )
    const topo = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles © Esri', maxZoom: 20 }
    )
    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles © Esri', maxZoom: 20 }
    )
    carto.addTo(map)

    L.control.layers(
      { '📍 Labels (CartoDB)': carto, '🏔️ Topographic': topo, '🛰️ Satellite': satellite },
      undefined,
      { position: 'topright' }
    ).addTo(map)

    L.control.zoom({ position: 'topright' }).addTo(map)
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map)

    // Ward boundary
    L.polygon(WARD_BOUNDARY, {
      color: '#ffffff', weight: 2.5, opacity: 0.7, fill: false, dashArray: '6 6',
    }).addTo(map).bindPopup(
      `<b>Kisiara Ward</b><br>${wardArea.toFixed(1)} km²<br>12,486 registered voters`
    )

    // Region polygons & dividing lines
    regions.forEach((reg, idx) => {
      const r = idx + 1
      const col = REGION_COLOURS[r]

      // Dividing line from centroid to first divide point
      L.polyline([centroid, reg.coords[1]], {
        color: '#ffffff', weight: 1.5, opacity: 0.4, dashArray: '5 4',
      }).addTo(map)

      const poly = L.polygon(reg.coords, {
        color: col, weight: 2.5, opacity: 0.85,
        fillColor: col, fillOpacity: 0.12,
        className: `region-poly-${r}`,
      }).addTo(map)

      poly.bindPopup(
        `<b>Region ${r} — ${REGION_NAMES[r]}</b><br>` +
        `👥 ${regionVoters[r]?.toLocaleString() ?? '—'} voters<br>` +
        `📋 ${stationsWithRegion.filter((s) => s.region === r).length} polling centres`
      )

      // Region label pill
      const bounds = poly.getBounds()
      const centre = bounds.getCenter()
      L.marker(centre, {
        icon: L.divIcon({
          className: '',
          html: `<div style="
            display:inline-block;padding:5px 14px;border-radius:20px;
            background:${col};color:white;font-size:11px;font-weight:700;
            white-space:nowrap;border:2px solid rgba(255,255,255,0.35);
            box-shadow:0 3px 12px rgba(0,0,0,0.5);letter-spacing:0.3px;">
            R${r}: ${REGION_NAMES[r]} (${regionVoters[r]?.toLocaleString() ?? '—'})
          </div>`,
          iconSize: [0, 0], iconAnchor: [0, 0],
        }),
        interactive: false,
      }).addTo(map)
    })

    // Central star
    L.marker(centroid, {
      icon: L.divIcon({
        className: '',
        html: '<div style="font-size:28px;text-align:center;line-height:1;text-shadow:0 0 12px white,0 0 24px gold;">⭐</div>',
        iconSize: [36, 36], iconAnchor: [18, 18],
      }),
    }).addTo(map).bindPopup(
      `<b>⭐ Central Command Point</b><br>${centroid[0].toFixed(4)}, ${centroid[1].toFixed(4)}<br>All 5 regions converge here`
    )

    // Polling stations
    stationsWithRegion.forEach((ps) => {
      const col = REGION_COLOURS[ps.region]
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:32px;height:32px;border-radius:50%;background:#fff;
          display:flex;align-items:center;justify-content:center;
          font-size:14px;border:3px solid ${col};
          box-shadow:0 4px 12px rgba(0,0,0,0.5);cursor:pointer;">🗳️</div>`,
        iconSize: [32, 32], iconAnchor: [16, 16],
      })
      L.marker([ps.lat, ps.lng], { icon })
        .addTo(map)
        .bindTooltip(
          `<b>${ps.name}</b><br>Region ${ps.region} — ${REGION_NAMES[ps.region]}<br>👥 ${ps.voters.toLocaleString()} voters · ${ps.stations} station${ps.stations > 1 ? 's' : ''}`,
          { direction: 'top', offset: [0, -20], opacity: 1 }
        )
        .bindPopup(
          `<b>${ps.name}</b><br>` +
          `<span style="color:${col}">■</span> Region ${ps.region} — ${REGION_NAMES[ps.region]}<br>` +
          `👥 Registered Voters: <b>${ps.voters.toLocaleString()}</b><br>` +
          `📋 Polling Stations: <b>${ps.stations}</b>`
        )
    })

    // Fit to ward bounds
    const lats = WARD_BOUNDARY.map((p) => p[0])
    const lngs = WARD_BOUNDARY.map((p) => p[1])
    map.fitBounds(
      L.latLngBounds([Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]).pad(0.06)
    )

    return () => { map.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Add home location pins when team members load (aspirant only)
  useEffect(() => {
    if (!mapRef.current || !teamMembers.length) return
    teamMembers.forEach((m) => {
      if (!m.home_location?.coordinates) return
      const [lng, lat] = m.home_location.coordinates
      const col = REGION_COLOURS[m.region_id ?? 1]
      const roleLabel = m.role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      const initial = m.full_name.charAt(0).toUpperCase()
      L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="
            width:30px;height:30px;border-radius:50%;
            background:${col};color:#fff;
            display:flex;align-items:center;justify-content:center;
            font-size:12px;font-weight:700;
            border:2px solid rgba(255,255,255,0.8);
            box-shadow:0 3px 10px rgba(0,0,0,0.5);
            cursor:pointer;">${initial}</div>`,
          iconSize: [30, 30], iconAnchor: [15, 15],
        }),
      })
        .addTo(mapRef.current!)
        .bindTooltip(
          `<b>${m.full_name}</b><br>${roleLabel}`,
          { direction: 'top', offset: [0, -18], opacity: 1 }
        )
        .bindPopup(
          `<b>${m.full_name}</b><br>` +
          `<span style="color:${col}">●</span> R${m.region_id ?? '?'} — ${REGION_NAMES[m.region_id ?? 1]}<br>` +
          `Role: <b>${roleLabel}</b><br>` +
          `<span style="font-size:11px;color:#94a3b8;">Home location</span>`
        )
    })
  }, [teamMembers])

  const zoomToRegion = (r: number) => {
    if (!mapRef.current) return
    setActiveRegion(r)
    const centres: Record<number, [number, number]> = {
      1: [centroid[0] - 0.005, centroid[1] - 0.014],
      2: [centroid[0] + 0.008, centroid[1] + 0.012],
      3: [centroid[0] - 0.006, centroid[1] + 0.028],
      4: [centroid[0] - 0.020, centroid[1] + 0.006],
      5: [centroid[0] - 0.014, centroid[1] - 0.032],
    }
    mapRef.current.flyTo(centres[r], 15, { duration: 1.4 })
  }

  const resetMap = () => {
    if (!mapRef.current) return
    setActiveRegion(null)
    const lats = WARD_BOUNDARY.map((p) => p[0])
    const lngs = WARD_BOUNDARY.map((p) => p[1])
    mapRef.current.flyToBounds(
      L.latLngBounds([Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]).pad(0.06),
      { duration: 1.4 }
    )
  }

  return (
    <div className="flex h-full bg-surface-bg relative">
      {/* ── Desktop sidebar ── */}
      {!isMobile && (
        <div className="w-72 bg-surface-panel border-r border-surface-border flex flex-col p-4 gap-3 overflow-y-auto flex-shrink-0">
          <MapSidebarContent
            wardArea={wardArea} regionVoters={regionVoters} activeRegion={activeRegion}
            teamMembers={teamMembers} user={user}
            onZoom={zoomToRegion} onReset={resetMap}
          />
        </div>
      )}

      {/* ── Map canvas ── */}
      <div ref={containerRef} className="flex-1" style={{ minHeight: 0 }} aria-label="Interactive campaign map" />

      {/* ── Mobile: floating drawer toggle ── */}
      {isMobile && (
        <>
          <button
            onClick={() => setDrawerOpen((v) => !v)}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 px-4 py-2.5 bg-surface-panel border border-surface-border-light rounded-full shadow-2xl text-sm font-semibold text-slate-200 active:bg-white/10 transition-colors"
            aria-expanded={drawerOpen}
            aria-label="Toggle map controls"
          >
            {drawerOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            {drawerOpen ? 'Hide Controls' : 'Map Controls'}
          </button>

          {/* Slide-up drawer */}
          {drawerOpen && (
            <>
              <div className="absolute inset-0 z-[999] bg-black/40" onClick={() => setDrawerOpen(false)} />
              <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-surface-panel border-t border-surface-border-light rounded-t-2xl max-h-[70vh] overflow-y-auto shadow-2xl">
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-surface-border-light" />
                </div>
                <div className="px-4 pb-6 flex flex-col gap-3">
                  <MapSidebarContent
                    wardArea={wardArea} regionVoters={regionVoters} activeRegion={activeRegion}
                    teamMembers={teamMembers} user={user}
                    onZoom={(r) => { zoomToRegion(r); setDrawerOpen(false) }}
                    onReset={() => { resetMap(); setDrawerOpen(false) }}
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── Extracted sidebar content (shared desktop + mobile drawer) ────────────────

function MapSidebarContent({ wardArea, regionVoters, activeRegion, teamMembers, user, onZoom, onReset }: {
  wardArea: number
  regionVoters: Record<number, number>
  activeRegion: number | null
  teamMembers: AppUser[]
  user: AppUser | null
  onZoom: (r: number) => void
  onReset: () => void
}) {
  return (
    <>
      <div className="text-center pb-3 border-b border-surface-border">
        <p className="text-lg font-extrabold tracking-tight"
          style={{ background: 'linear-gradient(135deg, #e94560, #c17e1a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          🗳️ Kisiara Ward
        </p>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Campaign Map</p>
      </div>

      <div className="grid grid-cols-3 gap-2 bg-white/[0.03] rounded-xl p-3">
        {[{ value: '5', label: 'Regions' }, { value: wardArea.toFixed(1), label: 'km²' }, { value: '12,486', label: 'Voters' }].map(({ value, label }) => (
          <div key={label} className="text-center">
            <p className="text-xl font-bold text-crimson leading-none">{value}</p>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">{label}</p>
          </div>
        ))}
      </div>

      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold px-1 mt-1">📍 Campaign Regions</p>

      {[1, 2, 3, 4, 5].map((r) => (
        <button key={r} onClick={() => onZoom(r)}
          className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 border-2 ${
            activeRegion === r ? 'border-white shadow-lg translate-x-1' : 'border-transparent hover:border-white/30 hover:translate-x-1'
          }`}
          style={{ background: REGION_COLOURS[r] }}
          aria-pressed={activeRegion === r}>
          <span className="w-3.5 h-3.5 rounded-full bg-white/40 flex-shrink-0" />
          <span className="flex-1 text-left">R{r} — {REGION_NAMES[r]}</span>
          <span className="text-[10px] bg-black/20 px-2 py-0.5 rounded-full">{regionVoters[r]?.toLocaleString()}</span>
        </button>
      ))}

      <button onClick={onReset}
        className="px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-surface-border hover:border-white/25 text-slate-300 rounded-xl text-sm font-semibold transition-all">
        🔍 Show Entire Ward
      </button>

      {user && isAspirant(user.role) && (
        <div className="p-3 bg-gold/10 border border-gold/25 rounded-xl">
          <p className="text-xs text-gold font-medium mb-1.5">Team Locations</p>
          <p className="text-[11px] text-slate-400">
            {teamMembers.filter((m) => m.home_location).length} of {teamMembers.length} members mapped
          </p>
          <p className="text-[10px] text-slate-600 mt-1">Pins show initials in region colour.</p>
        </div>
      )}

      <p className="text-[9px] text-slate-600 text-center">17 polling centres · Equal-area regions</p>
    </>
  )
}
