import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { supabase } from '../../integrations/supabase/client';

@Component({
  selector: 'app-auth',
  imports: [FormsModule, RouterLink],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export class Auth implements OnInit, OnDestroy {
  modo: 'entrar' | 'cadastro' = 'entrar';
  nome: string = '';
  email: string = '';
  senha: string = '';
  carregando: boolean = false;
  erro: string = '';
  mensagem: string = '';

  private router = inject(Router);
  private authSubscription = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      this.router.navigate(['/diario']);
    }
  });

  async ngOnInit() {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      this.router.navigate(['/diario']);
    }
  }

  ngOnDestroy() {
    this.authSubscription.data.subscription.unsubscribe();
  }

  alternarModo() {
    this.modo = this.modo === 'entrar' ? 'cadastro' : 'entrar';
    this.erro = '';
    this.mensagem = '';
  }

  async entrar() {
    this.erro = '';
    this.mensagem = '';
    this.carregando = true;

    try {
      if (this.modo === 'cadastro') {
        const { error } = await supabase.auth.signUp({
          email: this.email,
          password: this.senha,
          options: {
            data: { display_name: this.nome || this.email.split('@')[0] },
          },
        });
        if (error) throw error;
        this.mensagem = 'Conta criada! Verifique seu email para confirmar.';
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: this.email,
          password: this.senha,
        });
        if (error) throw error;
        this.router.navigate(['/diario']);
      }
    } catch (err) {
      this.erro = err instanceof Error ? err.message : 'Erro ao autenticar';
    } finally {
      this.carregando = false;
    }
  }

  async entrarComGoogle() {
    this.erro = '';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth' },
    });
    if (error) this.erro = error.message;
  }

  async entrarComApple() {
    this.erro = '';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin + '/auth' },
    });
    if (error) this.erro = error.message;
  }
}
