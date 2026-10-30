import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, NavigationError, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { ErroreNavigazioneService } from './errore-navigazione.service';
import { EventiStore } from './eventi-store.service';

describe('ErroreNavigazioneService', () => {
  const eventi = new Subject<unknown>();
  const messaggi = { add: vi.fn() };
  const online = signal(true);

  beforeEach(() => {
    messaggi.add.mockReset();
    online.set(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { events: eventi } },
        { provide: MessageService, useValue: messaggi },
        { provide: EventiStore, useValue: { online } },
      ],
    });
    TestBed.inject(ErroreNavigazioneService);
  });

  it('shows a sticky error toast saying the user is offline when a page fails to load offline', () => {
    online.set(false);

    eventi.next(new NavigationError(1, '/eventi', new Error('chunk')));

    expect(messaggi.add).toHaveBeenCalledOnce();
    const toast = messaggi.add.mock.calls[0][0];
    expect(toast).toMatchObject({ severity: 'error', summary: 'Sei offline', sticky: true });
  });

  it('shows a generic sticky error toast when the page fails while online', () => {
    eventi.next(new NavigationError(1, '/eventi', new Error('chunk')));

    expect(messaggi.add.mock.calls[0][0]).toMatchObject({ severity: 'error', summary: 'Pagina non caricata', sticky: true });
  });

  it('ignores navigations that succeed', () => {
    eventi.next(new NavigationEnd(1, '/eventi', '/eventi'));

    expect(messaggi.add).not.toHaveBeenCalled();
  });
});
