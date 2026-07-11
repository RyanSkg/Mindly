import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { supabase } from '../../integrations/supabase/client';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  abaTutorial: 'usuario' | 'psicologo' = 'usuario';
  logado = false;

  private router = inject(Router);

  async ngOnInit() {
    const { data } = await supabase.auth.getSession();
    this.logado = !!data.session;
  }

  irParaRegistro() {
    this.router.navigate(['/auth'], { queryParams: { modo: 'cadastro' } });
  }
}
