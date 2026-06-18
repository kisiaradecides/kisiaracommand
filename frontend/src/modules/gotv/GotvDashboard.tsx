import { useEffect, useState, type FormEvent } from 'react'
import { Vote, Camera, Upload, CheckCircle, AlertTriangle, Clock, BarChart3 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAppSelector } from '../../hooks/useAppDispatch'
import { canViewGotvCommand, isAgent } from '../../lib/permissions'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Textarea } from '../../components/ui/Input'
import { REGION_COLOURS, REGION_NAMES } from '../../lib/constants'
import type { GotvReport, GotvResult, PollingCentre } from '../../types/models'
import type { StationStatus } from '../../types/enums'
import toast from 'react-hot-toast'

const STATUS_ICON: Record<StationStatus, string> = {
  open: '✅', delayed: '⚠️', problem: '🚨', closed: '🔒',
}

export function GotvDashboard() {
  const user = useAppSelector((s) => s.auth.user)
  const [centres, setCentres] = useState<PollingCentre[]>([])
  const [reports, setReports] = useState<GotvReport[]>([])
  const [results, setResults] = useState<GotvResult[]>([])

  // Agent state
  const [agentCentre, setAgentCentre] = useState<PollingCentre | null>(null)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showTurnoutModal, setShowTurnoutModal] = useState(false)
  const [showResultsModal, setShowResultsModal] = useState(false)
  const [showIncidentModal, setShowIncidentModal] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: centresData } = await supabase
        .from('polling_centres')
        .select('*, region:regions(id,name,code,color)')
        .order('registered_voters', { ascending: false })
      if (centresData) setCentres(centresData as PollingCentre[])

      const { data: reportsData } = await supabase
        .from('gotv_reports')
        .select('*, polling_centre:polling_centres(id,name,region_id)')
        .order('created_at', { ascending: false })
      if (reportsData) setReports(reportsData as GotvReport[])

      const { data: resultsData } = await supabase
        .from('gotv_results')
        .select('*, polling_centre:polling_centres(id,name,region_id,polling_stations)')
        .order('created_at', { ascending: false })
      if (resultsData) setResults(resultsData as GotvResult[])

      if (user && isAgent(user.role) && user.polling_station_id) {
        const { data: centreData } = await supabase
          .from('polling_centres')
          .select('*')
          .eq('id', user.polling_station_id)
          .single()
        if (centreData) setAgentCentre(centreData as PollingCentre)
      }
    }
    load()

    const reloadReports = async () => {
      const { data } = await supabase.from('gotv_reports').select('*, polling_centre:polling_centres(id,name,region_id)').order('created_at', { ascending: false })
      if (data) setReports(data as GotvReport[])
    }
    const reloadResults = async () => {
      const { data } = await supabase.from('gotv_results').select('*, polling_centre:polling_centres(id,name,region_id,polling_stations)').order('created_at', { ascending: false })
      if (data) setResults(data as GotvResult[])
    }

    const reportsChannel = supabase
      .channel('gotv-reports-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gotv_reports' }, () => { reloadReports() })
      .subscribe()

    const resultsChannel = supabase
      .channel('gotv-results-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gotv_results' }, () => { reloadResults() })
      .subscribe()

    return () => { supabase.removeChannel(reportsChannel); supabase.removeChannel(resultsChannel) }
  }, [user])

  if (!user) return null

  // Show public results page for everyone
  const isAspirantView = canViewGotvCommand(user.role)
  const isAgentView = isAgent(user.role)

  const totalVotes = results.reduce((a, r) => a + r.total_votes_cast, 0)
  const reportedCentres = results.length
  const wardRegistered = centres.reduce((a, c) => a + c.registered_voters, 0) || 12486

  // Aggregate candidate totals
  const candidateTotals: Record<string, number> = {}
  results.forEach((r) => {
    Object.entries(r.candidate_results).forEach(([name, votes]) => {
      candidateTotals[name] = (candidateTotals[name] ?? 0) + Number(votes)
    })
  })
  const sortedCandidates = Object.entries(candidateTotals).sort((a, b) => b[1] - a[1])

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 md:px-6 py-4 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-crimson/15 border border-crimson/25 flex items-center justify-center">
            <Vote className="w-4.5 h-4.5 text-crimson" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-100 text-sm md:text-base">GOTV & Results</h1>
            <p className="text-xs text-slate-500">
              {reportedCentres}/{centres.length} centres · {totalVotes.toLocaleString()} votes
            </p>
          </div>
        </div>
        {isAgentView && (
          <div className="flex gap-2 flex-wrap justify-end">
            <Button size="sm" variant="outline" onClick={() => setShowStatusModal(true)} icon={<CheckCircle className="w-3.5 h-3.5" />}>
              <span className="hidden sm:inline">Status</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowTurnoutModal(true)} icon={<Clock className="w-3.5 h-3.5" />}>
              <span className="hidden sm:inline">Turnout</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowIncidentModal(true)} icon={<AlertTriangle className="w-3.5 h-3.5" />}>
              <span className="hidden sm:inline">Incident</span>
            </Button>
            <Button size="sm" onClick={() => setShowResultsModal(true)} icon={<Upload className="w-3.5 h-3.5" />}>
              Results
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 flex flex-col gap-4">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Centres Reported', value: `${reportedCentres}/${centres.length}`, colour: '#1a936f' },
            { label: 'Total Votes', value: totalVotes.toLocaleString(), colour: '#c17e1a' },
            { label: 'Ward Turnout', value: wardRegistered ? `${((totalVotes / wardRegistered) * 100).toFixed(1)}%` : '—', colour: '#0f3460' },
            { label: 'Candidates', value: String(sortedCandidates.length), colour: '#533483' },
          ].map(({ label, value, colour }) => (
            <div key={label} className="bg-surface-card border border-surface-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: colour }}>{value}</p>
              <p className="text-xs text-slate-500 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Results — public bar chart */}
        {sortedCandidates.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-gold" />
              <h2 className="font-semibold text-slate-200">Live Results</h2>
              <span className="text-xs text-slate-500 ml-auto">{reportedCentres} of {centres.length} centres</span>
            </div>
            <div className="flex flex-col gap-3">
              {sortedCandidates.map(([name, votes], i) => {
                const pct = totalVotes > 0 ? (votes / totalVotes) * 100 : 0
                const isLeading = i === 0
                return (
                  <div key={name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className={`font-medium ${isLeading ? 'text-gold' : 'text-slate-300'}`}>
                        {isLeading && '👑 '}{name}
                      </span>
                      <span className="text-slate-400">{votes.toLocaleString()} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-3 bg-surface-elevated rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: isLeading ? '#c17e1a' : '#0f3460' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* Station breakdown — table on desktop, cards on mobile */}
        <Card>
          <div className="px-4 md:px-5 py-4 border-b border-surface-border">
            <h2 className="font-semibold text-slate-200 text-sm md:text-base">Station Breakdown</h2>
          </div>

          {/* Mobile card list */}
          <div className="block md:hidden divide-y divide-surface-border">
            {centres.map((centre) => {
              const result = results.find((r) => r.polling_centre_id === centre.id)
              const latestStatus = reports
                .filter((r) => r.polling_centre_id === centre.id && r.report_type === 'station_status')
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
              const col = REGION_COLOURS[centre.region_id]
              return (
                <div key={centre.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-2 self-stretch rounded-full flex-shrink-0" style={{ background: col }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{centre.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      R{centre.region_id} · {centre.registered_voters.toLocaleString()} registered
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {result ? (
                      <p className="text-sm font-bold text-emerald-300">{result.total_votes_cast.toLocaleString()}</p>
                    ) : (
                      <p className="text-xs text-slate-600">Pending</p>
                    )}
                    {latestStatus?.station_status && (
                      <p className="text-xs text-slate-500">{STATUS_ICON[latestStatus.station_status]}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  {['Polling Centre', 'Region', 'Registered', 'Votes Cast', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                  {isAspirantView && <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Form 35A</th>}
                </tr>
              </thead>
              <tbody>
                {centres.map((centre) => {
                  const result = results.find((r) => r.polling_centre_id === centre.id)
                  const latestStatus = reports
                    .filter((r) => r.polling_centre_id === centre.id && r.report_type === 'station_status')
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                  const col = REGION_COLOURS[centre.region_id]
                  return (
                    <tr key={centre.id} className="border-b border-surface-border hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-200">{centre.name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${col}20`, color: col }}>
                          R{centre.region_id} {REGION_NAMES[centre.region_id]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{centre.registered_voters.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        {result
                          ? <span className="font-semibold text-emerald-300">{result.total_votes_cast.toLocaleString()}</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {latestStatus?.station_status
                          ? <span>{STATUS_ICON[latestStatus.station_status]} {latestStatus.station_status}</span>
                          : result ? <span className="text-emerald-300">✅ Counted</span>
                          : <span className="text-slate-600">Pending</span>}
                      </td>
                      {isAspirantView && (
                        <td className="px-4 py-3">
                          {result?.form_photo_url
                            ? <a href={result.form_photo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 underline">View</a>
                            : <span className="text-slate-600">—</span>}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Aspirant: incidents */}
        {isAspirantView && reports.filter((r) => r.report_type === 'incident').length > 0 && (
          <Card className="p-5">
            <h2 className="font-semibold text-slate-200 mb-3">🚨 Incident Reports</h2>
            <div className="flex flex-col gap-2">
              {reports.filter((r) => r.report_type === 'incident').map((r) => (
                <div key={r.id} className="flex items-start gap-3 p-3 bg-crimson/5 border border-crimson/20 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-crimson flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-200">{(r.polling_centre as { name: string })?.name}</p>
                    <p className="text-sm text-slate-400">{r.incident_description}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Type: {r.incident_type} · Status: {r.incident_status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Agent Modals */}
      {isAgentView && agentCentre && (
        <>
          <StationStatusModal
            open={showStatusModal}
            onClose={() => setShowStatusModal(false)}
            centre={agentCentre}
            agentId={user.id}
          />
          <TurnoutModal
            open={showTurnoutModal}
            onClose={() => setShowTurnoutModal(false)}
            centre={agentCentre}
            agentId={user.id}
          />
          <IncidentModal
            open={showIncidentModal}
            onClose={() => setShowIncidentModal(false)}
            centre={agentCentre}
            agentId={user.id}
          />
          <ResultsModal
            open={showResultsModal}
            onClose={() => setShowResultsModal(false)}
            centre={agentCentre}
            agentId={user.id}
            existingResult={results.find((r) => r.polling_centre_id === agentCentre.id) ?? null}
          />
        </>
      )}
    </div>
  )
}

// ─── Agent Sub-Modals ────────────────────────────────────────────────────────

function StationStatusModal({ open, onClose, centre, agentId }: {
  open: boolean; onClose: () => void; centre: PollingCentre; agentId: string
}) {
  const [status, setStatus] = useState<StationStatus>('open')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    const { error } = await supabase.from('gotv_reports').insert({
      agent_id: agentId, polling_centre_id: centre.id,
      report_type: 'station_status', station_status: status,
    })
    if (error) toast.error('Failed to submit.')
    else { toast.success('Status reported.'); onClose() }
    setSaving(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Report Station Status" size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-400">{centre.name}</p>
        <div className="grid grid-cols-2 gap-2">
          {(['open', 'delayed', 'problem', 'closed'] as StationStatus[]).map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`py-3 rounded-xl border text-sm font-medium transition-all ${status === s ? 'border-gold bg-gold/15 text-gold' : 'border-surface-border text-slate-400 hover:border-surface-border-light'}`}>
              {STATUS_ICON[s]} {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <Button onClick={submit} loading={saving}>Submit Status</Button>
      </div>
    </Modal>
  )
}

function TurnoutModal({ open, onClose, centre, agentId }: {
  open: boolean; onClose: () => void; centre: PollingCentre; agentId: string
}) {
  const [count, setCount] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!count) return
    setSaving(true)
    const { error } = await supabase.from('gotv_reports').insert({
      agent_id: agentId, polling_centre_id: centre.id,
      report_type: 'turnout', turnout_count: parseInt(count),
    })
    if (error) toast.error('Failed to submit.')
    else { toast.success('Turnout reported.'); onClose(); setCount('') }
    setSaving(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Report Turnout" size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-400">{centre.name} · {centre.registered_voters.toLocaleString()} registered</p>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Voters counted so far</label>
          <input type="number" value={count} onChange={(e) => setCount(e.target.value)} min={0} max={centre.registered_voters}
            placeholder="e.g. 450"
            className="w-full bg-surface-elevated border border-surface-border-light rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-gold/50" />
        </div>
        <Button onClick={submit} loading={saving} disabled={!count}>Submit Turnout</Button>
      </div>
    </Modal>
  )
}

function IncidentModal({ open, onClose, centre, agentId }: {
  open: boolean; onClose: () => void; centre: PollingCentre; agentId: string
}) {
  const [form, setForm] = useState({ type: '', description: '' })
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!form.description) return
    setSaving(true)
    const { error } = await supabase.from('gotv_reports').insert({
      agent_id: agentId, polling_centre_id: centre.id,
      report_type: 'incident', incident_type: form.type || 'general',
      incident_description: form.description,
    })
    if (error) toast.error('Failed to submit.')
    else { toast.success('Incident reported.'); onClose(); setForm({ type: '', description: '' }) }
    setSaving(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Report Incident" size="sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Incident Type</label>
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className="bg-surface-elevated border border-surface-border-light rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-gold/50">
            <option value="">Select type...</option>
            {['equipment_failure', 'voter_intimidation', 'ballot_shortage', 'access_issue', 'counting_dispute', 'other'].map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <Textarea label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder="Describe what happened..." />
        <Button variant="danger" onClick={submit} loading={saving} disabled={!form.description}>
          Report Incident
        </Button>
      </div>
    </Modal>
  )
}

function ResultsModal({ open, onClose, centre, agentId, existingResult }: {
  open: boolean; onClose: () => void; centre: PollingCentre; agentId: string; existingResult: GotvResult | null
}) {
  const [registered, setRegistered] = useState(String(centre.registered_voters))
  const [totalVotes, setTotalVotes] = useState('')
  const [rejected, setRejected] = useState('0')
  const [candidates, setCandidates] = useState<{ name: string; votes: string }[]>([
    { name: '', votes: '' }, { name: '', votes: '' },
  ])
  const [saving, setSaving] = useState(false)

  const addCandidate = () => setCandidates((prev) => [...prev, { name: '', votes: '' }])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (existingResult) { toast.error('Results already submitted for this station.'); return }
    setSaving(true)
    const candidateResults: Record<string, number> = {}
    candidates.forEach((c) => { if (c.name) candidateResults[c.name] = parseInt(c.votes) || 0 })

    const { error } = await supabase.from('gotv_results').insert({
      agent_id: agentId, polling_centre_id: centre.id,
      registered_voters: parseInt(registered), total_votes_cast: parseInt(totalVotes),
      rejected_votes: parseInt(rejected), candidate_results: candidateResults,
    })

    if (error) toast.error(error.message.includes('unique') ? 'Results already submitted for this station.' : 'Failed to submit results.')
    else { toast.success('Results submitted successfully.'); onClose() }
    setSaving(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Enter Official Results" size="lg">
      {existingResult ? (
        <div className="text-center py-6">
          <CheckCircle className="w-12 h-12 text-emerald-brand mx-auto mb-3" />
          <p className="font-semibold text-slate-200">Results already submitted</p>
          <p className="text-sm text-slate-500 mt-1">Results for this station have been recorded.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-sm text-slate-400 font-medium">{centre.name}</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Registered Voters</label>
              <input type="number" value={registered} onChange={(e) => setRegistered(e.target.value)}
                className="bg-surface-elevated border border-surface-border-light rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-gold/50" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Votes Cast</label>
              <input type="number" value={totalVotes} onChange={(e) => setTotalVotes(e.target.value)} required
                className="bg-surface-elevated border border-surface-border-light rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-gold/50" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Rejected Ballots</label>
              <input type="number" value={rejected} onChange={(e) => setRejected(e.target.value)}
                className="bg-surface-elevated border border-surface-border-light rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-gold/50" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Candidate Results</label>
              <button type="button" onClick={addCandidate} className="text-xs text-gold hover:text-gold/80">+ Add Candidate</button>
            </div>
            <div className="flex flex-col gap-2">
              {candidates.map((c, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <input placeholder="Candidate name" value={c.name}
                    onChange={(e) => setCandidates((prev) => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    className="bg-surface-elevated border border-surface-border-light rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-gold/50" />
                  <input placeholder="Votes" type="number" value={c.votes}
                    onChange={(e) => setCandidates((prev) => prev.map((x, j) => j === i ? { ...x, votes: e.target.value } : x))}
                    className="bg-surface-elevated border border-surface-border-light rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-gold/50" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-crimson/5 border border-crimson/20 rounded-xl text-xs text-slate-400">
            <AlertTriangle className="w-3.5 h-3.5 text-crimson flex-shrink-0 mt-0.5" />
            Results cannot be edited after submission. Verify figures against the official Form 35A before submitting.
          </div>

          <Button type="submit" loading={saving} icon={<Camera className="w-3.5 h-3.5" />}>
            Submit Official Results
          </Button>
        </form>
      )}
    </Modal>
  )
}
