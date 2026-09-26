import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import type { PasswordHasher } from '../application/ports/password-hasher';

/**
 * Argon2id (padrão da biblioteca), recomendado pela OWASP para senhas.
 * O hash gerado já embute algoritmo, parâmetros e salt — trocar os
 * parâmetros no futuro não invalida hashes antigos.
 */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  hash(plain: string): Promise<string> {
    return hash(plain);
  }

  async verify(passwordHash: string, plain: string): Promise<boolean> {
    try {
      return await verify(passwordHash, plain);
    } catch {
      return false; // hash corrompido/em formato desconhecido
    }
  }
}
