import { ImagePlus, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useWebChatChannels } from '@/features/channels/api'
import { useForms } from '@/features/forms/api'
import { usePermissions } from '@/features/auth/session-context'
import {
  MAX_FAQ_ITEMS,
  MAX_GALLERY_ITEMS,
  MAX_TESTIMONIALS,
  SITE_SECTIONS,
  useSiteAssets,
  type SiteContent,
  type SiteSection,
} from './api'
import { AssetPicker } from './asset-picker'

/** Muda o conteúdo em edição (recebe uma cópia para alterar). */
export type PatchContent = (change: (content: SiteContent) => void) => void

/** Campo de texto do conteúdo (vazio vai como "", que o backend grava como "sem"). */
export function TextField({
  id,
  label,
  value,
  onChange,
  hint,
  multiline = false,
  maxLength,
  placeholder,
  type = 'text',
}: {
  id: string
  label: string
  value: string | null
  onChange: (value: string) => void
  hint?: ReactNode
  multiline?: boolean
  maxLength: number
  placeholder?: string
  type?: string
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {multiline ? (
        <Textarea
          id={id}
          rows={4}
          maxLength={maxLength}
          placeholder={placeholder}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          type={type}
          maxLength={maxLength}
          placeholder={placeholder}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  )
}

export function BusinessFields({ content, patch }: { content: SiteContent; patch: PatchContent }) {
  const b = content.business
  const set = (key: keyof SiteContent['business']) => (value: string) =>
    patch((c) => {
      c.business[key] = value
    })
  return (
    <FieldGroup>
      <TextField
        id="site-name"
        label="Nome da empresa"
        value={b.name}
        onChange={set('name')}
        maxLength={120}
      />
      <TextField
        id="site-tagline"
        label="Frase de apresentação"
        value={b.tagline}
        onChange={set('tagline')}
        maxLength={160}
        placeholder="Ex.: Corte e barba no centro desde 2010"
      />
      <TextField
        id="site-about"
        label="Sobre a empresa"
        value={b.about}
        onChange={set('about')}
        maxLength={3000}
        multiline
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="site-whatsapp"
          label="WhatsApp"
          value={b.whatsapp}
          onChange={set('whatsapp')}
          maxLength={40}
          type="tel"
          placeholder="(11) 99999-9999"
          hint="Vira o botão de WhatsApp do site."
        />
        <TextField
          id="site-phone"
          label="Telefone"
          value={b.phone}
          onChange={set('phone')}
          maxLength={40}
          type="tel"
        />
      </div>
      <TextField
        id="site-email"
        label="E-mail"
        value={b.email}
        onChange={set('email')}
        maxLength={320}
        type="email"
      />
      <TextField
        id="site-address"
        label="Endereço"
        value={b.address}
        onChange={set('address')}
        maxLength={300}
        hint="Também posiciona o mapa."
      />
      <TextField
        id="site-hours"
        label="Horário de atendimento"
        value={b.hours}
        onChange={set('hours')}
        maxLength={500}
        multiline
        placeholder={'Seg a sex: 9h às 18h\nSábado: 9h às 13h'}
        hint="Uma linha por dia ou faixa de dias."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="site-instagram"
          label="Instagram"
          value={b.instagram}
          onChange={set('instagram')}
          maxLength={200}
          placeholder="@suaempresa"
        />
        <TextField
          id="site-facebook"
          label="Facebook"
          value={b.facebook}
          onChange={set('facebook')}
          maxLength={300}
          placeholder="Endereço da página"
        />
      </div>
    </FieldGroup>
  )
}

/** Miniatura de uma imagem escolhida, com trocar e tirar. */
function ImageSlot({
  label,
  assetId,
  onChange,
}: {
  label: string
  assetId: string | null
  onChange: (assetId: string | null) => void
}) {
  const assets = useSiteAssets()
  const [picking, setPicking] = useState(false)
  const url = assets.data?.find((a) => a.id === assetId)?.url
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-3">
        <div className="bg-muted flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border">
          {url ? (
            <img src={url} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="text-muted-foreground size-5" />
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
            {assetId ? 'Trocar' : 'Escolher'}
          </Button>
          {assetId && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              Tirar
            </Button>
          )}
        </div>
      </div>
      <AssetPicker
        open={picking}
        onOpenChange={setPicking}
        title={label}
        onPick={([asset]) => asset && onChange(asset.id)}
      />
    </Field>
  )
}

export function AppearanceFields({
  content,
  patch,
}: {
  content: SiteContent
  patch: PatchContent
}) {
  const color = content.theme.primaryColor
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="site-color">Cor principal</FieldLabel>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Escolher a cor"
            value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#2f5bd7'}
            onChange={(event) =>
              patch((c) => {
                c.theme.primaryColor = event.target.value
              })
            }
            className="h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1"
          />
          <Input
            id="site-color"
            className="w-32 font-mono"
            maxLength={7}
            value={color}
            onChange={(event) =>
              patch((c) => {
                c.theme.primaryColor = event.target.value
              })
            }
          />
        </div>
        <FieldDescription>
          Botões, destaques e títulos. O texto sobre ela fica claro ou escuro sozinho.
        </FieldDescription>
      </Field>
      <ImageSlot
        label="Logo"
        assetId={content.theme.logoAssetId}
        onChange={(id) =>
          patch((c) => {
            c.theme.logoAssetId = id
          })
        }
      />
      <ImageSlot
        label="Foto de capa"
        assetId={content.theme.heroImageAssetId}
        onChange={(id) =>
          patch((c) => {
            c.theme.heroImageAssetId = id
          })
        }
      />
      <TextField
        id="site-hero-title"
        label="Título da capa"
        value={content.hero.title}
        onChange={(v) => patch((c) => void (c.hero.title = v))}
        maxLength={160}
        hint="Vazio: o nome da empresa."
      />
      <TextField
        id="site-hero-subtitle"
        label="Texto da capa"
        value={content.hero.subtitle}
        onChange={(v) => patch((c) => void (c.hero.subtitle = v))}
        maxLength={300}
        hint="Vazio: a frase de apresentação."
      />
      <TextField
        id="site-hero-cta"
        label="Texto do botão da capa"
        value={content.hero.ctaLabel}
        onChange={(v) => patch((c) => void (c.hero.ctaLabel = v))}
        maxLength={40}
        hint="Leva ao WhatsApp (ou ao contato, sem WhatsApp). Vazio: “Chamar no WhatsApp”."
      />
    </FieldGroup>
  )
}

const SECTION_LABELS: Record<SiteSection, { label: string; hint: string }> = {
  about: { label: 'Sobre', hint: 'O texto “Sobre a empresa”.' },
  services: {
    label: 'Serviços',
    hint: 'Do cadastro de serviços: os ativos marcados “mostrar no site”.',
  },
  professionals: {
    label: 'Equipe',
    hint: 'Do cadastro de profissionais: os marcados “mostrar no site”.',
  },
  gallery: { label: 'Fotos', hint: 'A galeria (aba Conteúdo).' },
  testimonials: { label: 'Depoimentos', hint: 'O que os clientes dizem (aba Conteúdo).' },
  faq: { label: 'Dúvidas frequentes', hint: 'Perguntas e respostas (aba Conteúdo).' },
  contact: {
    label: 'Contato',
    hint: 'WhatsApp, telefone, e-mail, endereço, horário e o formulário.',
  },
  map: { label: 'Mapa', hint: 'Mapa do Google pelo endereço.' },
  booking: {
    label: 'Agendamento online',
    hint: 'Escolher serviço e horário livre (só com o agendamento online ligado na Agenda).',
  },
}

export function SectionsFields({ content, patch }: { content: SiteContent; patch: PatchContent }) {
  const { can } = usePermissions()
  const canForms = can('forms:manage')
  const canChannels = can('channels:manage')
  const forms = useForms()
  const chats = useWebChatChannels(canChannels)
  const options = useMemo(
    () => (forms.data ?? []).filter((f) => f.active || f.id === content.contactFormId),
    [forms.data, content.contactFormId],
  )
  return (
    <FieldGroup>
      <p className="text-muted-foreground text-sm">
        Seção ligada só aparece se tiver o que mostrar (sem fotos, a galeria não aparece).
      </p>
      <ul className="grid gap-3">
        {SITE_SECTIONS.map((section) => (
          <li key={section} className="flex items-start gap-2">
            <Checkbox
              id={`section-${section}`}
              checked={content.sections[section]}
              onCheckedChange={(checked) =>
                patch((c) => {
                  c.sections[section] = checked === true
                })
              }
            />
            <div className="grid gap-0.5">
              <Label htmlFor={`section-${section}`}>{SECTION_LABELS[section].label}</Label>
              <p className="text-muted-foreground text-xs">{SECTION_LABELS[section].hint}</p>
            </div>
          </li>
        ))}
      </ul>
      {canForms && (
        <Field>
          <FieldLabel htmlFor="site-form">Formulário do contato</FieldLabel>
          <Select
            value={content.contactFormId ?? 'none'}
            onValueChange={(value) =>
              patch((c) => {
                c.contactFormId = value === 'none' ? null : value
              })
            }
          >
            <SelectTrigger id="site-form">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem formulário</SelectItem>
              {options.map((form) => (
                <SelectItem key={form.id} value={form.id}>
                  {form.name}
                  {!form.active && ' (pausado)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Os envios viram contatos e negócios no funil. Crie formulários em Site › Formulários.
          </FieldDescription>
        </Field>
      )}
      {canChannels && (
        <Field>
          <FieldLabel htmlFor="site-chat">Chat do site</FieldLabel>
          <Select
            value={content.chatChannelId ?? 'none'}
            onValueChange={(value) =>
              patch((c) => {
                c.chatChannelId = value === 'none' ? null : value
              })
            }
          >
            <SelectTrigger id="site-chat">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem chat</SelectItem>
              {chats.data?.map((chat) => (
                <SelectItem key={chat.id} value={chat.id}>
                  {chat.name}
                  {chat.status !== 'connected' && ' (desligado)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Um botão de chat no canto do site; as conversas chegam na caixa de entrada. Crie o chat
            em Configurações › Canais.
          </FieldDescription>
        </Field>
      )}
    </FieldGroup>
  )
}

/** Lista editável de itens de texto (depoimentos, dúvidas). */
export function TextList<T>({
  title,
  items,
  max,
  empty,
  addLabel,
  onAdd,
  onRemove,
  render,
}: {
  title: string
  items: T[]
  max: number
  empty: string
  addLabel: string
  onAdd: () => void
  onRemove: (index: number) => void
  render: (item: T, index: number) => ReactNode
}) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          disabled={items.length >= max}
        >
          <Plus />
          {addLabel}
        </Button>
      </div>
      {items.length === 0 && <p className="text-muted-foreground text-sm">{empty}</p>}
      {items.map((item, index) => (
        <div key={index} className="relative grid gap-2 rounded-md border p-3 pr-11">
          {render(item, index)}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 size-7"
            aria-label={`Remover item ${index + 1} de ${title}`}
            onClick={() => onRemove(index)}
          >
            <X />
          </Button>
        </div>
      ))}
    </section>
  )
}

export function ExtrasFields({ content, patch }: { content: SiteContent; patch: PatchContent }) {
  const assets = useSiteAssets()
  const [picking, setPicking] = useState(false)
  const urls = useMemo(() => new Map((assets.data ?? []).map((a) => [a.id, a.url])), [assets.data])
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3" aria-label="Fotos">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Fotos</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPicking(true)}
            disabled={content.gallery.length >= MAX_GALLERY_ITEMS}
          >
            <ImagePlus />
            Adicionar fotos
          </Button>
        </div>
        {content.gallery.length === 0 && (
          <p className="text-muted-foreground text-sm">Nenhuma foto na galeria.</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {content.gallery.map((item, index) => (
            <div key={`${item.assetId}-${index}`} className="flex gap-2 rounded-md border p-2">
              <div className="bg-muted size-16 shrink-0 overflow-hidden rounded">
                {urls.get(item.assetId) && (
                  <img
                    src={urls.get(item.assetId) ?? ''}
                    alt=""
                    className="size-full object-cover"
                  />
                )}
              </div>
              <Input
                aria-label={`Legenda da foto ${index + 1}`}
                placeholder="Legenda (opcional)"
                maxLength={160}
                value={item.caption ?? ''}
                onChange={(event) =>
                  patch((c) => {
                    c.gallery[index].caption = event.target.value
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Tirar a foto ${index + 1} da galeria`}
                onClick={() => patch((c) => void c.gallery.splice(index, 1))}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
        <AssetPicker
          open={picking}
          onOpenChange={setPicking}
          title="Fotos da galeria"
          multiple
          onPick={(picked) =>
            patch((c) => {
              c.gallery.push(...picked.map((a) => ({ assetId: a.id, caption: null })))
              c.gallery.splice(MAX_GALLERY_ITEMS)
            })
          }
        />
      </section>

      <TextList
        title="Depoimentos"
        items={content.testimonials}
        max={MAX_TESTIMONIALS}
        empty="Nenhum depoimento."
        addLabel="Adicionar depoimento"
        onAdd={() => patch((c) => void c.testimonials.push({ author: '', text: '' }))}
        onRemove={(index) => patch((c) => void c.testimonials.splice(index, 1))}
        render={(item, index) => (
          <>
            <Input
              aria-label={`Quem disse (depoimento ${index + 1})`}
              placeholder="Quem disse"
              maxLength={80}
              value={item.author}
              onChange={(event) =>
                patch((c) => void (c.testimonials[index].author = event.target.value))
              }
            />
            <Textarea
              aria-label={`Depoimento ${index + 1}`}
              placeholder="O que disse"
              rows={2}
              maxLength={600}
              value={item.text}
              onChange={(event) =>
                patch((c) => void (c.testimonials[index].text = event.target.value))
              }
            />
          </>
        )}
      />

      <TextList
        title="Dúvidas frequentes"
        items={content.faq}
        max={MAX_FAQ_ITEMS}
        empty="Nenhuma pergunta."
        addLabel="Adicionar pergunta"
        onAdd={() => patch((c) => void c.faq.push({ question: '', answer: '' }))}
        onRemove={(index) => patch((c) => void c.faq.splice(index, 1))}
        render={(item, index) => (
          <>
            <Input
              aria-label={`Pergunta ${index + 1}`}
              placeholder="Pergunta"
              maxLength={200}
              value={item.question}
              onChange={(event) => patch((c) => void (c.faq[index].question = event.target.value))}
            />
            <Textarea
              aria-label={`Resposta ${index + 1}`}
              placeholder="Resposta"
              rows={2}
              maxLength={1500}
              value={item.answer}
              onChange={(event) => patch((c) => void (c.faq[index].answer = event.target.value))}
            />
          </>
        )}
      />
      <p className="text-muted-foreground text-xs">
        Itens incompletos (sem pergunta ou sem resposta, por exemplo) são descartados ao salvar.
      </p>
    </div>
  )
}

export function SeoFields({ content, patch }: { content: SiteContent; patch: PatchContent }) {
  return (
    <FieldGroup>
      <TextField
        id="site-seo-title"
        label="Título no Google e na aba do navegador"
        value={content.seo.title}
        onChange={(v) => patch((c) => void (c.seo.title = v))}
        maxLength={120}
        hint="Vazio: o nome da empresa e a frase de apresentação."
      />
      <TextField
        id="site-seo-description"
        label="Descrição no Google"
        value={content.seo.description}
        onChange={(v) => patch((c) => void (c.seo.description = v))}
        maxLength={300}
        multiline
        hint="Vazio: a frase de apresentação."
      />
    </FieldGroup>
  )
}
