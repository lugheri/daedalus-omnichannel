import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { FormError } from '@/components/form/form-error'
import { TextField } from '@/components/form/text-field'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { apiKeysApi, apiKeysQueryKey } from './api'

const schema = z.object({ name: z.string().trim().min(1, 'Dê um nome à chave').max(60) })
type KeyForm = z.infer<typeof schema>

/**
 * Cria a chave e a mostra UMA vez. Depois de fechar, só dá para ver o início
 * dela — perdeu, revoga e cria outra.
 */
export function CreateKeyDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [plainKey, setPlainKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const form = useForm<KeyForm>({ resolver: zodResolver(schema), defaultValues: { name: '' } })

  const create = useMutation({
    mutationFn: ({ name }: KeyForm) => apiKeysApi.create(name),
    onSuccess: (key) => {
      setPlainKey(key.key)
      void queryClient.invalidateQueries({ queryKey: apiKeysQueryKey })
    },
  })

  const close = (next: boolean) => {
    if (!next) {
      form.reset()
      create.reset()
      setPlainKey(null)
      setCopied(false)
    }
    onOpenChange(next)
  }

  const copy = async () => {
    if (!plainKey) return
    await navigator.clipboard.writeText(plainKey)
    setCopied(true)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plainKey ? 'Copie a sua chave agora' : 'Nova chave de API'}</DialogTitle>
          <DialogDescription>
            {plainKey
              ? 'Por segurança, ela não será mostrada de novo.'
              : 'Use um nome que diga onde a chave será usada (ex.: "Site principal").'}
          </DialogDescription>
        </DialogHeader>

        {plainKey ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input
                readOnly
                value={plainKey}
                aria-label="Chave de API"
                className="font-mono text-xs"
              />
              <Button variant="outline" onClick={() => void copy()} aria-label="Copiar chave">
                {copied ? <Check /> : <Copy />}
                {copied ? 'Copiada' : 'Copiar'}
              </Button>
            </div>
            <Alert>
              <TriangleAlert />
              <AlertTitle>Guarde em lugar seguro</AlertTitle>
              <AlertDescription>
                Quem tem a chave cria contatos na sua conta. Use-a só no servidor (backend do site
                ou plugin de formulário) — nunca no código de uma página.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <form id="api-key-form" onSubmit={form.handleSubmit((v) => create.mutate(v))} noValidate>
            <FieldGroup>
              <FormError error={create.error} />
              <TextField form={form} name="name" label="Nome" autoFocus />
            </FieldGroup>
          </form>
        )}

        <DialogFooter>
          {plainKey ? (
            <Button onClick={() => close(false)}>Já copiei</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => close(false)}>
                Cancelar
              </Button>
              <Button type="submit" form="api-key-form" disabled={create.isPending}>
                {create.isPending ? 'Criando…' : 'Criar chave'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
