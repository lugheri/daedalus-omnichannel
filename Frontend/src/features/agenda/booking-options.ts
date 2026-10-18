/** Antecedência mínima para marcar pelo site (minutos; até 7 dias no backend). */
export const NOTICE_OPTIONS = [
  { value: 0, label: 'Nenhuma' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
  { value: 240, label: '4 horas' },
  { value: 720, label: '12 horas' },
  { value: 1440, label: '1 dia' },
  { value: 2880, label: '2 dias' },
] as const

/** Até quantos dias à frente o site mostra horários (até 180 no backend). */
export const WINDOW_OPTIONS = [
  { value: 7, label: '7 dias' },
  { value: 14, label: '14 dias' },
  { value: 30, label: '30 dias' },
  { value: 60, label: '60 dias' },
  { value: 90, label: '90 dias' },
  { value: 180, label: '180 dias' },
] as const

/** O lugar do widget e o script, para colar em qualquer site. */
export function bookingSnippet(apiUrl: string, publicKey: string): string {
  return [
    '<div data-omni-booking></div>',
    `<script src="${apiUrl}/v1/public/booking/widget.js" data-key="${publicKey}" async></script>`,
  ].join('\n')
}
