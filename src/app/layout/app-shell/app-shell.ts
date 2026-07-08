import { Component, inject, OnInit } from '@angular/core';
import { Router, ActivatedRoute, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { DatePipe } from '@angular/common';
import { filter } from 'rxjs/operators';
import { supabase } from '../../integrations/supabase/client';
import { TopbarActionsService } from '../../shared/topbar-actions.service';
import { PerfilService } from '../../shared/perfil.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLinkActive, RouterLink, DatePipe],
  templateUrl: './app-shell.html',
  styleUrls: ['./app-shell.css'],
})
export class AppShell implements OnInit {
  tituloPagina = '';
  rotaAtual = '';
  dataHoje = new Date();

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private topbarActions = inject(TopbarActionsService);
  perfil = inject(PerfilService);

  ngOnInit(): void {
    this.atualizarRota();
    this.perfil.carregar();
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
      )
      .subscribe(() => {
        this.atualizarRota();
      });
  }

  private atualizarRota(): void {
    this.tituloPagina = this.route.firstChild?.snapshot.title ?? '';
    this.rotaAtual = this.route.firstChild?.snapshot.routeConfig?.path ?? '';
  }

  dispararAcao(acao: string): void {
    this.topbarActions.disparar(acao);
  }

  async sair(): Promise<void> {
    await supabase.auth.signOut();
    this.router.navigate(['/auth']);
  }
}
