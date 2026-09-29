import { z } from 'zod';
import { CONVERSATION_STATUSES } from '../../domain/conversation.entity';
import { DISPOSITION_COLORS } from '../../domain/disposition.entity';

const status = z.enum(CONVERSATION_STATUSES as [string, ...string[]]);

export const listConversationsQuerySchema = z.object({
  status: status.optional(),
  /** Recorte: só as minhas, ou só as sem responsável. */
  assignee: z.enum(['me', 'none']).optional(),
  /** Histórico de um contato (todas as conversas dele no meu escopo). */
  contactId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  /** Opaco: repasse o `nextCursor` da página anterior. */
  cursor: z.string().max(200).optional(),
});
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;

export const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(200).optional(),
});
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;

/** Só o formato; tamanho e texto vazio são regra do domínio. */
export const sendMessageSchema = z.object({ text: z.string().max(10_000) });
export type SendMessageDto = z.infer<typeof sendMessageSchema>;

/** Tabulação: o tamanho da observação é regra do domínio. */
export const tabulateSchema = z.object({
  dispositionId: z.uuid(),
  note: z.string().max(5000).nullish(),
});
export type TabulateDto = z.infer<typeof tabulateSchema>;

/** Ao resolver, a tabulação pode vir junto (`disposition`). */
export const changeStatusSchema = z.object({ status, disposition: tabulateSchema.optional() });
export type ChangeStatusDto = z.infer<typeof changeStatusSchema>;

/** Campo ausente = não muda; null = tira (fila geral / sem responsável). */
export const transferSchema = z
  .object({ teamId: z.uuid().nullable().optional(), assigneeId: z.uuid().nullable().optional() })
  .refine((v) => v.teamId !== undefined || v.assigneeId !== undefined, {
    message: 'Informe a equipe e/ou o responsável',
  });
export type TransferDto = z.infer<typeof transferSchema>;

const dispositionColor = z.enum(DISPOSITION_COLORS);

export const createDispositionSchema = z.object({
  name: z.string().max(200),
  color: dispositionColor,
});
export type CreateDispositionDto = z.infer<typeof createDispositionSchema>;

/** Campo ausente = não muda. */
export const updateDispositionSchema = z
  .object({
    name: z.string().max(200).optional(),
    color: dispositionColor.optional(),
    archived: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((field) => field !== undefined), {
    message: 'Nada para alterar',
  });
export type UpdateDispositionDto = z.infer<typeof updateDispositionSchema>;
