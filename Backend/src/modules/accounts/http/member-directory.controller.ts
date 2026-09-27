import { Controller, Get } from '@nestjs/common';
import { ListMemberDirectoryUseCase } from '../application/use-cases/members/list-member-directory.use-case';

/**
 * Diretório de colegas (id do vínculo + nome). Sem permissão específica:
 * todo membro autenticado da conta vê os nomes dos colegas ativos.
 */
@Controller('v1/members/directory')
export class MemberDirectoryController {
  constructor(private readonly listDirectory: ListMemberDirectoryUseCase) {}

  @Get()
  list() {
    return this.listDirectory.execute();
  }
}
