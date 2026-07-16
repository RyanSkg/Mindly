import { Component, NgZone, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { supabase } from '../../integrations/supabase/client';

type TipoConta = 'usuario' | 'psicologo';

@Component({
  selector: 'app-auth',
  imports: [FormsModule, RouterLink],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export class Auth implements OnInit, OnDestroy {
  modo: 'entrar' | 'cadastro' = 'entrar';
  tipoConta: TipoConta = 'usuario';
  nome: string = '';
  email: string = '';
  senha: string = '';
  crp: string = '';
  especialidade: string = '';
  carregando: boolean = false;
  erro: string = '';
  mensagem: string = '';
  aceitouPolitica: boolean = false;
  documentoAberto: 'politica' | 'termos' | null = null;

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private zone = inject(NgZone);
  // O callback do Supabase roda fora da zona do Angular (navigator.locks não é
  // rastreado pelo zone.js); sem o zone.run, a navegação monta a tela sem o
  // Angular perceber e os primeiros cliques não re-renderizam nada.
  private authSubscription = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      this.zone.run(() => this.router.navigate(['/diario']));
    }
  });

  async ngOnInit() {
    if (this.route.snapshot.queryParamMap.get('modo') === 'cadastro') {
      this.modo = 'cadastro';
    }

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
    this.aceitouPolitica = false;
    this.tipoConta = 'usuario';
  }

  abrirPolitica() {
    this.documentoAberto = 'politica';
  }

  abrirTermos() {
    this.documentoAberto = 'termos';
  }

  fecharDocumento() {
    this.documentoAberto = null;
  }

  aceitarDocumento() {
    this.aceitouPolitica = true;
    this.documentoAberto = null;
  }

  async entrar() {
    this.erro = '';
    this.mensagem = '';

    if (this.modo === 'cadastro' && !this.aceitouPolitica) {
      this.erro = 'Você precisa aceitar a Política de Privacidade para criar sua conta.';
      return;
    }

    this.carregando = true;

    try {
      if (this.modo === 'cadastro') {
        const { error } = await supabase.auth.signUp({
          email: this.email,
          password: this.senha,
          options: {
            data: {
              display_name: this.nome || this.email.split('@')[0],
              tipo_conta: this.tipoConta,
              crp: this.tipoConta === 'psicologo' ? this.crp || null : null,
              especialidade: this.tipoConta === 'psicologo' ? this.especialidade || null : null,
            },
          },
        });
        if (error) throw error;
        this.mensagem =
          this.tipoConta === 'psicologo'
            ? 'Conta criada! Verifique seu email para confirmar. Seu cadastro de psicólogo(a) ainda precisa ser aprovado antes de liberar o acesso.'
            : 'Conta criada! Verifique seu email para confirmar.';
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
