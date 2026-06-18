import type {
  UserRole, EventStatus, TaskStatus, TaskPriority,
  ReportType, StationStatus, IncidentStatus, MissionStatus
} from './enums'

export interface Region {
  id: number
  name: string
  code: string
  color: string
  area_km2: number | null
  total_voters: number
}

export interface PollingCentre {
  id: number
  region_id: number
  name: string
  location: { type: string; coordinates: [number, number] } | null
  registered_voters: number
  polling_stations: number
  region?: Region
}

export interface AppUser {
  id: string
  auth_id: string
  email: string
  role: UserRole
  region_id: number | null
  full_name: string
  alt_email: string | null
  phone: string | null
  gender: 'M' | 'F' | null
  photo_url: string | null
  networks: string[] | null
  estimated_influence: number
  loyalty_rating: number | null
  private_notes: string | null
  home_location: { type: string; coordinates: [number, number] } | null
  polling_station_id: number | null
  date_onboarded: string
  is_active: boolean
  created_at: string
  region?: Region
}

export interface CampaignEvent {
  id: string
  title: string
  description: string | null
  event_date: string
  location_text: string | null
  region_id: number
  created_by: string
  created_role: string
  status: EventStatus
  created_at: string
  region?: Region
  creator?: Pick<AppUser, 'id' | 'full_name' | 'role'>
}

export interface NewsPost {
  id: string
  author_id: string
  author_role: string
  region_id: number | null
  content: string
  is_deleted: boolean
  created_at: string
  author?: Pick<AppUser, 'id' | 'full_name' | 'role' | 'region_id'>
}

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  is_read: boolean
  read_at: string | null
  created_at: string
  sender?: Pick<AppUser, 'id' | 'full_name' | 'role'>
  receiver?: Pick<AppUser, 'id' | 'full_name' | 'role'>
}

export interface Mission {
  id: string
  title: string
  description: string | null
  deadline: string | null
  status: MissionStatus
  created_by: string
  created_at: string
  completed_at: string | null
}

export interface Task {
  id: string
  mission_id: string | null
  title: string
  description: string | null
  region_id: number | null
  assigned_to: string | null
  priority: TaskPriority
  status: TaskStatus
  due_date: string | null
  progress: number
  target_metric: number | null
  current_metric: number
  created_by: string
  created_at: string
  updated_at: string
  mission?: Pick<Mission, 'id' | 'title'>
  assignee?: Pick<AppUser, 'id' | 'full_name' | 'role'>
  region?: Region
}

export interface TaskComment {
  id: string
  task_id: string
  author_id: string
  content: string
  created_at: string
  author?: Pick<AppUser, 'id' | 'full_name' | 'role'>
}

export interface Target {
  id: string
  title: string
  description: string | null
  region_id: number | null
  target_value: number
  current_value: number
  unit: string
  deadline: string | null
  created_by: string
  created_at: string
  updated_at: string
  region?: Region
}

export interface GotvReport {
  id: string
  agent_id: string
  polling_centre_id: number
  report_type: ReportType
  station_status: StationStatus | null
  turnout_count: number | null
  incident_type: string | null
  incident_description: string | null
  incident_status: IncidentStatus
  created_at: string
  agent?: Pick<AppUser, 'id' | 'full_name'>
  polling_centre?: Pick<PollingCentre, 'id' | 'name' | 'region_id'>
}

export interface GotvResult {
  id: string
  agent_id: string
  polling_centre_id: number
  form_photo_url: string | null
  registered_voters: number
  total_votes_cast: number
  rejected_votes: number
  candidate_results: Record<string, number>
  is_verified: boolean
  verified_by: string | null
  created_at: string
  updated_at: string
  polling_centre?: Pick<PollingCentre, 'id' | 'name' | 'region_id' | 'polling_stations'>
}
