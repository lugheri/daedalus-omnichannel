import { isSmsOptOutReply } from './opt-out';
import { OutboundMessage } from './outbound-message.entity';

const compose = (channel: 'email' | 'sms', over: { subject?: string | null; body?: string } = {}) =>
  OutboundMessage.compose('m-1', {
    tenantId: 't',
    channel,
    contactId: 'c-1',
    to: channel === 'email' ? 'a@b.com' : '+5511987654321',
    subject: 'Assunto',
    body: 'Olá',
    sentByMembershipId: 'agent-1',
    campaignId: null,
    ...over,
  });

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
};

describe('OutboundMessage', () => {
  it('email needs a subject; SMS has none and at most 1600 characters', () => {
    expect(codeOf(() => compose('email', { subject: '  ' }))).toBe('MESSAGING_INVALID_SUBJECT');
    expect(compose('sms', { subject: 'ignorado' }).subject).toBeNull();
    expect(codeOf(() => compose('sms', { body: 'x'.repeat(1601) }))).toBe('MESSAGING_INVALID_BODY');
    expect(codeOf(() => compose('email', { body: '   ' }))).toBe('MESSAGING_INVALID_BODY');
    expect(compose('email').status).toBe('queued');
  });

  it('status only moves forward, whatever order the provider notices arrive in', () => {
    const m = compose('sms');
    m.markSent('SM1');
    expect(m.applyProviderStatus('delivered')).toBe(true);
    expect(m.applyProviderStatus('sent')).toBe(false); // atrasado
    expect(m.status).toBe('delivered');
    expect(m.deliveredAt).not.toBeNull();
    // Devolução tardia vale; depois dela, nada muda.
    expect(m.applyProviderStatus('bounced', 'Caixa inexistente')).toBe(true);
    expect(m.applyProviderStatus('delivered')).toBe(false);
    expect(m).toMatchObject({ status: 'bounced', error: 'Caixa inexistente', isFinal: true });
  });

  it('a retry keeps it queued with the reason; failing is final', () => {
    const m = compose('email');
    m.noteRetry('tempo esgotado');
    expect(m).toMatchObject({ status: 'queued', error: 'tempo esgotado' });
    m.markFailed('recusado');
    m.markSent('x');
    expect(m).toMatchObject({ status: 'failed', error: 'recusado', providerMessageId: null });
  });
});

describe('isSmsOptOutReply', () => {
  it.each(['SAIR', 'sair', ' Parar! ', 'STOP', 'Cancelar.', 'descadastrar'])(
    '"%s" opts out',
    (reply) => expect(isSmsOptOutReply(reply)).toBe(true),
  );
  it.each(['quero sair do plano', 'ok', 'Sair?', ''])('"%s" does not', (reply) =>
    expect(isSmsOptOutReply(reply)).toBe(false),
  );
});
