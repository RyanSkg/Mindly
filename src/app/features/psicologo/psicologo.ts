import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import jsPDF from 'jspdf';
import { supabase } from '../../integrations/supabase/client';
import { labelDoHumor } from '../../shared/humor.util';
import { TopbarActionsService } from '../../shared/topbar-actions.service';

interface Relatorio {
  id: string;
  titulo: string;
  detalhes: string;
  tags: { label: string; cor: string }[];
  principal: boolean;
}

@Component({
  selector: 'app-psicologo',
  imports: [],
  templateUrl: './psicologo.html',
  styleUrl: './psicologo.css',
})
export class Psicologo implements OnInit {
  psicologa = {
    iniciais: 'DR',
    nome: 'Dra. Renata Souza',
    especialidade: 'Psicóloga clínica — CRP 06/123456',
    mensagem: 'Ótima semana, Ryan! Continue registrando seu humor diariamente.',
    conectada: true,
  };

  relatorios: Relatorio[] = [];
  enviando: boolean = false;

  private readonly coresTag = ['roxo', 'azul', 'verde', 'vermelho'];
  private readonly meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];

  private topbarActions = inject(TopbarActionsService);
  private destroyRef = inject(DestroyRef);

  async ngOnInit() {
    await this.carregarRelatorios();
    this.topbarActions.acoes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(acao => {
      if (acao === 'enviar-relatorio') this.enviarRelatorio();
    });
  }

  private async carregarRelatorios() {
    const { data, error } = await supabase
      .from('relatorios')
      .select('id, titulo, detalhes, tags, criado_em')
      .order('criado_em', { ascending: false });

    if (!error && data) {
      this.relatorios = data.map((r, i) => ({
        id: r.id,
        titulo: r.titulo,
        detalhes: r.detalhes ?? '',
        tags: r.tags ?? [],
        principal: i === 0,
      }));
    }
  }

  async enviarRelatorio() {
    if (this.enviando) return;
    this.enviando = true;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      this.enviando = false;
      return;
    }

    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    const { data: registros } = await supabase
      .from('registros')
      .select('humor, criado_em')
      .eq('user_id', user.id)
      .gte('criado_em', inicioMes.toISOString());

    const lista = registros ?? [];
    const diasUnicos = new Set(lista.map(r => new Date(r.criado_em).toDateString())).size;
    const semanas = Math.max(1, Math.ceil(diasUnicos / 7));

    const contagem = new Map<string, number>();
    lista.forEach(r => contagem.set(r.humor, (contagem.get(r.humor) ?? 0) + 1));
    const tags = [...contagem.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([humor], i) => ({ label: labelDoHumor(humor).toLowerCase(), cor: this.coresTag[i % this.coresTag.length] }));

    const titulo = `Relatório — ${this.meses[hoje.getMonth()]} ${hoje.getFullYear()}`;
    const detalhes = `${lista.length} registros · ${semanas} semana${semanas > 1 ? 's' : ''}`;

    const { data, error } = await supabase
      .from('relatorios')
      .insert({ user_id: user.id, titulo, detalhes, tags })
      .select()
      .single();

    if (!error && data) {
      this.relatorios = this.relatorios.map(r => ({ ...r, principal: false }));
      this.relatorios.unshift({ id: data.id, titulo: data.titulo, detalhes: data.detalhes, tags: data.tags, principal: true });
    }
    this.enviando = false;
  }

  agendarConsulta() {}

  baixarRelatorio(relatorio: Relatorio) {
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(16);
    doc.text(relatorio.titulo, 14, y);
    y += 10;

    doc.setFontSize(11);
    doc.setTextColor(120);
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
