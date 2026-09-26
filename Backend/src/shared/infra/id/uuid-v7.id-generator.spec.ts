import { UuidV7IdGenerator } from './uuid-v7.id-generator';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('UuidV7IdGenerator', () => {
  const generator = new UuidV7IdGenerator();

  it('generates valid UUIDv7 strings', () => {
    expect(generator.generate()).toMatch(UUID_V7);
  });

  it('generates ids that sort by creation time', () => {
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00.000Z') });
    const first = generator.generate();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.001Z'));
    const second = generator.generate();
    jest.useRealTimers();

    expect(first < second).toBe(true);
  });
});
