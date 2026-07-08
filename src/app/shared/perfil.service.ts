import { Injectable, signal } from '@angular/core';
import { supabase } from '../integrations/supabase/client';

@Injectable({ providedIn: 'root' })
export class PerfilService {
  nome = signal('Usuário');
  email = signal('');
  iniciais = signal('U');

  private carregado = false;

  async carregar(force = false): Promise<void> {
    if (this.carregado && !force) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const nome = (user.user_metadata?.['display_name'] as string) || user.email?.split('@')[0] || 'Usuário';
    this.nome.set(nome);
    this.email.set(user.email ?? '');
    this.iniciais.set(this.gerarIniciais(nome));
    this.carregado = true;
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
    const iniciais = partes.length > 1
      ? partes[0][0] + partes[partes.length - 1][0]
      : partes[0].slice(0, 2);
    return iniciais.toUpperCase();
  }
}
