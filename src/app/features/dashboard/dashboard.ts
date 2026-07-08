import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import jsPDF from 'jspdf';
import { supabase } from '../../integrations/supabase/client';
import { valorDoHumor, labelDoHumor } from '../../shared/humor.util';
import { TopbarActionsService } from '../../shared/topbar-actions.service';

interface DiaDaSemana {
  id: string;
  label: string;
  v: number;
}

interface Estatistica {
  valor: string;
  label: string;
  delta: string;
  positivo: boolean;
}

interface PontoGrafico {
  x: number;
  y: number;
  label: string;
  v: number;
  melhor: boolean;
}

interface TagEmocao {
  label: string;
  cor: string;
}

interface RegistroBasico {
  humor: string;
  data: Date;
}

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  semana: DiaDaSemana[] = [
    { id: 'segunda', label: 'Seg', v: 0 },
    { id: 'terca',   label: 'Ter', v: 0 },
    { id: 'quarta',  label: 'Qua', v: 0 },
    { id: 'quinta',  label: 'Qui', v: 0 },
    { id: 'sexta',   label: 'Sex', v: 0 },
    { id: 'sabado',  label: 'Sáb', v: 0 },
    { id: 'domingo', label: 'Dom', v: 0 },
  ];

  estatisticas: Estatistica[] = [
    { valor: '0', label: 'Registros totais', delta: '—', positivo: true },
    { valor: '0', label: 'Humor médio',      delta: '—', positivo: true },
    { valor: '0', label: 'Dias ativo',       delta: '—', positivo: true },
  ];

  emocoesFrequentes: TagEmocao[] = [];

  /* ==== Geometria do gráfico de linha ==== */
  readonly largura = 560;
  readonly altura = 190;
  readonly margem = { topo: 18, direita: 16, baixo: 28, esquerda: 16 };

  pontoAtivo: number | null = null;

  pontos: PontoGrafico[] = [];
  caminhoLinha: string = '';
  caminhoArea: string = '';

  mesFiltro: string = new Date().toISOString().slice(0, 7);

  private readonly coresTag = ['roxo', 'azul', 'verde', 'vermelho'];
  private topbarActions = inject(TopbarActionsService);
  private destroyRef = inject(DestroyRef);
  private registrosTodos: RegistroBasico[] = [];

  async ngOnInit() {
    this.topbarActions.acoes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(acao => {
      if (acao.tipo === 'gerar-pdf') this.gerarRelatorio();
      if (acao.tipo === 'filtrar-mes' && acao.valor) {
        this.mesFiltro = acao.valor;
        this.aplicarFiltroMes();
      }
    });

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const { data, error } = await supabase
      .from('registros')
      .select('humor, criado_em')
      .eq('user_id', user.id);

    if (error || !data) {
      this.recalcularGrafico();
      return;
    }

    this.registrosTodos = data.map(r => ({ humor: r.humor, data: new Date(r.criado_em) }));

    this.calcularSemana(this.registrosTodos);
    this.aplicarFiltroMes();
    this.recalcularGrafico();
  }

  private aplicarFiltroMes(): void {
    const [ano, mes] = this.mesFiltro.split('-').map(Number);
    const inicioMes = new Date(ano, mes - 1, 1);
    const fimMes = new Date(ano, mes, 1);
    const registrosDoMes = this.registrosTodos.filter(r => r.data >= inicioMes && r.data < fimMes);

    const hoje = new Date();
    const ehMesAtual = ano === hoje.getFullYear() && mes - 1 === hoje.getMonth();

    this.calcularEstatisticas(registrosDoMes, ehMesAtual);
    this.calcularEmocoesFrequentes(registrosDoMes);
  }

  private inicioDaSemana(referencia: Date): Date {
    const dia = referencia.getDay();
    const diffSegunda = dia === 0 ? -6 : 1 - dia;
    const segunda = new Date(referencia);
    segunda.setHours(0, 0, 0, 0);
    segunda.setDate(referencia.getDate() + diffSegunda);
    return segunda;
  }

  private mesmoDia(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  private calcularSemana(registros: RegistroBasico[]): void {
    const segunda = this.inicioDaSemana(new Date());
    const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

    this.semana = labels.map((label, i) => {
      const dia = new Date(segunda);
      dia.setDate(segunda.getDate() + i);
      const doDia = registros.filter(r => this.mesmoDia(r.data, dia));
      const media = doDia.length
        ? doDia.reduce((soma, r) => soma + valorDoHumor(r.humor), 0) / doDia.length
        : 0;
      return { id: label.toLowerCase(), label, v: Math.round(media * 10) / 10 };
    });
  }

  private calcularDelta(atual: number, anterior: number, percentual = false): { texto: string; positivo: boolean } {
    if (anterior === 0) return { texto: atual > 0 ? 'novo' : '—', positivo: true };
    const diff = atual - anterior;
    const sinal = diff >= 0 ? '+' : '';
    if (percentual) {
      const pct = Math.round((diff / anterior) * 100);
      return { texto: `${sinal}${pct}%`, positivo: diff >= 0 };
    }
    const texto = Number.isInteger(diff) ? `${sinal}${diff}` : `${sinal}${diff.toFixed(1)}`;
    return { texto, positivo: diff >= 0 };
  }

  private calcularEstatisticas(registros: RegistroBasico[], ehMesAtual: boolean): void {
    const totalRegistros = registros.length;
    const humorMedio = totalRegistros
      ? registros.reduce((soma, r) => soma + valorDoHumor(r.humor), 0) / totalRegistros
      : 0;
    const diasUnicos = new Set(registros.map(r => r.data.toDateString()));

    let deltaRegistros = { texto: '—', positivo: true };
    let deltaHumor = { texto: '—', positivo: true };
    let deltaDias = { texto: '—', positivo: true };

    if (ehMesAtual) {
      const hoje = new Date();
      const inicioSemanaAtual = this.inicioDaSemana(hoje);
      const inicioSemanaPassada = new Date(inicioSemanaAtual);
      inicioSemanaPassada.setDate(inicioSemanaAtual.getDate() - 7);

      const estaSemana = this.registrosTodos.filter(r => r.data >= inicioSemanaAtual);
      const semanaPassada = this.registrosTodos.filter(r => r.data >= inicioSemanaPassada && r.data < inicioSemanaAtual);

      deltaRegistros = this.calcularDelta(estaSemana.length, semanaPassada.length, true);

      const mediaEstaSemana = estaSemana.length
        ? estaSemana.reduce((s, r) => s + valorDoHumor(r.humor), 0) / estaSemana.length
        : 0;
      const mediaSemanaPassada = semanaPassada.length
        ? semanaPassada.reduce((s, r) => s + valorDoHumor(r.humor), 0) / semanaPassada.length
        : 0;
      deltaHumor = this.calcularDelta(mediaEstaSemana, mediaSemanaPassada);

      const inicioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const inicioMesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);

      const diasEsteMes = new Set(
        this.registrosTodos.filter(r => r.data >= inicioMesAtual).map(r => r.data.toDateString())
      ).size;
      const diasMesPassado = new Set(
        this.registrosTodos.filter(r => r.data >= inicioMesPassado && r.data < inicioMesAtual).map(r => r.data.toDateString())
      ).size;
      deltaDias = this.calcularDelta(diasEsteMes, diasMesPassado);
    }

    this.estatisticas = [
      { valor: String(totalRegistros), label: 'Registros totais', delta: deltaRegistros.texto, positivo: deltaRegistros.positivo },
      { valor: humorMedio.toFixed(1), label: 'Humor médio',      delta: deltaHumor.texto,      positivo: deltaHumor.positivo },
      { valor: String(diasUnicos.size), label: 'Dias ativo',      delta: deltaDias.texto,       positivo: deltaDias.positivo },
    ];
  }

  private calcularEmocoesFrequentes(registros: RegistroBasico[]): void {
    const contagem = new Map<string, number>();
    registros.forEach(r => contagem.set(r.humor, (contagem.get(r.humor) ?? 0) + 1));

    this.emocoesFrequentes = [...contagem.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([humor], i) => ({
        label: labelDoHumor(humor).toLowerCase(),
        cor: this.coresTag[i % this.coresTag.length],
      }));
  }

  private recalcularGrafico(): void {
    this.pontos = this.calcularPontos();
    this.caminhoLinha = this.suavizar(this.pontos);
    this.caminhoArea = this.fecharArea(this.caminhoLinha);
  }

  private calcularPontos(): PontoGrafico[] {
    const vMax = 10;
    const larguraUtil = this.largura - this.margem.esquerda - this.margem.direita;
    const alturaUtil = this.altura - this.margem.topo - this.margem.baixo;
    const passo = larguraUtil / (this.semana.length - 1);
    const maiorValor = Math.max(...this.semana.map(d => d.v));

    return this.semana.map((dia, i) => ({
      x: this.margem.esquerda + i * passo,
      y: this.margem.topo + alturaUtil * (1 - dia.v / vMax),
      label: dia.label,
      v: dia.v,
      melhor: dia.v === maiorValor && maiorValor > 0,
    }));
  }

  /** Converte os pontos numa curva suave (Catmull-Rom → Bézier) */
  private suavizar(pts: PontoGrafico[]): string {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  private fecharArea(linha: string): string {
    if (!linha || this.pontos.length === 0) return '';
    const base = this.altura - this.margem.baixo;
    const primeiro = this.pontos[0];
    const ultimo = this.pontos[this.pontos.length - 1];
    return `${linha} L ${ultimo.x} ${base} L ${primeiro.x} ${base} Z`;
  }

  gerarRelatorio() {
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(18);
    doc.text('Mindly — Relatório de Humor', 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 14, y);
    doc.setTextColor(0);
    y += 12;

    doc.setFontSize(14);
    doc.text('Resumo', 14, y);
    y += 8;
    doc.setFontSize(11);
    this.estatisticas.forEach(e => {
      doc.text(`${e.label}: ${e.valor}  (${e.delta})`, 14, y);
      y += 7;
    });

    y += 6;
    doc.setFontSize(14);
    doc.text('Humor por dia — esta semana', 14, y);
    y += 8;
    doc.setFontSize(11);
    this.semana.forEach(d => {
      doc.text(`${d.label}: ${d.v || '—'}`, 14, y);
      y += 7;
    });

    y += 6;
    doc.setFontSize(14);
    doc.text('Emoções mais frequentes', 14, y);
    y += 8;
    doc.setFontSize(11);
    if (this.emocoesFrequentes.length === 0) {
      doc.text('Sem dados suficientes ainda.', 14, y);
    } else {
      this.emocoesFrequentes.forEach(t => {
        doc.text(`• ${t.label}`, 14, y);
        y += 7;
      });
    }

    doc.save(`mindly-dashboard-${Date.now()}.pdf`);
  }
}
