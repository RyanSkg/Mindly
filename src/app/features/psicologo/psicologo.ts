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
import { ConexoesService, ConexaoComPerfil } from '../../shared/conexoes.service';

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
  psicologosConectados: ConexaoComPerfil[] = [];
  pendentesEnviados: ConexaoComPerfil[] = [];
  pendentesRecebidos: ConexaoComPerfil[] = [];
  psicologoSelecionadoId: string | null = null;
  ultimasMensagens = new Map<string, string>();

  buscaUsername = '';
  buscandoPsicologo = false;
  erroBuscaPsicologo = '';

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
  private conexoes = inject(ConexoesService);

  async ngOnInit() {
    await this.perfil.carregar();
    await this.carregarConexoes();
    await this.carregarRelatorios();
    await this.verificarConversaDisponivel();
    this.topbarActions.acoes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(acao => {
      if (acao.tipo === 'enviar-relatorio') this.enviarRelatorio();
    });
  }

  private async carregarConexoes() {
    this.psicologosConectados = await this.conexoes.listar('psicologo', 'aceito');
    const pendentes = await this.conexoes.listar('psicologo', 'pendente');
    this.pendentesEnviados = pendentes.filter(p => p.souSolicitante);
    this.pendentesRecebidos = pendentes.filter(p => !p.souSolicitante);
    if (this.psicologosConectados.length > 0 && !this.psicologoSelecionadoId) {
      this.psicologoSelecionadoId = this.psicologosConectados[0].outroPerfil.user_id;
    }
    await this.carregarUltimasMensagens();
  }

  /** Última mensagem que cada psicólogo(a) conectado(a) mandou (aparece no card). */
  private async carregarUltimasMensagens() {
    this.ultimasMensagens.clear();
    if (this.psicologosConectados.length === 0) return;

    const { data } = await supabase
      .from('mensagens_psicologo')
      .select('psicologo_id, conteudo, criado_em')
      .order('criado_em', { ascending: false })
      .limit(30);

    for (const m of data ?? []) {
      if (!this.ultimasMensagens.has(m.psicologo_id)) {
        this.ultimasMensagens.set(m.psicologo_id, m.conteudo);
      }
    }
  }

  async responderPedido(conexaoId: string, aceitar: boolean) {
    const sucesso = await this.conexoes.responder(conexaoId, aceitar);
    if (sucesso) await this.carregarConexoes();
  }

  async adicionarPsicologo() {
    if (!this.buscaUsername.trim() || this.buscandoPsicologo) return;
    this.buscandoPsicologo = true;
    this.erroBuscaPsicologo = '';

    const resultado = await this.conexoes.solicitarPorUsername(this.buscaUsername.trim(), 'psicologo');
    if (resultado.ok) {
      this.buscaUsername = '';
      await this.carregarConexoes();
    } else {
      this.erroBuscaPsicologo = resultado.erro ?? 'Não foi possível enviar o pedido.';
    }
    this.buscandoPsicologo = false;
  }

  async removerPsicologo(conexaoId: string) {
    const confirmou = await this.modal.confirmar({
      titulo: 'Remover psicólogo(a)',
      mensagem: 'Vocês vão deixar de estar conectados no Mindly. Tem certeza?',
      textoConfirmar: 'Remover',
      perigo: true,
    });
    if (!confirmou) return;

    const sucesso = await this.conexoes.remover(conexaoId);
    if (sucesso) await this.carregarConexoes();
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
    if (this.enviando || !this.psicologoSelecionadoId) return;
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
      .insert({
        user_id: user.id,
        psicologo_id: this.psicologoSelecionadoId,
        titulo,
        detalhes,
        tags,
        conversa_anexada: conversaAnexada,
      })
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
      const psicologo = this.psicologosConectados.find(p => p.outroPerfil.user_id === this.psicologoSelecionadoId);
      this.notificacoes.criar('Relatório enviado', `${data.titulo} foi enviado para @${psicologo?.outroPerfil.username ?? 'seu(sua) psicólogo(a)'}.`);
      this.incluirConversa = false;
    } else {
      this.modal.avisar({ titulo: 'Não foi possível enviar', mensagem: 'Algo deu errado ao enviar o relatório. Tente novamente.' });
    }
    this.enviando = false;
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
