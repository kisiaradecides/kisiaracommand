import type { ReactNode, HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  glass?: boolean
}

export function Card({ children, glass = false, className = '', ...props }: CardProps) {
  const base = glass
    ? 'bg-surface-card/60 backdrop-blur-sm border border-surface-border-light rounded-xl'
    : 'bg-surface-card border border-surface-border rounded-xl'
  return (
    <div className={`${base} ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`px-5 py-4 border-b border-surface-border flex items-center justify-between ${className}`}>
      {children}
    </div>
  )
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>
}
