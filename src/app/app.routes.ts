import { Routes } from '@angular/router';
import { AppShell } from './layout/app-shell/app-shell';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'home',
    title: 'Mindly — Diário emocional com IA',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: 'auth',
    title: 'Entrar · Mindly',
    loadComponent: () => import('./features/auth/auth').then((m) => m.Auth),
  },
  {
    path: 'pendente-aprovacao',
    title: 'Aguardando aprovação · Mindly',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/pendente-aprovacao/pendente-aprovacao').then((m) => m.PendenteAprovacao),
  },
  {
    path: '',
    component: AppShell,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'diario', pathMatch: 'full' },
      {
        path: 'convite/:userId',
        title: 'Convite · Mindly',
        loadComponent: () => import('./features/convite/convite').then((m) => m.Convite),
      },
      {
        path: 'painel-psicologo',
        title: 'Painel de pacientes',
        loadComponent: () =>
          import('./features/painel-psicologo/painel-psicologo').then((m) => m.PainelPsicologo),
      },
      {
        path: 'admin',
        title: 'Administração',
        loadComponent: () => import('./features/admin/admin').then((m) => m.Admin),
      },
      {
        path: 'diario',
        title: 'Diário emocional',
        loadComponent: () => import('./features/diario/diario').then((m) => m.Diario),
      },
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'oito-minutos',
        title: '8 Minutos',
        loadComponent: () =>
          import('./features/oito-minutos/oito-minutos').then((m) => m.OitoMinutos),
      },
      {
        path: 'psicologos',
        title: 'Psicólogo',
        loadComponent: () => import('./features/psicologo/psicologo').then((m) => m.Psicologo),
      },
      {
        path: 'perfil',
        title: 'Perfil',
        loadComponent: () => import('./features/perfil/perfil').then((m) => m.Perfil),
      },
      {
        path: 'configuracoes',
        title: 'Configurações',
        loadComponent: () =>
          import('./features/configuracoes/configuracoes').then((m) => m.Configuracoes),
      },
    ],
  },
];
