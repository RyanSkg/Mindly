import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import jsPDF from 'jspdf';
import { supabase } from '../../integrations/supabase/client';
import { labelDoHumor } from '../../shared/humor.util';
import { TopbarActionsService } from '../../shared/topbar-actions.service';
import { PerfilService } from '../../shared/perfil.service';
import { NotificacoesService } from '../../shared/notificacoes.service';
import { obterUsuarioValido } from '../../shared/sessao.util';
import { ModalService } from '../../shared/modal.service';

interface MensagemConversa {
  role: 'user' | 'assistant';
  content: string;
}

interface Relatorio {
  id: string;
  titulo: string;
  detalhes: string;
  tags: { label: string; cor: string }[];
  conversaAnexada: MensagemConversa[];
  principal: boolean;
}

@Component({
  selector: 'app-psicologo',
  imports: [FormsModule],
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
    email: 'renata.souza@mindly-exemplo.com',
  };

  relatorios: Relatorio[] = [];
  enviando: boolean = false;
  incluirConversa: boolean = false;
  temConversaDisponivel: boolean = false;

  private readonly coresTag = ['roxo', 'azul', 'verde', 'vermelho'];
  private readonly meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];

  private topbarActions = inject(TopbarActionsService);
  private destroyRef = inject(DestroyRef);
  private perfil = inject(PerfilService);
  private notificacoes = inject(NotificacoesService);
  private modal = inject(ModalService);

  async ngOnInit() {
    await this.perfil.carregar();
    await this.carregarRelatorios();
    await this.verificarConversaDisponivel();
    this.topbarActions.acoes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(acao => {
      if (acao.tipo === 'enviar-relatorio') this.enviarRelatorio();
    });
  }

  private async carregarRelatorios() {
    const { data, error } = await supabase
      .from('relatorios')
      .select('id, titulo, detalhes, tags, conversa_anexada, criado_em')
      .order('criado_em', { ascending: false });

    if (!error && data) {
      this.relatorios = data.map((r, i) => ({
        id: r.id,
        titulo: r.titulo,
        detalhes: r.detalhes ?? '',
        tags: r.tags ?? [],
        conversaAnexada: r.conversa_anexada ?? [],
        principal: i === 0,
      }));
    }
  }

  private async verificarConversaDisponivel() {
    const { data } = await supabase
      .from('registros')
      .select('conversa_ia')
      .not('conversa_ia', 'is', null)
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    this.temConversaDisponivel = !!(data?.conversa_ia && data.conversa_ia.length > 0);
  }

  async enviarRelatorio() {
    if (this.enviando) return;
    this.enviando = true;

    const user = await obterUsuarioValido();
    if (!user) {
      this.enviando = false;
      this.modal.avisar({ titulo: 'Sessão expirada', mensagem: 'Atualize a página e tente enviar o relatório de novo.' });
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

    let conversaAnexada: MensagemConversa[] = [];
    if (this.incluirConversa) {
      const { data: registroComConversa } = await supabase
        .from('registros')
        .select('conversa_ia')
        .eq('user_id', user.id)
        .not('conversa_ia', 'is', null)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      conversaAnexada = registroComConversa?.conversa_ia ?? [];
    }

    const { data, error } = await supabase
      .from('relatorios')
      .insert({ user_id: user.id, titulo, detalhes, tags, conversa_anexada: conversaAnexada })
      .select()
      .single();

    if (!error && data) {
      this.relatorios = this.relatorios.map(r => ({ ...r, principal: false }));
      this.relatorios.unshift({
        id: data.id,
        titulo: data.titulo,
        detalhes: data.detalhes,
        tags: data.tags,
        conversaAnexada: data.conversa_anexada ?? [],
        principal: true,
      });
      this.notificacoes.criar('Relatório enviado', `${data.titulo} foi enviado para ${this.psicologa.nome}.`);
      this.incluirConversa = false;
    } else {
      this.modal.avisar({ titulo: 'Não foi possível enviar', mensagem: 'Algo deu errado ao enviar o relatório. Tente novamente.' });
    }
    this.enviando = false;
  }

  agendarConsulta() {
    const assunto = encodeURIComponent('Agendamento de consulta - Mindly');
    const corpo = encodeURIComponent(
      `Olá ${this.psicologa.nome},\n\nGostaria de agendar uma consulta. Poderia me passar os horários disponíveis?\n\nObrigado(a),\n${this.perfil.nome()}`
    );
    window.open(`mailto:${this.psicologa.email}?subject=${assunto}&body=${corpo}`);
  }

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
      y += 4;
    }

    if (relatorio.conversaAnexada.length > 0) {
      doc.setFontSize(12);
      doc.text('Conversa com a IA:', 14, y);
      y += 8;
      doc.setFontSize(10);
      relatorio.conversaAnexada.forEach(msg => {
        const prefixo = msg.role === 'user' ? 'Paciente: ' : 'IA: ';
        const linhas = doc.splitTextToSize(prefixo + msg.content, 180);
        linhas.forEach((linha: string) => {
          if (y > 280) {
            doc.addPage();
            y = 20;
          }
          doc.text(linha, 14, y);
          y += 6;
        });
        y += 2;
      });
    }

    const nomeArquivo = relatorio.titulo.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
    doc.save(`${nomeArquivo}.pdf`);
  }
}
