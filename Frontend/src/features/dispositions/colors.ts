import type { DispositionColor } from './api'

/** Classes literais (o Tailwind só gera as que aparecem inteiras no código). */
export const DISPOSITION_STYLES: Record<
  DispositionColor,
  { label: string; badge: string; swatch: string }
> = {
  gray: {
    label: 'Cinza',
    badge:
      'border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100',
    swatch: 'bg-zinc-400',
  },
  red: {
    label: 'Vermelho',
    badge:
      'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
    swatch: 'bg-red-500',
  },
  orange: {
    label: 'Laranja',
    badge:
      'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200',
    swatch: 'bg-orange-500',
  },
  yellow: {
    label: 'Amarelo',
    badge:
      'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200',
    swatch: 'bg-yellow-400',
  },
  green: {
    label: 'Verde',
    badge:
      'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200',
    swatch: 'bg-green-500',
  },
  teal: {
    label: 'Verde-água',
    badge:
      'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200',
    swatch: 'bg-teal-500',
  },
  blue: {
    label: 'Azul',
    badge:
      'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200',
    swatch: 'bg-blue-500',
  },
  purple: {
    label: 'Roxo',
    badge:
      'border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-200',
    swatch: 'bg-purple-500',
  },
  pink: {
    label: 'Rosa',
    badge:
      'border-pink-200 bg-pink-50 text-pink-800 dark:border-pink-800 dark:bg-pink-950 dark:text-pink-200',
    swatch: 'bg-pink-500',
  },
}
