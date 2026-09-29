import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useMe, usePermissions } from '@/features/auth/session-context'
import { useMemberNames } from '@/features/members/api'
import { errorMessage } from '@/lib/api/api-error'
import { contactKeys, contactsApi, useContactNotes } from './api'

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** Notas internas da equipe sobre o contato. Só o autor apaga a própria nota. */
export function ContactNotes({ contactId }: { contactId: string }) {
  const queryClient = useQueryClient()
  const notes = useContactNotes(contactId)
  const me = useMe()
  const { can } = usePermissions()
  const nameOf = useMemberNames()
  const [draft, setDraft] = useState('')
  const refresh = () => queryClient.invalidateQueries({ queryKey: contactKeys.notes(contactId) })

  const add = useMutation({
    mutationFn: () => contactsApi.addNote(contactId, draft),
    onSuccess: () => {
      setDraft('')
      void refresh()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const remove = useMutation({
    mutationFn: (noteId: string) => contactsApi.deleteNote(contactId, noteId),
    onSuccess: () => void refresh(),
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <section aria-labelledby="notes-title" className="flex flex-col gap-3">
      <h2 id="notes-title" className="font-semibold">
        Notas internas
      </h2>

      {can('contacts:edit') && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (draft.trim()) add.mutate()
          }}
        >
          <Textarea
            aria-label="Nova nota"
            placeholder="Anote algo sobre este contato (só a equipe vê)"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={5000}
            rows={3}
          />
          <Button
            type="submit"
            size="sm"
            className="self-end"
            disabled={!draft.trim() || add.isPending}
          >
            {add.isPending ? 'Salvando…' : 'Adicionar nota'}
          </Button>
        </form>
      )}

      {notes.isPending && <Skeleton className="h-16" />}
      {notes.data?.length === 0 && (
        <p className="text-muted-foreground text-sm">Nenhuma nota ainda.</p>
      )}
      <ul className="flex flex-col gap-2">
        {notes.data?.map((note) => {
          const mine = note.authorMembershipId === me.membershipId
          return (
            <li key={note.id} className="bg-muted/40 rounded-md border p-3 text-sm">
              <p className="break-words whitespace-pre-wrap">{note.body}</p>
              <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
                <span>
                  {mine ? 'Você' : (nameOf(note.authorMembershipId) ?? 'Ex-membro')} ·{' '}
                  {dateTime.format(new Date(note.createdAt))}
                </span>
                {mine && can('contacts:edit') && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label="Apagar nota"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(note.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
