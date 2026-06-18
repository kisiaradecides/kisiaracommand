import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, CheckCircle } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../hooks/useAppDispatch'
import { signIn, clearError } from '../../store/slices/authSlice'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

// Parse hash params from the invite URL
function parseHashParams(): Record<string, string> {
  const hash = window.location.hash.slice(1)
  const params = new URLSearchParams(hash)
  const result: Record<string, string> = {}
  params.forEach((v, k) => { result[k] = v })
  return result
}

export function LoginPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { loading, error } = useAppSelector((s) => s.auth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Invite / password-set mode
  const [inviteMode, setInviteMode] = useState(false)
  const [expiredLink, setExpiredLink] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [settingPassword, setSettingPassword] = useState(false)
  const [pwError, setPwError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const params = parseHashParams()

    // Expired / invalid invite link
    if (params.error === 'access_denied') {
      setExpiredLink(true)
      window.history.replaceState(null, '', window.location.pathname)
      return
    }

    // Valid invite or password-reset link
    if (params.type === 'invite' || params.type === 'recovery') {
      setInviteMode(true)
      supabase.auth.getSession().then(async ({ data }) => {
        if (!data.session && params.access_token && params.refresh_token) {
          await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          })
        }
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email) setInviteEmail(user.email)
      })
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  const handleSetPassword = async (e: FormEvent) => {
    e.preventDefault()
    setPwError('')
    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.')
      return
    }
    setSettingPassword(true)
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
    if (updateErr) {
      setPwError(updateErr.message)
      setSettingPassword(false)
      return
    }
    setDone(true)
    setSettingPassword(false)
    // Sign in properly and redirect
    setTimeout(async () => {
      const result = await dispatch(signIn({ email: inviteEmail, password: newPassword }))
      if (signIn.fulfilled.match(result)) {
        const role = result.payload.role
        navigate(role === 'agent' ? '/gotv' : '/map')
      }
    }, 1500)
  }

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault()
    dispatch(clearError())
    const result = await dispatch(signIn({ email: email.trim(), password }))
    if (signIn.fulfilled.match(result)) {
      const role = result.payload.role
      navigate(role === 'agent' ? '/gotv' : '/map')
    }
  }

  return (
    <div className="min-h-screen bg-surface-bg flex items-center justify-center p-4">
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -20%, #0f3460 0%, transparent 60%)' }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-xl"
            style={{ background: 'linear-gradient(135deg, #e94560 0%, #c17e1a 100%)' }}
            aria-hidden="true"
          >
            🗳️
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Kisiara Command</h1>
          <p className="text-sm text-slate-500 mt-1 uppercase tracking-widest">Kisiara Ward · Campaign HQ</p>
        </div>

        <div className="bg-surface-panel border border-surface-border rounded-2xl p-6 shadow-2xl">

          {/* ── Expired / invalid link ── */}
          {expiredLink ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <div className="w-12 h-12 rounded-full bg-crimson/15 border border-crimson/30 flex items-center justify-center">
                <Lock className="w-5 h-5 text-crimson" />
              </div>
              <div>
                <p className="font-semibold text-slate-100">Invite link expired</p>
                <p className="text-sm text-slate-400 mt-1">
                  This link is no longer valid. Ask your administrator to send a new invite.
                </p>
              </div>
              <button
                onClick={() => setExpiredLink(false)}
                className="text-xs text-gold hover:text-gold/80 transition-colors mt-1"
              >
                Back to sign in
              </button>
            </div>

          ) : inviteMode ? (
            done ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle className="w-12 h-12 text-emerald-400" />
                <p className="font-semibold text-slate-100">Password set!</p>
                <p className="text-sm text-slate-400 text-center">Signing you in...</p>
              </div>
            ) : (
              <>
                <div className="mb-5">
                  <h2 className="text-base font-semibold text-slate-200">Welcome to Kisiara Command</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    You've been invited. Set a password to activate your account.
                  </p>
                  {inviteEmail && (
                    <p className="text-xs text-gold mt-2 font-medium">{inviteEmail}</p>
                  )}
                </div>

                <form onSubmit={handleSetPassword} className="flex flex-col gap-4" noValidate>
                  <PasswordField
                    label="New Password"
                    value={newPassword}
                    onChange={setNewPassword}
                    show={showNew}
                    onToggle={() => setShowNew((v) => !v)}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                  />
                  <PasswordField
                    label="Confirm Password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    show={showConfirm}
                    onToggle={() => setShowConfirm((v) => !v)}
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                  />

                  {pwError && (
                    <div className="rounded-lg bg-crimson/10 border border-crimson/30 px-4 py-3 text-sm text-crimson" role="alert">
                      {pwError}
                    </div>
                  )}

                  <Button type="submit" variant="primary" size="lg" loading={settingPassword} className="mt-1 w-full">
                    {settingPassword ? 'Saving...' : 'Set Password & Sign In'}
                  </Button>
                </form>
              </>
            )
          ) : (

            /* ── Normal sign-in mode ── */
            <>
              <h2 className="text-base font-semibold text-slate-200 mb-5">Sign in to your account</h2>

              <form onSubmit={handleSignIn} className="flex flex-col gap-4" noValidate>
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<Mail className="w-4 h-4" />}
                  autoComplete="email"
                  required
                  disabled={loading}
                />

                <PasswordField
                  label="Passcode"
                  value={password}
                  onChange={setPassword}
                  show={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                />

                {error && (
                  <div className="rounded-lg bg-crimson/10 border border-crimson/30 px-4 py-3 text-sm text-crimson" role="alert">
                    {error}
                  </div>
                )}

                <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-1 w-full">
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-5">
          Access is restricted to authorised campaign operatives only.
        </p>
      </div>
    </div>
  )
}

// ─── Reusable password input ──────────────────────────────────────────────────
function PasswordField({ label, value, onChange, show, onToggle, placeholder, autoComplete, disabled }: {
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggle: () => void
  placeholder?: string
  autoComplete?: string
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
          <Lock className="w-4 h-4" />
        </span>
        <input
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          disabled={disabled}
          className="w-full bg-surface-elevated border border-surface-border-light rounded-lg pl-9 pr-10 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-gold/50 focus:border-gold/50 transition-colors disabled:opacity-50"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
