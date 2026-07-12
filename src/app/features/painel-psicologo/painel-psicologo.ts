import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import jsPDF from 'jspdf';
import { supabase } from '../../integrations/supabase/client';
import { PerfisService } from '../../shared/perfis.service';
import { ConexoesService, ConexaoComPerfil } from '../../shared/conexoes.service';
import { obterUsuarioValido } from '../../shared/sessao.util';
import { emojiDoHumor, labelDoHumor, valorDoHumor } from '../../shared/humor.util';

interface MensagemConversa {
  role: 'user' | 'assistant';
  content: string;
}

interface RelatorioRecebido {
  id: string;
  titulo: string;
  detalhes: string;
  tags: { label: string; cor: string }[];
  criadoEm: Date;
  pacienteId: string;
  registros: number;
  conversaAnexada: MensagemConversa[];
}

interface PontoHumor {
  x: number;
  y: number;
  humor: string;
  data: Date;
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

  // Mensagem pro paciente selecionado
  mensagemConteudo = '';
  enviandoMensagem = false;
  mensagemEnviada = false;

  // Linha do tempo do humor do paciente selecionado
  pontosHumor: PontoHumor[] = [];
  caminhoHumor = '';
  pontoHumorAtivo: number | null = null;
  readonly larguraLinha = 600;
  readonly alturaLinha = 150;
  emojiDoHumor = emojiDoHumor;
  labelDoHumor = labelDoHumor;

  // Conversa com a IA anexada (expandida por relatório)
  conversaExpandidaId: string | null = null;

  // Notas privadas sobre o paciente selecionado
  notaConteudo = '';
  salvandoNota = false;
  notaSalva = false;

  async ngOnInit() {
    const perfil = await this.perfis.carregar();
    if (perfil) {
      this.linkConvite = this.conexoes.linkConvite('psicologo', perfil.user_id);
    }
    await this.carregarTudo();
    await this.carregarNota();
    await this.carregarLinhaHumor();
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
      .select('id, titulo, detalhes, tags, conversa_anexada, criado_em, user_id')
      .eq('psicologo_id', user.id)
      .order('criado_em', { ascending: true });

    this.relatoriosTodos = (data ?? []).map(r => ({
      id: r.id,
      titulo: r.titulo,
      detalhes: r.detalhes ?? '',
      tags: r.tags ?? [],
      conversaAnexada: r.conversa_anexada ?? [],
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
    this.mensagemConteudo = '';
    this.mensagemEnviada = false;
    this.conversaExpandidaId = null;
    this.carregarNota();
    this.carregarLinhaHumor();
  }

  /* ==== Mensagem pro paciente ==== */

  async enviarMensagem() {
    if (!this.mensagemConteudo.trim() || this.enviandoMensagem || !this.pacienteSelecionadoId) return;
    this.enviandoMensagem = true;
    this.mensagemEnviada = false;

    const user = await obterUsuarioValido();
    if (user) {
      const conteudo = this.mensagemConteudo.trim();
      const { error } = await supabase.from('mensagens_psicologo').insert({
        psicologo_id: user.id,
        paciente_id: this.pacienteSelecionadoId,
        conteudo,
      });

      if (!error) {
        const meuUsername = this.perfis.meuPerfil()?.username ?? 'psicologo';
        await supabase.rpc('notificar_conexao', {
          destino: this.pacienteSelecionadoId,
          titulo: `Mensagem de @${meuUsername}`,
          mensagem: conteudo,
        });
        this.mensagemConteudo = '';
        this.mensagemEnviada = true;
        setTimeout(() => (this.mensagemEnviada = false), 2500);
      }
    }
    this.enviandoMensagem = false;
  }

  /* ==== Linha do tempo do humor ==== */

  private async carregarLinhaHumor() {
    this.pontosHumor = [];
    this.caminhoHumor = '';
    this.pontoHumorAtivo = null;
    if (!this.pacienteSelecionadoId) return;

    const { data } = await supabase.rpc('humor_do_paciente', { paciente: this.pacienteSelecionadoId });
    const registros: { humor: string; criado_em: string }[] = data ?? [];
    if (registros.length < 2) return;

    const margem = { esquerda: 16, direita: 16, topo: 18, baixo: 24 };
    const larguraUtil = this.larguraLinha - margem.esquerda - margem.direita;
    const alturaUtil = this.alturaLinha - margem.topo - margem.baixo;

    this.pontosHumor = registros.map((r, i) => {
      const valor = valorDoHumor(r.humor); // 1 (ruim) a 9 (ótimo)
      return {
        x: margem.esquerda + (i / (registros.length - 1)) * larguraUtil,
        y: margem.topo + (1 - (valor - 1) / 8) * alturaUtil,
        humor: r.humor,
        data: new Date(r.criado_em),
      };
    });

    this.caminhoHumor = this.pontosHumor
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
  }

  /* ==== Conversa com a IA anexada ==== */

  toggleConversa(relatorioId: string) {
    this.conversaExpandidaId = this.conversaExpandidaId === relatorioId ? null : relatorioId;
  }

  /* ==== Notas privadas do psicólogo ==== */

  private async carregarNota() {
    this.notaConteudo = '';
    this.notaSalva = false;
    if (!this.pacienteSelecionadoId) return;

    const user = await obterUsuarioValido();
    if (!user) return;

    const { data } = await supabase
      .from('notas_psicologo')
      .select('conteudo')
      .eq('psicologo_id', user.id)
      .eq('paciente_id', this.pacienteSelecionadoId)
      .maybeSingle();

    this.notaConteudo = data?.conteudo ?? '';
  }

  async salvarNota() {
    if (this.salvandoNota || !this.pacienteSelecionadoId) return;
    this.salvandoNota = true;
    this.notaSalva = false;

    const user = await obterUsuarioValido();
    if (user) {
      const { error } = await supabase.from('notas_psicologo').upsert({
        psicologo_id: user.id,
        paciente_id: this.pacienteSelecionadoId,
        conteudo: this.notaConteudo,
        atualizado_em: new Date().toISOString(),
      });
      if (!error) {
        this.notaSalva = true;
        setTimeout(() => (this.notaSalva = false), 2500);
      }
    }
    this.salvandoNota = false;
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

  /** PDF com o resumo do paciente: gráficos de registros e emoções + notas. */
  exportarResumoPaciente() {
    const paciente = this.pacienteSelecionado;
    if (!paciente) return;

    const doc = new jsPDF();
    const roxo: [number, number, number] = [124, 58, 237];
    let y = 20;

    doc.setFontSize(18);
    doc.text(`Resumo do paciente @${paciente.outroPerfil.username}`, 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} · ${this.relatoriosDoPaciente.length} relatório(s) recebido(s)`, 14, y);
    doc.setTextColor(0);
    y += 14;

    // Gráfico de barras: registros por relatório
    const barras = this.graficoRegistros;
    if (barras.length > 0) {
      doc.setFontSize(13);
      doc.text('Registros por relatório', 14, y);
      y += 6;

      const alturaMax = 40;
      const larguraBarra = 14;
      const espaco = 8;
      const baseY = y + alturaMax;
      const maior = Math.max(1, ...barras.map(b => b.valor));

      barras.forEach((barra, i) => {
        const x = 14 + i * (larguraBarra + espaco);
        const altura = Math.max(2, (barra.valor / maior) * alturaMax);
        doc.setFillColor(...roxo);
        doc.rect(x, baseY - altura, larguraBarra, altura, 'F');
        doc.setFontSize(8);
        doc.text(String(barra.valor), x + larguraBarra / 2, baseY - altura - 1.5, { align: 'center' });
        doc.text(barra.label, x + larguraBarra / 2, baseY + 4.5, { align: 'center' });
      });
      y = baseY + 14;
    }

    // Emoções mais observadas
    const emocoes = this.emocoesFrequentes;
    if (emocoes.length > 0) {
      doc.setFontSize(13);
      doc.text('Emoções mais observadas', 14, y);
      y += 7;

      const larguraTrilho = 90;
      emocoes.forEach(emocao => {
        doc.setFontSize(10);
        doc.text(emocao.label, 14, y + 3.5);
        doc.setFillColor(230, 230, 235);
        doc.rect(55, y, larguraTrilho, 4.5, 'F');
        doc.setFillColor(...roxo);
        doc.rect(55, y, (emocao.percentual / 100) * larguraTrilho, 4.5, 'F');
        doc.text(`${emocao.percentual}%`, 55 + larguraTrilho + 4, y + 3.5);
        y += 9;
      });
      y += 6;
    }

    // Notas do psicólogo
    if (this.notaConteudo.trim()) {
      doc.setFontSize(13);
      doc.text('Minhas anotações', 14, y);
      y += 7;
      doc.setFontSize(10);
      const linhas = doc.splitTextToSize(this.notaConteudo.trim(), 180);
      linhas.forEach((linha: string) => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(linha, 14, y);
        y += 5.5;
      });
      y += 6;
    }

    // Lista de relatórios
    if (this.relatoriosDoPaciente.length > 0) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(13);
      doc.text('Relatórios recebidos', 14, y);
      y += 7;
      doc.setFontSize(10);
      this.relatoriosDoPaciente.forEach(r => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(`• ${r.criadoEm.toLocaleDateString('pt-BR')} — ${r.titulo} (${r.detalhes})`, 14, y);
        y += 6;
      });
    }

    doc.save(`resumo-${paciente.outroPerfil.username}.pdf`);
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
