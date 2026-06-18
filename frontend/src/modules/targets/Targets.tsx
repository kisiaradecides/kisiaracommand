import { useEffect, useState, type FormEvent } from 'react'
import { Target, Plus, TrendingUp } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAppSelector } from '../../hooks/useAppDispatch'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Input, Textarea } from '../../components/ui/Input'
import { RegionBadge } from '../../components/ui/Badge'
import type { Target as TargetType } from '../../types/models'
import toast from 'react-hot-toast'

function getStatus(current: number, target: number): 'red' | 'yellow' | 'green' {
  const pct = (current / target) * 100
  if (pct >= 80) return 'green'
  if (pct >= 50) return 'yellow'
  return 'red'
}

const STATUS_STYLE = {
  red: { bar: '#e94560', bg: 'bg-crimson/10', border: 'border-crimson/25', dot: '🔴' },
  yellow: { bar: '#c17e1a', bg: 'bg-gold/10', border: 'border-gold/25', dot: '🟡' },
  green: { bar: '#1a936f', bg: 'bg-emerald-brand/10', border: 'border-emerald-brand/25', dot: '🟢' },
}

export function TargetsDashboard() {
  const user = useAppSelector((s) => s.auth.user)
  const [targets, setTargets] = useState<TargetType[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<TargetType | null>(null)
  const [form, setForm] = useState({ title: '', description: '', target_value: '', current_value: '', unit: 'count', deadline: '', region_id: '' })
  const [saving, setSaving] = useState(false)

  const fetch = async () => {
    const { data } = await supabase
      .from('targets')
      .select('*, region:regions(id,name,code,color)')
      .order('deadline', { ascending: true, nullsFirst: false })
    if (data) setTargets(data as TargetType[])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const openEdit = (t: TargetType) => {
    setEditTarget(t)
    setForm({
      title: t.title, description: t.description ?? '', target_value: String(t.target_value),
      current_value: String(t.current_value), unit: t.unit, deadline: t.deadline ?? '', region_id: String(t.region_id ?? ''),
    })
    setShowCreate(true)
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!user || !form.title || !form.target_value) return
    setSaving(true)
    const payload = {
      title: form.title, description: form.description || null,
      target_value: parseInt(form.target_value), current_value: parseInt(form.current_value || '0'),
      unit: form.unit, deadline: form.deadline || null,
      region_id: form.region_id ? parseInt(form.region_id) : null,
      created_by: user.id,
    }
    const { error } = editTarget
      ? await supabase.from('targets').update(payload).eq('id', editTarget.id)
      : await supabase.from('targets').insert(payload)
    if (error) toast.error('Failed to save target.')
    else { toast.success(editTarget ? 'Target updated.' : 'Target created.'); setShowCreate(false); setEditTarget(null); fetch() }
    setSaving(false)
  }

  const updateCurrent = async (t: TargetType, val: number) => {
    await supabase.from('targets').update({ current_value: val }).eq('id', t.id)
    fetch()
    toast.success('Progress updated.')
  }

  // Summary stats
  const summary = { red: 0, yellow: 0, green: 0 }
  targets.forEach((t) => { summary[getStatus(t.current_value, t.target_value)]++ })

  if (!user) return null

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-brand/15 border border-emerald-brand/25 flex items-center justify-center">
            <Target className="w-4.5 h-4.5 text-emerald-300" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-100 text-sm md:text-base">Targets & KPIs</h1>
            <p className="text-xs text-slate-500">
              {summary.green} on track · {summary.yellow} progressing · {summary.red} off track
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => { setEditTarget(null); setForm({ title: '', description: '', target_value: '', current_value: '0', unit: 'count', deadline: '', region_id: '' }); setShowCreate(true) }} icon={<Plus className="w-3.5 h-3.5" />}>
          <span className="hidden sm:inline">New Target</span>
        </Button>
      </div>

      {/* Summary RAG row */}
      <div className="px-6 py-3 border-b border-surface-border grid grid-cols-3 gap-3">
        {[
          { label: 'On Track', count: summary.green, colour: '#1a936f', icon: '🟢' },
          { label: 'Progressing', count: summary.yellow, colour: '#c17e1a', icon: '🟡' },
          { label: 'Off Track', count: summary.red, colour: '#e94560', icon: '🔴' },
        ].map(({ label, count, colour, icon }) => (
          <div key={label} className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold" style={{ color: colour }}>{count}</p>
            <p className="text-xs text-slate-500 mt-0.5">{icon} {label}</p>
          </div>
        ))}
      </div>

      {/* Targets list */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-500">Loading targets...</div>
        ) : targets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
            <TrendingUp className="w-8 h-8 opacity-30" />
            <p className="text-sm">No targets yet. Add your first KPI.</p>
          </div>
        ) : (
          targets.map((t) => {
            const status = getStatus(t.current_value, t.target_value)
            const style = STATUS_STYLE[status]
            const pct = Math.min(100, Math.round((t.current_value / t.target_value) * 100))
            return (
              <Card key={t.id} className={`p-5 ${style.bg} ${style.border}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span>{style.dot}</span>
                      <h3 className="font-semibold text-slate-200">{t.title}</h3>
                      {t.region_id && <RegionBadge regionId={t.region_id} />}
                    </div>
                    {t.description && <p className="text-sm text-slate-400">{t.description}</p>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>Edit</Button>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                    <span>{t.current_value.toLocaleString()} {t.unit}</span>
                    <span className="font-semibold">{pct}%</span>
                    <span>Goal: {t.target_value.toLocaleString()} {t.unit}</span>
                  </div>
                  <div className="h-2.5 bg-surface-elevated rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: style.bar }} />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-slate-500">Update current:</label>
                    <input
                      type="number"
                      defaultValue={t.current_value}
                      min={0}
                      max={t.target_value * 2}
                      className="w-24 bg-surface-elevated border border-surface-border-light rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-gold/40"
                      onBlur={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v !== t.current_value) updateCurrent(t, v) }}
                      aria-label={`Update current value for ${t.title}`}
                    />
                  </div>
                  {t.deadline && (
                    <span className="text-xs text-slate-500">
                      📅 Due {format(parseISO(t.deadline), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
              </Card>
            )
          })
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={editTarget ? 'Edit Target' : 'New Target'} size="md">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Input label="Target Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Register new supporters" required />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Target Value" type="number" value={form.target_value} onChange={(e) => setForm((f) => ({ ...f, target_value: e.target.value }))} required />
            <Input label="Current Value" type="number" value={form.current_value} onChange={(e) => setForm((f) => ({ ...f, current_value: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Unit" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="e.g. voters, events" />
            <Input label="Deadline" type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Region (optional)</label>
            <select value={form.region_id} onChange={(e) => setForm((f) => ({ ...f, region_id: e.target.value }))}
              className="bg-surface-elevated border border-surface-border-light rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-gold/50">
              <option value="">— Ward-wide —</option>
              {[1,2,3,4,5].map((r) => <option key={r} value={r}>R{r} — {['Northwest','Northeast','East','Southeast','Southwest'][r-1]}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editTarget ? 'Save Changes' : 'Create Target'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
