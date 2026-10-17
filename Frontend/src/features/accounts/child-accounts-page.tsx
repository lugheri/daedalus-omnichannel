import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, LogIn, MoreHorizontal, Plus, Power, PowerOff, Store } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { FormError } from '@/components/form/form-error'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useSession } from '@/features/auth/session-context'
import { errorMessage } from '@/lib/api/api-error'
import { accountKeys, accountsApi, useChildAccounts, type ChildAccount } from './api'

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

const STATUS = {
  trial: { label: 'Em teste', variant: 'warning' },
  active: { label: 'Ativa', variant: 'success' },
  suspended: { label: 'Suspensa', variant: 'destructive' },
} as const

/**
 * Contas abaixo da atual (ADR 0009): clientes diretos e, abaixo dos
 * revendedores, os clientes deles. Entrar numa conta abre a sessão nela como
 * "acesso da conta-mãe" (registrado para a conta ver).
 */
export function ChildAccountsPage() {
  const accounts = useChildAccounts()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { switchAccount } = useSession()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [entering, setEntering] = useState<string | null>(null)

  const items = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('pt-BR')
    const all = accounts.data ?? []
    return q
      ? all.filter((a) => `${a.name} ${a.parentName ?? ''}`.toLocaleLowerCase('pt-BR').includes(q))
      : all
  }, [accounts.data, query])

  const change = useMutation({
    mutationFn: ({ account, action }: { account: ChildAccount; action: Action }) =>
      action === 'suspend'
        ? accountsApi.suspend(account.id)
        : action === 'reactivate'
          ? accountsApi.reactivate(account.id)
          : accountsApi.setReseller(account.id, action === 'reseller-on'),
    onSuccess: (_, { account, action }) => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.children })
      toast.success(MESSAGES[action](account.name))
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const enter = async (account: ChildAccount) => {
    setEntering(account.id)
    try {
      void navigate('/')
      await switchAccount(account.id)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setEntering(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Contas clientes"
        description="As contas abaixo desta: clientes e revendedores (e os clientes deles). Entrar numa conta fica registrado para ela."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus />
            Nova conta
          </Button>
        }
      />

      <Input
        className="mb-3 max-w-sm"
        placeholder="Buscar pelo nome da conta ou do revendedor"
        aria-label="Buscar conta"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="bg-card rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Conta</TableHead>
              <TableHead className="hidden md:table-cell">Gerenciada por</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="hidden sm:table-cell">Desde</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.isPending && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-8" />
                </TableCell>
              </TableRow>
            )}
            {!accounts.isPending && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                  {query ? 'Nenhuma conta com esse nome.' : 'Nenhuma conta abaixo desta ainda.'}
                </TableCell>
              </TableRow>
            )}
            {items.map((account) => (
              <TableRow key={account.id}>
                <TableCell>
                  <div className="flex items-center gap-1.5 font-medium">
                    {account.name}
                    {account.canCreateChildren && (
                      <Badge variant="secondary" className="gap-1">
                        <Store className="size-3" />
                        Revendedor
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">
                  {account.depth > 1 ? account.parentName : 'Esta conta'}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS[account.status].variant}>
                    {STATUS[account.status].label}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground hidden sm:table-cell">
                  {dateFormat.format(new Date(account.createdAt))}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={account.status === 'suspended' || entering !== null}
                      onClick={() => void enter(account)}
                    >
                      <LogIn />
                      Entrar
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Ações da conta ${account.name}`}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() =>
                            change.mutate({
                              account,
                              action: account.canCreateChildren ? 'reseller-off' : 'reseller-on',
                            })
                          }
                        >
                          <Store />
                          {account.canCreateChildren
                            ? 'Deixar de ser revendedor'
                            : 'Tornar revendedor'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {account.status === 'suspended' ? (
                          <DropdownMenuItem
                            onSelect={() => change.mutate({ account, action: 'reactivate' })}
                          >
                            <Power />
                            Reativar
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => change.mutate({ account, action: 'suspend' })}
                          >
                            <PowerOff />
                            Suspender
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {creating && <NewChildAccountDialog onOpenChange={setCreating} />}
    </>
  )
}

type Action = 'suspend' | 'reactivate' | 'reseller-on' | 'reseller-off'

const MESSAGES: Record<Action, (name: string) => string> = {
  suspend: (name) => `${name} suspensa: ninguém entra até reativar.`,
  reactivate: (name) => `${name} reativada.`,
  'reseller-on': (name) => `${name} agora pode criar contas abaixo dela.`,
  'reseller-off': (name) => `${name} não cria mais contas abaixo dela.`,
}

/** Conta nova abaixo desta + convite do dono (o link aparece para copiar). */
function NewChildAccountDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const [accountName, setAccountName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [reseller, setReseller] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: () => accountsApi.create({ accountName, ownerEmail, allowsChildren: reseller }),
    onSuccess: ({ inviteUrl: url }) => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.children })
      setInviteUrl(url)
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (accountName.trim() && ownerEmail.trim()) create.mutate()
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl ?? '')
      toast.success('Link copiado.')
    } catch {
      toast.error('Não foi possível copiar. Selecione o link e copie à mão.')
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        {inviteUrl ? (
          <>
            <DialogHeader>
              <DialogTitle>Conta criada</DialogTitle>
              <DialogDescription>
                Envie o link para {ownerEmail}: com ele, a pessoa cria a senha e entra como dona da
                conta. O link vale por alguns dias.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Input readOnly value={inviteUrl} aria-label="Link do convite" />
              <Button variant="outline" onClick={() => void copy()}>
                <Copy />
                Copiar
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Concluir</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Nova conta</DialogTitle>
              <DialogDescription>
                A conta nasce abaixo desta, com os cargos padrão e o funil de vendas. O dono recebe
                um convite.
              </DialogDescription>
            </DialogHeader>
            <form id="child-account-form" onSubmit={submit} noValidate>
              <FieldGroup>
                <FormError error={create.error} />
                <Field>
                  <FieldLabel htmlFor="child-name">Nome da empresa</FieldLabel>
                  <Input
                    id="child-name"
                    autoFocus
                    maxLength={100}
                    value={accountName}
                    onChange={(event) => setAccountName(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="child-owner">E-mail do dono</FieldLabel>
                  <Input
                    id="child-owner"
                    type="email"
                    maxLength={320}
                    value={ownerEmail}
                    onChange={(event) => setOwnerEmail(event.target.value)}
                  />
                  <FieldDescription>
                    Quem vai administrar a conta do lado do cliente.
                  </FieldDescription>
                </Field>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="child-reseller"
                    checked={reseller}
                    onCheckedChange={(checked) => setReseller(checked === true)}
                  />
                  <div className="grid gap-0.5">
                    <Label htmlFor="child-reseller">Revendedor</Label>
                    <p className="text-muted-foreground text-xs">
                      Pode criar e gerenciar as contas dos clientes dele.
                    </p>
                  </div>
                </div>
              </FieldGroup>
            </form>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                form="child-account-form"
                disabled={!accountName.trim() || !ownerEmail.trim() || create.isPending}
              >
                {create.isPending ? 'Criando…' : 'Criar conta'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
