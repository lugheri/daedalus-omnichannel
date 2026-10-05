import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'
import { Link } from 'react-router'
import { itemsOf, type NavLocation } from '../../navigation'

/**
 * Onde a tela mora: Módulo › Grupo › Tela. Nome repetido não se repete
 * ("Campanhas › Campanhas" vira só "Campanhas"); a tela vira link quando
 * se está numa página dentro dela (ex.: o detalhe de uma campanha).
 */
export function Breadcrumbs({ location, pathname }: { location: NavLocation; pathname: string }) {
  const { module, group, item } = location
  const first = itemsOf(module)[0]

  const parts: { label: string; to?: string }[] = []
  if (module.label !== item.label) parts.push({ label: module.label, to: first?.to })
  if (group.label && group.label !== item.label) parts.push({ label: group.label })
  parts.push({ label: item.label, to: pathname === item.to ? undefined : item.to })

  return (
    <nav aria-label="Você está em" className="text-faint flex flex-wrap items-center gap-1 text-xs">
      {parts.map((part, index) => (
        <Fragment key={`${index}-${part.label}`}>
          {index > 0 && <ChevronRight className="size-3" />}
          {part.to && part.to !== pathname ? (
            <Link to={part.to} className="text-muted-foreground hover:text-foreground">
              {part.label}
            </Link>
          ) : (
            <span className={index === parts.length - 1 ? 'text-muted-foreground' : undefined}>
              {part.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}
