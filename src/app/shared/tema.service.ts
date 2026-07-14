import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { supabase } from '../integrations/supabase/client';

export type Tema = 'claro' | 'escuro' | 'automatico';

const CHAVE_TEMA = 'mindly-tema';
const CHAVE_ANIMACOES = 'mindly-animacoes-reduzidas';

@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));
  private mediaEscuro: MediaQueryList | null = this.navegador
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
  private temaAtual: Tema = 'escuro';

  async iniciar(): Promise<void> {
    if (!this.navegador) return;

    const temaLocal = (localStorage.getItem(CHAVE_TEMA) as Tema | null) ?? 'escuro';
    const animacoesLocal = localStorage.getItem(CHAVE_ANIMACOES) === '1';
    this.aplicarTema(temaLocal);
    this.aplicarAnimacoes(animacoesLocal);

    this.mediaEscuro?.addEventListener('change', () => {
      if (this.temaAtual === 'automatico') this.aplicarModoDoSistema();
    });

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;

    const { data } = await supabase
      .from('preferencias')
      .select('tema, animacoes_reduzidas')
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      this.aplicarTema((data.tema as Tema | null) ?? 'escuro');
      this.aplicarAnimacoes(!!data.animacoes_reduzidas);
    }
  }

  aplicarTema(tema: Tema): void {
    if (!this.navegador) return;
    this.temaAtual = tema;
    localStorage.setItem(CHAVE_TEMA, tema);
    if (tema === 'automatico') {
      this.aplicarModoDoSistema();
    } else {
      document.documentElement.setAttribute('data-theme', tema);
    }
  }

  aplicarAnimacoes(reduzidas: boolean): void {
    if (!this.navegador) return;
    localStorage.setItem(CHAVE_ANIMACOES, reduzidas ? '1' : '0');
    if (reduzidas) {
      document.documentElement.setAttribute('data-animacoes', 'reduzidas');
    } else {
      document.documentElement.removeAttribute('data-animacoes');
    }
  }

  private aplicarModoDoSistema(): void {
    const escuro = this.mediaEscuro?.matches ?? true;
    document.documentElement.setAttribute('data-theme', escuro ? 'escuro' : 'claro');
  }
}
