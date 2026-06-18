import type { ReactNode } from 'react'
import { ROLE_LABELS, ROLE_BADGE_COLOUR, REGION_NAMES, REGION_COLOURS } from '../../lib/constants'
import type { UserRole } from '../../types/enums'

interface BadgeProps {
  children: ReactNode
  className?: string
  variant?: 'default' | 'outline'
}

export function Badge({ children, className = '', variant = 'outline' }: BadgeProps) {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border'
  const variantClass = variant === 'outline' ? 'bg-transparent' : ''
  return <span className={`${base} ${variantClass} ${className}`}>{children}</span>
}

export function RoleBadge({ role }: { role: UserRole | string }) {
  const colour = ROLE_BADGE_COLOUR[role] ?? 'bg-white/10 text-white border-white/20'
  return <Badge className={colour}>{ROLE_LABELS[role] ?? role}</Badge>
}

export function RegionBadge({ regionId }: { regionId: number }) {
  const colour = REGION_COLOURS[regionId] ?? '#555'
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: `${colour}22`, color: colour, border: `1px solid ${colour}55` }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: colour }}
      />
      R{regionId} — {REGION_NAMES[regionId]}
    </span>
  )
}
