import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Copy, KeyRound, Pause, Play, Settings, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
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
import { Textarea } from '@/components/ui/textarea'
import { useServices } from '@/features/catalog/api'
import { errorMessage } from '@/lib/api/api-error'
import { formatPhone } from '@/lib/phone'
import { FORM_KIND_LABEL, formKeys, formsApi, useFormSubmissions, useForms } from './api'
import { FormDialog } from './form-dialog'
import { formSnippet } from './snippet'

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function FormPage() {
  const { id = '' } = useParams()
  const forms = useForms()
  const form = forms.data?.find((f) => f.id === id)
  const submissions = useFormSubmissions(id)
  const services = useServices()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState<'rotate' | 'delete' | null>(null)

  const siteServices = useMemo(
    () => services.data?.filter((s) => s.active && s.showOnSite) ?? [],
    [services.data],
  )
  const snippet = form ? formSnippet(form, siteServices) : ''

  const change = useMutation({
    mutationFn: (input: { active?: boolean; rotateKey?: boolean }) => formsApi.update(id, input),
    onSuccess: (updated, input) => {
      void queryClient.invalidateQueries({ queryKey: formKeys.all })
      toast.success(
        input.rotateKey
          ? 'Chave trocada. Cole o HTML novo no site.'
          : updated.active
            ? 'Formulário reativado.'
            : 'Formulário pausado: os envios são recusados.',
      )
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
  const remove = useMutation({
    mutationFn: () => formsApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: formKeys.all })
      toast.success('Formulário excluído.')
      void navigate('/forms')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      toast.success('HTML copiado. Cole na página do site.')
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto e copie à mão.')
    }
  }

  if (forms.isPending) return <Skeleton className="h-64" />
  if (!form) {
    return <p className="text-muted-foreground text-sm">Formulário não encontrado.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link to="/forms">
          <ArrowLeft />
          Formulários
        </Link>
      </Button>
      <PageHeader
        title={form.name}
        description={`${FORM_KIND_LABEL[form.kind]} · origem dos contatos: ${form.campaign ?? form.name}`}
        actions={
          <>
            {!form.active && <Badge variant="warning">Pausado</Badge>}
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Settings />
              Configurar
            </Button>
            <Button
              variant="outline"
              disabled={change.isPending}
              onClick={() => change.mutate({ active: !form.active })}
            >
              {form.active ? <Pause /> : <Play />}
              {form.active ? 'Pausar' : 'Reativar'}
            </Button>
          </>
        }
      />

      <section aria-labelledby="embed-title" className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 id="embed-title" className="font-semibold">
              HTML para o site
            </h2>
            <Button size="sm" onClick={() => void copy()}>
              <Copy />
              Copiar
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">
            Cole na página onde o formulário deve aparecer. Funciona sem JavaScript; o estilo fica
            no bloco <code>.omni-form</code>, fácil de ajustar.
            {form.kind === 'service' &&
              siteServices.length === 0 &&
              ' Atenção: nenhum serviço está marcado para aparecer no site — a lista vai sair vazia.'}
          </p>
          <Textarea
            readOnly
            aria-label="HTML do formulário"
            value={snippet}
            rows={14}
            className="font-mono text-xs"
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold">Prévia</h2>
          <p className="text-muted-foreground text-sm">
            Assim ele aparece num site em branco (o visual final depende do site).
          </p>
          <iframe
            title="Prévia do formulário"
            // Sem permissões: nem script nem envio — é só para ver.
            sandbox=""
            srcDoc={`<body style="margin:16px;background:#fff">${snippet}</body>`}
            className="min-h-96 w-full rounded-md border bg-white"
          />
        </div>
      </section>

      <section aria-labelledby="submissions-title" className="flex flex-col gap-3">
        <h2 id="submissions-title" className="font-semibold">
          Envios recentes
        </h2>
        <div className="bg-card rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Quem</TableHead>
                {form.kind === 'service' && <TableHead>Serviço</TableHead>}
                <TableHead>Mensagem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.isPending && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-8" />
                  </TableCell>
                </TableRow>
              )}
              {submissions.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                    Nenhum envio ainda.
                  </TableCell>
                </TableRow>
              )}
              {submissions.data?.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {dateTime.format(new Date(s.createdAt))}
                  </TableCell>
                  <TableCell>
                    <Link to={`/contacts/${s.contactId}`} className="font-medium hover:underline">
                      {s.name ?? 'Sem nome'}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {[s.phone && formatPhone(s.phone), s.email].filter(Boolean).join(' · ')}
                    </p>
                  </TableCell>
                  {form.kind === 'service' && (
                    <TableCell>
                      {s.serviceName ?? '—'}
                      {s.preferredDate && (
                        <p className="text-muted-foreground text-xs">{s.preferredDate}</p>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="text-muted-foreground max-w-md whitespace-pre-line">
                    {s.message ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-wrap gap-2 border-t pt-4">
        <Button variant="ghost" onClick={() => setConfirm('rotate')}>
          <KeyRound />
          Trocar a chave
        </Button>
        <Button variant="ghost" className="text-destructive" onClick={() => setConfirm('delete')}>
          <Trash2 />
          Excluir formulário
        </Button>
      </section>

      {editing && <FormDialog form={form} open onOpenChange={setEditing} />}
      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'rotate' ? 'Trocar a chave do formulário?' : `Excluir ${form.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'rotate'
                ? 'O formulário que está no site para de funcionar até você colar o HTML novo. Use se ele estiver recebendo spam.'
                : 'O formulário publicado para de funcionar e os envios dele somem desta tela. Os contatos e negócios criados continuam.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm === 'delete' ? 'destructive' : 'default'}
              onClick={() =>
                confirm === 'rotate' ? change.mutate({ rotateKey: true }) : remove.mutate()
              }
            >
              {confirm === 'rotate' ? 'Trocar chave' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
