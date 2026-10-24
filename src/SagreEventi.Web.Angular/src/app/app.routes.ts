import { Routes } from '@angular/router';
import { richiedeAdmin, richiedeModifica } from './core/permessi.service';

const base = 'Sagre & Eventi';

export const routes: Routes = [
  {
    path: '',
    title: base,
    loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'eventi',
    title: `Tutti gli eventi · ${base}`,
    loadComponent: () => import('./features/eventi/eventi-list.page').then((m) => m.EventiListPage),
  },
  {
    path: 'eventi/nuovo',
    title: `Segnala un evento · ${base}`,
    loadComponent: () => import('./features/eventi/evento-form.page').then((m) => m.EventoFormPage),
  },
  {
    path: 'eventi/:id/modifica',
    canActivate: [richiedeModifica],
    title: `Modifica evento · ${base}`,
    loadComponent: () => import('./features/eventi/evento-form.page').then((m) => m.EventoFormPage),
  },
  {
    path: 'eventi/:id',
    title: `Evento · ${base}`,
    loadComponent: () => import('./features/eventi/evento-detail.page').then((m) => m.EventoDetailPage),
  },
  {
    path: 'segnalazioni',
    title: `Le mie segnalazioni · ${base}`,
    loadComponent: () => import('./features/segnalazioni/mie-segnalazioni.page').then((m) => m.MieSegnalazioniPage),
  },
  {
    path: 'gestione',
    canActivate: [richiedeModifica],
    loadComponent: () => import('./features/gestione/gestione.page').then((m) => m.GestionePage),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'revisione' },
      {
        path: 'revisione',
        title: `Revisione eventi · ${base}`,
        loadComponent: () => import('./features/revisione/revisione.page').then((m) => m.RevisionePage),
      },
      {
        path: 'utenti',
        canActivate: [richiedeAdmin],
        title: `Utenti · ${base}`,
        loadComponent: () => import('./features/amministrazione/amministrazione.page').then((m) => m.AmministrazionePage),
      },
    ],
  },
  // Vecchi indirizzi, mantenuti per i link già condivisi
  { path: 'revisione', pathMatch: 'full', redirectTo: 'gestione/revisione' },
  { path: 'amministrazione', pathMatch: 'full', redirectTo: 'gestione/utenti' },
  {
    path: 'agenda',
    title: `Agenda · ${base}`,
    loadComponent: () => import('./features/agenda/agenda.page').then((m) => m.AgendaPage),
  },
  {
    path: 'login',
    title: `Accedi · ${base}`,
    loadComponent: () => import('./features/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: '**',
    title: `Pagina non trovata · ${base}`,
    loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
