import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { supabase } from '../../integrations/supabase/client';
import { TemaService } from '../../shared/tema.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  abaTutorial: 'usuario' | 'psicologo' = 'usuario';
  logado = false;
  temaEscuro = true;

  private router = inject(Router);
  private tema = inject(TemaService);
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));

  async ngOnInit() {
    if (this.navegador) {
      this.temaEscuro = document.documentElement.getAttribute('data-theme') !== 'claro';
    }

    const { data } = await supabase.auth.getSession();
    this.logado = !!data.session;
  }

  alternarTema() {
    this.temaEscuro = !this.temaEscuro;
    this.tema.aplicarTema(this.temaEscuro ? 'escuro' : 'claro');
  }

  irParaRegistro() {
    this.router.navigate(['/auth'], { queryParams: { modo: 'cadastro' } });
  }
}
