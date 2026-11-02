import { primoLink, segmentaTesto } from './link-utils';

describe('segmentaTesto', () => {
  it('returns no segments for an empty text', () => {
    expect(segmentaTesto('')).toEqual([]);
  });

  it('keeps a text without links as a single text segment, line breaks included', () => {
    expect(segmentaTesto('Caldarroste\ne vino novello')).toEqual([{ tipo: 'testo', testo: 'Caldarroste\ne vino novello' }]);
  });

  it('turns an address into a link named after the site, without "www."', () => {
    const segmenti = segmentaTesto('Il programma è disponibile qui: https://www.comune.venegonoinferiore.va.it/it/eventi/halloween-730876');

    expect(segmenti).toHaveLength(2);
    expect(segmenti[0]).toEqual({ tipo: 'testo', testo: 'Il programma è disponibile qui: ' });
    expect(segmenti[1]).toMatchObject({
      tipo: 'link',
      host: 'comune.venegonoinferiore.va.it',
      url: 'https://www.comune.venegonoinferiore.va.it/it/eventi/halloween-730876',
    });
  });

  it('finds several links and keeps the text between them', () => {
    const segmenti = segmentaTesto('Vedi https://a.example/x e anche http://b.example/y per altro');

    expect(segmenti.map((s) => s.tipo)).toEqual(['testo', 'link', 'testo', 'link', 'testo']);
    expect(segmenti.filter((s) => s.tipo === 'link').map((s) => (s as { host: string }).host)).toEqual(['a.example', 'b.example']);
  });

  it('leaves trailing punctuation out of the link', () => {
    const segmenti = segmentaTesto('Info su (https://a.example/x), poi https://b.example/y.');

    expect(segmenti.filter((s) => s.tipo === 'link').map((s) => (s as { url: string }).url)).toEqual(['https://a.example/x', 'https://b.example/y']);
    expect(segmenti.at(-1)).toEqual({ tipo: 'testo', testo: '.' });
  });

  it('does not turn other schemes into links', () => {
    for (const testo of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'mailto:a@b.it', 'ftp://a.example/x', 'file:///etc/passwd']) {
      expect(segmentaTesto(testo)).toEqual([{ tipo: 'testo', testo }]);
    }
  });

  it('does not link an address that hides a scheme inside the text', () => {
    expect(primoLink(segmentaTesto('javascript:alert(1)//https'))).toBeUndefined();
  });

  it('does not link addresses with credentials', () => {
    const testo = 'https://utente:segreto@a.example/x';
    expect(segmentaTesto(testo)).toEqual([{ tipo: 'testo', testo }]);
  });

  it('does not link an address longer than 2000 characters', () => {
    const testo = `https://a.example/${'x'.repeat(2000)}`;
    expect(segmentaTesto(testo)).toEqual([{ tipo: 'testo', testo }]);
  });

  it('does not link a broken address', () => {
    expect(primoLink(segmentaTesto('https:// vuoto'))).toBeUndefined();
  });

  it('keeps markup as plain text', () => {
    const segmenti = segmentaTesto('<script>alert(1)</script> https://a.example/x?q=<b>');

    expect(segmenti[0]).toEqual({ tipo: 'testo', testo: '<script>alert(1)</script> ' });
    expect(segmenti[1]).toMatchObject({ tipo: 'link', host: 'a.example' });
  });

  it('keeps the characters of the original text, so nothing is lost', () => {
    const testo = 'Ciao https://a.example/x, ciao\nhttps://b.example/y.';
    const ricomposto = segmentaTesto(testo).map((s) => s.testo).join('');
    expect(ricomposto).toBe(testo);
  });
});

describe('primoLink', () => {
  it('returns the first link', () => {
    expect(primoLink(segmentaTesto('a https://one.example/ b https://two.example/'))?.host).toBe('one.example');
  });

  it('returns undefined when there are no links', () => {
    expect(primoLink(segmentaTesto('nessun link'))).toBeUndefined();
  });
});
