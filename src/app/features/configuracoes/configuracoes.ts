import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
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

  private userId: string | null = null;

  async ngOnInit() {
    await this.perfil.carregar();

    const { data: { user } } = await supabase.auth.getUser();
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

  exportarDados() {}
  excluirConta() {}
}
