import { BadRequestException, PipeTransform } from '@nestjs/common';
import { z, type ZodType } from 'zod';

/**
 * Valida e transforma a entrada HTTP com um schema Zod.
 * Uso: `@Body(new ZodValidationPipe(createContactSchema)) body: CreateContactDto`
 *
 * Aqui se valida o FORMATO (tipos, tamanhos, campos obrigatórios).
 * Regras de NEGÓCIO (telefone válido, contato duplicado) ficam no domínio.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: z.prettifyError(result.error),
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}
