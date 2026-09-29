import { composeEmail } from './email-composer';

describe('composeEmail', () => {
  it('escapes the text for HTML, adds the footer and the one-click unsubscribe headers', () => {
    const email = composeEmail({
      to: 'a@b.com',
      subject: 'Oi',
      body: 'Linha 1\n<script>alert(1)</script>',
      senderName: 'Loja & Cia',
      unsubscribeUrl: 'https://api.x/v1/public/unsubscribe/tok',
      messageId: 'm-1',
    });
    expect(email.html).toContain('Linha 1<br>&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(email.html).toContain('Loja &amp; Cia');
    expect(email.html).not.toContain('<script>');
    expect(email.text).toContain('Descadastre-se: https://api.x/v1/public/unsubscribe/tok');
    expect(email.headers).toEqual({
      'List-Unsubscribe': '<https://api.x/v1/public/unsubscribe/tok>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
    expect(email.customArgs).toEqual({ omni_message_id: 'm-1' });
  });
});
