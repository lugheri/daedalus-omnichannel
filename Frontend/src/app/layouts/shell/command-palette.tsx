import { useMemo, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { NavItem, NavModule } from '../../navigation'

interface Entry {
  item: NavItem
  /** "Módulo › Grupo", mostrado à direita. */
  path: string
}

const MAX_RESULTS = 9

/** Sem acento e minúsculo: "tabulacoes" acha "Tabulações". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Busca de telas em todos os módulos (Ctrl+K). Só lista o que a pessoa pode abrir. */
export function CommandPalette({
  modules,
  open,
  onOpenChange,
}: {
  modules: NavModule[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)

  const entries = useMemo<Entry[]>(
    () =>
      modules.flatMap((module) =>
        module.groups.flatMap((group) =>
          group.items.map((item) => ({
            item,
            path: [module.label, group.label].filter(Boolean).join(' › '),
          })),
        ),
      ),
    [modules],
  )

  const results = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return entries.slice(0, MAX_RESULTS)
    return entries
      .filter(({ item, path }) => normalize(item.label).includes(q) || normalize(path).includes(q))
      .slice(0, MAX_RESULTS)
  }, [entries, query])

  const close = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      setQuery('')
      setSelected(0)
    }
  }

  const go = (entry: Entry | undefined) => {
    if (!entry) return
    close(false)
    navigate(entry.item.to)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelected((s) => Math.min(s + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      go(results[selected])
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        showCloseButton={false}
        className="top-[68px] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Buscar tela</DialogTitle>
        <DialogDescription className="sr-only">
          Digite o nome de uma tela e tecle Enter para abrir.
        </DialogDescription>
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setSelected(0)
          }}
          onKeyDown={onKeyDown}
          placeholder={`Buscar entre as ${entries.length} telas…`}
          aria-label="Buscar tela"
          role="combobox"
          aria-expanded
          aria-controls="command-palette-results"
          aria-activedescendant={results[selected] ? `command-${selected}` : undefined}
          className="placeholder:text-faint border-b px-4 py-3.5 text-[15px] outline-none"
        />
        <div id="command-palette-results" role="listbox" className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <p className="text-faint p-5 text-center text-sm">Nenhuma tela com esse nome.</p>
          ) : (
            results.map((entry, index) => {
              const Icon = entry.item.icon
              return (
                <button
                  key={entry.item.to}
                  id={`command-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === selected}
                  onMouseMove={() => setSelected(index)}
                  onClick={() => go(entry)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm',
                    index === selected && 'bg-accent text-accent-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0 opacity-60" />
                  <span className="font-medium">{entry.item.label}</span>
                  <span className="text-faint ml-auto truncate text-xs">{entry.path}</span>
                </button>
              )
            })
          )}
        </div>
        <div className="text-faint flex gap-3 border-t px-3.5 py-2 text-[11px]">
          <span>
            <Kbd>↑↓</Kbd> navegar
          </span>
          <span>
            <Kbd>Enter</Kbd> abrir
          </span>
          <span>
            <Kbd>Esc</Kbd> fechar
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function Kbd({ children, className }: { children: string; className?: string }) {
  return (
    <kbd
      className={cn(
        'rounded border border-current/30 px-1 py-px font-mono text-[10.5px] opacity-80',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
