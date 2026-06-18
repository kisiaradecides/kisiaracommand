import { NavLink, useNavigate } from 'react-router-dom'
import {
  Map, Calendar, Kanban, Newspaper, MessageSquare,
  Users, Target, Vote, LogOut, ChevronRight
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch'
import { signOut } from '../../store/slices/authSlice'
import { RoleBadge, RegionBadge } from '../ui/Badge'
import {
  canAccessMap, canViewCalendar, canMessage, canPostNews,
  canViewProfiles, canViewTargets, isAgent
} from '../../lib/permissions'
import type { UserRole } from '../../types/enums'

const NAV_ITEMS = [
  { to: '/map', icon: Map, label: 'Campaign Map', permission: (r: UserRole) => canAccessMap(r) },
  { to: '/events', icon: Calendar, label: 'Events Calendar', permission: (r: UserRole) => canViewCalendar(r) },
  { to: '/missions', icon: Kanban, label: 'Mission Board', permission: (r: UserRole) => !isAgent(r) },
  { to: '/news', icon: Newspaper, label: 'News & Intelligence', permission: (r: UserRole) => canPostNews(r) },
  { to: '/messages', icon: MessageSquare, label: 'Private Messages', permission: (r: UserRole) => canMessage(r) },
  { to: '/profiles', icon: Users, label: 'Team Profiles', permission: (r: UserRole) => canViewProfiles(r) },
  { to: '/targets', icon: Target, label: 'Targets & KPIs', permission: (r: UserRole) => canViewTargets(r) },
  { to: '/gotv', icon: Vote, label: 'GOTV & Results', permission: (_r: UserRole) => true },
]

export function Sidebar() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const user = useAppSelector((s) => s.auth.user)

  const handleSignOut = async () => {
    await dispatch(signOut())
    navigate('/login')
  }

  if (!user) return null

  const visibleNav = NAV_ITEMS.filter((item) => item.permission(user.role))

  return (
    <aside className="w-64 bg-surface-panel border-r border-surface-border flex flex-col h-screen flex-shrink-0">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-surface-border">
        <div className="flex items-center gap-2.5 mb-1">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
            style={{ background: 'linear-gradient(135deg, #e94560, #c17e1a)' }}
            aria-hidden="true"
          >
            🗳️
          </div>
          <div>
            <p className="font-bold text-sm tracking-tight text-slate-100">Kisiara Command</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Campaign HQ</p>
          </div>
        </div>
      </div>

      {/* User profile */}
      <div className="px-4 py-3 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-surface-elevated border border-surface-border-light flex items-center justify-center text-sm font-bold text-gold flex-shrink-0">
            {user.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{user.full_name}</p>
            <RoleBadge role={user.role} />
          </div>
        </div>
        {user.region_id && (
          <div className="mt-2">
            <RegionBadge regionId={user.region_id} />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-0.5" aria-label="Main navigation">
        {visibleNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                isActive
                  ? 'bg-gold/15 text-gold border border-gold/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`
            }
          >
            <item.icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span className="flex-1">{item.label}</span>
            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" aria-hidden="true" />
          </NavLink>
        ))}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-3 border-t border-surface-border">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-crimson hover:bg-crimson/10 transition-all duration-150 border border-transparent hover:border-crimson/20"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
