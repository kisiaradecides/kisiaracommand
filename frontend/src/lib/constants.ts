export const REGION_COLOURS: Record<number, string> = {
  1: '#e94560',
  2: '#0f3460',
  3: '#533483',
  4: '#1a936f',
  5: '#c17e1a',
}

export const REGION_NAMES: Record<number, string> = {
  1: 'Northwest',
  2: 'Northeast',
  3: 'East',
  4: 'Southeast',
  5: 'Southwest',
}

export const ROLE_LABELS: Record<string, string> = {
  super_user: 'Super User',
  aspirant: 'Aspirant',
  team_lead: 'Team Lead',
  assistant: 'Assistant Team Lead',
  opinion_leader: 'Opinion Leader',
  agent: 'Agent',
}

export const ROLE_BADGE_COLOUR: Record<string, string> = {
  aspirant: 'bg-gold/20 text-gold border-gold/30',
  team_lead: 'bg-navy/40 text-blue-300 border-blue-500/30',
  assistant: 'bg-purple-brand/20 text-purple-300 border-purple-500/30',
  opinion_leader: 'bg-emerald-brand/20 text-emerald-300 border-emerald-500/30',
  agent: 'bg-crimson/20 text-red-300 border-red-500/30',
  super_user: 'bg-white/10 text-white border-white/20',
}

export const PRIORITY_COLOURS: Record<string, string> = {
  high: 'text-crimson bg-crimson/10 border-crimson/30',
  medium: 'text-gold bg-gold/10 border-gold/30',
  low: 'text-emerald-brand bg-emerald-brand/10 border-emerald-brand/30',
}

export const STATUS_COLOURS: Record<string, string> = {
  todo: 'text-slate-400 bg-slate-400/10 border-slate-400/30',
  in_progress: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  under_review: 'text-gold bg-gold/10 border-gold/30',
  completed: 'text-emerald-brand bg-emerald-brand/10 border-emerald-brand/30',
}

export const WARD_TOTAL_VOTERS = 12486
export const WARD_TOTAL_STATIONS = 28
export const WARD_TOTAL_CENTRES = 17
export const WARD_TOTAL_REGIONS = 5
