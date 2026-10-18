import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

/** Espelho de `APPOINTMENT_STATUSES` do backend. */
export type AppointmentStatus = 'scheduled' | 'completed' | 'no_show' | 'canceled'

/** Faixa do dia em minutos desde a meia-noite (no fuso da agenda). */
export interface TimeRange {
  start: number
  end: number
}

/** 7 dias, domingo = 0. */
export type WeeklyHours = TimeRange[][]

export interface Appointment {
  id: string
  professionalId: string
  serviceId: string
  /** Nome e preço na hora da marcação (mudar o catálogo não muda o histórico). */
  serviceName: string
  priceCents: number | null
  contactId: string
  startsAt: string
  endsAt: string
  status: AppointmentStatus
  /** `site` = agendado pelo visitante no site. */
  source: 'panel' | 'site'
  notes: string | null
  cancelReason: string | null
  createdAt: string
}

export interface DayAppointment extends Appointment {
  contact: { id: string; name: string | null; phone: string | null }
}

export interface TimeOff {
  id: string
  professionalId: string
  startsAt: string
  endsAt: string
  reason: string | null
}

export interface AgendaService {
  id: string
  name: string
  durationMinutes: number
  priceCents: number | null
  showOnSite: boolean
  active: boolean
}

export interface AgendaProfessional {
  id: string
  name: string
  offeringIds: string[]
  showOnSite: boolean
  active: boolean
  /** O horário do profissional neste dia. */
  hours: TimeRange[]
}

export interface AgendaDay {
  date: string
  timezone: string
  professionals: AgendaProfessional[]
  services: AgendaService[]
  appointments: DayAppointment[]
  timeOffs: TimeOff[]
}

export interface FreeSlot {
  startsAt: string
  professionalIds: string[]
}

export interface ProfessionalSchedule {
  weekly: WeeklyHours
  /** Nunca configurado: vale o horário padrão. */
  isDefault: boolean
  timezone: string
  /** Bloqueios dos próximos meses. */
  timeOffs: TimeOff[]
}

export interface BookingSettings {
  enabled: boolean
  timezone: string
  slotStepMinutes: number
  minNoticeMinutes: number
  maxDaysAhead: number
  /** A chave do widget; null enquanto a configuração nunca foi gravada. */
  publicKey: string | null
}

export interface NewAppointment {
  professionalId: string
  serviceId: string
  contactId: string
  startsAt: string
  notes: string | null
}

export const agendaApi = {
  day: (date: string) => api<AgendaDay>(`/v1/agenda/day?date=${date}`),
  slots: (query: { serviceId: string; professionalId: string | null; date: string }) => {
    const params = new URLSearchParams({ serviceId: query.serviceId, date: query.date })
    if (query.professionalId) params.set('professionalId', query.professionalId)
    return api<FreeSlot[]>(`/v1/agenda/slots?${params}`)
  },
  book: (input: NewAppointment) =>
    api<Appointment>('/v1/agenda/appointments', { method: 'POST', body: input }),
  update: (
    id: string,
    input: { startsAt?: string; professionalId?: string; notes?: string | null },
  ) => api<Appointment>(`/v1/agenda/appointments/${id}`, { method: 'PATCH', body: input }),
  setStatus: (id: string, status: AppointmentStatus, reason: string | null = null) =>
    api<Appointment>(`/v1/agenda/appointments/${id}/status`, {
      method: 'POST',
      body: { status, reason },
    }),
  byContact: (contactId: string) =>
    api<Appointment[]>(`/v1/agenda/contacts/${contactId}/appointments`),

  schedule: (professionalId: string) =>
    api<ProfessionalSchedule>(`/v1/agenda/professionals/${professionalId}/schedule`),
  saveSchedule: (professionalId: string, weekly: WeeklyHours) =>
    api<{ weekly: WeeklyHours }>(`/v1/agenda/professionals/${professionalId}/schedule`, {
      method: 'PUT',
      body: { weekly },
    }),
  addTimeOff: (
    professionalId: string,
    input: { startsAt: string; endsAt: string; reason: string | null },
  ) =>
    api<TimeOff>(`/v1/agenda/professionals/${professionalId}/time-offs`, {
      method: 'POST',
      body: input,
    }),
  removeTimeOff: (id: string) => api<void>(`/v1/agenda/time-offs/${id}`, { method: 'DELETE' }),

  settings: () => api<BookingSettings>('/v1/agenda/settings'),
  saveSettings: (input: Partial<Omit<BookingSettings, 'publicKey'>> & { rotateKey?: boolean }) =>
    api<BookingSettings>('/v1/agenda/settings', { method: 'PATCH', body: input }),
}

export const agendaKeys = {
  all: ['agenda'] as const,
  day: (date: string) => ['agenda', 'day', date] as const,
  slots: (serviceId: string, professionalId: string | null, date: string) =>
    ['agenda', 'slots', serviceId, professionalId, date] as const,
  contact: (contactId: string) => ['agenda', 'contact', contactId] as const,
  schedule: (professionalId: string) => ['agenda', 'schedule', professionalId] as const,
  settings: ['agenda', 'settings'] as const,
}

export function useAgendaDay(date: string) {
  return useQuery({ queryKey: agendaKeys.day(date), queryFn: () => agendaApi.day(date) })
}

export function useBookingSettings(enabled = true) {
  return useQuery({ queryKey: agendaKeys.settings, queryFn: agendaApi.settings, enabled })
}

export function useProfessionalSchedule(professionalId: string) {
  return useQuery({
    queryKey: agendaKeys.schedule(professionalId),
    queryFn: () => agendaApi.schedule(professionalId),
  })
}

export function useContactAppointments(contactId: string, enabled: boolean) {
  return useQuery({
    queryKey: agendaKeys.contact(contactId),
    queryFn: () => agendaApi.byContact(contactId),
    enabled,
  })
}
