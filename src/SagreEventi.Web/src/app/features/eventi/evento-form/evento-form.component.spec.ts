import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { EventiStore } from '../../../core/eventi-store.service';
import { EventoLocale } from '../../../core/models';
import { PermessiService } from '../../../core/permessi.service';
import { EventoFormComponent } from './evento-form.component';

const TESTO_AVVISO = 'La segnalazione sarà visibile a tutti solo dopo la verifica degli amministratori, per evitare spam e contenuti non idonei.';

describe('EventoFormComponent moderation notice', () => {
  const moderatore = signal(false);
  const esistente: EventoLocale = {
    id: 'a',
    nomeEvento: 'Sagra della castagna',
    cittaEvento: 'Soriano',
    dataInizioEvento: '2026-10-24T00:00:00',
    dataFineEvento: '2026-10-26T00:00:00',
    descrizioneEvento: 'Caldarroste e vino novello',
    eventoConcluso: false,
    dataOraUltimaModifica: '2026-10-01T10:00:00Z',
    stato: 'Approvato',
  };

  const crea = (id?: string): HTMLElement => {
    const fixture: ComponentFixture<EventoFormComponent> = TestBed.createComponent(EventoFormComponent);
    if (id) fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  const avviso = (el: HTMLElement) => Array.from(el.querySelectorAll('p-message')).find((m) => m.textContent?.includes('verifica degli amministratori'));

  beforeEach(() => {
    moderatore.set(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        MessageService,
        { provide: PermessiService, useValue: { puoModificare: () => moderatore() } },
        { provide: EventiStore, useValue: { citta: signal<string[]>([]), trova: (id: string) => (id === esistente.id ? esistente : undefined) } },
      ],
    });
  });

  it('is shown above the buttons on a new report from someone who cannot moderate', () => {
    const el = crea();

    const riquadro = avviso(el);
    expect(riquadro?.textContent?.replace(/\s+/g, ' ').trim()).toBe(TESTO_AVVISO);
    // The notice comes before the submit buttons
    const azioni = el.querySelector('.form-azioni');
    expect(riquadro && azioni && riquadro.compareDocumentPosition(azioni) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is not shown to an Admin or Editor, whose reports are published at once', () => {
    moderatore.set(true);

    expect(avviso(crea())).toBeUndefined();
  });

  it('is not shown when editing an existing event', () => {
    moderatore.set(true);

    expect(avviso(crea('a'))).toBeUndefined();
  });

  it('is not shown when editing, even without moderation rights', () => {
    expect(avviso(crea('a'))).toBeUndefined();
  });
});
