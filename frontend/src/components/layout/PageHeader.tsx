import type { ReactNode } from 'react'

interface PageHeaderProps {
  icon: ReactNode
  iconBg?: string
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ icon, iconBg = 'bg-gold/15 border-gold/25', title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="px-4 md:px-6 py-4 border-b border-surface-border flex items-center justify-between gap-3 flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-lg ${iconBg} border flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0">
          <h1 className="font-semibold text-slate-100 text-sm md:text-base leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
