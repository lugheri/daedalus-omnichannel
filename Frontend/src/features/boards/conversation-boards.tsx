import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { FormError } from '@/components/form/form-error'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { boardKeys, boardsApi, useBoards, usePlacements } from './api'

/** "Vendas › Proposta" — em que quadros a conversa está (links para o quadro). */
export function PlacementLinks({ conversationId }: { conversationId: string }) {
  const placements = usePlacements(conversationId)
  if (!placements.data?.length) return null
  return (
    <p
      className="text-muted-foreground truncate text-xs"
      title={placements.data.map((p) => `${p.board.name} › ${p.column.name}`).join(' · ')}
    >
      {placements.data.map((p, index) => (
        <span key={p.cardId}>
          {index > 0 && ' · '}
          <Link to={`/boards/${p.board.id}`} className="hover:underline">
            {p.board.name} › {p.column.name}
          </Link>
        </span>
      ))}
    </p>
  )
}

/** Coloca a conversa num quadro (na coluna escolhida; padrão: a primeira). */
export function AddToBoardDialog({
  conversationId,
  open,
  onOpenChange,
}: {
  conversationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const boards = useBoards()
  const placements = usePlacements(conversationId)
  const [boardId, setBoardId] = useState('')
  const [columnId, setColumnId] = useState('')

  const onBoards = new Set(placements.data?.map((p) => p.board.id))
  const available = boards.data?.filter((b) => !onBoards.has(b.id)) ?? []
  const board = available.find((b) => b.id === boardId)

  const add = useMutation({
    mutationFn: () => boardsApi.addCard(boardId, conversationId, columnId || undefined),
    onSuccess: () => {
      toast.success(`Adicionada ao quadro ${board?.name ?? ''}.`)
      void queryClient.invalidateQueries({ queryKey: boardKeys.placements(conversationId) })
      void queryClient.invalidateQueries({ queryKey: boardKeys.cards(boardId) })
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar ao quadro</DialogTitle>
          <DialogDescription>
            A conversa vira um card no topo da coluna escolhida.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <FormError error={add.error} />
          {boards.isSuccess && available.length === 0 && (
            <p className="text-muted-foreground text-sm">
              {boards.data.length === 0
                ? 'A conta ainda não tem quadros.'
                : 'A conversa já está em todos os quadros.'}
            </p>
          )}
          {available.length > 0 && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="add-board">Quadro</Label>
                <Select
                  value={boardId}
                  onValueChange={(value) => {
                    setBoardId(value)
                    setColumnId('')
                  }}
                >
                  <SelectTrigger id="add-board" className="w-full">
                    <SelectValue placeholder="Escolha…" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {board && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="add-column">Coluna</Label>
                  <Select value={columnId || board.columns[0].id} onValueChange={setColumnId}>
                    <SelectTrigger id="add-column" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {board.columns.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!board || add.isPending} onClick={() => add.mutate()}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
