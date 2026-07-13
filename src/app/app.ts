import { Component, OnInit, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { Modal } from './shared/modal/modal';
import { TemaService } from './shared/tema.service';
import { PerfisService } from './shared/perfis.service';
import { CarregamentoService } from './shared/carregamento.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Modal],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('Mindly');
  private tema = inject(TemaService);
  private perfis = inject(PerfisService);
  private router = inject(Router);
  carregamento = inject(CarregamentoService);

  ngOnInit() {
    this.tema.iniciar();
    this.perfis.carregar();

    // Roda de carregamento durante a troca de rotas (inclui o download
    // do chunk lazy da página e a checagem de sessão do guard).
    this.router.events.subscribe(evento => {
      if (evento instanceof NavigationStart) {
        this.carregamento.mostrar();
      } else if (
        evento instanceof NavigationEnd ||
        evento instanceof NavigationCancel ||
        evento instanceof NavigationError
      ) {
        this.carregamento.esconder();
      }
    });
  }
}
