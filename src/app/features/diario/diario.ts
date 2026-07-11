import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { supabase } from '../../integrations/supabase/client';
import { emojiDoHumor } from '../../shared/humor.util';
import { TopbarActionsService } from '../../shared/topbar-actions.service';
import { PerfilService } from '../../shared/perfil.service';
import { NotificacoesService } from '../../shared/notificacoes.service';
import { ModalService } from '../../shared/modal.service';
import { obterUsuarioValido } from '../../shared/sessao.util';

interface Humor {
    id: string;
    label: string;
    emoji: string;
}

interface TagEmocao {
    label: string;
    cor: string;
}

interface ConteudoSugerido {
    tipo: 'ler' | 'assistir' | 'ouvir';
    sugestao: string;
}

interface AnaliseIA {
    comentario: string;
    sugestao: string;
    conteudos: ConteudoSugerido[];
    tags: TagEmocao[];
}

interface RegistroRecente {
    id: string;
    humor: string;
    texto: string;
    data: Date;
    comentarioIA: string | null;
    sugestaoIA: string | null;
    conteudosIA: ConteudoSugerido[];
    tagsIA: TagEmocao[];
    conversaIA: MensagemConversa[];
}

interface MensagemConversa {
    role: 'user' | 'assistant';
    content: string;
}

@Component({
  selector: 'app-diario',
  imports: [FormsModule, DatePipe],
  templateUrl: './diario.html',
  styleUrl: './diario.css',
})

export class Diario implements OnInit {
  listaHumor: Humor[] = [
    { id: 'bem', label: 'Bem', emoji: '😊' },
    { id: 'ansioso', label: 'Ansioso', emoji: '😰' },
    { id: 'neutro', label: 'Neutro', emoji: '😐' },
    { id: 'triste', label: 'Triste', emoji: '😢' },
    { id: 'motivado', label: 'Motivado', emoji: '🔥' },
    { id: 'receioso', label: 'Receioso', emoji: '😟' },
    { id: 'irritado', label: 'Irritado', emoji: '😤' },
    { id: 'inseguro', label: 'Inseguro', emoji: '😬' },
    { id: 'otimista', label: 'Otimista', emoji: '🌟' },
    { id: 'pessimista', label: 'Pessimista', emoji: '😔' },
    { id: 'envergonhado', label: 'Envergonhado', emoji: '😳' },
    { id: 'cansado', label: 'Cansado', emoji: '😴' },
    { id: 'confuso', label: 'Confuso', emoji: '😵' },
    { id: 'frustrado', label: 'Frustrado', emoji: '😣' },
  ];

  saudacao: string = this.definirSaudacao();
  dropdownAberto: boolean = false;
  humorSelecionado: string = 'ansioso';
  textoRegistro: string = '';
  registrosRecentes: RegistroRecente[] = [];
  salvando: boolean = false;
  analisando: boolean = false;
  erroAnalise: string = '';
  ultimaAnalise: AnaliseIA | null = null;

  gravando: boolean = false;
  transcrevendo: boolean = false;

  modoSelecao: boolean = false;
  selecionados: Set<string> = new Set();
  excluindoSelecionados: boolean = false;

  filtroData: string | null = null;
  carregandoRegistros: boolean = false;

  conversaAberta: boolean = false;
  mensagensConversa: MensagemConversa[] = [];
  novaMensagem: string = '';
  enviandoConversa: boolean = false;
  erroConversa: string = '';
  ultimaAnaliseRegistroId: string | null = null;

  private readonly coresTag = ['roxo', 'azul', 'verde', 'vermelho'];
  private topbarActions = inject(TopbarActionsService);
  private destroyRef = inject(DestroyRef);
  private notificacoes = inject(NotificacoesService);
  private modal = inject(ModalService);
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private alertasIAHabilitado = true;
  perfil = inject(PerfilService);

  emojiDoHumor = emojiDoHumor;

  async ngOnInit() {
    await this.perfil.carregar();
    await this.carregarRegistros();
    this.carregarPreferenciaAlertasIA();
    this.topbarActions.acoes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(acao => {
      if (acao.tipo === 'analisar-ia') this.registrarHumoreAnalisar();
      if (acao.tipo === 'filtrar-data' && acao.valor) this.filtrarPorData(acao.valor);
    });
  }

  private async carregarPreferenciaAlertasIA() {
    const user = await obterUsuarioValido();
    if (!user) return;
    const { data } = await supabase
      .from('preferencias')
      .select('alertas_ia')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) this.alertasIAHabilitado = data.alertas_ia;
  }

  async filtrarPorData(data: string) {
    const hoje = new Date().toISOString().slice(0, 10);
    this.filtroData = data === hoje ? null : data;
    await this.carregarRegistros();
  }

  limparFiltroData() {
    this.filtroData = null;
    this.carregarRegistros();
  }

  private async carregarRegistros() {
    this.carregandoRegistros = true;

    let query = supabase
      .from('registros')
      .select('id, humor, texto, criado_em, comentario_ia, sugestao_ia, conteudos_ia, tags_ia, conversa_ia')
      .order('criado_em', { ascending: false });

    if (this.filtroData) {
      const inicio = new Date(`${this.filtroData}T00:00:00`);
      const fim = new Date(inicio);
      fim.setDate(fim.getDate() + 1);
      query = query.gte('criado_em', inicio.toISOString()).lt('criado_em', fim.toISOString());
    } else {
      query = query.limit(8);
    }

    const { data, error } = await query;

    if (!error && data) {
      this.registrosRecentes = data.map(r => ({
        id: r.id,
        humor: r.humor,
        texto: r.texto ?? '',
        data: new Date(r.criado_em),
        comentarioIA: r.comentario_ia,
        sugestaoIA: r.sugestao_ia,
        conteudosIA: r.conteudos_ia ?? [],
        tagsIA: r.tags_ia ?? [],
        conversaIA: r.conversa_ia ?? [],
      }));

      const maisRecente = this.registrosRecentes[0];
      if (maisRecente?.comentarioIA) {
        this.ultimaAnalise = {
          comentario: maisRecente.comentarioIA,
          sugestao: maisRecente.sugestaoIA ?? '',
          conteudos: maisRecente.conteudosIA,
          tags: maisRecente.tagsIA,
        };
        this.ultimaAnaliseRegistroId = maisRecente.id;
        this.mensagensConversa = maisRecente.conversaIA;
      }
    }
    this.carregandoRegistros = false;
  }

  definirSaudacao(): string {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return 'Bom dia';
    if (hora >= 12 && hora < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  private async inserirRegistro() {
    const user = await obterUsuarioValido();
    if (!user) {
      this.erroAnalise = 'Sessão expirada. Atualize a página e tente de novo.';
      return null;
    }

    const { data, error } = await supabase
      .from('registros')
      .insert({ user_id: user.id, humor: this.humorSelecionado, texto: this.textoRegistro })
      .select()
      .single();

    if (error || !data) {
      this.erroAnalise = 'Não foi possível salvar. Atualize a página e tente de novo.';
      return null;
    }

    this.notificarMarco(user.id);
    return data;
  }

  private async notificarMarco(userId: string) {
    const { count } = await supabase
      .from('registros')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (count && count % 5 === 0) {
      this.notificacoes.criar('Parabéns! 🎉', `Você já tem ${count} registros no seu Diário. Continue assim!`);
    }
  }

  async registrarHumor() {
    if (!this.humorSelecionado || this.salvando) return;
    this.salvando = true;

    const registro = await this.inserirRegistro();
    if (registro) {
      this.registrosRecentes.unshift({
        id: registro.id,
        humor: registro.humor,
        texto: registro.texto ?? '',
        data: new Date(registro.criado_em),
        comentarioIA: null,
        sugestaoIA: null,
        conteudosIA: [],
        tagsIA: [],
        conversaIA: [],
      });
      this.textoRegistro = '';
    } else if (this.erroAnalise) {
      this.modal.avisar({ titulo: 'Não foi possível salvar', mensagem: this.erroAnalise });
    }
    this.salvando = false;
  }

  async registrarHumoreAnalisar() {
    if (!this.humorSelecionado || this.salvando || this.analisando) return;
    this.salvando = true;
    this.analisando = true;
    this.erroAnalise = '';

    const registro = await this.inserirRegistro();
    if (!registro) {
      this.salvando = false;
      this.analisando = false;
      return;
    }

    const novoRegistro: RegistroRecente = {
      id: registro.id,
      humor: registro.humor,
      texto: registro.texto ?? '',
      data: new Date(registro.criado_em),
      comentarioIA: null,
      sugestaoIA: null,
      conteudosIA: [],
      tagsIA: [],
      conversaIA: [],
    };
    this.registrosRecentes.unshift(novoRegistro);
    this.textoRegistro = '';
    this.salvando = false;

    try {
      const resposta = await fetch('/api/analisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          humor: registro.humor,
          emoji: emojiDoHumor(registro.humor),
          texto: registro.texto,
        }),
      });

      if (!resposta.ok) {
        throw new Error('Não foi possível analisar agora.');
      }

      const dados: { comentario: string; sugestao: string; conteudos: ConteudoSugerido[]; tags: string[] } = await resposta.json();
      const tags: TagEmocao[] = (dados.tags ?? []).map((label, i) => ({
        label,
        cor: this.coresTag[i % this.coresTag.length],
      }));
      const conteudos = dados.conteudos ?? [];

      novoRegistro.comentarioIA = dados.comentario;
      novoRegistro.sugestaoIA = dados.sugestao ?? null;
      novoRegistro.conteudosIA = conteudos;
      novoRegistro.tagsIA = tags;
      this.ultimaAnalise = { comentario: dados.comentario, sugestao: dados.sugestao ?? '', conteudos, tags };
      this.ultimaAnaliseRegistroId = registro.id;
      this.mensagensConversa = [];
      this.conversaAberta = false;

      await supabase
        .from('registros')
        .update({
          comentario_ia: dados.comentario,
          sugestao_ia: dados.sugestao ?? null,
          conteudos_ia: conteudos,
          tags_ia: tags,
        })
        .eq('id', registro.id);

      if (this.alertasIAHabilitado) {
        this.notificacoes.criar('Análise da IA pronta', 'A reflexão sobre o seu registro mais recente já está disponível no Diário.');
      }
    } catch (err) {
      this.erroAnalise = err instanceof Error ? err.message : 'Erro ao analisar';
    } finally {
      this.analisando = false;
    }
  }

  async audio() {
    if (this.gravando) {
      this.mediaRecorder?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        this.gravando = false;
        await this.transcreverAudio();
      };

      this.mediaRecorder.start();
      this.gravando = true;
      this.erroAnalise = '';
    } catch {
      this.erroAnalise = 'Não foi possível acessar o microfone. Verifique as permissões do navegador.';
    }
  }

  private async transcreverAudio() {
    if (this.audioChunks.length === 0) return;
    this.transcrevendo = true;

    const blob = new Blob(this.audioChunks, { type: 'audio/webm' });

    try {
      const resposta = await fetch('/api/transcrever', {
        method: 'POST',
        headers: { 'Content-Type': 'audio/webm' },
        body: blob,
      });

      if (!resposta.ok) throw new Error('Não foi possível transcrever o áudio.');

      const dados: { texto: string } = await resposta.json();
      this.textoRegistro = this.textoRegistro
        ? `${this.textoRegistro} ${dados.texto}`.trim()
        : dados.texto;
    } catch (err) {
      this.erroAnalise = err instanceof Error ? err.message : 'Erro ao transcrever áudio';
    } finally {
      this.transcrevendo = false;
    }
  }

  toggleDropdown() {
    this.dropdownAberto = !this.dropdownAberto;
  }

  toggleHumor(id: string) {
    this.humorSelecionado = this.humorSelecionado === id ? '' : id;
    this.dropdownAberto = false;
  }

  async excluirRegistro(registro: RegistroRecente) {
    const confirmou = await this.modal.confirmar({
      titulo: 'Excluir registro',
      mensagem: 'Excluir este registro? Essa ação não pode ser desfeita.',
      textoConfirmar: 'Excluir',
      perigo: true,
    });
    if (!confirmou) return;

    const { error } = await supabase.from('registros').delete().eq('id', registro.id);
    if (!error) {
      this.registrosRecentes = this.registrosRecentes.filter(r => r.id !== registro.id);
      this.atualizarAnaliseAposExclusao(new Set([registro.id]));
    }
  }

  toggleModoSelecao() {
    this.modoSelecao = !this.modoSelecao;
    this.selecionados.clear();
  }

  toggleSelecao(id: string) {
    if (this.selecionados.has(id)) {
      this.selecionados.delete(id);
    } else {
      this.selecionados.add(id);
    }
  }

  selecionarTodos() {
    if (this.selecionados.size === this.registrosRecentes.length) {
      this.selecionados.clear();
    } else {
      this.registrosRecentes.forEach(r => this.selecionados.add(r.id));
    }
  }

  private atualizarAnaliseAposExclusao(idsExcluidos: Set<string>) {
    if (this.ultimaAnalise && this.ultimaAnaliseRegistroId && idsExcluidos.has(this.ultimaAnaliseRegistroId)) {
      const proximo = this.registrosRecentes[0];
      this.ultimaAnalise = proximo?.comentarioIA
        ? {
            comentario: proximo.comentarioIA,
            sugestao: proximo.sugestaoIA ?? '',
            conteudos: proximo.conteudosIA,
            tags: proximo.tagsIA,
          }
        : null;
      this.ultimaAnaliseRegistroId = proximo?.comentarioIA ? proximo.id : null;
      this.mensagensConversa = proximo?.conversaIA ?? [];
      this.conversaAberta = false;
    }
  }

  async excluirSelecionados() {
    if (this.selecionados.size === 0 || this.excluindoSelecionados) return;

    const quantidade = this.selecionados.size;
    const confirmou = await this.modal.confirmar({
      titulo: 'Excluir registros',
      mensagem: `Excluir ${quantidade} registro${quantidade > 1 ? 's' : ''}? Essa ação não pode ser desfeita.`,
      textoConfirmar: 'Excluir',
      perigo: true,
    });
    if (!confirmou) return;

    this.excluindoSelecionados = true;
    const ids = [...this.selecionados];

    const { error } = await supabase.from('registros').delete().in('id', ids);
    if (!error) {
      const idsExcluidos = new Set(ids);
      this.registrosRecentes = this.registrosRecentes.filter(r => !idsExcluidos.has(r.id));
      this.atualizarAnaliseAposExclusao(idsExcluidos);
      this.selecionados.clear();
      this.modoSelecao = false;
    }
    this.excluindoSelecionados = false;
  }

  abrirConversa() {
    if (!this.ultimaAnalise) return;
    this.conversaAberta = true;
    this.erroConversa = '';

    if (this.mensagensConversa.length === 0) {
      const primeiraMensagem = this.ultimaAnalise.sugestao
        ? `${this.ultimaAnalise.comentario} ${this.ultimaAnalise.sugestao}`
        : this.ultimaAnalise.comentario;
      this.mensagensConversa.push({ role: 'assistant', content: primeiraMensagem });
    }
  }

  fecharConversa() {
    this.conversaAberta = false;
  }

  async enviarMensagemConversa() {
    const texto = this.novaMensagem.trim();
    if (!texto || this.enviandoConversa) return;

    this.mensagensConversa.push({ role: 'user', content: texto });
    this.novaMensagem = '';
    this.enviandoConversa = true;
    this.erroConversa = '';

    try {
      const resposta = await fetch('/api/conversar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagens: this.mensagensConversa }),
      });

      if (!resposta.ok) {
        throw new Error('Não foi possível responder agora.');
      }

      const dados: { resposta: string } = await resposta.json();
      this.mensagensConversa.push({ role: 'assistant', content: dados.resposta });
      await this.salvarConversa();
    } catch (err) {
      this.erroConversa = err instanceof Error ? err.message : 'Erro ao conversar';
    } finally {
      this.enviandoConversa = false;
    }
  }

  private async salvarConversa() {
    if (!this.ultimaAnaliseRegistroId) return;

    await supabase
      .from('registros')
      .update({ conversa_ia: this.mensagensConversa })
      .eq('id', this.ultimaAnaliseRegistroId);

    const registro = this.registrosRecentes.find(r => r.id === this.ultimaAnaliseRegistroId);
    if (registro) registro.conversaIA = this.mensagensConversa;
  }
}
