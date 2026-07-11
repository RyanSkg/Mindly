import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { supabase } from '../../integrations/supabase/client';
import { tempoRelativo } from '../../shared/tempo.util';
import { TopbarActionsService } from '../../shared/topbar-actions.service';
import { NotificacoesService } from '../../shared/notificacoes.service';
import { obterUsuarioValido } from '../../shared/sessao.util';
import { ModalService } from '../../shared/modal.service';
import { PerfisService } from '../../shared/perfis.service';
import { ConexoesService, ConexaoComPerfil } from '../../shared/conexoes.service';
import { emojiDoHumor, labelDoHumor } from '../../shared/humor.util';

interface Contato {
  id: string;
  iniciais: string;
  nome: string;
  relacao: string;
  telefone: string | null;
  status: 'disponivel' | 'ocupado' | 'nao-perturbe';
  ultimaConversa: string;
}

@Component({
  selector: 'app-oito-minutos',
  imports: [FormsModule],
  templateUrl: './oito-minutos.html',
  styleUrl: './oito-minutos.css',
})
export class OitoMinutos implements OnInit {
  mensagem: string = '';
  contatos: Contato[] = [];

  mostrarFormulario: boolean = false;
  contatoEditandoId: string | null = null;
  novoNome: string = '';
  novaRelacao: string = '';
  novoTelefone: string = '';
  salvandoContato: boolean = false;

  avisoEnviado: string = '';
  enviandoMensagem: boolean = false;
  erroContato: string = '';
  excluindoContato: boolean = false;

  // Contatos Mindly (conexões reais entre usuários)
  pendentesMindly: ConexaoComPerfil[] = [];
  contatosMindly: (ConexaoComPerfil & { humor?: string | null })[] = [];
  buscaUsername: string = '';
  buscandoMindly: boolean = false;
  erroBuscaMindly: string = '';
  meuLinkConvite: string = '';
  linkCopiado: boolean = false;
  emojiDoHumor = emojiDoHumor;
  labelDoHumor = labelDoHumor;

  private topbarActions = inject(TopbarActionsService);
  private destroyRef = inject(DestroyRef);
  private notificacoes = inject(NotificacoesService);
  private modal = inject(ModalService);
  private perfis = inject(PerfisService);
  private conexoes = inject(ConexoesService);

  carregandoContatos = true;

  async ngOnInit() {
    await this.carregarContatos();
    await this.carregarMindly();
    this.carregandoContatos = false;
    this.topbarActions.acoes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(acao => {
      if (acao.tipo === 'adicionar-contato') this.abrirFormulario();
    });
  }

  private async carregarMindly() {
    const perfil = await this.perfis.carregar();
    if (perfil) this.meuLinkConvite = this.conexoes.linkConvite('contato', perfil.user_id);

    this.pendentesMindly = await this.conexoes.listar('contato', 'pendente');
    const aceitos = await this.conexoes.listar('contato', 'aceito');

    this.contatosMindly = await Promise.all(
      aceitos.map(async c => {
        const humorInfo = await this.conexoes.buscarHumorRecente(c.outroPerfil.user_id);
        return { ...c, humor: humorInfo?.humor ?? null };
      }),
    );
  }

  async adicionarPorUsername() {
    if (!this.buscaUsername.trim() || this.buscandoMindly) return;
    this.buscandoMindly = true;
    this.erroBuscaMindly = '';

    const resultado = await this.conexoes.solicitarPorUsername(this.buscaUsername.trim(), 'contato');
    if (resultado.ok) {
      this.buscaUsername = '';
      await this.carregarMindly();
    } else {
      this.erroBuscaMindly = resultado.erro ?? 'Não foi possível enviar o pedido.';
    }
    this.buscandoMindly = false;
  }

  async responderPedidoMindly(conexaoId: string, aceitar: boolean) {
    const sucesso = await this.conexoes.responder(conexaoId, aceitar);
    if (sucesso) await this.carregarMindly();
  }

  async removerContatoMindly(conexaoId: string) {
    const confirmou = await this.modal.confirmar({
      titulo: 'Remover conexão',
      mensagem: 'Vocês vão deixar de ser contatos de confiança no Mindly. Tem certeza?',
      textoConfirmar: 'Remover',
      perigo: true,
    });
    if (!confirmou) return;

    const sucesso = await this.conexoes.remover(conexaoId);
    if (sucesso) await this.carregarMindly();
  }

  copiarLinkConvite() {
    navigator.clipboard?.writeText(this.meuLinkConvite);
    this.linkCopiado = true;
    setTimeout(() => (this.linkCopiado = false), 2000);
  }

  async avisarContatoMindly(contato: ConexaoComPerfil) {
    this.avisoEnviado = '';
    const texto = this.mensagem.trim()
      ? this.mensagem.trim()
      : 'Estou passando por um momento difícil e gostaria de conversar. Você tem 8 minutos?';

    const { error } = await supabase.rpc('avisar_contato', {
      destino: contato.outroPerfil.user_id,
      titulo: 'Um contato precisa de você',
      mensagem: texto,
    });

    this.avisoEnviado = error
      ? 'Não foi possível avisar esse contato agora.'
      : `@${contato.outroPerfil.username} foi avisado(a) dentro do Mindly.`;
  }

  private async carregarContatos() {
    const { data, error } = await supabase
      .from('contatos')
      .select('id, nome, relacao, telefone, status, criado_em')
      .order('criado_em', { ascending: true });

    if (!error && data) {
      this.contatos = data.map(c => this.mapearContato(c));
    }
  }

  private mapearContato(c: { id: string; nome: string; relacao: string; telefone: string | null; status: string; criado_em: string }): Contato {
    return {
      id: c.id,
      nome: c.nome,
      relacao: c.relacao,
      telefone: c.telefone,
      status: c.status as Contato['status'],
      iniciais: this.gerarIniciais(c.nome),
      ultimaConversa: tempoRelativo(new Date(c.criado_em)),
    };
  }

  private gerarIniciais(nome: string): string {
    const partes = nome.trim().split(/\s+/);
    const iniciais = partes.length > 1
      ? partes[0][0] + partes[partes.length - 1][0]
      : partes[0].slice(0, 2);
    return iniciais.toUpperCase();
  }

  abrirFormulario() {
    this.contatoEditandoId = null;
    this.novoNome = '';
    this.novaRelacao = '';
    this.novoTelefone = '';
    this.mostrarFormulario = true;
  }

  editarContato(contato: Contato) {
    this.contatoEditandoId = contato.id;
    this.novoNome = contato.nome;
    this.novaRelacao = contato.relacao;
    this.novoTelefone = contato.telefone ?? '';
    this.mostrarFormulario = true;
  }

  cancelarFormulario() {
    this.mostrarFormulario = false;
    this.contatoEditandoId = null;
    this.novoNome = '';
    this.novaRelacao = '';
    this.novoTelefone = '';
    this.erroContato = '';
  }

  async salvarContato() {
    if (!this.novoNome.trim() || !this.novaRelacao.trim() || this.salvandoContato) return;
    this.salvandoContato = true;
    this.erroContato = '';

    if (this.contatoEditandoId) {
      const { data, error } = await supabase
        .from('contatos')
        .update({
          nome: this.novoNome,
          relacao: this.novaRelacao,
          telefone: this.novoTelefone.trim() || null,
        })
        .eq('id', this.contatoEditandoId)
        .select()
        .single();

      if (!error && data) {
        const atualizado = this.mapearContato(data);
        this.contatos = this.contatos.map(c => (c.id === atualizado.id ? atualizado : c));
        this.cancelarFormulario();
      } else {
        this.erroContato = error?.message || 'Não foi possível salvar. Tente novamente.';
      }
      this.salvandoContato = false;
      return;
    }

    const user = await obterUsuarioValido();
    if (!user) {
      this.salvandoContato = false;
      this.erroContato = 'Sessão expirada. Atualize a página e tente de novo.';
      return;
    }

    const { data, error } = await supabase
      .from('contatos')
      .insert({
        user_id: user.id,
        nome: this.novoNome,
        relacao: this.novaRelacao,
        telefone: this.novoTelefone.trim() || null,
        status: 'disponivel',
      })
      .select()
      .single();

    if (!error && data) {
      this.contatos.push(this.mapearContato(data));
      this.cancelarFormulario();
      this.notificacoes.criar('Novo contato adicionado', `${data.nome} agora faz parte da sua rede de apoio.`);
    } else {
      this.erroContato = error?.message || 'Não foi possível salvar. Tente novamente.';
    }
    this.salvandoContato = false;
  }

  async excluirContato() {
    if (!this.contatoEditandoId || this.excluindoContato) return;

    const contato = this.contatos.find(c => c.id === this.contatoEditandoId);
    const confirmou = await this.modal.confirmar({
      titulo: 'Excluir contato',
      mensagem: `Tem certeza que deseja excluir ${contato?.nome ?? 'este contato'}? Essa ação não pode ser desfeita.`,
      textoConfirmar: 'Excluir',
      perigo: true,
    });
    if (!confirmou) return;

    this.excluindoContato = true;
    const { error } = await supabase
      .from('contatos')
      .delete()
      .eq('id', this.contatoEditandoId);

    if (!error) {
      this.contatos = this.contatos.filter(c => c.id !== this.contatoEditandoId);
      this.cancelarFormulario();
    } else {
      this.erroContato = error.message || 'Não foi possível excluir. Tente novamente.';
    }
    this.excluindoContato = false;
  }

  avisar(contato: Contato) {
    this.avisoEnviado = '';

    const texto = this.mensagem.trim()
      ? this.mensagem.trim()
      : `Oi ${contato.nome}, tudo bem? Estou passando por um momento difícil e gostaria de conversar. Você tem 8 minutos?`;

    if (contato.telefone) {
      const numero = contato.telefone.replace(/\D/g, '');
      window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, '_blank');
    } else {
      this.avisoEnviado = `${contato.nome} não tem telefone cadastrado. Edite o contato para adicionar um número e avisar por WhatsApp.`;
    }
  }

  enviarMensagem() {
    this.avisoEnviado = '';

    if (!this.mensagem.trim()) {
      this.avisoEnviado = 'Escreva como você está se sentindo antes de enviar.';
      return;
    }

    const disponivel = this.contatos.find(c => c.status === 'disponivel' && c.telefone)
      ?? this.contatos.find(c => c.telefone);

    if (!disponivel) {
      this.avisoEnviado = 'Nenhum contato com telefone cadastrado ainda. Adicione um contato de confiança primeiro.';
      return;
    }

    this.enviandoMensagem = true;
    this.avisar(disponivel);
    this.enviandoMensagem = false;
  }

  ligarCVV() {
    window.open('tel:188');
  }

  ligarSAMU() {
    window.open('tel:192');
  }
}
