import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { useMobile } from '../../hooks/useMobile'

export function AppLayout() {
  const isMobile = useMobile()

  return (
    <div className="flex h-screen bg-surface-bg overflow-hidden">
      {/* Desktop sidebar */}
      {!isMobile && <Sidebar />}

      {/* Main content */}
      <main
        className={`flex-1 overflow-y-auto min-w-0 ${isMobile ? 'pb-16' : ''}`}
        id="main-content"
      >
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      {isMobile && <BottomNav />}
    </div>
  )
}
