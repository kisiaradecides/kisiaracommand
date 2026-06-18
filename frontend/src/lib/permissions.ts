import type { UserRole } from '../types/enums'

export const canAccessMap = (role: UserRole) =>
  ['aspirant'].includes(role)

export const canSubmitEvents = (role: UserRole) =>
  ['aspirant', 'team_lead', 'assistant', 'super_user'].includes(role)

export const canApproveEvents = (role: UserRole) =>
  ['aspirant', 'super_user'].includes(role)

export const canViewFullCalendar = (role: UserRole) =>
  ['aspirant', 'super_user'].includes(role)

export const canViewCalendar = (role: UserRole) =>
  ['aspirant', 'team_lead', 'assistant', 'super_user'].includes(role)

export const canCreateTasks = (role: UserRole) =>
  ['aspirant', 'super_user'].includes(role)

export const canViewRegionTasks = (role: UserRole) =>
  ['aspirant', 'team_lead', 'assistant', 'super_user'].includes(role)

export const canPostNews = (role: UserRole) =>
  ['aspirant', 'team_lead', 'assistant', 'opinion_leader', 'super_user'].includes(role)

export const canDeleteNews = (role: UserRole) =>
  ['aspirant', 'super_user'].includes(role)

export const canMessage = (role: UserRole) =>
  ['aspirant', 'team_lead', 'assistant', 'opinion_leader', 'super_user'].includes(role)

export const canViewAllMessages = (role: UserRole) =>
  ['aspirant', 'super_user'].includes(role)

export const canViewProfiles = (role: UserRole) =>
  ['aspirant', 'super_user'].includes(role)

export const canViewTargets = (role: UserRole) =>
  ['aspirant', 'super_user'].includes(role)

export const canViewGotvCommand = (role: UserRole) =>
  ['aspirant', 'super_user'].includes(role)

export const canSubmitGotvReports = (role: UserRole) =>
  ['aspirant', 'agent', 'super_user'].includes(role)

export const isAspirant = (role: UserRole) => role === 'aspirant'
export const isAgent = (role: UserRole) => role === 'agent'
export const isSuperUser = (role: UserRole) => role === 'super_user'
