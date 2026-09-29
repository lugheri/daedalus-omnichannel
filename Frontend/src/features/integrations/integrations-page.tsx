import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useMemberNames } from '@/features/members/api'
import { errorMessage } from '@/lib/api/api-error'
import { env } from '@/lib/env'
import { apiKeysApi, apiKeysQueryKey, useApiKeys, type ApiKey } from './api'
import { CreateKeyDialog } from './create-key-dialog'

const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function IntegrationsPage() {
  const queryClient = useQueryClient()
  const keys = useApiKeys()
  const nameOf = useMemberNames()
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<ApiKey | null>(null)
  const endpoint = `${env.VITE_API_URL}/v1/public/leads`

  const revoke = useMutation({
    mutationFn: (key: ApiKey) => apiKeysApi.revoke(key.id),
    onSuccess: () => {
      toast.success('Chave revogada.')
      void queryClient.invalidateQueries({ queryKey: apiKeysQueryKey })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <>
      <PageHeader
        title="Integrações"
        description="Chaves de API para o formulário do site (e outros sistemas) criarem leads na sua conta."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus />
            Nova chave
          </Button>
        }
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Chave</TableHead>
              <TableHead className="hidden md:table-cell">Criada por</TableHead>
              <TableHead>Último uso</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.isPending && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-8" />
                </TableCell>
              </TableRow>
            )}
            {keys.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                  Nenhuma chave ainda.
                </TableCell>
              </TableRow>
            )}
            {keys.data?.map((key) => (
              <TableRow key={key.id} className={key.active ? undefined : 'opacity-60'}>
                <TableCell className="font-medium">{key.name}</TableCell>
                <TableCell className="font-mono text-xs">omni_….{key.hint}…</TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">
                  {nameOf(key.createdByMembershipId) ?? '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {key.lastUsedAt ? date.format(new Date(key.lastUsedAt)) : 'Nunca'}
                </TableCell>
                <TableCell>
                  {key.active ? (
                    <Button variant="ghost" size="sm" onClick={() => setRevoking(key)}>
                      Revogar
                    </Button>
                  ) : (
                    <Badge variant="outline">Revogada</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <section className="mt-8 max-w-3xl space-y-3 text-sm">
        <h2 className="text-lg font-semibold">Como conectar o formulário do site</h2>
        <p>
          Configure o formulário (ou o plugin de webhook, como os do WordPress/Elementor) para
          enviar os dados para:
        </p>
        <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">POST {endpoint}</pre>
        <p>
          Com o cabeçalho <code className="bg-muted rounded px-1">X-Api-Key: sua-chave</code>.
          Aceita JSON ou formulário comum, com os campos (em português ou inglês):
        </p>
        <ul className="text-muted-foreground list-disc space-y-1 pl-5">
          <li>
            <strong className="text-foreground">nome</strong> (ou name)
          </li>
          <li>
            <strong className="text-foreground">telefone</strong> (ou celular, whatsapp, phone)
          </li>
          <li>
            <strong className="text-foreground">email</strong>
          </li>
          <li>
            <strong className="text-foreground">campanha</strong> (ou campaign, utm_campaign) — vira
            o detalhe da origem do lead
          </li>
        </ul>
        <p className="text-muted-foreground">
          Precisa de telefone ou e-mail. Se o contato já existir, ele não é duplicado. Os leads
          entram com a origem “Formulário do site”.
        </p>
        <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
          {`curl -X POST ${endpoint} \\
  -H "X-Api-Key: omni_..." \\
  -d "nome=Maria Souza" -d "telefone=11987654321" -d "campanha=Black Friday"`}
        </pre>
      </section>

      <CreateKeyDialog open={creating} onOpenChange={setCreating} />

      <AlertDialog open={revoking !== null} onOpenChange={(open) => !open && setRevoking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar a chave {revoking?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ela para de funcionar na hora: o que estiver usando essa chave deixa de criar leads.
              Não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => revoking && revoke.mutate(revoking)}
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
