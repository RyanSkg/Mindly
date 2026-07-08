import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { supabase } from '../../integrations/supabase/client';
import { PerfilService } from '../../shared/perfil.service';

interface Preferencias {
  lembrete_diario: boolean;
  relatorio_semanal: boolean;
  alertas_ia: boolean;
  modo_escuro: boolean;
  animacoes_reduzidas: boolean;
}

@Component({
  selector: 'app-configuracoes',
  imports: [FormsModule],
  templateUrl: './configuracoes.html',
  styleUrl: './configuracoes.css',
})
export class Configuracoes implements OnInit {
  lembreteDiario = true;
  relatorioSemanal = false;
  alertasIA = true;
  modoEscuro = true;
  animacoesReduzidas = false;

  perfil = inject(PerfilService);
  editandoPerfil = false;
  nomeEmEdicao = '';
  salvandoPerfil = false;

  exportando = false;
  excluindo = false;
  erroExclusao = '';

  private router = inject(Router);
  private userId: string | null = null;

  async ngOnInit() {
    await this.perfil.carregar();

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;
    this.userId = user.id;

    const { data, error } = await supabase
      .from('preferencias')
      .select('lembrete_diario, relatorio_semanal, alertas_ia, modo_escuro, animacoes_reduzidas')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data) {
      this.lembreteDiario = data.lembrete_diario;
      this.relatorioSemanal = data.relatorio_semanal;
      this.alertasIA = data.alertas_ia;
      this.modoEscuro = data.modo_escuro;
      this.animacoesReduzidas = data.animacoes_reduzidas;
    } else {
      // Primeira vez do usuário: cria a linha com os valores padrão
      await supabase.from('preferencias').insert({
        user_id: user.id,
        lembrete_diario: this.lembreteDiario,
        relatorio_semanal: this.relatorioSemanal,
        alertas_ia: this.alertasIA,
        modo_escuro: this.modoEscuro,
        animacoes_reduzidas: this.animacoesReduzidas,
      });
    }
  }

  async toggle(prop: 'lembreteDiario' | 'relatorioSemanal' | 'alertasIA' | 'modoEscuro' | 'animacoesReduzidas') {
    this[prop] = !this[prop];
    await this.salvar();
  }

  private async salvar() {
    if (!this.userId) return;

    const preferencias: Preferencias = {
      lembrete_diario: this.lembreteDiario,
      relatorio_semanal: this.relatorioSemanal,
      alertas_ia: this.alertasIA,
      modo_escuro: this.modoEscuro,
      animacoes_reduzidas: this.animacoesReduzidas,
    };

    await supabase
      .from('preferencias')
      .update(preferencias)
      .eq('user_id', this.userId);
  }

  editarPerfil() {
    this.nomeEmEdicao = this.perfil.nome();
    this.editandoPerfil = true;
  }

  cancelarEdicaoPerfil() {
    this.editandoPerfil = false;
  }

  async salvarPerfil() {
    if (this.salvandoPerfil) return;
    this.salvandoPerfil = true;

    const sucesso = await this.perfil.atualizarNome(this.nomeEmEdicao);
    if (sucesso) {
      this.editandoPerfil = false;
    }
    this.salvandoPerfil = false;
  }

  async exportarDados() {
    if (this.exportando || !this.userId) return;
    this.exportando = true;

    const [registros, contatos, relatorios, preferencias] = await Promise.all([
      supabase.from('registros').select('*').eq('user_id', this.userId),
      supabase.from('contatos').select('*').eq('user_id', this.userId),
      supabase.from('relatorios').select('*').eq('user_id', this.userId),
      supabase.from('preferencias').select('*').eq('user_id', this.userId).maybeSingle(),
    ]);

    const dados = {
      perfil: { nome: this.perfil.nome(), email: this.perfil.email() },
      exportado_em: new Date().toISOString(),
      registros: registros.data ?? [],
      contatos: contatos.data ?? [],
      relatorios: relatorios.data ?? [],
      preferencias: preferencias.data ?? null,
    };

    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mindly-meus-dados-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    this.exportando = false;
  }

  async excluirConta() {
    if (this.excluindo) return;

    const confirmou = confirm(
      'Tem certeza que quer excluir sua conta? Todos os seus registros, contatos e relatórios serão apagados para sempre. Essa ação não pode ser desfeita.'
    );
    if (!confirmou) return;

    this.excluindo = true;
    this.erroExclusao = '';

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      this.excluindo = false;
      return;
    }

    try {
      const resposta = await fetch('/api/excluir-conta', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!resposta.ok) {
        const erro = await resposta.json();
        throw new Error(erro.error || 'Não foi possível excluir a conta.');
      }

      await supabase.auth.signOut();
      this.router.navigate(['/auth']);
    } catch (err) {
      this.erroExclusao = err instanceof Error ? err.message : 'Erro ao excluir conta';
    } finally {
      this.excluindo = false;
    }
  }
}
