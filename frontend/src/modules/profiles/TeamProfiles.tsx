import { useEffect, useState, useRef } from 'react'
import { Users, Search, Star, MapPin, Phone, Mail, Plus, Edit2, UserX, UserCheck } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../../lib/supabase'
import { useAppSelector } from '../../hooks/useAppDispatch'
import { RoleBadge, RegionBadge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Input, Textarea } from '../../components/ui/Input'
import { REGION_COLOURS, ROLE_LABELS, REGION_NAMES } from '../../lib/constants'
import { isSuperUser, isAspirant } from '../../lib/permissions'
import { WARD_BOUNDARY } from '../../lib/mapData'
import type { AppUser } from '../../types/models'
import type { UserRole } from '../../types/enums'
import toast from 'react-hot-toast'

const EDITABLE_ROLES: UserRole[] = ['team_lead', 'assistant', 'opinion_leader', 'agent']

function canAdminProfiles(role: UserRole) {
  return isAspirant(role) || isSuperUser(role)
}

// ─── blank form ────────────────────────────────────────────────────────────
const BLANK = {
  full_name: '',
  email: '',
  phone: '',
  gender: '' as 'M' | 'F' | '',
  role: 'agent' as UserRole,
  region_id: '' as string,
  estimated_influence: '0',
  loyalty_rating: '' as string,
  networks: '',
  private_notes: '',
  lat: '' as string,
  lng: '' as string,
}

type FormState = typeof BLANK

export function TeamProfiles() {
  const user = useAppSelector((s) => s.auth.user)
  const [members, setMembers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')

  // modals
  const [viewMember, setViewMember] = useState<AppUser | null>(null)
  const [editMember, setEditMember] = useState<AppUser | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<FormState>(BLANK)
  const [saving, setSaving] = useState(false)
  const [showMap, setShowMap] = useState(false)

  const isAdmin = user ? canAdminProfiles(user.role) : false

  const fetchMembers = () => {
    supabase
      .from('users')
      .select('*, region:regions(id,name,code,color)')
      .eq('is_active', true)
      .neq('role', 'aspirant')
      .neq('role', 'super_user')
      .order('full_name')
      .then(({ data }) => {
        if (data) setMembers(data as AppUser[])
        setLoading(false)
      })
  }

  useEffect(() => { fetchMembers() }, [])

  const filtered = members.filter((m) => {
    const q = search.toLowerCase()
    const matchSearch = m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    const matchRole = roleFilter ? m.role === roleFilter : true
    const matchRegion = regionFilter ? String(m.region_id) === regionFilter : true
    return matchSearch && matchRole && matchRegion
  })

  // open edit — prefill form
  const openEdit = (m: AppUser) => {
    const coords = m.home_location?.coordinates
    setForm({
      full_name: m.full_name,
      email: m.email,
      phone: m.phone ?? '',
      gender: m.gender ?? '',
      role: m.role,
      region_id: String(m.region_id ?? ''),
      estimated_influence: String(m.estimated_influence ?? 0),
      loyalty_rating: String(m.loyalty_rating ?? ''),
      networks: (m.networks ?? []).join(', '),
      private_notes: m.private_notes ?? '',
      lat: coords ? String(coords[1]) : '',
      lng: coords ? String(coords[0]) : '',
    })
    setEditMember(m)
    setShowMap(false)
  }

  const openAdd = () => {
    setForm(BLANK)
    setEditMember(null)
    setShowAdd(true)
    setShowMap(false)
  }

  const handleSave = async () => {
    if (!form.full_name || !form.email || !form.role) {
      toast.error('Name, email and role are required.')
      return
    }
    setSaving(true)

    const networksArr = form.networks
      ? form.networks.split(',').map((n) => n.trim()).filter(Boolean)
      : null

    const homeLocation =
      form.lat && form.lng
        ? `SRID=4326;POINT(${form.lng} ${form.lat})`
        : null

    const payload: Record<string, unknown> = {
      full_name: form.full_name,
      phone: form.phone || null,
      gender: form.gender || null,
      role: form.role,
      region_id: form.region_id ? parseInt(form.region_id) : null,
      estimated_influence: parseInt(form.estimated_influence || '0'),
      loyalty_rating: form.loyalty_rating ? parseInt(form.loyalty_rating) : null,
      networks: networksArr,
      private_notes: form.private_notes || null,
      home_location: homeLocation,
    }

    if (editMember) {
      const { error } = await supabase.from('users').update(payload).eq('id', editMember.id)
      if (error) toast.error('Failed to update profile.')
      else { toast.success('Profile updated.'); setEditMember(null); fetchMembers() }
    } else {
      // Call edge function — handles auth user creation + profile insert server-side
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          ...payload,
          email: form.email,
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      })

      // supabase.functions.invoke puts HTTP error bodies in `error.context`
      let errMsg: string | null = null
      if (error) {
        try {
          const body = await (error as unknown as { context: Response }).context.json()
          errMsg = body?.error ?? error.message
        } catch {
          errMsg = error.message
        }
      } else if (data?.error) {
        errMsg = data.error
      }

      if (errMsg) {
        toast.error(errMsg, { duration: 6000 })
      } else {
        toast.success(`Invite sent to ${form.email}. They'll receive a login link.`)
        setShowAdd(false)
        fetchMembers()
      }
    }
    setSaving(false)
  }

  const toggleActive = async (m: AppUser) => {
    const { error } = await supabase.from('users').update({ is_active: !m.is_active }).eq('id', m.id)
    if (error) toast.error('Update failed.')
    else { toast.success(m.is_active ? 'Member deactivated.' : 'Member reactivated.'); fetchMembers() }
  }

  if (!user) return null

  const modalOpen = !!(editMember || showAdd)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gold/15 border border-gold/25 flex items-center justify-center">
            <Users className="w-4.5 h-4.5 text-gold" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-100 text-sm md:text-base">Team Profiles</h1>
            <p className="text-xs text-slate-500">{filtered.length} of {members.length} operatives · Confidential</p>
          </div>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openAdd} icon={<Plus className="w-3.5 h-3.5" />}>
            <span className="hidden sm:inline">Add Member</span>
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="px-4 md:px-6 py-3 border-b border-surface-border flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
            className="w-full bg-surface-elevated border border-surface-border-light rounded-xl pl-8 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-gold/40"
            aria-label="Search team members" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-surface-elevated border border-surface-border-light rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-gold/40">
          <option value="">All Roles</option>
          {EDITABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}
          className="bg-surface-elevated border border-surface-border-light rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-gold/40">
          <option value="">All Regions</option>
          {[1,2,3,4,5].map((r) => <option key={r} value={r}>R{r} — {REGION_NAMES[r]}</option>)}
        </select>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-500">Loading profiles...</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">No members found.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map((member) => (
              <ProfileCard
                key={member.id}
                member={member}
                isAdmin={isAdmin}
                onView={() => setViewMember(member)}
                onEdit={() => openEdit(member)}
              />
            ))}
          </div>
        )}
      </div>

      {/* View Modal */}
      <Modal open={!!viewMember} onClose={() => setViewMember(null)} title="Operative Profile" size="md">
        {viewMember && (
          <ProfileDetail
            member={viewMember}
            isAdmin={isAdmin}
            onEdit={() => { setViewMember(null); openEdit(viewMember) }}
            onToggleActive={() => { toggleActive(viewMember); setViewMember(null) }}
          />
        )}
      </Modal>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setEditMember(null); setShowAdd(false) }}
        title={editMember ? `Edit — ${editMember.full_name}` : 'Add Team Member'}
        size="xl"
      >
        <MemberForm
          form={form}
          setForm={setForm}
          saving={saving}
          isEdit={!!editMember}
          showMap={showMap}
          setShowMap={setShowMap}
          onSave={handleSave}
          onCancel={() => { setEditMember(null); setShowAdd(false) }}
        />
      </Modal>
    </div>
  )
}

// ─── Profile Card ────────────────────────────────────────────────────────────

function ProfileCard({ member, isAdmin, onView, onEdit }: {
  member: AppUser
  isAdmin: boolean
  onView: () => void
  onEdit: () => void
}) {
  const col = REGION_COLOURS[member.region_id ?? 1]
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-4 flex flex-col gap-2 animate-fade-in">
      <button onClick={onView} className="text-left flex items-center gap-3 flex-1">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 border-2"
          style={{ background: `${col}20`, color: col, borderColor: `${col}40` }}
        >
          {member.full_name.charAt(0)}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm text-slate-200 truncate">{member.full_name}</p>
          <RoleBadge role={member.role} />
        </div>
      </button>

      {member.region_id && <RegionBadge regionId={member.region_id} />}

      {member.loyalty_rating && (
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="w-3 h-3"
              style={{ color: i < member.loyalty_rating! ? '#c17e1a' : '#374151', fill: i < member.loyalty_rating! ? '#c17e1a' : 'none' }} />
          ))}
        </div>
      )}

      {member.estimated_influence > 0 && (
        <p className="text-xs text-slate-500">~{member.estimated_influence.toLocaleString()} voter influence</p>
      )}

      {member.home_location && (
        <p className="text-xs text-emerald-400 flex items-center gap-1">
          <MapPin className="w-3 h-3" /> Location mapped
        </p>
      )}

      {isAdmin && (
        <button
          onClick={onEdit}
          className="mt-auto flex items-center gap-1.5 text-xs text-slate-500 hover:text-gold transition-colors pt-1 border-t border-surface-border"
        >
          <Edit2 className="w-3 h-3" /> Edit
        </button>
      )}
    </div>
  )
}

// ─── Profile Detail (view) ────────────────────────────────────────────────────

function ProfileDetail({ member, isAdmin, onEdit, onToggleActive }: {
  member: AppUser
  isAdmin: boolean
  onEdit: () => void
  onToggleActive: () => void
}) {
  const col = REGION_COLOURS[member.region_id ?? 1]
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold border-2"
            style={{ background: `${col}20`, color: col, borderColor: `${col}50` }}>
            {member.full_name.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-slate-100 text-base">{member.full_name}</p>
            <RoleBadge role={member.role} />
            {member.region_id && <div className="mt-1"><RegionBadge regionId={member.region_id} /></div>}
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2 flex-shrink-0">
            <Button size="sm" variant="outline" onClick={onEdit} icon={<Edit2 className="w-3.5 h-3.5" />}>Edit</Button>
            <Button size="sm" variant={member.is_active ? 'danger' : 'secondary'} onClick={onToggleActive}
              icon={member.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}>
              {member.is_active ? 'Deactivate' : 'Reactivate'}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <InfoRow icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={member.email} />
        {member.phone && <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label="Phone" value={member.phone} />}
        {member.gender && <InfoRow icon={<Users className="w-3.5 h-3.5" />} label="Gender" value={member.gender === 'M' ? 'Male' : 'Female'} />}
        {member.estimated_influence > 0 && (
          <InfoRow icon={<Users className="w-3.5 h-3.5" />} label="Influence" value={`~${member.estimated_influence.toLocaleString()} voters`} />
        )}
        {member.home_location && (
          <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="GPS"
            value={`${member.home_location.coordinates[1].toFixed(5)}, ${member.home_location.coordinates[0].toFixed(5)}`} />
        )}
      </div>

      {member.loyalty_rating && (
        <div className="bg-surface-elevated rounded-xl p-3 border border-surface-border">
          <p className="text-xs text-slate-500 mb-1.5">Loyalty Rating</p>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="w-4 h-4"
                style={{ color: i < member.loyalty_rating! ? '#c17e1a' : '#374151', fill: i < member.loyalty_rating! ? '#c17e1a' : 'none' }} />
            ))}
            <span className="text-sm text-gold ml-1">{member.loyalty_rating}/5</span>
          </div>
        </div>
      )}

      {member.networks && member.networks.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1.5">Community Networks</p>
          <div className="flex flex-wrap gap-1.5">
            {member.networks.map((n) => (
              <span key={n} className="text-xs px-2 py-0.5 bg-navy/30 border border-blue-500/20 rounded-full text-blue-300">{n}</span>
            ))}
          </div>
        </div>
      )}

      {member.private_notes && isAdmin && (
        <div className="bg-gold/5 border border-gold/20 rounded-xl p-3">
          <p className="text-xs text-gold mb-1">Private Notes</p>
          <p className="text-sm text-slate-300 leading-relaxed">{member.private_notes}</p>
        </div>
      )}
    </div>
  )
}

// ─── Member Form (add / edit) ─────────────────────────────────────────────────

function MemberForm({ form, setForm, saving, isEdit, showMap, setShowMap, onSave, onCancel }: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  saving: boolean
  isEdit: boolean
  showMap: boolean
  setShowMap: (v: boolean) => void
  onSave: () => void
  onCancel: () => void
}) {
  const f = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }))

  return (
    <div className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">
      {/* Basic info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Full Name" value={form.full_name} onChange={f('full_name')} placeholder="e.g. John Kipchoge" required />
        <Input label="Email" type="email" value={form.email} onChange={f('email')} placeholder="john@example.com" required disabled={isEdit} />
        <Input label="Phone" value={form.phone} onChange={f('phone')} placeholder="+254 7XX XXX XXX" />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Gender</label>
          <select value={form.gender} onChange={f('gender')}
            className="bg-surface-elevated border border-surface-border-light rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-gold/50">
            <option value="">— Select —</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </div>
      </div>

      {/* Role & Region */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Role</label>
          <select value={form.role} onChange={f('role')}
            className="bg-surface-elevated border border-surface-border-light rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-gold/50">
            {EDITABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Region</label>
          <select value={form.region_id} onChange={f('region_id')}
            className="bg-surface-elevated border border-surface-border-light rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-gold/50">
            <option value="">— None —</option>
            {[1,2,3,4,5].map((r) => <option key={r} value={r}>R{r} — {REGION_NAMES[r]}</option>)}
          </select>
        </div>
      </div>

      {/* Influence & Loyalty */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Estimated Voter Influence" type="number" min="0"
          value={form.estimated_influence} onChange={f('estimated_influence')} placeholder="0" />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Loyalty Rating (1–5)</label>
          <div className="flex gap-2 items-center">
            {[1,2,3,4,5].map((n) => (
              <button key={n} type="button"
                onClick={() => setForm((p) => ({ ...p, loyalty_rating: String(p.loyalty_rating) === String(n) ? '' : String(n) }))}
                className="focus:outline-none transition-transform hover:scale-110">
                <Star className="w-6 h-6"
                  style={{
                    color: parseInt(form.loyalty_rating || '0') >= n ? '#c17e1a' : '#374151',
                    fill: parseInt(form.loyalty_rating || '0') >= n ? '#c17e1a' : 'none',
                  }} />
              </button>
            ))}
            {form.loyalty_rating && (
              <span className="text-xs text-gold ml-1">{form.loyalty_rating}/5</span>
            )}
          </div>
        </div>
      </div>

      {/* Networks */}
      <Input label="Community Networks (comma-separated)" value={form.networks} onChange={f('networks')}
        placeholder="e.g. Youth Leaders, Church Elders, Traders" />

      {/* Private Notes */}
      <Textarea label="Private Notes (admin only)" value={form.private_notes} onChange={f('private_notes')}
        rows={3} placeholder="Confidential notes about this operative..." />

      {/* Home Location */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Home Location (GPS)</label>
          <button type="button"
            onClick={() => setShowMap(!showMap)}
            className="text-xs text-gold hover:text-gold/80 flex items-center gap-1 transition-colors">
            <MapPin className="w-3 h-3" />
            {showMap ? 'Hide map' : 'Pick on map'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Input label="Latitude" type="number" step="any" value={form.lat} onChange={f('lat')} placeholder="-0.5007" />
          <Input label="Longitude" type="number" step="any" value={form.lng} onChange={f('lng')} placeholder="35.0728" />
        </div>

        {showMap && (
          <LocationPicker
            lat={form.lat ? parseFloat(form.lat) : undefined}
            lng={form.lng ? parseFloat(form.lng) : undefined}
            onPick={(lat, lng) => {
              setForm((p) => ({ ...p, lat: lat.toFixed(6), lng: lng.toFixed(6) }))
            }}
          />
        )}

        {form.lat && form.lng && (
          <p className="text-xs text-emerald-400 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Pinned at {parseFloat(form.lat).toFixed(5)}, {parseFloat(form.lng).toFixed(5)}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-surface-border">
        <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        <Button onClick={onSave} loading={saving}>{isEdit ? 'Save Changes' : 'Add Member'}</Button>
      </div>
    </div>
  )
}

// ─── Location Picker (mini Leaflet map) ──────────────────────────────────────

function LocationPicker({ lat, lng, onPick }: {
  lat?: number
  lng?: number
  onPick: (lat: number, lng: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const wardCenter: [number, number] = [-0.499, 35.1]
    const initialCenter: [number, number] = lat && lng ? [lat, lng] : wardCenter

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: lat && lng ? 15 : 13,
      zoomControl: true,
    })
    mapRef.current = map

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OSM © CARTO', subdomains: 'abcd', maxZoom: 20,
    }).addTo(map)

    // Ward boundary outline
    L.polygon(WARD_BOUNDARY, {
      color: '#ffffff', weight: 1.5, opacity: 0.5, fill: false, dashArray: '5 5',
    }).addTo(map)

    // Existing pin
    if (lat && lng) {
      const marker = L.marker([lat, lng], { draggable: true }).addTo(map)
      markerRef.current = marker
      marker.on('dragend', () => {
        const pos = marker.getLatLng()
        onPick(pos.lat, pos.lng)
      })
    }

    // Click to place / move pin
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat: clickLat, lng: clickLng } = e.latlng
      if (markerRef.current) {
        markerRef.current.setLatLng([clickLat, clickLng])
      } else {
        const marker = L.marker([clickLat, clickLng], { draggable: true }).addTo(map)
        markerRef.current = marker
        marker.on('dragend', () => {
          const pos = marker.getLatLng()
          onPick(pos.lat, pos.lng)
        })
      }
      onPick(clickLat, clickLng)
    })

    return () => { map.remove(); mapRef.current = null; markerRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update marker when lat/lng changes externally (manual input)
  useEffect(() => {
    if (!mapRef.current || !lat || !lng) return
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng])
      mapRef.current.panTo([lat, lng])
    }
  }, [lat, lng])

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl overflow-hidden border border-surface-border-light"
      style={{ height: 280 }}
      aria-label="Location picker map — click to place pin"
    />
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-slate-400">
      <span className="text-slate-600 mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <p className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-slate-300">{value}</p>
      </div>
    </div>
  )
}
