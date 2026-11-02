import { DOCUMENT } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EventiStore } from './eventi-store.service';
import { SincronizzazioneAutomaticaService } from './sincronizzazione-automatica.service';

const MINUTO = 60 * 1000;

describe('SincronizzazioneAutomaticaService', () => {
  const online = signal(true);
  const ultimaSincronizzazione = signal<string | null>(null);
  const sincronizza = vi.fn();
  let doc: EventTarget & { visibilityState: string };

  const avvia = (): SincronizzazioneAutomaticaService => {
    TestBed.configureTestingModule({
      providers: [
        { provide: EventiStore, useValue: { online, ultimaSincronizzazione, sincronizza } },
        { provide: DOCUMENT, useValue: doc },
      ],
    });
    return TestBed.inject(SincronizzazioneAutomaticaService);
  };

  /** Brings the page to the foreground, as the browser does when the user comes back to the app. */
  const tornaInPrimoPiano = () => {
    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
  };

  beforeEach(() => {
    vi.useFakeTimers();
    online.set(true);
    ultimaSincronizzazione.set(null);
    sincronizza.mockReset().mockResolvedValue(true);
    doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  });

  afterEach(() => vi.useRealTimers());

  it('does nothing when the app has just started: the startup synchronization already ran', () => {
    avvia();

    tornaInPrimoPiano();

    expect(sincronizza).not.toHaveBeenCalled();
  });

  it('synchronizes when the app comes back to the foreground after the minimum interval', () => {
    avvia();
    vi.advanceTimersByTime(6 * MINUTO);
    sincronizza.mockClear();

    tornaInPrimoPiano();

    expect(sincronizza).toHaveBeenCalledTimes(1);
  });

  it('does not synchronize again if the app returns to the foreground within the minimum interval', () => {
    avvia();
    vi.advanceTimersByTime(6 * MINUTO);
    sincronizza.mockClear();
    tornaInPrimoPiano();

    vi.advanceTimersByTime(2 * MINUTO);
    tornaInPrimoPiano();

    expect(sincronizza).toHaveBeenCalledTimes(1);
  });

  it('checks every 10 minutes while the page stays visible', () => {
    avvia();

    vi.advanceTimersByTime(10 * MINUTO);
    expect(sincronizza).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10 * MINUTO);
    expect(sincronizza).toHaveBeenCalledTimes(2);
  });

  it('does not synchronize while the page is in the background', () => {
    avvia();
    doc.visibilityState = 'hidden';

    vi.advanceTimersByTime(30 * MINUTO);

    expect(sincronizza).not.toHaveBeenCalled();
  });

  it('does not synchronize while offline', () => {
    avvia();
    online.set(false);

    vi.advanceTimersByTime(30 * MINUTO);

    expect(sincronizza).not.toHaveBeenCalled();
  });

  it('counts a manual synchronization: the next check waits for the minimum interval', () => {
    avvia();
    vi.advanceTimersByTime(9 * MINUTO);
    ultimaSincronizzazione.set(new Date(Date.now()).toISOString());

    vi.advanceTimersByTime(1 * MINUTO);

    expect(sincronizza).not.toHaveBeenCalled();
  });

  it('retries after a failure only when the minimum interval has passed', () => {
    sincronizza.mockResolvedValue(false);
    avvia();
    vi.advanceTimersByTime(10 * MINUTO);
    expect(sincronizza).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(3 * MINUTO);
    tornaInPrimoPiano();
    expect(sincronizza).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(3 * MINUTO);
    tornaInPrimoPiano();
    expect(sincronizza).toHaveBeenCalledTimes(2);
  });
});
