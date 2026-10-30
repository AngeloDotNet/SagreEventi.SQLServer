import { Routes } from '@angular/router';
import { richiedeAdmin, richiedeModifica } from './core/permessi.service';

const base = 'Sagre & Eventi';

export const routes: Routes = [
  {
    path: '',
    title: base,
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'eventi',
    title: `Tutti gli eventi · ${base}`,
    loadComponent: () => import('./features/eventi/eventi-list/eventi-list.component').then((m) => m.EventiListComponent),
  },
  {
    path: 'eventi/nuovo',
    title: `Segnala un evento · ${base}`,
    loadComponent: () => import('./features/eventi/evento-form/evento-form.component').then((m) => m.EventoFormComponent),
  },
  {
    path: 'eventi/:id/modifica',
    canActivate: [richiedeModifica],
    title: `Modifica evento · ${base}`,
    loadComponent: () => import('./features/eventi/evento-form/evento-form.component').then((m) => m.EventoFormComponent),
  },
  {
    path: 'eventi/:id',
    title: `Evento · ${base}`,
    loadComponent: () => import('./features/eventi/evento-detail/evento-detail.component').then((m) => m.EventoDetailComponent),
  },
  {
    path: 'segnalazioni',
    title: `Le mie segnalazioni · ${base}`,
    loadComponent: () => import('./features/segnalazioni/mie-segnalazioni.component').then((m) => m.MieSegnalazioniComponent),
  },
  {
    path: 'gestione',
    canActivate: [richiedeModifica],
    loadComponent: () => import('./features/gestione/gestione.component').then((m) => m.GestioneComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'revisione' },
      {
        path: 'revisione',
        title: `Revisione eventi · ${base}`,
        loadComponent: () => import('./features/revisione/revisione.component').then((m) => m.RevisioneComponent),
      },
      {
        path: 'utenti',
        canActivate: [richiedeAdmin],
        title: `Utenti · ${base}`,
        loadComponent: () => import('./features/amministrazione/amministrazione.component').then((m) => m.AmministrazioneComponent),
      },
    ],
  },
  // Vecchi indirizzi, mantenuti per i link già condivisi
  { path: 'revisione', pathMatch: 'full', redirectTo: 'gestione/revisione' },
  { path: 'amministrazione', pathMatch: 'full', redirectTo: 'gestione/utenti' },
  {
    path: 'agenda',
    title: `Agenda · ${base}`,
    loadComponent: () => import('./features/agenda/agenda.component').then((m) => m.AgendaComponent),
  },
  {
    path: 'informazioni',
    title: `Informazioni · ${base}`,
    loadComponent: () => import('./features/informazioni/informazioni.component').then((m) => m.InformazioniComponent),
  },
  {
    path: 'login',
    title: `Accedi · ${base}`,
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '**',
    title: `Pagina non trovata · ${base}`,
    loadComponent: () => import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
