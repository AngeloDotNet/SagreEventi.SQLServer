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

  const crea = (isEnabled = true): AggiornamentoAppService => {
    TestBed.configureTestingModule({
      providers: [
        { provide: SwUpdate, useValue: { isEnabled, versionUpdates: versioni, activateUpdate } },
        { provide: MessageService, useValue: messaggi },
        { provide: DOCUMENT, useValue: { location: { reload } } },
      ],
    });
    return TestBed.inject(AggiornamentoAppService);
  };

  beforeEach(() => {
    messaggi.add.mockReset();
    reload.mockReset();
    activateUpdate.mockReset().mockResolvedValue(true);
  });

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
});
