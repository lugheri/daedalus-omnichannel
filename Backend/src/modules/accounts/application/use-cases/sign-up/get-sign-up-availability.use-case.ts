import { Injectable } from '@nestjs/common';
import { isSignUpAccepted } from '../../../domain/sign-up-policy';
import { SignUpGate } from '../../sign-up-gate';

export interface SignUpAvailabilityResult {
  enabled: boolean;
}

/**
 * Consulta pública: o cadastro aceita conta nova agora? O front usa para
 * esconder o link e a tela. Devolve só o sim/não — o motivo (falta a raiz ou
 * está desligado) é assunto de quem opera, e aparece no erro do POST.
 */
@Injectable()
export class GetSignUpAvailabilityUseCase {
  constructor(private readonly gate: SignUpGate) {}

  async execute(): Promise<SignUpAvailabilityResult> {
    const { availability } = await this.gate.decide();
    return { enabled: isSignUpAccepted(availability) };
  }
}
