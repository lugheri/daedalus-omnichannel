import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

/**
 * Alterna entre claro e escuro num clique. "Do sistema" continua no menu do
 * usuário; aqui vale o tema que está na tela (`resolvedTheme`).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === 'dark'
  const label = dark ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      title={label}
      aria-label={label}
      className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', className)}
    >
      {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  )
}
