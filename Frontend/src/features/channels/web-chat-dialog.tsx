import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, RefreshCw } from 'lucide-react'
import { useState } from 'react'
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { env } from '@/lib/env'
import { channelsApi, channelsQueryKey, webChatSnippet, type Channel } from './api'

/**
 * Chat do site: o que o visitante vê (título, saudação, cor) e o código para
 * colar num site de fora (no site do módulo de sites, o widget entra sozinho
 * ao escolher o chat na aba Seções). Monte com `key` para recomeçar.
 */
export function WebChatDialog({
  channel,
  onOpenChange,
}: {
  channel: Channel
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const settings = channel.settings ?? { title: '', greeting: '', color: '#2f5bd7' }
  const [title, setTitle] = useState(settings.title)
  const [greeting, setGreeting] = useState(settings.greeting)
  const [color, setColor] = useState(settings.color)
  const [publicKey, setPublicKey] = useState(channel.publicKey ?? '')
  const snippet = webChatSnippet(env.VITE_API_URL, publicKey)

  const save = useMutation({
    mutationFn: (rotateKey: boolean) =>
      channelsApi.updateWebChat(channel.id, rotateKey ? { rotateKey } : { title, greeting, color }),
    onSuccess: (next, rotateKey) => {
      void queryClient.invalidateQueries({ queryKey: channelsQueryKey, exact: true })
      if (rotateKey) {
        setPublicKey(next.publicKey ?? '')
        toast.success('Chave trocada. Cole o código novo nos sites (e publique o seu de novo).')
      } else {
        toast.success('Chat salvo.')
        onOpenChange(false)
      }
    },
  })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      toast.success('Código copiado.')
    } catch {
      toast.error('Não foi possível copiar. Selecione o código e copie à mão.')
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chat do site: {channel.name}</DialogTitle>
          <DialogDescription>
            O visitante diz nome e WhatsApp ou e-mail e conversa com a equipe pela caixa de entrada.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <FormError error={save.error} />
          <Field>
            <FieldLabel htmlFor="chat-title">Título</FieldLabel>
            <Input
              id="chat-title"
              maxLength={60}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="chat-greeting">Saudação</FieldLabel>
            <Textarea
              id="chat-greeting"
              rows={2}
              maxLength={300}
              value={greeting}
              onChange={(event) => setGreeting(event.target.value)}
            />
            <FieldDescription>A primeira mensagem que o visitante vê.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="chat-color">Cor</FieldLabel>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Escolher a cor"
                value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#2f5bd7'}
                onChange={(event) => setColor(event.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1"
              />
              <Input
                id="chat-color"
                className="w-32 font-mono"
                maxLength={7}
                value={color}
                onChange={(event) => setColor(event.target.value)}
              />
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="chat-snippet">Código para colar em outro site</FieldLabel>
            <div className="flex gap-2">
              <Textarea
                id="chat-snippet"
                readOnly
                rows={3}
                className="font-mono text-xs"
                value={snippet}
              />
              <div className="flex flex-col gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
                  <Copy />
                  Copiar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={save.isPending}
                  onClick={() => save.mutate(true)}
                >
                  <RefreshCw />
                  Trocar chave
                </Button>
              </div>
            </div>
            <FieldDescription>
              Antes do &lt;/body&gt; do site. No site feito aqui (Site › Meu site), basta escolher
              este chat na aba Seções. Trocar a chave desliga o código antigo.
            </FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button disabled={save.isPending || !title.trim()} onClick={() => save.mutate(false)}>
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
