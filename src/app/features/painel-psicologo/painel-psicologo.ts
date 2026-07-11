import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import jsPDF from 'jspdf';
import { supabase } from '../../integrations/supabase/client';
import { PerfisService } from '../../shared/perfis.service';
import { ConexoesService, ConexaoComPerfil } from '../../shared/conexoes.service';
import { obterUsuarioValido } from '../../shared/sessao.util';

interface RelatorioRecebido {
  id: string;
  titulo: string;
  detalhes: string;
  tags: { label: string; cor: string }[];
  criadoEm: Date;
  pacienteId: string;
  registros: number;
}

interface BarraGrafico {
  label: string;
  valor: number;
  altura: number;
}

interface EmocaoFrequencia {
  label: string;
  vezes: number;
  percentual: number;
}

@Component({
  selector: 'app-painel-psicologo',
  imports: [FormsModule, DatePipe],
  templateUrl: './painel-psicologo.html',
  styleUrl: './painel-psicologo.css',
})
export class PainelPsicologo implements OnInit {
  perfis = inject(PerfisService);
  private conexoes = inject(ConexoesService);

  carregando = true;
  pendentes: ConexaoComPerfil[] = [];
  pacientes: ConexaoComPerfil[] = [];
  private relatoriosTodos: RelatorioRecebido[] = [];

  filtroPaciente = '';
  pacienteSelecionadoId: string | null = null;

  // Cadastro de novo paciente
  novoPacienteUsername = '';
  adicionandoPaciente = false;
  erroAdicionarPaciente = '';
  avisoPacienteAdicionado = '';

  linkConvite = '';
  linkCopiado = false;

  async ngOnInit() {
    const perfil = await this.perfis.carregar();
    if (perfil) {
      this.linkConvite = this.conexoes.linkConvite('psicologo', perfil.user_id);
    }
    await this.carregarTudo();
    this.carregando = false;
  }

  private async carregarTudo() {
    this.pendentes = await this.conexoes.listar('psicologo', 'pendente');
    this.pacientes = await this.conexoes.listar('psicologo', 'aceito');
    await this.carregarRelatorios();

    if (!this.pacienteSelecionadoId && this.pacientes.length > 0) {
      this.pacienteSelecionadoId = this.pacientes[0].outroPerfil.user_id;
    }
  }

  private async carregarRelatorios() {
    const user = await obterUsuarioValido();
    if (!user) return;

    const { data } = await supabase
      .from('relatorios')
      .select('id, titulo, detalhes, tags, criado_em, user_id')
      .eq('psicologo_id', user.id)
      .order('criado_em', { ascending: true });

    this.relatoriosTodos = (data ?? []).map(r => ({
      id: r.id,
      titulo: r.titulo,
      detalhes: r.detalhes ?? '',
      tags: r.tags ?? [],
      criadoEm: new Date(r.criado_em),
      pacienteId: r.user_id,
      registros: parseInt((r.detalhes ?? '').match(/^(\d+) registros/)?.[1] ?? '0', 10),
    }));
  }

  /* ==== Lista de pacientes (com busca) ==== */

  get pacientesFiltrados(): ConexaoComPerfil[] {
    const busca = this.filtroPaciente.trim().replace(/^@/, '').toLowerCase();
    if (!busca) return this.pacientes;
    return this.pacientes.filter(p => p.outroPerfil.username.toLowerCase().includes(busca));
  }

  selecionarPaciente(userId: string) {
    this.pacienteSelecionadoId = userId;
  }

  get pacienteSelecionado(): ConexaoComPerfil | null {
    return this.pacientes.find(p => p.outroPerfil.user_id === this.pacienteSelecionadoId) ?? null;
  }

  /* ==== Visão do paciente selecionado ==== */

  get relatoriosDoPaciente(): RelatorioRecebido[] {
    return this.relatoriosTodos
      .filter(r => r.pacienteId === this.pacienteSelecionadoId)
      .slice()
      .reverse();
  }

  /** Barras: nº de registros em cada relatório recebido (evolução ao longo do tempo). */
  get graficoRegistros(): BarraGrafico[] {
    const doPaciente = this.relatoriosTodos.filter(r => r.pacienteId === this.pacienteSelecionadoId);
    const ultimos = doPaciente.slice(-8);
    const maior = Math.max(1, ...ultimos.map(r => r.registros));
    return ultimos.map(r => ({
      label: r.criadoEm.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      valor: r.registros,
      altura: Math.max(6, Math.round((r.registros / maior) * 100)),
    }));
  }

  /** Emoções mais frequentes nas tags de todos os relatórios do paciente. */
  get emocoesFrequentes(): EmocaoFrequencia[] {
    const doPaciente = this.relatoriosTodos.filter(r => r.pacienteId === this.pacienteSelecionadoId);
    const contagem = new Map<string, number>();
    doPaciente.forEach(r => r.tags.forEach(t => contagem.set(t.label, (contagem.get(t.label) ?? 0) + 1)));

    const total = [...contagem.values()].reduce((s, v) => s + v, 0);
    if (total === 0) return [];

    return [...contagem.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, vezes]) => ({ label, vezes, percentual: Math.round((vezes / total) * 100) }));
  }

  /* ==== Cadastrar paciente ==== */

  async adicionarPaciente() {
    if (!this.novoPacienteUsername.trim() || this.adicionandoPaciente) return;
    this.adicionandoPaciente = true;
    this.erroAdicionarPaciente = '';
    this.avisoPacienteAdicionado = '';

    const resultado = await this.conexoes.solicitarPorUsername(this.novoPacienteUsername.trim(), 'psicologo');
    if (resultado.ok) {
      this.avisoPacienteAdicionado = `Pedido enviado para ${this.novoPacienteUsername.trim()}. Assim que o paciente aceitar, ele aparece na sua lista.`;
      this.novoPacienteUsername = '';
      await this.carregarTudo();
    } else {
      this.erroAdicionarPaciente = resultado.erro ?? 'Não foi possível enviar o pedido.';
    }
    this.adicionandoPaciente = false;
  }

  async responder(conexaoId: string, aceitar: boolean) {
    const sucesso = await this.conexoes.responder(conexaoId, aceitar);
    if (sucesso) await this.carregarTudo();
  }

  copiarLink() {
    navigator.clipboard?.writeText(this.linkConvite);
    this.linkCopiado = true;
    setTimeout(() => (this.linkCopiado = false), 2000);
  }

  baixarRelatorio(relatorio: RelatorioRecebido) {
    const paciente = this.pacienteSelecionado;
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(16);
    doc.text(relatorio.titulo, 14, y);
    y += 8;

    doc.setFontSize(11);
    doc.setTextColor(120);
    doc.text(`Paciente: @${paciente?.outroPerfil.username ?? 'paciente'}`, 14, y);
    y += 8;
    doc.text(relatorio.detalhes, 14, y);
    doc.setTextColor(0);
    y += 12;

    if (relatorio.tags.length > 0) {
      doc.setFontSize(12);
      doc.text('Emoções observadas:', 14, y);
      y += 8;
      doc.setFontSize(11);
      relatorio.tags.forEach(tag => {
        doc.text(`• ${tag.label}`, 14, y);
        y += 7;
      });
    }

    const nomeArquivo = relatorio.titulo.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
    doc.save(`${nomeArquivo}.pdf`);
  }
}
