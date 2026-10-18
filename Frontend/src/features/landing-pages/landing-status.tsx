import { Badge } from '@/components/ui/badge'

export function LandingStatus({
  page,
}: {
  page: {
    isLive: boolean
    isTesting: boolean
    hasUnpublishedChanges: boolean
    pendingAction: 'publish' | 'unpublish' | null
  }
}) {
  if (page.pendingAction === 'publish') return <Badge variant="warning">Publicando…</Badge>
  if (page.pendingAction === 'unpublish') return <Badge variant="warning">Tirando do ar…</Badge>
  if (!page.isLive) return <Badge variant="secondary">Fora do ar</Badge>
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Badge variant={page.hasUnpublishedChanges ? 'warning' : 'success'}>
        {page.hasUnpublishedChanges ? 'No ar · alterações não publicadas' : 'No ar'}
      </Badge>
      {page.isTesting && <Badge variant="outline">Teste A/B</Badge>}
    </span>
  )
}
