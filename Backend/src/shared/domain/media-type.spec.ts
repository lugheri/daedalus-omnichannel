import { mediaKindOf, servedMimeType } from './media-type';

describe('media types', () => {
  it.each([
    ['image/jpeg', 'image'],
    ['image/webp', 'image'],
    ['audio/ogg; codecs=opus', 'audio'],
    ['VIDEO/MP4', 'video'],
    ['application/pdf', 'document'],
    ['image/svg+xml', 'document'], // SVG pode ter script: nunca exibido
    ['text/html', 'document'],
  ])('%s → %s', (mime, kind) => {
    expect(mediaKindOf(mime)).toBe(kind);
  });

  it('serves only displayable types as themselves; everything else as binary', () => {
    expect(servedMimeType('audio/ogg; codecs=opus')).toBe('audio/ogg');
    expect(servedMimeType('text/html')).toBe('application/octet-stream');
    expect(servedMimeType('image/svg+xml')).toBe('application/octet-stream');
  });
});
