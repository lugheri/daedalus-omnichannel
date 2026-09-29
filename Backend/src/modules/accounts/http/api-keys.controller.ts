import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import {
  CreateApiKeyUseCase,
  ListApiKeysUseCase,
  RevokeApiKeyUseCase,
} from '../application/use-cases/api-keys/api-keys.use-cases';
import type { ApiKey } from '../domain/api-key.entity';
import { RequirePermissions } from './require-permissions.decorator';

const createApiKeySchema = z.object({ name: z.string().max(200) });
type CreateApiKeyDto = z.infer<typeof createApiKeySchema>;

/** O segredo NUNCA sai daqui — só o `hint` (início) para reconhecer a chave. */
const present = (key: ApiKey) => ({
  id: key.id,
  name: key.name,
  hint: key.hint,
  active: key.isActive,
  createdByMembershipId: key.createdByMembershipId,
  createdAt: key.createdAt.toISOString(),
  lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
  revokedAt: key.revokedAt?.toISOString() ?? null,
});

@RequirePermissions('integrations:manage')
@Controller('v1/api-keys')
export class ApiKeysController {
  constructor(
    private readonly listKeys: ListApiKeysUseCase,
    private readonly createKey: CreateApiKeyUseCase,
    private readonly revokeKey: RevokeApiKeyUseCase,
  ) {}

  @Get()
  async list() {
    return (await this.listKeys.execute()).map(present);
  }

  /** A resposta traz `key` completa: é a única vez — o cliente precisa copiar agora. */
  @Post()
  async create(@Body(new ZodValidationPipe(createApiKeySchema)) body: CreateApiKeyDto) {
    const { key, plainKey } = await this.createKey.execute(body);
    return { ...present(key), key: plainKey };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Param('id', new ZodValidationPipe(z.uuid())) id: string) {
    await this.revokeKey.execute(id);
  }
}
