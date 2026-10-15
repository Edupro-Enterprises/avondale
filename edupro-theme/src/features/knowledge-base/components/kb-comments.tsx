import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentUser } from '@/lib/frappe/auth'
import { useAddComment, useDeleteComment, useKbComments } from '@/lib/frappe/knowledge-base'

/** A real, shared comment thread backed by the Phase 2 API
 * (edupro_school_fees.knowledge_base.get_comments/add_comment/
 * delete_comment) -- every signed-in reader of this article sees the same
 * thread. Rendered below the 12-block article template rather than inside
 * it, so the template's fixed block contract stays untouched. */
export function KbComments({ slug }: { slug: string }) {
  const { user } = useCurrentUser()
  const { data: comments, isLoading } = useKbComments(slug)
  const addComment = useAddComment(slug)
  const deleteComment = useDeleteComment(slug)
  const [draft, setDraft] = useState('')

  function handleSubmit() {
    if (!draft.trim()) return
    addComment.mutate(draft.trim(), { onSuccess: () => setDraft('') })
  }

  return (
    <div className='mt-8 border-t pt-6 print:hidden'>
      <p className='mb-4 text-sm font-semibold'>
        Comments {comments && comments.length > 0 && <span className='text-muted-foreground'>({comments.length})</span>}
      </p>

      {isLoading && (
        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
          <Loader2 className='size-4 animate-spin' />
          Loading comments…
        </div>
      )}

      <div className='space-y-3'>
        {comments?.map((comment) => (
          <div key={comment.id} className='rounded-lg border p-3 text-sm'>
            <div className='flex items-center justify-between gap-2'>
              <span className='font-medium'>{comment.author_name}</span>
              {comment.author_id === user?.name && (
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-6'
                  onClick={() => deleteComment.mutate(comment.id)}
                >
                  <Trash2 className='size-3.5' />
                </Button>
              )}
            </div>
            <p className='mt-1 text-muted-foreground'>{comment.body}</p>
          </div>
        ))}
      </div>

      {user && (
        <div className='mt-4 space-y-2'>
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder='Add a comment…' rows={3} />
          <Button type='button' size='sm' onClick={handleSubmit} disabled={!draft.trim() || addComment.isPending}>
            Post comment
          </Button>
        </div>
      )}
    </div>
  )
}
