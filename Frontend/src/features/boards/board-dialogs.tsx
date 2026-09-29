import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { FormError } from '@/components/form/form-error'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTeams } from '@/features/teams/api'
import { errorMessage } from '@/lib/api/api-error'
import { boardKeys, boardsApi, type AutoAdd, type Board, type BoardColumn } from './api'

/** Criar ou renomear uma coluna. */
export function ColumnNameDialog({
  board,
  column,
  open,
  onOpenChange,
}: {
  board: Board
  /** Ausente = nova coluna. */
  column?: BoardColumn
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(column?.name ?? '')
  const save = useMutation({
    mutationFn: () =>
      column
        ? boardsApi.updateColumn(board.id, column.id, { name })
        : boardsApi.addColumn(board.id, name),
    onSuccess: (updated) => {
      queryClient.setQueryData(boardKeys.detail(board.id), updated)
      void queryClient.invalidateQueries({ queryKey: boardKeys.all })
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{column ? 'Renomear coluna' : 'Nova coluna'}</DialogTitle>
          <DialogDescription>
            {column ? 'O novo nome aparece para todos.' : 'A coluna entra no fim do quadro.'}
          </DialogDescription>
        </DialogHeader>
        <form
          id="column-form"
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate()
          }}
        >
          <FormError error={save.error} />
          <Label htmlFor="column-name">Nome</Label>
          <Input
            id="column-name"
            autoFocus
            maxLength={40}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="column-form" disabled={!name.trim() || save.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Excluir coluna: os cards dela vão para outra coluna escolhida. */
export function DeleteColumnDialog({
  board,
  column,
  hasCards,
  open,
  onOpenChange,
}: {
  board: Board
  column: BoardColumn
  hasCards: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const others = board.columns.filter((c) => c.id !== column.id)
  const [moveTo, setMoveTo] = useState(others[0]?.id ?? '')
  const remove = useMutation({
    mutationFn: () => boardsApi.removeColumn(board.id, column.id, moveTo || undefined),
    onSuccess: (updated) => {
      queryClient.setQueryData(boardKeys.detail(board.id), updated)
      void queryClient.invalidateQueries({ queryKey: boardKeys.all })
      toast.success('Coluna excluída.')
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir a coluna {column.name}?</DialogTitle>
          <DialogDescription>
            {others.length === 0
              ? 'O quadro precisa de ao menos uma coluna.'
              : hasCards
                ? 'Os cards desta coluna vão para o fim da coluna escolhida (sem disparar automações).'
                : 'A coluna está vazia.'}
          </DialogDescription>
        </DialogHeader>
        <FormError error={remove.error} />
        {hasCards && others.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="move-to">Mover os cards para</Label>
            <Select value={moveTo} onValueChange={setMoveTo}>
              <SelectTrigger id="move-to" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {others.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={others.length === 0 || remove.isPending}
            onClick={() => remove.mutate()}
          >
            Excluir coluna
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const NO_TEAM = ''

/** Nome, entrada automática e exclusão do quadro. */
export function BoardSettingsDialog({
  board,
  open,
  onOpenChange,
}: {
  board: Board
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const teams = useTeams(open)
  const [name, setName] = useState(board.name)
  const [mode, setMode] = useState<AutoAdd['mode']>(board.autoAdd.mode)
  const [teamId, setTeamId] = useState(
    board.autoAdd.mode === 'team' ? board.autoAdd.teamId : NO_TEAM,
  )
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = useMutation({
    mutationFn: () => {
      const autoAdd: AutoAdd = mode === 'team' ? { mode, teamId } : { mode }
      return boardsApi.update(board.id, { name, autoAdd })
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(boardKeys.detail(board.id), updated)
      void queryClient.invalidateQueries({ queryKey: boardKeys.list })
      toast.success('Quadro atualizado.')
      onOpenChange(false)
    },
  })

  const remove = useMutation({
    mutationFn: () => boardsApi.remove(board.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: boardKeys.all })
      toast.success('Quadro excluído.')
      void navigate('/boards')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar quadro</DialogTitle>
            <DialogDescription>
              Com a entrada automática, cada conversa nova entra no topo da primeira coluna.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <FormError error={save.error} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="board-name">Nome</Label>
              <Input
                id="board-name"
                maxLength={60}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="board-auto-add">Entrada automática</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as AutoAdd['mode'])}>
                <SelectTrigger id="board-auto-add" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (cards adicionados à mão)</SelectItem>
                  <SelectItem value="all">Todas as conversas novas</SelectItem>
                  <SelectItem value="team">Conversas novas de uma equipe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === 'team' && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="board-team">Equipe</Label>
                <Select value={teamId} onValueChange={setTeamId}>
                  <SelectTrigger id="board-team" className="w-full">
                    <SelectValue placeholder="Escolha…" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.data?.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              Excluir quadro
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!name.trim() || (mode === 'team' && !teamId) || save.isPending}
                onClick={() => save.mutate()}
              >
                Salvar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o quadro {board.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              As colunas e os cards somem. As conversas continuam na caixa de entrada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate()}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
