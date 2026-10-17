import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Trash2, Upload } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/api/api-error'
import { cn } from '@/lib/utils'
import { siteKeys, sitesApi, useSiteAssets, type SiteAsset } from './api'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

/**
 * Imagens do site: escolher uma (ou várias, na galeria), enviar novas e
 * excluir as que o site não usa. As imagens ficam públicas assim que enviadas
 * (é o que a prévia mostra).
 */
export function AssetPicker({
  open,
  onOpenChange,
  title,
  multiple = false,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  multiple?: boolean
  onPick: (assets: SiteAsset[]) => void
}) {
  const queryClient = useQueryClient()
  const assets = useSiteAssets()
  const input = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<string[]>([])

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const sent: SiteAsset[] = []
      for (const file of files) sent.push(await sitesApi.upload(file))
      return sent
    },
    onSuccess: (sent) => {
      void queryClient.invalidateQueries({ queryKey: siteKeys.assets })
      setSelected((current) =>
        multiple ? [...current, ...sent.map((a) => a.id)] : sent.slice(-1).map((a) => a.id),
      )
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const remove = useMutation({
    mutationFn: sitesApi.removeAsset,
    onSuccess: (_, id) => {
      setSelected((current) => current.filter((s) => s !== id))
      void queryClient.invalidateQueries({ queryKey: siteKeys.assets })
      toast.success('Imagem excluída. Se o site no ar usava, publique de novo.')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    if (files.length) upload.mutate(files)
  }

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((s) => s !== id) : multiple ? [...current, id] : [id],
    )

  const confirm = () => {
    const byId = new Map((assets.data ?? []).map((a) => [a.id, a]))
    onPick(selected.flatMap((id) => byId.get(id) ?? []))
    setSelected([])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            JPEG, PNG, WebP ou GIF, até 5 MB. {multiple ? 'Escolha uma ou mais.' : 'Escolha uma.'}
          </DialogDescription>
        </DialogHeader>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple={multiple}
          className="hidden"
          aria-label="Arquivo de imagem"
          onChange={choose}
        />
        <div className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={upload.isPending}
            className="text-muted-foreground hover:bg-muted flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs"
          >
            <Upload className="size-5" />
            {upload.isPending ? 'Enviando…' : 'Enviar imagem'}
          </button>
          {assets.isPending &&
            [0, 1, 2].map((i) => <Skeleton key={i} className="aspect-square rounded-md" />)}
          {assets.data?.map((asset) => {
            const isSelected = selected.includes(asset.id)
            return (
              <div key={asset.id} className="group relative">
                <button
                  type="button"
                  onClick={() => toggle(asset.id)}
                  aria-pressed={isSelected}
                  aria-label={asset.fileName ?? 'Imagem'}
                  className={cn(
                    'bg-muted block aspect-square w-full overflow-hidden rounded-md border-2',
                    isSelected ? 'border-primary' : 'border-transparent',
                  )}
                >
                  {asset.url && (
                    <img src={asset.url} alt="" className="size-full object-cover" loading="lazy" />
                  )}
                </button>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute top-1 right-1 size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Excluir ${asset.fileName ?? 'imagem'}`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(asset.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            )
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={selected.length === 0}>
            <ImagePlus />
            {multiple && selected.length > 1 ? `Usar ${selected.length} imagens` : 'Usar imagem'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
