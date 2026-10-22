import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { ConfigService } from './core/config.service';
import { SagrePreset } from './theme';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),
    provideHttpClient(withFetch()),
    provideAppInitializer(() => inject(ConfigService).load()),
    providePrimeNG({
      ripple: true,
      theme: {
        preset: SagrePreset,
        options: { darkModeSelector: '.app-dark' },
      },
      translation: {
        firstDayOfWeek: 1,
        dayNames: ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'],
        dayNamesShort: ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'],
        dayNamesMin: ['D', 'L', 'M', 'M', 'G', 'V', 'S'],
        monthNames: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
        monthNamesShort: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
        today: 'Oggi',
        clear: 'Pulisci',
        weekHeader: 'Sett.',
        dateFormat: 'dd/mm/yy',
        accept: 'Sì',
        reject: 'No',
        apply: 'Applica',
        cancel: 'Annulla',
        emptyMessage: 'Nessun risultato',
        emptyFilterMessage: 'Nessun risultato',
      },
    }),
    MessageService,
    ConfirmationService,
  ],
};
