import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Map, Calendar, Kanban, Newspaper, MessageSquare,
  Users, Target, Vote, LogOut, X, Menu, ChevronRight
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch'
import { signOut } from '../../store/slices/authSlice'
import { RoleBadge, RegionBadge } from '../ui/Badge'
import {
  canAccessMap, canViewCalendar, canMessage, canPostNews,
  canViewProfiles, canViewTargets, isAgent
} from '../../lib/permissions'
import type { UserRole } from '../../types/enums'

const ALL_NAV = [
  { to: '/map',      icon: Map,         label: 'Map',      permission: (r: UserRole) => canAccessMap(r) },
  { to: '/events',   icon: Calendar,    label: 'Events',   permission: (r: UserRole) => canViewCalendar(r) },
  { to: '/missions', icon: Kanban,      label: 'Missions', permission: (r: UserRole) => !isAgent(r) },
  { to: '/news',     icon: Newspaper,   label: 'News',     permission: (r: UserRole) => canPostNews(r) },
  { to: '/messages', icon: MessageSquare, label: 'Messages', permission: (r: UserRole) => canMessage(r) },
  { to: '/profiles', icon: Users,       label: 'Team',     permission: (r: UserRole) => canViewProfiles(r) },
  { to: '/targets',  icon: Target,      label: 'Targets',  permission: (r: UserRole) => canViewTargets(r) },
  { to: '/gotv',     icon: Vote,        label: 'GOTV',     permission: (_r: UserRole) => true },
]

export function BottomNav() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const user = useAppSelector((s) => s.auth.user)
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (!user) return null

  const visible = ALL_NAV.filter((n) => n.permission(user.role))
  // Show first 4 in bottom bar, rest in drawer
  const bottomItems = visible.slice(0, 4)

  const handleSignOut = async () => {
    await dispatch(signOut())
    navigate('/login')
  }

  return (
    <>
      {/* Bottom navigation bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-surface-panel border-t border-surface-border safe-area-bottom"
        aria-label="Mobile navigation"
      >
        <div className="flex items-stretch h-16">
          {bottomItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors min-w-0 ${
                  isActive ? 'text-gold' : 'text-slate-500'
                }`
              }
              onClick={() => setDrawerOpen(false)}
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-gold' : 'text-slate-500'}`} aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 w-8 h-0.5 rounded-full bg-gold" />
                  )}
                </>
              )}
            </NavLink>
          ))}

          {/* More button */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-slate-500 active:text-gold transition-colors"
            aria-label="More navigation options"
            aria-expanded={drawerOpen}
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* Slide-up drawer for remaining nav items */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface-panel rounded-t-2xl border-t border-surface-border-light shadow-2xl animate-slide-up"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-surface-border-light" />
            </div>

            {/* User info */}
            <div className="px-5 py-3 border-b border-surface-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-surface-elevated border border-surface-border-light flex items-center justify-center text-base font-bold text-gold flex-shrink-0">
                {user.full_name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-slate-100 truncate">{user.full_name}</p>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <RoleBadge role={user.role} />
                  {user.region_id && <RegionBadge regionId={user.region_id} />}
                </div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="ml-auto p-2 rounded-xl hover:bg-white/10 text-slate-400"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* All nav items */}
            <div className="px-4 py-3 flex flex-col gap-1 max-h-80 overflow-y-auto">
              {visible.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                      isActive
                        ? 'bg-gold/15 text-gold border-gold/25'
                        : 'text-slate-300 hover:bg-white/5 border-transparent'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight className="w-4 h-4 opacity-30" aria-hidden="true" />
                </NavLink>
              ))}
            </div>

            {/* Sign out */}
            <div className="px-4 pb-6 pt-2 border-t border-surface-border mt-1">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-crimson hover:bg-crimson/10 transition-all border border-transparent"
              >
                <LogOut className="w-5 h-5" aria-hidden="true" />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
