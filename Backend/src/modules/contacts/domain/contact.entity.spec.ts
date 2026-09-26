import { Contact } from './contact.entity';
import { ContactWithoutIdentifierError } from './errors/contact-without-identifier.error';
import { InvalidEmailError } from './errors/invalid-email.error';
import { InvalidPhoneError } from './errors/invalid-phone.error';
import { ContactCreatedEvent } from './events/contact-created.event';

describe('Contact', () => {
  const tenantId = 'tenant-1';

  it('normalizes phone and email', () => {
    const contact = Contact.create('contact-1', {
      tenantId,
      phone: '+55 (11) 98765-4321',
      email: '  Maria@Example.COM ',
    });

    expect(contact.phone?.value).toBe('+5511987654321');
    expect(contact.email?.value).toBe('maria@example.com');
  });

  it('turns a blank name into null', () => {
    const contact = Contact.create('contact-1', { tenantId, name: '   ', phone: '+5511987654321' });

    expect(contact.name).toBeNull();
  });

  it('requires at least a phone or an email', () => {
    expect(() => Contact.create('contact-1', { tenantId, name: 'Maria' })).toThrow(
      ContactWithoutIdentifierError,
    );
  });

  it('rejects an invalid phone', () => {
    expect(() => Contact.create('contact-1', { tenantId, phone: '98765-4321' })).toThrow(
      InvalidPhoneError,
    );
  });

  it('rejects an invalid email', () => {
    expect(() => Contact.create('contact-1', { tenantId, email: 'maria@' })).toThrow(
      InvalidEmailError,
    );
  });

  it('emits ContactCreatedEvent once on creation', () => {
    const contact = Contact.create('contact-1', { tenantId, phone: '+5511987654321' });

    const events = contact.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ContactCreatedEvent);
    expect(contact.pullEvents()).toHaveLength(0);
  });

  it('does not emit events when restored from persistence', () => {
    const original = Contact.create('contact-1', { tenantId, phone: '+5511987654321' });
    const restored = Contact.restore('contact-1', {
      tenantId,
      name: null,
      phone: original.phone,
      email: null,
      createdAt: original.createdAt,
    });

    expect(restored.pullEvents()).toHaveLength(0);
    expect(restored.equals(original)).toBe(true);
  });
});
