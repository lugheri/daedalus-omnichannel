import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, CircleAlert, CircleDashed, Send, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorMessage } from '@/lib/api/api-error'
import { messagingApi, messagingKeys, type MessagingChannel, type ProviderView } from './api'

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** Situação do provedor, com a mensagem do último teste que falhou. */
export function ProviderStatusBadge({ provider }: { provider: ProviderView<unknown> | null }) {
  if (!provider) return <Badge variant="outline">Não configurado</Badge>
  if (provider.status === 'verified') {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="size-3.5" />
        Funcionando
      </Badge>
    )
  }
  if (provider.status === 'failing') {
    return (
      <Badge variant="destructive" className="gap-1">
        <CircleAlert className="size-3.5" />
        Com falha
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1">
      <CircleDashed className="size-3.5" />
      Não testado
    </Badge>
  )
}

/**
 * Moldura comum dos provedores: título, situação, formulário (filho), envio
 * de teste e remoção.
 */
export function ProviderCard({
  channel,
  title,
  description,
  provider,
  testPlaceholder,
  children,
}: {
  channel: MessagingChannel
  title: string
  description: ReactNode
  provider: ProviderView<unknown> | null
  testPlaceholder: string
  children: ReactNode
}) {
  const queryClient = useQueryClient()
  const [testTo, setTestTo] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const refresh = () => queryClient.invalidateQueries({ queryKey: messagingKeys.providers })

  const test = useMutation({
    mutationFn: () => messagingApi.test(channel, testTo),
    onSuccess: () => toast.success('Mensagem de teste enviada. Confira se chegou.'),
    // Falhou ou não, a situação do provedor mudou.
    onSettled: () => void refresh(),
  })

  const remove = useMutation({
    mutationFn: () => messagingApi.remove(channel),
    onSuccess: () => {
      toast.success('Provedor removido.')
      void refresh()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          <ProviderStatusBadge provider={provider} />
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {provider?.status === 'failing' && provider.lastError && (
          <p role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
            Último teste (
            {provider.lastCheckedAt && dateTime.format(new Date(provider.lastCheckedAt))}
            ): {provider.lastError}
          </p>
        )}

        {children}

        {provider && (
          <section aria-label="Enviar teste" className="flex flex-col gap-2 border-t pt-4">
            <Label htmlFor={`${channel}-test-to`}>Enviar uma mensagem de teste para</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id={`${channel}-test-to`}
                value={testTo}
                placeholder={testPlaceholder}
                onChange={(event) => setTestTo(event.target.value)}
              />
              <Button
                variant="outline"
                disabled={!testTo.trim() || test.isPending}
                onClick={() => test.mutate()}
              >
                <Send />
                {test.isPending ? 'Enviando…' : 'Enviar teste'}
              </Button>
            </div>
            <FormError error={test.error} />
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => setConfirmRemove(true)}
              >
                <Trash2 />
                Remover provedor
              </Button>
            </div>
          </section>
        )}
      </CardContent>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover o provedor de {title}?</AlertDialogTitle>
            <AlertDialogDescription>
              As credenciais são apagadas daqui (não da sua conta no provedor). Envios deste canal
              param até você configurar de novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate()}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
