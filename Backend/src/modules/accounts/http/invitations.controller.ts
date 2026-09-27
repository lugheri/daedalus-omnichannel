import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import { Public } from '../../../shared/http/public.decorator';
import { TrustedOriginGuard } from '../../../shared/http/trusted-origin.guard';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { AuthTokensPresenter, RefreshTokenCookie } from '../../identity';
import {
  AcceptInvitationUseCase,
  LookUpInvitationUseCase,
} from '../application/use-cases/invitations/accept-invitation.use-case';
import { InviteMemberUseCase } from '../application/use-cases/invitations/invite-member.use-case';
import {
  ListInvitationsUseCase,
  RevokeInvitationUseCase,
} from '../application/use-cases/invitations/manage-invitations.use-case';
import {
  acceptInvitationSchema,
  idParam,
  invitationTokenQuerySchema,
  inviteMemberSchema,
  type AcceptInvitationDto,
  type InvitationTokenQuery,
  type InviteMemberDto,
} from './dto/management.dto';
import { InvitationPresenter, RolePresenter } from './management.presenters';
import { RequirePermissions } from './require-permissions.decorator';
import { TenantPresenter } from './tenant.presenter';

/** Gestão de convites pela conta (exige members:manage). */
@RequirePermissions('members:manage')
@Controller('v1/invitations')
export class InvitationsController {
  constructor(
    private readonly inviteMember: InviteMemberUseCase,
    private readonly listInvitations: ListInvitationsUseCase,
    private readonly revokeInvitation: RevokeInvitationUseCase,
  ) {}

  @Post()
  async create(@Body(new ZodValidationPipe(inviteMemberSchema)) body: InviteMemberDto) {
    const { invitation, inviteUrl } = await this.inviteMember.execute(body);
    return { ...InvitationPresenter.toHttp(invitation), inviteUrl };
  }

  @Get()
  async list() {
    return (await this.listInvitations.execute()).map((i) => InvitationPresenter.toHttp(i));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Param('id', new ZodValidationPipe(idParam)) invitationId: string) {
    await this.revokeInvitation.execute(invitationId);
  }
}

/**
 * Lado do convidado: rotas públicas (quem tem o link não está logado).
 * O aceite já abre a sessão, com o refresh token no cookie.
 */
@Public()
@UseGuards(TrustedOriginGuard)
@Controller('v1/invitations')
export class InvitationAcceptanceController {
  constructor(
    private readonly lookUpInvitation: LookUpInvitationUseCase,
    private readonly acceptInvitation: AcceptInvitationUseCase,
    private readonly refreshTokenCookie: RefreshTokenCookie,
  ) {}

  @Get('lookup')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async lookUp(
    @Query(new ZodValidationPipe(invitationTokenQuerySchema)) query: InvitationTokenQuery,
  ) {
    const preview = await this.lookUpInvitation.execute(query.token);
    return {
      tenant: TenantPresenter.toHttp(preview.tenant),
      email: preview.email,
      role: RolePresenter.toSummary(preview.role),
      requiresSignup: preview.requiresSignup,
    };
  }

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000, blockDuration: 15 * 60_000 } })
  async accept(
    @Body(new ZodValidationPipe(acceptInvitationSchema)) body: AcceptInvitationDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const { tenant, tokens } = await this.acceptInvitation.execute(body);
    this.refreshTokenCookie.write(reply, tokens);
    return { tenant: TenantPresenter.toHttp(tenant), ...AuthTokensPresenter.toHttp(tokens) };
  }
}
