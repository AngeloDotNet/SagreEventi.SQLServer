import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { AuthService } from './core/auth.service';
import { authInterceptor } from './core/auth.interceptor';
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
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    // La configurazione va caricata prima di tutto; poi i ruoli vengono riallineati con il server
    provideAppInitializer(async () => {
      // inject() va chiamato prima di ogni await: dopo non c'è più il contesto di iniezione (NG0203)
      const config = inject(ConfigService);
      const auth = inject(AuthService);
      await config.load();
      void auth.aggiornaUtente();
    }),
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
