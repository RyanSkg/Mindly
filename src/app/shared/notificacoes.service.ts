import { Injectable, signal, computed } from '@angular/core';
import { supabase } from '../integrations/supabase/client';

export interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string | null;
  lida: boolean;
  criado_em: string;
}

@Injectable({ providedIn: 'root' })
export class NotificacoesService {
  lista = signal<Notificacao[]>([]);
  naoLidas = computed(() => this.lista().filter(n => !n.lida).length);

  private carregado = false;

  async carregar(force = false): Promise<void> {
    if (this.carregado && !force) return;

    const { data, error } = await supabase
      .from('notificacoes')
      .select('id, titulo, mensagem, lida, criado_em')
      .order('criado_em', { ascending: false })
      .limit(20);

    if (!error && data) {
      this.lista.set(data);
      this.carregado = true;
    }
  }

  async marcarComoLida(id: string): Promise<void> {
    this.lista.update(atual => atual.map(n => (n.id === id ? { ...n, lida: true } : n)));
    await supabase.from('notificacoes').update({ lida: true }).eq('id', id);
  }

  async marcarTodasComoLidas(): Promise<void> {
    const idsNaoLidas = this.lista().filter(n => !n.lida).map(n => n.id);
    if (idsNaoLidas.length === 0) return;

    this.lista.update(atual => atual.map(n => ({ ...n, lida: true })));
    await supabase.from('notificacoes').update({ lida: true }).in('id', idsNaoLidas);
  }

  /** Cria uma notificação para o usuário logado e atualiza a lista/badge na hora. */
  async criar(titulo: string, mensagem?: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const { data, error } = await supabase
      .from('notificacoes')
      .insert({ user_id: user.id, titulo, mensagem: mensagem ?? null })
      .select()
      .single();

    if (!error && data) {
      this.lista.update(atual => [data as Notificacao, ...atual]);
    }
  }
}
