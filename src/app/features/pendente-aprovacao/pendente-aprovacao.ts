import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { supabase } from '../../integrations/supabase/client';

@Component({
  selector: 'app-pendente-aprovacao',
  templateUrl: './pendente-aprovacao.html',
  styleUrl: './pendente-aprovacao.css',
})
export class PendenteAprovacao {
  private router = inject(Router);

  async sair() {
    await supabase.auth.signOut();
    this.router.navigate(['/auth']);
  }
}
