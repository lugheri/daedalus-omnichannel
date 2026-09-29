import { Plus, SquareKanban } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/features/auth/session-context'
import { useBoards } from './api'
import { CreateBoardDialog } from './create-board-dialog'

const AUTO_ADD_LABEL = {
  none: 'Entrada manual',
  all: 'Recebe todas as conversas novas',
  team: 'Recebe as conversas novas de uma equipe',
} as const

export function BoardsPage() {
  const boards = useBoards()
  const { can } = usePermissions()
  const [creating, setCreating] = useState(false)

  return (
    <>
      <PageHeader
        title="Quadros"
        description="Acompanhe os atendimentos em etapas. Cada card é uma conversa."
        actions={
          can('boards:manage') && (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              Novo quadro
            </Button>
          )
        }
      />

      {boards.isPending && <Skeleton className="h-24" />}
      {boards.data?.length === 0 && (
        <div className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">
          {can('boards:manage')
            ? 'Nenhum quadro ainda. Crie o primeiro para organizar os atendimentos em etapas.'
            : 'Nenhum quadro ainda. Peça a um administrador para criar.'}
        </div>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {boards.data?.map((board) => (
          <li key={board.id}>
            <Link
              to={`/boards/${board.id}`}
              className="hover:bg-accent flex h-full flex-col gap-2 rounded-lg border p-4"
            >
              <span className="flex items-center gap-2 font-medium">
                <SquareKanban className="text-muted-foreground size-4" />
                {board.name}
              </span>
              <span className="text-muted-foreground text-sm">
                {board.columns.map((c) => c.name).join(' → ')}
              </span>
              <span className="text-muted-foreground mt-auto text-xs">
                {AUTO_ADD_LABEL[board.autoAdd.mode]}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <CreateBoardDialog open={creating} onOpenChange={setCreating} />
    </>
  )
}
