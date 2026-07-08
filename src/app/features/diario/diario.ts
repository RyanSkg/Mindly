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

  private readonly coresTag = ['roxo', 'azul', 'verde', 'vermelho'];
  private topbarActions = inject(TopbarActionsService);
  private destroyRef = inject(DestroyRef);
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
        body: JSON.stringify({ humor: registro.humor, texto: registro.texto }),
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

  audio() {
  }

  toggleDropdown() {
    this.dropdownAberto = !this.dropdownAberto;
  }

  toggleHumor(id: string) {
    this.humorSelecionado = this.humorSelecionado === id ? '' : id;
    this.dropdownAberto = false;
  }
}
