import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { supabase } from '../../integrations/supabase/client';
import { PerfilService } from '../../shared/perfil.service';
import { ModalService } from '../../shared/modal.service';
import { obterUsuarioValido } from '../../shared/sessao.util';
import { TemaService, Tema } from '../../shared/tema.service';
import { PerfisService } from '../../shared/perfis.service';

interface Preferencias {
  lembrete_diario: boolean;
  relatorio_semanal: boolean;
  alertas_ia: boolean;
  tema: Tema;
  animacoes_reduzidas: boolean;
  mostrar_humor_recente: boolean;
  relatorio_semanal_dia: number | null;
}

export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

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
  tema: Tema = 'escuro';
  animacoesReduzidas = false;
  mostrarHumorRecente = false;
  relatorioSemanalDia: number | null = null;
  diasSemana = DIAS_SEMANA;

  perfil = inject(PerfilService);
  perfis = inject(PerfisService);

  exportando = false;
  excluindo = false;
  erroExclusao = '';

  editandoUsername = false;
  novoUsername = '';
  salvandoUsername = false;
  erroUsername = '';

  private router = inject(Router);
  private modal = inject(ModalService);
  private temaService = inject(TemaService);
  private userId: string | null = null;

  async ngOnInit() {
    await this.perfil.carregar();
    await this.perfis.carregar();

    const user = await obterUsuarioValido();
    if (!user) return;
    this.userId = user.id;

    const { data, error } = await supabase
      .from('preferencias')
      .select('lembrete_diario, relatorio_semanal, alertas_ia, tema, animacoes_reduzidas, mostrar_humor_recente, relatorio_semanal_dia')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data) {
      this.lembreteDiario = data.lembrete_diario;
      this.relatorioSemanal = data.relatorio_semanal;
      this.alertasIA = data.alertas_ia;
      this.tema = (data.tema as Tema | null) ?? 'escuro';
      this.animacoesReduzidas = data.animacoes_reduzidas;
      this.mostrarHumorRecente = data.mostrar_humor_recente ?? false;
      this.relatorioSemanalDia = data.relatorio_semanal_dia ?? null;
    } else {
      // Primeira vez do usuário: cria a linha com os valores padrão
      await supabase.from('preferencias').insert({
        user_id: user.id,
        lembrete_diario: this.lembreteDiario,
        relatorio_semanal: this.relatorioSemanal,
        alertas_ia: this.alertasIA,
        tema: this.tema,
        animacoes_reduzidas: this.animacoesReduzidas,
        mostrar_humor_recente: this.mostrarHumorRecente,
        relatorio_semanal_dia: this.relatorioSemanalDia,
      });
    }
  }

  erroPreferencias = '';

  async toggle(prop: 'lembreteDiario' | 'relatorioSemanal' | 'alertasIA' | 'animacoesReduzidas' | 'mostrarHumorRecente') {
    this[prop] = !this[prop];
    const sucesso = await this.salvar();
    if (!sucesso) {
      this[prop] = !this[prop];
      return;
    }
    if (prop === 'animacoesReduzidas') this.temaService.aplicarAnimacoes(this.animacoesReduzidas);
  }

  async escolherDiaRelatorio(dia: number) {
    const anterior = this.relatorioSemanalDia;
    this.relatorioSemanalDia = dia;
    const sucesso = await this.salvar();
    if (!sucesso) this.relatorioSemanalDia = anterior;
  }

  editarUsername() {
    this.novoUsername = this.perfis.meuPerfil()?.username ?? '';
    this.editandoUsername = true;
    this.erroUsername = '';
  }

  cancelarUsername() {
    this.editandoUsername = false;
    this.erroUsername = '';
  }

  async salvarUsername() {
    if (this.salvandoUsername) return;
    this.salvandoUsername = true;
    this.erroUsername = '';

    const resultado = await this.perfis.atualizarUsername(this.novoUsername);
    if (resultado.ok) {
      this.editandoUsername = false;
    } else {
      this.erroUsername = resultado.erro ?? 'Não foi possível salvar.';
    }
    this.salvandoUsername = false;
  }

  async escolherTema(tema: Tema) {
    if (this.tema === tema) return;
    const anterior = this.tema;
    this.tema = tema;
    this.temaService.aplicarTema(tema);

    const sucesso = await this.salvar();
    if (!sucesso) {
      this.tema = anterior;
      this.temaService.aplicarTema(anterior);
    }
  }

  private async salvar(): Promise<boolean> {
    if (!this.userId) return false;
    this.erroPreferencias = '';

    const preferencias: Preferencias = {
      lembrete_diario: this.lembreteDiario,
      relatorio_semanal: this.relatorioSemanal,
      alertas_ia: this.alertasIA,
      tema: this.tema,
      animacoes_reduzidas: this.animacoesReduzidas,
      mostrar_humor_recente: this.mostrarHumorRecente,
      relatorio_semanal_dia: this.relatorioSemanalDia,
    };

    const { error } = await supabase
      .from('preferencias')
      .update(preferencias)
      .eq('user_id', this.userId);

    if (error) {
      this.erroPreferencias = 'Não foi possível salvar. Atualize a página e tente de novo.';
      return false;
    }
    return true;
  }

  irParaPerfil() {
    this.router.navigate(['/perfil']);
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

    const confirmou = await this.modal.confirmar({
      titulo: 'Excluir conta',
      mensagem: 'Tem certeza que quer excluir sua conta? Todos os seus registros, contatos e relatórios serão apagados para sempre. Essa ação não pode ser desfeita.',
      textoConfirmar: 'Excluir conta',
      perigo: true,
    });
    if (!confirmou) return;

    this.excluindo = true;
    this.erroExclusao = '';

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      this.excluindo = false;
      this.erroExclusao = 'Sessão expirada. Faça login novamente e tente de novo.';
      return;
    }

    try {
      const resposta = await fetch('/api/excluir-conta', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!resposta.ok) {
        const erro = await resposta.json().catch(() => ({ error: `Erro ${resposta.status} ao excluir conta.` }));
        throw new Error(erro.error || `Erro ${resposta.status} ao excluir conta.`);
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
