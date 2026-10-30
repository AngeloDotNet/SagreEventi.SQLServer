import { TestBed } from '@angular/core/testing';
import { ConfigService } from './config.service';

/** Minimal `fetch` response: only what ConfigService reads. */
const risposta = (corpo: unknown, ok = true) => ({ ok, json: () => Promise.resolve(corpo) }) as unknown as Response;

describe('ConfigService', () => {
  let service: ConfigService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    service = TestBed.inject(ConfigService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to the same origin (empty base URL)', () => {
    expect(service.apiBaseUrl()).toBe('');
  });

  it('reads apiBaseUrl from config.json without using the HTTP cache', async () => {
    fetchMock.mockResolvedValue(risposta({ apiBaseUrl: 'https://api.example.com' }));

    await service.load();

    expect(fetchMock).toHaveBeenCalledWith('config.json', { cache: 'no-store' });
    expect(service.apiBaseUrl()).toBe('https://api.example.com');
  });

  it.each([
    ['https://api.example.com/', 'https://api.example.com'],
    ['https://api.example.com///', 'https://api.example.com'],
    ['/', ''],
  ])('removes trailing slashes from "%s"', async (valore, atteso) => {
    fetchMock.mockResolvedValue(risposta({ apiBaseUrl: valore }));

    await service.load();

    expect(service.apiBaseUrl()).toBe(atteso);
  });

  it('keeps the default when the response is not ok', async () => {
    fetchMock.mockResolvedValue(risposta({ apiBaseUrl: 'https://api.example.com' }, false));

    await service.load();

    expect(service.apiBaseUrl()).toBe('');
  });

  it.each([
    ['a number', { apiBaseUrl: 42 }],
    ['null', { apiBaseUrl: null }],
    ['an object', { apiBaseUrl: { url: 'x' } }],
    ['missing', {}],
  ])('keeps the default when apiBaseUrl is %s', async (_nome, corpo) => {
    fetchMock.mockResolvedValue(risposta(corpo));

    await service.load();

    expect(service.apiBaseUrl()).toBe('');
  });

  it('keeps the default when config.json is not valid JSON', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.reject(new SyntaxError('Unexpected token')) } as unknown as Response);

    await service.load();

    expect(service.apiBaseUrl()).toBe('');
  });

  it('keeps the default when the request fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(service.load()).resolves.toBeUndefined();

    expect(service.apiBaseUrl()).toBe('');
  });
});
