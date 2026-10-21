import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import type { TemporaryPasswordGenerator } from '../application/ports/temporary-password-generator';

/**
 * Sem caracteres que se confundem ao ditar ou copiar de um terminal
 * (0/O, 1/l/I) nem símbolos que o shell ou o chat estragam: a senha passa de
 * mão em mão até a pessoa.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const LENGTH = 20;

/**
 * 20 caracteres de 57 possíveis ≈ 116 bits, sorteados com `randomInt` (CSPRNG,
 * sem viés de módulo). Cabe nas regras do `Password` (8 a 128).
 */
@Injectable()
export class CryptoTemporaryPasswordGenerator implements TemporaryPasswordGenerator {
  generate(): string {
    let password = '';
    for (let i = 0; i < LENGTH; i++) password += ALPHABET[randomInt(ALPHABET.length)];
    return password;
  }
}
