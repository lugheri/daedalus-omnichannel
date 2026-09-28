import type { WAMessage } from 'baileys';
import { jidOf, normalizeMessage, phoneOf } from './message-normalizer';

const PHONE_JID = '5511987654321@s.whatsapp.net';

function message(overrides: Partial<WAMessage> & { message?: WAMessage['message'] }): WAMessage {
  return {
    key: { id: 'WA-1', remoteJid: PHONE_JID, fromMe: false },
    messageTimestamp: 1_900_000_000,
    pushName: 'Cliente',
    message: { conversation: 'Oi!' },
    ...overrides,
  };
}

describe('normalizeMessage', () => {
  it('normalizes a plain text message from a contact', () => {
    expect(normalizeMessage(message({}))).toEqual({
      externalId: 'WA-1',
      contactJid: PHONE_JID,
      contactPhone: '+5511987654321',
      contactName: 'Cliente',
      fromMe: false,
      kind: 'text',
      text: 'Oi!',
      sentAt: new Date(1_900_000_000 * 1000).toISOString(),
      attachment: null,
    });
  });

  it('reads the text of extended (formatted/quoted) messages', () => {
    const result = normalizeMessage(
      message({ message: { extendedTextMessage: { text: 'respondendo *você*' } } }),
    );
    expect(result).toMatchObject({ kind: 'text', text: 'respondendo *você*' });
  });

  it('keeps the caption of media and flags the kind', () => {
    const result = normalizeMessage(
      message({ message: { imageMessage: { caption: 'comprovante' } } }),
    );
    expect(result).toMatchObject({ kind: 'image', text: 'comprovante' });
  });

  it('describes the attached file (type, name, declared size) without downloading it', () => {
    const result = normalizeMessage(
      message({
        message: {
          documentMessage: {
            mimetype: 'application/pdf',
            fileName: 'orcamento.pdf',
            fileLength: 20480,
            caption: 'segue',
          },
        },
      }),
    );
    expect(result).toMatchObject({
      kind: 'document',
      text: 'segue',
      attachment: { mimeType: 'application/pdf', fileName: 'orcamento.pdf', declaredSize: 20480 },
    });
  });

  it('unwraps disappearing (ephemeral) messages', () => {
    const result = normalizeMessage(
      message({ message: { ephemeralMessage: { message: { conversation: 'some em 24h' } } } }),
    );
    expect(result).toMatchObject({ kind: 'text', text: 'some em 24h' });
  });

  it('marks messages sent from the connected phone, without a contact name', () => {
    const result = normalizeMessage(
      message({ key: { id: 'WA-2', remoteJid: PHONE_JID, fromMe: true } }),
    );
    expect(result).toMatchObject({ fromMe: true, contactName: null });
  });

  it('uses the alternate phone JID when the chat is addressed by LID', () => {
    const result = normalizeMessage(
      message({
        key: {
          id: 'WA-3',
          remoteJid: '123456789012345@lid',
          remoteJidAlt: PHONE_JID,
          fromMe: false,
        },
      }),
    );
    expect(result).toMatchObject({
      contactJid: '123456789012345@lid',
      contactPhone: '+5511987654321',
    });
  });

  it.each([
    ['groups', { key: { id: 'x', remoteJid: '1203630@g.us', fromMe: false } }],
    ['status updates', { key: { id: 'x', remoteJid: 'status@broadcast', fromMe: false } }],
    ['newsletters', { key: { id: 'x', remoteJid: '1203@newsletter', fromMe: false } }],
    ['reactions', { message: { reactionMessage: { text: '👍' } } }],
    ['protocol messages (edits, deletions)', { message: { protocolMessage: { type: 0 } } }],
    ['empty messages', { message: undefined }],
  ])('ignores %s', (_, overrides) => {
    expect(normalizeMessage(message(overrides as Partial<WAMessage>))).toBeNull();
  });

  it('flags content types it does not understand yet', () => {
    const result = normalizeMessage(
      message({ message: { pollCreationMessage: { name: 'Enquete' } } }),
    );
    expect(result).toMatchObject({ kind: 'unsupported', text: null });
  });
});

describe('phone helpers', () => {
  it('extracts E.164 only from phone JIDs', () => {
    expect(phoneOf(PHONE_JID)).toBe('+5511987654321');
    expect(phoneOf('123@lid')).toBeNull();
    expect(phoneOf(undefined)).toBeNull();
  });

  it('builds the JID to send to', () => {
    expect(jidOf('+5511987654321')).toBe(PHONE_JID);
  });
});
