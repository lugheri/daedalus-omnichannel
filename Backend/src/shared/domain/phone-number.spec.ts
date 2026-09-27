import { normalizePhoneNumber } from './phone-number';

describe('normalizePhoneNumber', () => {
  it.each([
    ['11987654321', '+5511987654321'],
    ['(11) 98765-4321', '+5511987654321'],
    ['1133334444', '+551133334444'],
    ['011 98765-4321', '+5511987654321'],
    ['01933334444', '+551933334444'],
    ['5511987654321', '+5511987654321'],
    ['55 (11) 98765-4321', '+5511987654321'],
    ['+55 (11) 98765-4321', '+5511987654321'],
    // DDD 55 (RS) sem código de país: continua nacional
    ['55987654321', '+5555987654321'],
    ['+1 (555) 123-4567', '+15551234567'],
    ['  +44 20 7946 0958 ', '+442079460958'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizePhoneNumber(raw)).toBe(expected);
  });

  it.each([
    '98765-4321', // sem DDD
    '00987654321', // DDD com zero
    '11887654321', // 11 dígitos sem o 9 de celular
    '15551234567', // outro país sem "+"
    '+0 123 4567',
    '+123',
    'abc',
    '',
  ])('rejects %s', (raw) => {
    expect(normalizePhoneNumber(raw)).toBeNull();
  });
});
