import { useEffect, useState, type FormEvent } from 'react'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar, Plus, Check, X, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAppSelector } from '../../hooks/useAppDispatch'
import { canSubmitEvents, canApproveEvents, canViewFullCalendar } from '../../lib/permissions'
import { RegionBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Input, Textarea } from '../../components/ui/Input'
import { REGION_COLOURS } from '../../lib/constants'
import type { CampaignEvent } from '../../types/models'
import toast from 'react-hot-toast'

export function EventsCalendar() {
  const user = useAppSelector((s) => s.auth.user)
  const [events, setEvents] = useState<CampaignEvent[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selected, setSelected] = useState<Date | null>(null)
  const [showSubmit, setShowSubmit] = useState(false)
  const [showPending, setShowPending] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', event_date: '', location_text: '' })
  const [submitting, setSubmitting] = useState(false)

  const fetchEvents = async () => {
    if (!user) return
    let query = supabase
      .from('events')
      .select('*, region:regions(id,name,code,color)')
      .order('event_date', { ascending: true })

    if (!canViewFullCalendar(user.role)) {
      query = query.eq('status', 'scheduled').eq('region_id', user.region_id ?? 0)
    }
    // Also include user's own submissions so they see "submitted" status
    if (canSubmitEvents(user.role) && !canViewFullCalendar(user.role)) {
      query = supabase
        .from('events')
        .select('*, region:regions(id,name,code,color)')
        .or(`and(status.eq.scheduled,region_id.eq.${user.region_id ?? 0}),created_by.eq.${user.id}`)
        .order('event_date', { ascending: true })
    }

    const { data } = await query
    if (data) setEvents(data as CampaignEvent[])
  }

  useEffect(() => { fetchEvents() }, [user])

  const handleSubmitEvent = async (e: FormEvent) => {
    e.preventDefault()
    if (!user || !form.title || !form.event_date) return
    setSubmitting(true)

    const { error } = await supabase.from('events').insert({
      title: form.title,
      description: form.description || null,
      event_date: form.event_date,
      location_text: form.location_text || null,
      region_id: user.region_id,
      created_by: user.id,
      created_role: user.role,
      status: 'submitted',
    })

    if (error) {
      toast.error('Failed to submit event.')
    } else {
      toast.success('✅ Successfully Submitted.')
      setShowSubmit(false)
      setForm({ title: '', description: '', event_date: '', location_text: '' })
      fetchEvents()
    }
    setSubmitting(false)
  }

  const handleApprove = async (eventId: string, action: 'schedule' | 'discard') => {
    const { error } = await supabase
      .from('events')
      .update({ status: action === 'schedule' ? 'scheduled' : 'discarded' })
      .eq('id', eventId)

    if (error) {
      toast.error('Action failed.')
    } else {
      toast.success(action === 'schedule' ? 'Event scheduled.' : 'Event discarded.')
      fetchEvents()
    }
  }

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const scheduledEvents = events.filter((e) => e.status === 'scheduled')
  const pendingEvents = events.filter((e) => e.status === 'submitted')

  const getEventsForDay = (day: Date) =>
    scheduledEvents.filter((e) => isSameDay(parseISO(e.event_date), day))

  if (!user) return null

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 md:py-5 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-navy/40 border border-blue-500/25 flex items-center justify-center">
            <Calendar className="w-4.5 h-4.5 text-blue-400" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-100 text-sm md:text-base">Events Calendar</h1>
            <p className="text-xs text-slate-500">
              {scheduledEvents.length} scheduled
              {canApproveEvents(user.role) && pendingEvents.length > 0 && (
                <span className="ml-2 text-gold">{pendingEvents.length} pending</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canApproveEvents(user.role) && pendingEvents.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowPending(true)} icon={<Clock className="w-3.5 h-3.5" />}>
              <span className="hidden sm:inline">Review </span>({pendingEvents.length})
            </Button>
          )}
          {canSubmitEvents(user.role) && (
            <Button size="sm" onClick={() => setShowSubmit(true)} icon={<Plus className="w-3.5 h-3.5" />}>
              <span className="hidden sm:inline">Propose</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1))}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-slate-200">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="font-semibold text-slate-200">{format(currentMonth, 'MMMM yyyy')}</h2>
          <button onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1))}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-slate-200">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Grid */}
        <Card>
          <div className="grid grid-cols-7 border-b border-surface-border">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {/* Empty cells for start of month */}
            {Array.from({ length: days[0].getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[44px] md:min-h-[80px] border-b border-r border-surface-border p-1" />
            ))}

            {days.map((day) => {
              const dayEvents = getEventsForDay(day)
              const isSelected = selected && isSameDay(day, selected)
              return (
                <div
                  key={day.toISOString()}
                  onClick={() => setSelected(isSelected ? null : day)}
                  className={`min-h-[44px] md:min-h-[80px] border-b border-r border-surface-border p-1 md:p-1.5 cursor-pointer transition-colors ${
                    isSelected ? 'bg-gold/10' : 'hover:bg-white/[0.02]'
                  } ${isToday(day) ? 'ring-1 ring-inset ring-gold/40' : ''}`}
                >
                  <p className={`text-xs font-medium mb-0.5 md:mb-1 w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center ${
                    isToday(day) ? 'bg-gold text-white' : 'text-slate-400'
                  }`}>
                    {format(day, 'd')}
                  </p>
                  {/* Desktop: show event pills */}
                  <div className="hidden md:flex flex-col gap-0.5">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <div key={ev.id} className="text-[10px] font-medium px-1.5 py-0.5 rounded truncate"
                        style={{ background: `${REGION_COLOURS[ev.region_id]}30`, color: REGION_COLOURS[ev.region_id] }}
                        title={ev.title}>
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && <p className="text-[10px] text-slate-500 px-1">+{dayEvents.length - 2} more</p>}
                  </div>
                  {/* Mobile: just a dot if events exist */}
                  {dayEvents.length > 0 && (
                    <div className="flex md:hidden justify-center mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>

        {/* Selected day detail */}
        {selected && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">
              {format(selected, 'EEEE, MMMM d, yyyy')}
            </h3>
            {getEventsForDay(selected).length === 0 ? (
              <p className="text-sm text-slate-500">No events scheduled for this day.</p>
            ) : (
              getEventsForDay(selected).map((ev) => (
                <Card key={ev.id} className="p-4 mb-2">
                  <div className="flex items-start gap-3">
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: REGION_COLOURS[ev.region_id] }} />
                    <div>
                      <p className="font-medium text-slate-200">{ev.title}</p>
                      {ev.description && <p className="text-sm text-slate-400 mt-1">{ev.description}</p>}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-xs text-slate-500">{format(parseISO(ev.event_date), 'h:mm a')}</span>
                        {ev.location_text && <span className="text-xs text-slate-500">📍 {ev.location_text}</span>}
                        <RegionBadge regionId={ev.region_id} />
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Upcoming agenda — always visible on mobile */}
        {scheduledEvents.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Upcoming Events</h3>
            <div className="flex flex-col gap-2">
              {scheduledEvents
                .filter((e) => new Date(e.event_date) >= new Date())
                .slice(0, 10)
                .map((ev) => (
                  <Card key={ev.id} className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-1 self-stretch rounded-full flex-shrink-0 mt-1" style={{ background: REGION_COLOURS[ev.region_id] }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{ev.title}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500">{format(parseISO(ev.event_date), 'EEE, MMM d · h:mm a')}</span>
                          {ev.location_text && <span className="text-xs text-slate-500">📍 {ev.location_text}</span>}
                        </div>
                        <div className="mt-1.5"><RegionBadge regionId={ev.region_id} /></div>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Submit Event Modal */}
      <Modal open={showSubmit} onClose={() => setShowSubmit(false)} title="Propose New Event" size="md">
        <form onSubmit={handleSubmitEvent} className="flex flex-col gap-4">
          <Input label="Event Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Door-to-Door — Mabasi Village" required />
          <Input label="Date & Time" type="datetime-local" value={form.event_date} onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))} required />
          <Input label="Location" value={form.location_text} onChange={(e) => setForm((f) => ({ ...f, location_text: e.target.value }))} placeholder="e.g. Mabasi Market Square" />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Expected attendance, resources needed..." rows={3} />
          <div className="text-xs text-slate-500 bg-surface-elevated rounded-lg p-3 border border-surface-border">
            Your proposal will be reviewed by the aspirant. If approved it will appear on the calendar.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setShowSubmit(false)}>Cancel</Button>
            <Button type="submit" loading={submitting}>Submit Proposal</Button>
          </div>
        </form>
      </Modal>

      {/* Pending Review Modal — Aspirant */}
      <Modal open={showPending} onClose={() => setShowPending(false)} title="Pending Event Proposals" size="lg">
        <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
          {pendingEvents.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No pending proposals.</p>
          ) : (
            pendingEvents.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 p-4 bg-surface-elevated rounded-xl border border-surface-border-light">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-200">{ev.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {format(parseISO(ev.event_date), 'PPp')} {ev.location_text && `· ${ev.location_text}`}
                  </p>
                  {ev.description && <p className="text-sm text-slate-400 mt-1">{ev.description}</p>}
                  <RegionBadge regionId={ev.region_id} />
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleApprove(ev.id, 'schedule')}
                    className="p-2 rounded-lg bg-emerald-brand/15 hover:bg-emerald-brand/30 text-emerald-300 transition-colors" title="Add to calendar">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleApprove(ev.id, 'discard')}
                    className="p-2 rounded-lg bg-crimson/15 hover:bg-crimson/30 text-red-300 transition-colors" title="Discard">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  )
}
