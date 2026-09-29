import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { FormError } from '@/components/form/form-error'
import { TextField } from '@/components/form/text-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { boardKeys, boardsApi } from './api'

const schema = z.object({
  name: z.string().trim().min(1, 'Dê um nome ao quadro').max(60, 'Máximo de 60 caracteres'),
  /** Uma coluna por linha. */
  columns: z.string(),
})
type BoardForm = z.infer<typeof schema>

const DEFAULT_COLUMNS = 'Novos\nEm atendimento\nConcluídos'

export function CreateBoardDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const form = useForm<BoardForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', columns: DEFAULT_COLUMNS },
  })

  const create = useMutation({
    mutationFn: (values: BoardForm) => {
      const columns = values.columns
        .split('\n')
        .map((c) => c.trim())
        .filter(Boolean)
      return boardsApi.create({ name: values.name, columns: columns.length ? columns : undefined })
    },
    onSuccess: (board) => {
      void queryClient.invalidateQueries({ queryKey: boardKeys.list })
      close(false)
      void navigate(`/boards/${board.id}`)
    },
  })

  function close(next: boolean) {
    if (!next) {
      form.reset()
      create.reset()
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo quadro</DialogTitle>
          <DialogDescription>
            Ex.: “Funil de vendas”, “Pós-venda”. Colunas podem ser mudadas depois.
          </DialogDescription>
        </DialogHeader>
        <form id="board-form" onSubmit={form.handleSubmit((v) => create.mutate(v))} noValidate>
          <FieldGroup>
            <FormError error={create.error} />
            <TextField form={form} name="name" label="Nome" autoFocus />
            <Field>
              <FieldLabel htmlFor="board-columns">Colunas (uma por linha)</FieldLabel>
              <Textarea id="board-columns" rows={4} {...form.register('columns')} />
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="board-form" disabled={create.isPending}>
            {create.isPending ? 'Criando…' : 'Criar quadro'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
