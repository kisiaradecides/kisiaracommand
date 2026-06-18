import { useEffect, lazy, Suspense } from 'react'
import type { ReactElement } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAppDispatch, useAppSelector } from './hooks/useAppDispatch'
import { fetchCurrentUser } from './store/slices/authSlice'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './modules/auth/LoginPage'
import {
  canAccessMap, canViewCalendar, canViewProfiles,
  canViewTargets, isAgent
} from './lib/permissions'

// Lazy-load heavy modules — improves initial load time
const CampaignMap     = lazy(() => import('./modules/map/CampaignMap').then(m => ({ default: m.CampaignMap })))
const EventsCalendar  = lazy(() => import('./modules/events/EventsCalendar').then(m => ({ default: m.EventsCalendar })))
const MissionBoard    = lazy(() => import('./modules/missions/MissionBoard').then(m => ({ default: m.MissionBoard })))
const NewsFeed        = lazy(() => import('./modules/news/NewsFeed').then(m => ({ default: m.NewsFeed })))
const Messages        = lazy(() => import('./modules/messages/Messages').then(m => ({ default: m.Messages })))
const TeamProfiles    = lazy(() => import('./modules/profiles/TeamProfiles').then(m => ({ default: m.TeamProfiles })))
const TargetsDashboard = lazy(() => import('./modules/targets/Targets').then(m => ({ default: m.TargetsDashboard })))
const GotvDashboard   = lazy(() => import('./modules/gotv/GotvDashboard').then(m => ({ default: m.GotvDashboard })))

function ModuleLoader() {
  return (
    <div className="flex items-center justify-center h-full text-slate-500 text-sm">
      Loading...
    </div>
  )
}

function ProtectedRoute({ children, allowed }: { children: ReactElement; allowed: boolean }) {
  if (!allowed) return <Navigate to="/gotv" replace />
  return children
}

function AppRoutes() {
  const user = useAppSelector((s) => s.auth.user)

  if (!user) return <Navigate to="/login" replace />

  const defaultPath = isAgent(user.role) ? '/gotv' : '/map'

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to={defaultPath} replace />} />
        <Route path="map" element={
          <ProtectedRoute allowed={canAccessMap(user.role)}>
            <Suspense fallback={<ModuleLoader />}><CampaignMap /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="events" element={
          <ProtectedRoute allowed={canViewCalendar(user.role)}>
            <Suspense fallback={<ModuleLoader />}><EventsCalendar /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="missions" element={
          <ProtectedRoute allowed={!isAgent(user.role)}>
            <Suspense fallback={<ModuleLoader />}><MissionBoard /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="news" element={
          <Suspense fallback={<ModuleLoader />}><NewsFeed /></Suspense>
        } />
        <Route path="messages" element={
          <Suspense fallback={<ModuleLoader />}><Messages /></Suspense>
        } />
        <Route path="profiles" element={
          <ProtectedRoute allowed={canViewProfiles(user.role)}>
            <Suspense fallback={<ModuleLoader />}><TeamProfiles /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="targets" element={
          <ProtectedRoute allowed={canViewTargets(user.role)}>
            <Suspense fallback={<ModuleLoader />}><TargetsDashboard /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="gotv" element={
          <Suspense fallback={<ModuleLoader />}><GotvDashboard /></Suspense>
        } />
      </Route>
    </Routes>
  )
}

function AuthGate() {
  const dispatch = useAppDispatch()
  const { initialized, loading } = useAppSelector((s) => s.auth)

  useEffect(() => {
    dispatch(fetchCurrentUser())
  }, [dispatch])

  if (!initialized || loading) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl animate-pulse"
            style={{ background: 'linear-gradient(135deg, #e94560, #c17e1a)' }}
            aria-hidden="true"
          >
            🗳️
          </div>
          <p className="text-sm text-slate-500">Loading Kisiara Command...</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<AppRoutes />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1a2035',
            color: '#e2e8f0',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            fontSize: '13px',
          },
          success: { iconTheme: { primary: '#1a936f', secondary: '#fff' } },
          error: { iconTheme: { primary: '#e94560', secondary: '#fff' } },
        }}
      />
    </BrowserRouter>
  )
}
