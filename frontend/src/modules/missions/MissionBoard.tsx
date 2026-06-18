import { useEffect, useState } from 'react'
import { Kanban, Plus, Calendar, User, List, LayoutGrid, ChevronDown } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useAppSelector } from '../../hooks/useAppDispatch'
import { canCreateTasks, canViewRegionTasks } from '../../lib/permissions'
import { RegionBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input, Textarea } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { PRIORITY_COLOURS, STATUS_COLOURS, REGION_NAMES } from '../../lib/constants'
import { useMobile } from '../../hooks/useMobile'
import type { Task, AppUser } from '../../types/models'
import type { TaskStatus } from '../../types/enums'
import toast from 'react-hot-toast'

const COLUMNS: { key: TaskStatus; label: string; colour: string; accent: string }[] = [
  { key: 'todo',         label: 'To Do',         colour: 'border-t-slate-500',   accent: '#64748b' },
  { key: 'in_progress',  label: 'In Progress',    colour: 'border-t-blue-500',    accent: '#3b82f6' },
  { key: 'under_review', label: 'Under Review',   colour: 'border-t-yellow-500',  accent: '#c17e1a' },
  { key: 'completed',    label: 'Completed',      colour: 'border-t-emerald-500', accent: '#1a936f' },
]

const PRIORITY_ICON: Record<string, string> = { high: '🔴', medium: '🟡', low: '🟢' }

export function MissionBoard() {
  const user = useAppSelector((s) => s.auth.user)
  const isMobile = useMobile()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [users, setUsers] = useState<AppUser[]>([])
  const [mobileView, setMobileView] = useState<'list' | 'board'>('list')
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', due_date: '', assigned_to: '', region_id: '' })
  const [creating, setCreating] = useState(false)

  const fetchTasks = async () => {
    if (!user) return
    let query = supabase
      .from('tasks')
      .select('*, assignee:users!assigned_to(id, full_name, role), region:regions(id,name,color,code)')
      .order('created_at', { ascending: false })

    if (!canViewRegionTasks(user.role)) {
      query = query.eq('assigned_to', user.id)
    } else if (!canCreateTasks(user.role)) {
      query = query.or(`region_id.eq.${user.region_id},assigned_to.eq.${user.id}`)
    }

    const { data } = await query
    if (data) setTasks(data as Task[])
    setLoading(false)
  }

  useEffect(() => {
    fetchTasks()
    if (canCreateTasks(user?.role ?? 'agent')) {
      supabase.from('users').select('id, full_name, role, region_id')
        .eq('is_active', true).neq('role', 'agent').order('full_name')
        .then(({ data }) => { if (data) setUsers(data as AppUser[]) })
    }
  }, [user])

  const handleCreate = async () => {
    if (!user || !form.title) return
    setCreating(true)
    const { error } = await supabase.from('tasks').insert({
      title: form.title, description: form.description || null,
      priority: form.priority, due_date: form.due_date || null,
      assigned_to: form.assigned_to || null,
      region_id: form.region_id ? parseInt(form.region_id) : null,
      created_by: user.id, status: 'todo', progress: 0,
    })
    if (error) toast.error('Failed to create task.')
    else {
      toast.success('Task created.')
      setShowCreate(false)
      setForm({ title: '', description: '', priority: 'medium', due_date: '', assigned_to: '', region_id: '' })
      fetchTasks()
    }
    setCreating(false)
  }

  const updateStatus = async (taskId: string, status: TaskStatus) => {
    const { error } = await supabase.from('tasks').update({ status, progress: status === 'completed' ? 100 : undefined }).eq('id', taskId)
    if (error) toast.error('Update failed.')
    else fetchTasks()
  }

  if (!user) return null

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-surface-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-brand/15 border border-purple-brand/25 flex items-center justify-center">
            <Kanban className="w-4.5 h-4.5 text-purple-300" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-100 text-sm md:text-base">Mission Board</h1>
            <p className="text-xs text-slate-500">{tasks.length} tasks</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile view toggle */}
          {isMobile && (
            <div className="flex bg-surface-elevated border border-surface-border rounded-lg overflow-hidden">
              <button onClick={() => setMobileView('list')}
                className={`p-2 transition-colors ${mobileView === 'list' ? 'bg-gold/20 text-gold' : 'text-slate-500'}`}
                aria-label="List view">
                <List className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setMobileView('board')}
                className={`p-2 transition-colors ${mobileView === 'board' ? 'bg-gold/20 text-gold' : 'text-slate-500'}`}
                aria-label="Board view">
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {canCreateTasks(user.role) && (
            <Button size="sm" onClick={() => setShowCreate(true)} icon={<Plus className="w-3.5 h-3.5" />}>
              <span className="hidden sm:inline">New Task</span>
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">Loading board...</div>
      ) : tasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Kanban className="w-10 h-10 opacity-20" />
          <p className="text-sm">No tasks yet.</p>
          {canCreateTasks(user.role) && (
            <Button size="sm" onClick={() => setShowCreate(true)} icon={<Plus className="w-3.5 h-3.5" />}>Create first task</Button>
          )}
        </div>
      ) : isMobile && mobileView === 'list' ? (
        /* ── Mobile list view ── */
        <MobileListView tasks={tasks} columns={COLUMNS} onSelect={setSelectedTask} onStatusChange={updateStatus}
          canMove={canCreateTasks(user.role)} />
      ) : (
        /* ── Kanban board ── */
        <div className="flex-1 overflow-x-auto min-h-0 p-4 md:p-5">
          <div className="flex gap-4 h-full min-w-max">
            {COLUMNS.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col.key)
              return (
                <div key={col.key} className="w-72 flex flex-col flex-shrink-0">
                  <div className={`bg-surface-card border border-surface-border rounded-t-xl border-t-2 px-4 py-3 flex items-center justify-between ${col.colour}`}>
                    <span className="text-sm font-semibold text-slate-200">{col.label}</span>
                    <span className="text-xs bg-surface-elevated px-2 py-0.5 rounded-full text-slate-400 border border-surface-border">{colTasks.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto bg-surface-bg/50 border border-t-0 border-surface-border rounded-b-xl p-2 flex flex-col gap-2">
                    {colTasks.length === 0 && (
                      <div className="flex items-center justify-center h-16 text-xs text-slate-600">Empty</div>
                    )}
                    {colTasks.map((task) => (
                      <TaskCard key={task.id} task={task} onSelect={() => setSelectedTask(task)}
                        onStatusChange={updateStatus}
                        currentUserId={user.id}
                        canMove={canCreateTasks(user.role) || task.assigned_to === user.id}
                        columns={COLUMNS} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Task" size="md">
        <div className="flex flex-col gap-4">
          <Input label="Task Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="What needs to be done?" required />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="Optional details..." />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Priority</label>
              <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className="bg-surface-elevated border border-surface-border-light rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-gold/50">
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
            <Input label="Due Date" type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Assign To</label>
            <select value={form.assigned_to} onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
              className="bg-surface-elevated border border-surface-border-light rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-gold/50">
              <option value="">— Unassigned —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.role.replace('_', ' ')})</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Region</label>
            <select value={form.region_id} onChange={(e) => setForm((f) => ({ ...f, region_id: e.target.value }))}
              className="bg-surface-elevated border border-surface-border-light rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-gold/50">
              <option value="">— All Regions —</option>
              {[1,2,3,4,5].map((r) => <option key={r} value={r}>R{r} — {REGION_NAMES[r]}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={creating} disabled={!form.title}>Create Task</Button>
          </div>
        </div>
      </Modal>

      {/* Task Detail Modal */}
      <Modal open={!!selectedTask} onClose={() => setSelectedTask(null)} title="Task Details" size="md">
        {selectedTask && <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} onRefresh={fetchTasks} currentUser={user} />}
      </Modal>
    </div>
  )
}

// ── Mobile list view ──────────────────────────────────────────────────────────

function MobileListView({ tasks, columns, onSelect, onStatusChange, canMove }: {
  tasks: Task[]
  columns: typeof COLUMNS
  onSelect: (t: Task) => void
  onStatusChange: (id: string, s: TaskStatus) => void
  canMove: boolean
}) {
  const [expanded, setExpanded] = useState<TaskStatus | null>('todo')

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
      {columns.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.key)
        const isOpen = expanded === col.key
        return (
          <div key={col.key} className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : col.key)}
              className="w-full flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.accent }} />
                <span className="text-sm font-semibold text-slate-200">{col.label}</span>
                <span className="text-xs bg-surface-elevated px-2 py-0.5 rounded-full text-slate-400 border border-surface-border">
                  {colTasks.length}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="px-3 pb-3 flex flex-col gap-2">
                {colTasks.length === 0 ? (
                  <p className="text-xs text-slate-600 text-center py-3">No tasks</p>
                ) : (
                  colTasks.map((task) => (
                    <MobileTaskRow key={task.id} task={task} columns={columns}
                      onSelect={() => onSelect(task)} onStatusChange={onStatusChange} canMove={canMove} />
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function MobileTaskRow({ task, columns, onSelect, onStatusChange, canMove }: {
  task: Task; columns: typeof COLUMNS
  onSelect: () => void; onStatusChange: (id: string, s: TaskStatus) => void; canMove: boolean
}) {
  const assignee = task.assignee as { full_name: string } | undefined
  return (
    <div onClick={onSelect}
      className="bg-surface-elevated border border-surface-border rounded-xl p-3 active:bg-white/5 transition-colors"
      role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onSelect() }}>
      <div className="flex items-start gap-2 mb-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 mt-0.5 ${PRIORITY_COLOURS[task.priority]}`}>
          {PRIORITY_ICON[task.priority]}
        </span>
        <p className="text-sm font-medium text-slate-200 leading-snug flex-1">{task.title}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {task.region && <RegionBadge regionId={(task.region as { id: number }).id} />}
        {assignee && (
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <User className="w-2.5 h-2.5" />{assignee.full_name}
          </span>
        )}
        {task.due_date && (
          <span className="text-[10px] text-slate-600 flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5" />{format(parseISO(task.due_date), 'MMM d')}
          </span>
        )}
        <span className="text-[10px] text-slate-500 ml-auto">{task.progress}%</span>
      </div>
      {canMove && (
        <div className="mt-2 flex gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {columns.filter((c) => c.key !== task.status).map((c) => (
            <button key={c.key} onClick={() => onStatusChange(task.id, c.key)}
              className="text-[10px] px-2 py-0.5 bg-surface-card hover:bg-white/10 border border-surface-border rounded-full text-slate-400 transition-colors">
              → {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Kanban card ───────────────────────────────────────────────────────────────

function TaskCard({ task, onSelect, onStatusChange, canMove, columns }: {
  task: Task; onSelect: () => void; onStatusChange: (id: string, s: TaskStatus) => void
  currentUserId: string; canMove: boolean; columns: typeof COLUMNS
}) {
  const assignee = task.assignee as { full_name: string; role: string } | undefined
  return (
    <div onClick={onSelect}
      className="bg-surface-card border border-surface-border rounded-xl p-3 cursor-pointer hover:border-surface-border-light transition-all hover:-translate-y-0.5 animate-fade-in"
      role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onSelect() }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-slate-200 leading-snug">{task.title}</p>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${PRIORITY_COLOURS[task.priority]}`}>
          {PRIORITY_ICON[task.priority]} {task.priority}
        </span>
      </div>
      {task.region && <RegionBadge regionId={(task.region as { id: number }).id} />}
      <div className="mt-2 mb-2">
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>Progress</span><span>{task.progress}%</span>
        </div>
        <div className="h-1 bg-surface-elevated rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${task.progress}%`, background: task.progress === 100 ? '#1a936f' : '#c17e1a' }} />
        </div>
      </div>
      <div className="flex items-center justify-between mt-2">
        {assignee && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <User className="w-3 h-3" /><span className="truncate max-w-[100px]">{assignee.full_name}</span>
          </div>
        )}
        {task.due_date && (
          <div className="flex items-center gap-1 text-[10px] text-slate-600 ml-auto">
            <Calendar className="w-3 h-3" />{format(parseISO(task.due_date), 'MMM d')}
          </div>
        )}
      </div>
      {canMove && (
        <div className="mt-2 flex gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {columns.filter((c) => c.key !== task.status).map((c) => (
            <button key={c.key} onClick={() => onStatusChange(task.id, c.key)}
              className="text-[10px] px-2 py-0.5 bg-surface-elevated hover:bg-white/10 border border-surface-border rounded-full text-slate-400 transition-colors">
              → {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Task detail modal ─────────────────────────────────────────────────────────

function TaskDetail({ task, onRefresh, currentUser }: {
  task: Task; onClose: () => void; onRefresh: () => void; currentUser: AppUser
}) {
  const [comments, setComments] = useState<{ id: string; content: string; created_at: string; author: { full_name: string } }[]>([])
  const [newComment, setNewComment] = useState('')
  const [progress, setProgress] = useState(task.progress)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('task_comments').select('id, content, created_at, author:users!author_id(full_name)')
      .eq('task_id', task.id).order('created_at')
      .then(({ data }) => {
        if (data) setComments(data as { id: string; content: string; created_at: string; author: { full_name: string } }[])
      })
  }, [task.id])

  const saveProgress = async () => {
    setSaving(true)
    await supabase.from('tasks').update({ progress }).eq('id', task.id)
    onRefresh(); setSaving(false); toast.success('Progress updated.')
  }

  const addComment = async () => {
    if (!newComment.trim()) return
    await supabase.from('task_comments').insert({ task_id: task.id, author_id: currentUser.id, content: newComment.trim() })
    setNewComment('')
    const { data } = await supabase.from('task_comments')
      .select('id, content, created_at, author:users!author_id(full_name)')
      .eq('task_id', task.id).order('created_at')
    if (data) setComments(data as { id: string; content: string; created_at: string; author: { full_name: string } }[])
  }

  const assignee = task.assignee as { full_name: string; role: string } | undefined

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${PRIORITY_COLOURS[task.priority]}`}>
            {PRIORITY_ICON[task.priority]} {task.priority} priority
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOURS[task.status]}`}>
            {task.status.replace('_', ' ')}
          </span>
          {task.region && <RegionBadge regionId={(task.region as { id: number }).id} />}
        </div>
        {task.description && <p className="text-sm text-slate-400 leading-relaxed">{task.description}</p>}
        <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
          {assignee && <span className="flex items-center gap-1"><User className="w-3 h-3" />{assignee.full_name}</span>}
          {task.due_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Due {format(parseISO(task.due_date), 'PPP')}</span>}
        </div>
      </div>

      {(canCreateTasks(currentUser.role) || task.assigned_to === currentUser.id) && (
        <div className="bg-surface-elevated rounded-xl p-4 border border-surface-border">
          <p className="text-xs text-slate-400 mb-3">Progress: {progress}%</p>
          <input type="range" min={0} max={100} step={5} value={progress}
            onChange={(e) => setProgress(parseInt(e.target.value))}
            className="w-full accent-gold" aria-label="Task progress" />
          <Button size="sm" variant="outline" onClick={saveProgress} loading={saving} className="mt-3">Save Progress</Button>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Comments</p>
        <div className="flex flex-col gap-2 max-h-40 overflow-y-auto mb-3">
          {comments.length === 0 && <p className="text-xs text-slate-600">No comments yet.</p>}
          {comments.map((c) => (
            <div key={c.id} className="bg-surface-elevated rounded-lg px-3 py-2 border border-surface-border">
              <p className="text-xs font-medium text-slate-300">{(c.author as { full_name: string }).full_name}</p>
              <p className="text-sm text-slate-400 mt-0.5">{c.content}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newComment} onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 bg-surface-elevated border border-surface-border-light rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-gold/50"
            onKeyDown={(e) => { if (e.key === 'Enter') addComment() }} />
          <Button size="sm" variant="outline" onClick={addComment}>Post</Button>
        </div>
      </div>
    </div>
  )
}

// unused import kept for type safety
const _Card = Card
void _Card
