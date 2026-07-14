import { Injectable, signal } from '@angular/core';
import { supabase } from '../integrations/supabase/client';

@Injectable({ providedIn: 'root' })
export class PerfilService {
  nome = signal('Usuário');
  email = signal('');
  iniciais = signal('U');
  membroDesde = signal<Date | null>(null);
  tempoAtivo = signal('');

  private carregado = false;

  async carregar(force = false): Promise<void> {
    if (this.carregado && !force) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const nome =
      (user.user_metadata?.['display_name'] as string) || user.email?.split('@')[0] || 'Usuário';
    this.nome.set(nome);
    this.email.set(user.email ?? '');
    this.iniciais.set(this.gerarIniciais(nome));

    if (user.created_at) {
      const criadoEm = new Date(user.created_at);
      this.membroDesde.set(criadoEm);
      this.tempoAtivo.set(this.calcularTempoAtivo(criadoEm));
    }

    this.carregado = true;
  }

  private calcularTempoAtivo(criadoEm: Date): string {
    const dias = Math.floor((Date.now() - criadoEm.getTime()) / (1000 * 60 * 60 * 24));
    if (dias < 1) return 'Ativo hoje';
    if (dias < 7) return `${dias} dia${dias > 1 ? 's' : ''} ativo`;
    const semanas = Math.floor(dias / 7);
    if (semanas < 5) return `${semanas} semana${semanas > 1 ? 's' : ''} ativo`;
    const meses = Math.floor(dias / 30);
    if (meses < 12) return `${meses} ${meses > 1 ? 'meses' : 'mês'} ativo`;
    const anos = Math.floor(dias / 365);
    return `${anos} ano${anos > 1 ? 's' : ''} ativo`;
  }

  async atualizarNome(novoNome: string): Promise<boolean> {
    const nome = novoNome.trim();
    if (!nome) return false;

    const { error } = await supabase.auth.updateUser({ data: { display_name: nome } });
    if (error) return false;

    this.nome.set(nome);
    this.iniciais.set(this.gerarIniciais(nome));
    return true;
  }

  private gerarIniciais(nome: string): string {
    const partes = nome.trim().split(/\s+/);
    const iniciais =
      partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : partes[0].slice(0, 2);
    return iniciais.toUpperCase();
  }
}
