import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Globe, MoreHorizontal, Pencil, Plus, Power, PowerOff, Trash2 } from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { errorMessage } from '@/lib/api/api-error'
import { catalogApi, catalogKeys, useProfessionals, useServices, type Service } from './api'
import { formatDuration, formatPrice } from './format'
import { ServiceDialog } from './service-dialog'

export function ServicesPage() {
  const queryClient = useQueryClient()
  const services = useServices()
  const professionals = useProfessionals()
  const [editing, setEditing] = useState<Service | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Service | null>(null)
  // Ativos primeiro; dentro de cada grupo, por nome (a API já ordena).
  const items = [...(services.data ?? [])].sort((a, b) => Number(b.active) - Number(a.active))
  const doneBy = (serviceId: string) =>
    professionals.data?.filter((p) => p.serviceIds.includes(serviceId)).length ?? 0

  const refresh = () => queryClient.invalidateQueries({ queryKey: catalogKeys.all })

  const toggle = useMutation({
    mutationFn: (s: Service) => catalogApi.updateService(s.id, { active: !s.active }),
    onSuccess: (s) => {
      toast.success(s.active ? 'Serviço reativado.' : 'Serviço desativado.')
      void refresh()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const remove = useMutation({
    mutationFn: (s: Service) => catalogApi.removeService(s.id),
    onSuccess: () => {
      toast.success('Serviço excluído.')
      void refresh()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <>
      <PageHeader
        title="Serviços"
        description="O que o seu negócio oferece, com duração e preço. Base da agenda e do site."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus />
            Novo serviço
          </Button>
        }
      />

      <div className="bg-card rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serviço</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead className="hidden sm:table-cell">Profissionais</TableHead>
              <TableHead className="hidden sm:table-cell">Situação</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.isPending && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Skeleton className="h-8" />
                </TableCell>
              </TableRow>
            )}
            {items.length === 0 && !services.isPending && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                  Nenhum serviço ainda. Cadastre o que você oferece para usar na agenda e no site.
                </TableCell>
              </TableRow>
            )}
            {items.map((service) => (
              <TableRow key={service.id} className={service.active ? '' : 'opacity-60'}>
                <TableCell>
                  <div className="flex items-center gap-1.5 font-medium">
                    {service.name}
                    {service.showOnSite && service.active && (
                      <span role="img" aria-label="Aparece no site" title="Aparece no site">
                        <Globe className="text-faint size-3.5" />
                      </span>
                    )}
                  </div>
                  {service.description && (
                    <p className="text-muted-foreground line-clamp-1 max-w-md text-xs">
                      {service.description}
                    </p>
                  )}
                </TableCell>
                <TableCell>{formatDuration(service.durationMinutes)}</TableCell>
                <TableCell className={service.priceCents === null ? 'text-muted-foreground' : ''}>
                  {formatPrice(service.priceCents)}
                </TableCell>
                <TableCell className="text-muted-foreground hidden sm:table-cell">
                  {doneBy(service.id) || '—'}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant={service.active ? 'success' : 'outline'}>
                    {service.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Ações de ${service.name}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(service)}>
                        <Pencil />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => toggle.mutate(service)}>
                        {service.active ? <PowerOff /> : <Power />}
                        {service.active ? 'Desativar' : 'Reativar'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(service)}>
                        <Trash2 />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editing !== null && (
        <ServiceDialog
          key={editing === 'new' ? 'new' : editing.id}
          open
          service={editing === 'new' ? undefined : editing}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o serviço {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ele sai da lista de quem o faz. Se for só uma pausa (ex.: fora de temporada),
              desative: ele sai das opções e pode voltar depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleting && remove.mutate(deleting)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
