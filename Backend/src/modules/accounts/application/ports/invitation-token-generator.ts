/** Token aleatório do link de convite; no banco fica só o hash (como no refresh token). */
export interface InvitationTokenGenerator {
  generate(): { token: string; hash: string };
  hash(token: string): string;
}

export const INVITATION_TOKEN_GENERATOR = Symbol('InvitationTokenGenerator');
