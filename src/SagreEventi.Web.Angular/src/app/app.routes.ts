import { Routes } from '@angular/router';
import { richiedeModifica } from './core/permessi.service';

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
    path: 'agenda',
    title: `Agenda · ${base}`,
    loadComponent: () => import('./features/agenda/agenda.page').then((m) => m.AgendaPage),
  },
  {
    path: '**',
    title: `Pagina non trovata · ${base}`,
    loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
