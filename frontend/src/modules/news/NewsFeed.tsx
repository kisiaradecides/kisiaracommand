import { useEffect, useState, type FormEvent } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Send, Trash2, Newspaper, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAppSelector } from '../../hooks/useAppDispatch'
import { canDeleteNews, canPostNews } from '../../lib/permissions'
import { RoleBadge, RegionBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/layout/PageHeader'
import type { NewsPost } from '../../types/models'
import toast from 'react-hot-toast'

export function NewsFeed() {
  const user = useAppSelector((s) => s.auth.user)
  const [posts, setPosts] = useState<NewsPost[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('news_posts')
      .select('*, author:users!author_id(id, full_name, role, region_id)')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(100)
    if (data) setPosts(data as NewsPost[])
    setLoading(false)
  }

  useEffect(() => {
    fetchPosts()
    const channel = supabase
      .channel('news-feed-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'news_posts' }, () => fetchPosts())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'news_posts' }, () => fetchPosts())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!content.trim() || !user) return
    setSubmitting(true)
    const { error } = await supabase.from('news_posts').insert({
      author_id: user.id, author_role: user.role,
      region_id: user.region_id, content: content.trim(),
    })
    if (error) toast.error('Failed to post update.')
    else { setContent(''); toast.success('Update posted.'); fetchPosts() }
    setSubmitting(false)
  }

  const handleDelete = async (postId: string) => {
    if (!user || !canDeleteNews(user.role)) return
    const { error } = await supabase.from('news_posts')
      .update({ is_deleted: true, deleted_by: user.id }).eq('id', postId)
    if (error) toast.error('Failed to delete post.')
    else { toast.success('Post removed.'); setPosts((p) => p.filter((x) => x.id !== postId)) }
  }

  if (!user) return null

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        icon={<Newspaper className="w-4.5 h-4.5 text-gold" />}
        title="News & Intelligence"
        subtitle={`${posts.length} updates`}
      />

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 flex flex-col gap-3">
        {/* Compose */}
        {canPostNews(user.role) && (
          <Card className="p-4">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full bg-surface-elevated border border-surface-border-light flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
                  {user.full_name.charAt(0)}
                </div>
                <span className="text-xs text-slate-400">Post a ground update or intelligence report</span>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's happening on the ground?"
                rows={3}
                className="w-full bg-surface-elevated border border-surface-border-light rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-gold/50 resize-none"
                maxLength={2000}
                aria-label="News post content"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">{content.length}/2000</span>
                <Button type="submit" size="sm" loading={submitting} disabled={!content.trim()} icon={<Send className="w-3.5 h-3.5" />}>
                  Post
                </Button>
              </div>
            </form>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-500 text-sm">Loading feed...</div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
            <AlertCircle className="w-8 h-8 opacity-40" />
            <p className="text-sm">No updates yet.</p>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard key={post.id} post={post} canDelete={canDeleteNews(user.role)} onDelete={handleDelete} currentUserId={user.id} />
          ))
        )}
      </div>
    </div>
  )
}

function PostCard({ post, canDelete, onDelete, currentUserId }: {
  post: NewsPost; canDelete: boolean; onDelete: (id: string) => void; currentUserId: string
}) {
  const author = post.author as { id: string; full_name: string; role: string; region_id: number } | undefined
  const isOwn = author?.id === currentUserId

  return (
    <Card className={`p-4 animate-fade-in ${isOwn ? 'border-gold/20' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-surface-elevated border border-surface-border-light flex items-center justify-center text-xs font-bold text-gold flex-shrink-0 mt-0.5">
            {author?.full_name?.charAt(0) ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <span className="text-sm font-medium text-slate-200">{author?.full_name ?? 'Unknown'}</span>
              {author?.role && <RoleBadge role={author.role as never} />}
              {author?.region_id && <RegionBadge regionId={author.region_id} />}
            </div>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words">{post.content}</p>
            <p className="text-xs text-slate-600 mt-2">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        {canDelete && (
          <button
            onClick={() => onDelete(post.id)}
            className="p-2 rounded-lg hover:bg-crimson/10 text-slate-600 hover:text-crimson transition-colors flex-shrink-0 touch-manipulation"
            aria-label={`Delete post by ${author?.full_name}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </Card>
  )
}
