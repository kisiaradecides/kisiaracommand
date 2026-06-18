import { useEffect, useState, useRef, useCallback } from 'react'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { Send, MessageSquare, Search, ArrowLeft, Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAppSelector } from '../../hooks/useAppDispatch'
import { canViewAllMessages } from '../../lib/permissions'
import { RoleBadge } from '../../components/ui/Badge'
import { useMobile } from '../../hooks/useMobile'
import type { Message, AppUser } from '../../types/models'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConvSummary {
  user: Pick<AppUser, 'id' | 'full_name' | 'role' | 'region_id'>
  lastMessage: string
  lastTime: string
  unread: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMsgTime(iso: string): string {
  const d = parseISO(iso)
  if (isToday(d)) return format(d, 'h:mm a')
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMM d')
}

function formatDivider(iso: string): string {
  const d = parseISO(iso)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEEE, MMMM d')
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-12 h-12 text-lg' : 'w-9 h-9 text-sm'
  return (
    <div className={`${sz} rounded-full bg-surface-elevated border border-surface-border-light flex items-center justify-center font-bold text-gold flex-shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Messages() {
  const user = useAppSelector((s) => s.auth.user)
  const isMobile = useMobile()
  const isAdmin = user ? canViewAllMessages(user.role) : false

  // Contacts available to message
  const [contacts, setContacts] = useState<Pick<AppUser, 'id' | 'full_name' | 'role' | 'region_id'>[]>([])
  const [convSummaries, setConvSummaries] = useState<ConvSummary[]>([])
  const [loadingContacts, setLoadingContacts] = useState(true)

  // Active thread
  const [selected, setSelected] = useState<Pick<AppUser, 'id' | 'full_name' | 'role' | 'region_id'> | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingThread, setLoadingThread] = useState(false)

  // Compose
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Load contacts ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return

    const loadContacts = async () => {
      setLoadingContacts(true)
      if (isAdmin) {
        // Aspirant / super_user sees everyone except other aspirants/super_users
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, role, region_id')
          .eq('is_active', true)
          .not('role', 'in', '(aspirant,super_user)')
          .order('full_name')
        if (error) toast.error('Could not load contacts.')
        else setContacts((data ?? []) as Pick<AppUser, 'id' | 'full_name' | 'role' | 'region_id'>[])
      } else {
        // Everyone else only messages the aspirant
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, role, region_id')
          .eq('role', 'aspirant')
          .eq('is_active', true)
          .limit(1)
        if (error) {
          console.error('Aspirant query error:', error)
          toast.error('Could not load contact. Check your connection.')
          setLoadingContacts(false)
          return
        }
        if (!data?.length) {
          toast.error('No aspirant account found. Contact your administrator.')
          setLoadingContacts(false)
          return
        }
        const aspirant = data[0] as Pick<AppUser, 'id' | 'full_name' | 'role' | 'region_id'>
        setContacts([aspirant])
        // Auto-open the aspirant thread immediately
        setSelected(aspirant)
      }
      setLoadingContacts(false)
    }

    loadContacts()
  }, [user, isAdmin])

  // ── Build conversation summaries (admin sidebar) ───────────────────────────

  useEffect(() => {
    if (!user || !isAdmin || contacts.length === 0) return

    const buildSummaries = async () => {
      const summaries: ConvSummary[] = []
      for (const contact of contacts) {
        const { data } = await supabase
          .from('messages')
          .select('content, created_at, sender_id, is_read')
          .or(
            `and(sender_id.eq.${user.id},receiver_id.eq.${contact.id}),` +
            `and(sender_id.eq.${contact.id},receiver_id.eq.${user.id})`
          )
          .order('created_at', { ascending: false })
          .limit(1)

        const last = data?.[0]
        const unread = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('sender_id', contact.id)
          .eq('receiver_id', user.id)
          .eq('is_read', false)

        summaries.push({
          user: contact,
          lastMessage: last?.content ?? '',
          lastTime: last?.created_at ?? '',
          unread: unread.count ?? 0,
        })
      }
      // Sort by last message time desc
      summaries.sort((a, b) => {
        if (!a.lastTime) return 1
        if (!b.lastTime) return -1
        return new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime()
      })
      setConvSummaries(summaries)
    }

    buildSummaries()
  }, [user, isAdmin, contacts])

  // ── Load thread messages ───────────────────────────────────────────────────

  const loadThread = useCallback(async () => {
    if (!user || !selected) return
    setLoadingThread(true)
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:users!sender_id(id, full_name, role)')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${selected.id}),` +
        `and(sender_id.eq.${selected.id},receiver_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true })
    if (!error && data) setMessages(data as Message[])

    // Mark incoming as read
    await supabase
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('sender_id', selected.id)
      .eq('receiver_id', user.id)
      .eq('is_read', false)

    setLoadingThread(false)
  }, [user, selected])

  useEffect(() => {
    if (!selected) { setMessages([]); return }
    loadThread()

    const channel = supabase
      .channel(`thread-${user?.id}-${selected.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new as Message
        const relevant =
          (msg.sender_id === user?.id && msg.receiver_id === selected.id) ||
          (msg.sender_id === selected.id && msg.receiver_id === user?.id)
        if (relevant) loadThread()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selected, loadThread, user?.id])

  // ── Auto-scroll ────────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send ───────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    const text = content.trim()
    if (!text || !user || !selected || sending) return
    setSending(true)
    setContent('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: selected.id,
      content: text,
    })
    if (error) {
      toast.error('Failed to send message.')
      setContent(text) // restore on error
    }
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    // Auto-resize
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  // ── Message grouping ───────────────────────────────────────────────────────

  type MsgGroup = { date: string; messages: Message[] }
  const grouped: MsgGroup[] = []
  messages.forEach((msg) => {
    const day = msg.created_at.slice(0, 10)
    const last = grouped[grouped.length - 1]
    if (!last || last.date !== day) grouped.push({ date: day, messages: [msg] })
    else last.messages.push(msg)
  })

  if (!user) return null

  // ── Layout logic ───────────────────────────────────────────────────────────

  const showSidebar = isAdmin && (!isMobile || !selected)
  const showThread = !isMobile || !!selected

  const displayList = isAdmin
    ? (convSummaries.length > 0 ? convSummaries : contacts.map((c) => ({ user: c, lastMessage: '', lastTime: '', unread: 0 })))
    : []

  const filteredList = displayList.filter((s) =>
    s.user.full_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="h-full flex flex-col">
      {/* ── Page header (only when sidebar is visible and no thread open on mobile) ── */}
      {(!isMobile || !selected) && (
        <div className="px-4 md:px-6 py-4 border-b border-surface-border flex items-center gap-3 flex-shrink-0">
          <div className="w-9 h-9 rounded-lg bg-purple-brand/15 border border-purple-brand/25 flex items-center justify-center">
            <MessageSquare className="w-4.5 h-4.5 text-purple-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-slate-100 text-sm md:text-base">Private Messages</h1>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              End-to-end between you and the aspirant only
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Sidebar: conversation list (admin only) ── */}
        {showSidebar && (
          <div className={`${isMobile ? 'w-full' : 'w-72 border-r border-surface-border'} flex flex-col flex-shrink-0`}>
            {/* Search */}
            <div className="p-3 border-b border-surface-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search contacts..."
                  className="w-full bg-surface-elevated border border-surface-border-light rounded-xl pl-8 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-gold/40"
                  aria-label="Search conversations"
                />
              </div>
            </div>

            {/* Contact rows */}
            <div className="flex-1 overflow-y-auto">
              {loadingContacts ? (
                <div className="flex items-center justify-center py-12 text-slate-500 text-sm">Loading...</div>
              ) : filteredList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-600">
                  <MessageSquare className="w-8 h-8 opacity-20" />
                  <p className="text-sm">No contacts found.</p>
                </div>
              ) : (
                filteredList.map((s) => {
                  const isActive = selected?.id === s.user.id
                  return (
                    <button
                      key={s.user.id}
                      onClick={() => setSelected(s.user)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors border-b border-surface-border touch-manipulation
                        ${isActive && !isMobile
                          ? 'bg-gold/10 border-l-2 border-l-gold'
                          : 'hover:bg-white/5 active:bg-white/10'
                        }`}
                    >
                      <Avatar name={s.user.full_name} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-sm font-medium text-slate-200 truncate">{s.user.full_name}</p>
                          {s.lastTime && (
                            <span className="text-[10px] text-slate-600 flex-shrink-0">{formatMsgTime(s.lastTime)}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          {s.lastMessage ? (
                            <p className="text-xs text-slate-500 truncate flex-1">{s.lastMessage}</p>
                          ) : (
                            <RoleBadge role={s.user.role} />
                          )}
                          {s.unread > 0 && (
                            <span className="w-5 h-5 rounded-full bg-gold flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                              {s.unread > 9 ? '9+' : s.unread}
                            </span>
                          )}
                        </div>
                      </div>
                      {isMobile && (
                        <ArrowLeft className="w-4 h-4 text-slate-600 rotate-180 flex-shrink-0" />
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ── Thread pane ── */}
        {showThread && (
          selected ? (
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              {/* Thread header */}
              <div className="px-4 py-3 border-b border-surface-border flex items-center gap-3 flex-shrink-0 bg-surface-panel">
                {isMobile && isAdmin && (
                  <button
                    onClick={() => setSelected(null)}
                    className="p-2 -ml-1 rounded-xl hover:bg-white/10 text-slate-400 touch-manipulation"
                    aria-label="Back"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <Avatar name={selected.full_name} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-100 truncate">{selected.full_name}</p>
                  <div className="flex items-center gap-1.5">
                    <RoleBadge role={selected.role} />
                    {!isAdmin && (
                      <span className="text-[10px] text-slate-600 flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> Private
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
                {loadingThread ? (
                  <div className="flex items-center justify-center h-full text-slate-500 text-sm">Loading...</div>
                ) : grouped.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
                    <div className="w-14 h-14 rounded-full bg-surface-elevated border border-surface-border flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 opacity-30" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-400">No messages yet</p>
                      <p className="text-xs text-slate-600 mt-1">Start the conversation below</p>
                    </div>
                  </div>
                ) : (
                  grouped.map((group) => (
                    <div key={group.date}>
                      {/* Date divider */}
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-surface-border" />
                        <span className="text-[10px] text-slate-600 font-medium uppercase tracking-wider px-2">
                          {formatDivider(group.date + 'T00:00:00')}
                        </span>
                        <div className="flex-1 h-px bg-surface-border" />
                      </div>

                      {group.messages.map((msg, idx) => {
                        const isMine = msg.sender_id === user.id
                        const prev = group.messages[idx - 1]
                        const isSameAuthor = prev?.sender_id === msg.sender_id
                        const showAvatar = !isMine && !isSameAuthor
                        const sender = msg.sender as { id: string; full_name: string } | undefined

                        return (
                          <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${isSameAuthor ? 'mt-0.5' : 'mt-3'}`}>
                            {/* Spacer so bubbles align when avatar is hidden */}
                            {!isMine && !showAvatar && <div className="w-9 flex-shrink-0 mr-2" />}

                            {!isMine && showAvatar && (
                              <div className="mr-2 mt-auto flex-shrink-0">
                                <Avatar name={sender?.full_name ?? selected.full_name} size="sm" />
                              </div>
                            )}

                            <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[75%] md:max-w-[60%]`}>
                              {!isMine && !isSameAuthor && (
                                <p className="text-[10px] text-slate-500 mb-1 ml-1">
                                  {sender?.full_name ?? selected.full_name}
                                </p>
                              )}
                              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                                isMine
                                  ? 'bg-gold/25 text-slate-100 rounded-br-sm border border-gold/30'
                                  : 'bg-surface-elevated text-slate-200 rounded-bl-sm border border-surface-border-light'
                              }`}>
                                {msg.content}
                              </div>
                              <p className="text-[10px] text-slate-600 mt-1 mx-1">
                                {format(parseISO(msg.created_at), 'h:mm a')}
                                {isMine && (
                                  <span className="ml-1.5">{msg.is_read ? '✓✓' : '✓'}</span>
                                )}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Compose bar */}
              <div className="px-4 py-3 border-t border-surface-border flex gap-2.5 items-end flex-shrink-0 bg-surface-panel">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                  rows={1}
                  className="flex-1 bg-surface-elevated border border-surface-border-light rounded-2xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-gold/50 resize-none leading-relaxed"
                  style={{ minHeight: '44px', maxHeight: '120px' }}
                  aria-label="Message input"
                />
                <button
                  onClick={handleSend}
                  disabled={!content.trim() || sending}
                  className="w-11 h-11 rounded-full bg-gold flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-all touch-manipulation active:scale-95"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          ) : (
            /* Desktop empty state — no conversation selected */
            !isMobile && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-600 bg-surface-bg/30">
                <div className="w-16 h-16 rounded-2xl bg-surface-elevated border border-surface-border flex items-center justify-center">
                  <MessageSquare className="w-7 h-7 opacity-30" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-400">Select a conversation</p>
                  <p className="text-xs text-slate-600 mt-1">Choose a contact from the left to start messaging</p>
                </div>
              </div>
            )
          )
        )}
      </div>
    </div>
  )
}
