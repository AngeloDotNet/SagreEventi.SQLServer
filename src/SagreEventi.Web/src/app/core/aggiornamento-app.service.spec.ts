import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { AggiornamentoAppService } from './aggiornamento-app.service';

describe('AggiornamentoAppService', () => {
  const versioni = new Subject<{ type: string }>();
  const messaggi = { add: vi.fn() };
  const reload = vi.fn();
  const activateUpdate = vi.fn();
  const checkForUpdate = vi.fn();
  /** A document that can receive events, as the service listens to `visibilitychange`. */
  let doc: EventTarget & { location: { reload: () => void }; visibilityState: string };

  const crea = (isEnabled = true): AggiornamentoAppService => {
    TestBed.configureTestingModule({
      providers: [
        { provide: SwUpdate, useValue: { isEnabled, versionUpdates: versioni, activateUpdate, checkForUpdate } },
        { provide: MessageService, useValue: messaggi },
        { provide: DOCUMENT, useValue: doc },
      ],
    });
    return TestBed.inject(AggiornamentoAppService);
  };

  beforeEach(() => {
    messaggi.add.mockReset();
    reload.mockReset();
    activateUpdate.mockReset().mockResolvedValue(true);
    checkForUpdate.mockReset().mockResolvedValue(false);
    doc = Object.assign(new EventTarget(), { location: { reload }, visibilityState: 'visible' });
  });

  afterEach(() => vi.useRealTimers());

  it('starts without an update available', () => {
    expect(crea().disponibile()).toBe(false);
  });

  it('flags the update and tells the user when a new version is ready', () => {
    const service = crea();

    versioni.next({ type: 'VERSION_READY' });

    expect(service.disponibile()).toBe(true);
    expect(messaggi.add).toHaveBeenCalledTimes(1);
    expect(messaggi.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'info', summary: 'Nuova versione disponibile' }));
  });

  it('ignores the other service worker events', () => {
    const service = crea();

    versioni.next({ type: 'VERSION_DETECTED' });
    versioni.next({ type: 'NO_NEW_VERSION_DETECTED' });

    expect(service.disponibile()).toBe(false);
    expect(messaggi.add).not.toHaveBeenCalled();
  });

  it('does nothing when the service worker is not enabled', () => {
    const service = crea(false);

    versioni.next({ type: 'VERSION_READY' });

    expect(service.disponibile()).toBe(false);
    expect(messaggi.add).not.toHaveBeenCalled();
  });

  it('activates the new version and then reloads the page', async () => {
    await crea().aggiorna();

    expect(activateUpdate).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads the page even if the activation fails', async () => {
    activateUpdate.mockRejectedValue(new Error('boom'));

    await expect(crea().aggiorna()).rejects.toThrow('boom');

    expect(reload).toHaveBeenCalledTimes(1);
  });

  describe('checking for new versions', () => {
    const UN_ORA = 60 * 60 * 1000;
    const CINQUE_MINUTI = 5 * 60 * 1000;
    const tornaInPrimoPiano = () => doc.dispatchEvent(new Event('visibilitychange'));

    beforeEach(() => vi.useFakeTimers());

    it('asks the server once an hour', () => {
      crea();

      vi.advanceTimersByTime(UN_ORA);
      expect(checkForUpdate).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(UN_ORA);
      expect(checkForUpdate).toHaveBeenCalledTimes(2);
    });

    it('asks when the page comes back to the foreground, at most once every five minutes', () => {
      crea();

      tornaInPrimoPiano();
      tornaInPrimoPiano();
      expect(checkForUpdate).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(CINQUE_MINUTI);
      tornaInPrimoPiano();
      expect(checkForUpdate).toHaveBeenCalledTimes(2);
    });

    it('does not ask when the page goes to the background', () => {
      crea();
      doc.visibilityState = 'hidden';

      tornaInPrimoPiano();

      expect(checkForUpdate).not.toHaveBeenCalled();
    });

    it('never asks when the service worker is not enabled', async () => {
      const service = crea(false);

      vi.advanceTimersByTime(UN_ORA);
      tornaInPrimoPiano();
      await service.controlla();

      expect(checkForUpdate).not.toHaveBeenCalled();
    });

    it('controlla asks at once and swallows a failure (offline)', async () => {
      checkForUpdate.mockRejectedValue(new Error('offline'));

      await expect(crea().controlla()).resolves.toBeUndefined();

      expect(checkForUpdate).toHaveBeenCalledTimes(1);
    });
  });
});
