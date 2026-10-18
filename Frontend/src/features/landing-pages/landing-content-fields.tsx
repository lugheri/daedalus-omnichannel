import { ImagePlus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useSiteAssets } from '@/features/sites/api'
import { AssetPicker } from '@/features/sites/asset-picker'
import { TextField, TextList } from '@/features/sites/site-content-fields'
import { MAX_BENEFITS, MAX_FAQ, MAX_TESTIMONIALS, type LandingContent } from './api'

export type PatchLanding = (change: (content: LandingContent) => void) => void

function HeroImage({ content, patch }: { content: LandingContent; patch: PatchLanding }) {
  const assets = useSiteAssets()
  const [picking, setPicking] = useState(false)
  const url = useMemo(
    () => assets.data?.find((a) => a.id === content.heroImageAssetId)?.url ?? null,
    [assets.data, content.heroImageAssetId],
  )
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Imagem da capa</span>
      <div className="flex items-center gap-3">
        <div className="bg-muted flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded border text-xs">
          {url ? (
            <img src={url} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-muted-foreground px-1 text-center">A capa do site</span>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
          <ImagePlus />
          Escolher
        </Button>
        {content.heroImageAssetId && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => patch((c) => void (c.heroImageAssetId = null))}
          >
            <X />
            Usar a do site
          </Button>
        )}
      </div>
      <AssetPicker
        open={picking}
        onOpenChange={setPicking}
        title="Imagem da capa"
        onPick={([asset]) => asset && patch((c) => void (c.heroImageAssetId = asset.id))}
      />
    </div>
  )
}

/** O conteúdo de uma variante, em abas. Os dados da empresa vêm do site da conta. */
export function LandingContentFields({
  content,
  patch,
  idPrefix,
}: {
  content: LandingContent
  patch: PatchLanding
  /** Para os ids dos campos não repetirem entre variantes. */
  idPrefix: string
}) {
  const id = (name: string) => `${idPrefix}-${name}`
  return (
    <Tabs defaultValue="hero" className="min-w-0">
      <TabsList className="max-w-full justify-start overflow-x-auto">
        <TabsTrigger value="hero">Capa</TabsTrigger>
        <TabsTrigger value="text">Texto</TabsTrigger>
        <TabsTrigger value="offer">Oferta</TabsTrigger>
        <TabsTrigger value="proof">Prova social</TabsTrigger>
        <TabsTrigger value="form">Formulário e SEO</TabsTrigger>
      </TabsList>

      <TabsContent value="hero" className="pt-2">
        <FieldGroup>
          <TextField
            id={id('title')}
            label="Chamada principal"
            value={content.hero.title}
            maxLength={160}
            onChange={(v) => patch((c) => void (c.hero.title = v))}
            hint="O que a pessoa ganha, em uma frase. Vazio: o nome da empresa."
          />
          <TextField
            id={id('subtitle')}
            label="Subtítulo"
            value={content.hero.subtitle}
            maxLength={300}
            multiline
            onChange={(v) => patch((c) => void (c.hero.subtitle = v))}
          />
          <TextField
            id={id('cta')}
            label="Texto do botão"
            value={content.hero.ctaLabel}
            maxLength={40}
            placeholder="Quero aproveitar"
            onChange={(v) => patch((c) => void (c.hero.ctaLabel = v))}
            hint="O botão leva ao formulário (ou ao WhatsApp, se a página não tiver formulário)."
          />
          <HeroImage content={content} patch={patch} />
        </FieldGroup>
      </TabsContent>

      <TabsContent value="text" className="flex flex-col gap-6 pt-2">
        <TextField
          id={id('intro')}
          label="Texto principal"
          value={content.intro}
          maxLength={4000}
          multiline
          onChange={(v) => patch((c) => void (c.intro = v))}
          hint="Uma linha em branco separa os parágrafos."
        />
        <TextList
          title="Benefícios"
          items={content.benefits}
          max={MAX_BENEFITS}
          empty="Nenhum benefício."
          addLabel="Adicionar benefício"
          onAdd={() => patch((c) => void c.benefits.push({ title: '', text: null }))}
          onRemove={(index) => patch((c) => void c.benefits.splice(index, 1))}
          render={(item, index) => (
            <>
              <Input
                aria-label={`Benefício ${index + 1}`}
                placeholder="Benefício"
                maxLength={120}
                value={item.title}
                onChange={(event) =>
                  patch((c) => void (c.benefits[index].title = event.target.value))
                }
              />
              <Input
                aria-label={`Detalhe do benefício ${index + 1}`}
                placeholder="Detalhe (opcional)"
                maxLength={400}
                value={item.text ?? ''}
                onChange={(event) =>
                  patch((c) => void (c.benefits[index].text = event.target.value))
                }
              />
            </>
          )}
        />
      </TabsContent>

      <TabsContent value="offer" className="pt-2">
        <FieldGroup>
          <TextField
            id={id('offer-title')}
            label="Nome da oferta"
            value={content.offer.title}
            maxLength={120}
            placeholder="Corte + barba"
            onChange={(v) => patch((c) => void (c.offer.title = v))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id={id('offer-price')}
              label="Preço"
              value={content.offer.price}
              maxLength={40}
              placeholder="R$ 49,00"
              onChange={(v) => patch((c) => void (c.offer.price = v))}
            />
            <TextField
              id={id('offer-old')}
              label="Preço “de” (riscado)"
              value={content.offer.oldPrice}
              maxLength={40}
              placeholder="R$ 70,00"
              onChange={(v) => patch((c) => void (c.offer.oldPrice = v))}
            />
          </div>
          <TextField
            id={id('offer-note')}
            label="Observação"
            value={content.offer.note}
            maxLength={200}
            placeholder="Válido até domingo"
            onChange={(v) => patch((c) => void (c.offer.note = v))}
            hint="Sem nome nem preço, a seção da oferta não aparece."
          />
        </FieldGroup>
      </TabsContent>

      <TabsContent value="proof" className="flex flex-col gap-6 pt-2">
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
          max={MAX_FAQ}
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
                onChange={(event) =>
                  patch((c) => void (c.faq[index].question = event.target.value))
                }
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
          Itens incompletos são descartados ao salvar.
        </p>
      </TabsContent>

      <TabsContent value="form" className="pt-2">
        <FieldGroup>
          <TextField
            id={id('form-title')}
            label="Título da seção do formulário"
            value={content.formTitle}
            maxLength={120}
            placeholder="Fale com a gente"
            onChange={(v) => patch((c) => void (c.formTitle = v))}
          />
          <TextField
            id={id('seo-title')}
            label="Título no Google e na aba do navegador"
            value={content.seo.title}
            maxLength={120}
            onChange={(v) => patch((c) => void (c.seo.title = v))}
            hint="Vazio: a chamada principal."
          />
          <TextField
            id={id('seo-description')}
            label="Descrição no Google"
            value={content.seo.description}
            maxLength={300}
            multiline
            onChange={(v) => patch((c) => void (c.seo.description = v))}
            hint="Vazio: o subtítulo."
          />
        </FieldGroup>
      </TabsContent>
    </Tabs>
  )
}
