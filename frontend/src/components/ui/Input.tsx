import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: ReactNode
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

const inputBase = `
  w-full bg-surface-elevated border border-surface-border-light rounded-lg
  px-3 py-2 text-sm text-slate-200 placeholder-slate-500
  focus:outline-none focus:ring-1 focus:ring-gold/50 focus:border-gold/50
  transition-colors disabled:opacity-50 disabled:cursor-not-allowed
`

export function Input({ label, error, icon, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</label>}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          className={`${inputBase} ${icon ? 'pl-9' : ''} ${error ? 'border-crimson/50 focus:ring-crimson/50' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-crimson">{error}</p>}
    </div>
  )
}

export function Textarea({ label, error, className = '', ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</label>}
      <textarea
        className={`${inputBase} resize-none ${error ? 'border-crimson/50 focus:ring-crimson/50' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-crimson">{error}</p>}
    </div>
  )
}

export function Select({
  label, error, className = '', children, ...props
}: TextareaProps & { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</label>}
      <select
        className={`${inputBase} ${error ? 'border-crimson/50' : ''} ${className}`}
        {...(props as unknown as React.SelectHTMLAttributes<HTMLSelectElement>)}
      >
        {children}
      </select>
      {error && <p className="text-xs text-crimson">{error}</p>}
    </div>
  )
}
