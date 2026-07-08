import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { supabase } from '../../integrations/supabase/client';
import { emojiDoHumor } from '../../shared/humor.util';
import { TopbarActionsService } from '../../shared/topbar-actions.service';
import { PerfilService } from '../../shared/perfil.service';

interface Humor {
    id: string;
    label: string;
    emoji: string;
}

interface TagEmocao {
    label: string;
    cor: string;
}

interface AnaliseIA {
    comentario: string;
    tags: TagEmocao[];
}

interface RegistroRecente {
    id: string;
    humor: string;
    texto: string;
    data: Date;
    comentarioIA: string | null;
    tagsIA: TagEmocao[];
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

  private readonly coresTag = ['roxo', 'azul', 'verde', 'vermelho'];
  private topbarActions = inject(TopbarActionsService);
  private destroyRef = inject(DestroyRef);
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  perfil = inject(PerfilService);

  emojiDoHumor = emojiDoHumor;

  async ngOnInit() {
    await this.perfil.carregar();
    await this.carregarRegistros();
    this.topbarActions.acoes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(acao => {
      if (acao === 'analisar-ia') this.registrarHumoreAnalisar();
    });
  }

  private async carregarRegistros() {
    const { data, error } = await supabase
      .from('registros')
      .select('id, humor, texto, criado_em, comentario_ia, tags_ia')
      .order('criado_em', { ascending: false })
      .limit(8);

    if (!error && data) {
      this.registrosRecentes = data.map(r => ({
        id: r.id,
        humor: r.humor,
        texto: r.texto ?? '',
        data: new Date(r.criado_em),
        comentarioIA: r.comentario_ia,
        tagsIA: r.tags_ia ?? [],
      }));

      const maisRecente = this.registrosRecentes[0];
      if (maisRecente?.comentarioIA) {
        this.ultimaAnalise = { comentario: maisRecente.comentarioIA, tags: maisRecente.tagsIA };
      }
    }
  }

  definirSaudacao(): string {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return 'Bom dia';
    if (hora >= 12 && hora < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  private async inserirRegistro() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('registros')
      .insert({ user_id: user.id, humor: this.humorSelecionado, texto: this.textoRegistro })
      .select()
      .single();

    return !error && data ? data : null;
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
        tagsIA: [],
      });
      this.textoRegistro = '';
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
      tagsIA: [],
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

      const dados: { comentario: string; tags: string[] } = await resposta.json();
      const tags: TagEmocao[] = (dados.tags ?? []).map((label, i) => ({
        label,
        cor: this.coresTag[i % this.coresTag.length],
      }));

      novoRegistro.comentarioIA = dados.comentario;
      novoRegistro.tagsIA = tags;
      this.ultimaAnalise = { comentario: dados.comentario, tags };

      await supabase
        .from('registros')
        .update({ comentario_ia: dados.comentario, tags_ia: tags })
        .eq('id', registro.id);
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
    const confirmou = confirm('Excluir este registro? Essa ação não pode ser desfeita.');
    if (!confirmou) return;

    const { error } = await supabase.from('registros').delete().eq('id', registro.id);
    if (!error) {
      this.registrosRecentes = this.registrosRecentes.filter(r => r.id !== registro.id);
      if (this.ultimaAnalise && registro.comentarioIA === this.ultimaAnalise.comentario) {
        this.ultimaAnalise = this.registrosRecentes[0]?.comentarioIA
          ? { comentario: this.registrosRecentes[0].comentarioIA, tags: this.registrosRecentes[0].tagsIA }
          : null;
      }
    }
  }
}
