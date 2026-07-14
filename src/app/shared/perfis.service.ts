import { Injectable, signal } from '@angular/core';
import { supabase } from '../integrations/supabase/client';

export type TipoConta = 'usuario' | 'psicologo';

export interface Perfil {
  user_id: string;
  username: string;
  tipo: TipoConta;
  aprovado: boolean;
  admin?: boolean;
  crp: string | null;
  especialidade: string | null;
}

@Injectable({ providedIn: 'root' })
export class PerfisService {
  meuPerfil = signal<Perfil | null>(null);

  private carregado = false;

  async carregar(force = false): Promise<Perfil | null> {
    if (this.carregado && !force) return this.meuPerfil();

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return null;

    let { data } = await supabase.from('perfis').select('*').eq('user_id', user.id).maybeSingle();

    if (!data) {
      const tipo: TipoConta =
        user.user_metadata?.['tipo_conta'] === 'psicologo' ? 'psicologo' : 'usuario';
      const nomeBase = user.user_metadata?.['display_name'] ?? user.email ?? 'usuario';
      data = await this.criarPerfil(user.id, nomeBase, tipo, {
        crp: user.user_metadata?.['crp'] ?? null,
        especialidade: user.user_metadata?.['especialidade'] ?? null,
      });
    }

    this.meuPerfil.set(data as Perfil | null);
    this.carregado = true;
    return this.meuPerfil();
  }

  /** Usado no cadastro, quando já sabemos se é usuário comum ou psicólogo. */
  async criarPerfil(
    userId: string,
    baseNome: string,
    tipo: TipoConta,
    extra?: { crp?: string | null; especialidade?: string | null },
  ): Promise<Perfil | null> {
    const usernameBase = this.normalizarUsername(baseNome);

    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const username =
        tentativa === 0
          ? usernameBase
          : `${usernameBase}${Math.floor(1000 + Math.random() * 9000)}`;

      const { data, error } = await supabase
        .from('perfis')
        .insert({
          user_id: userId,
          username,
          tipo,
          aprovado: tipo === 'usuario',
          crp: extra?.crp ?? null,
          especialidade: extra?.especialidade ?? null,
        })
        .select()
        .single();

      if (!error && data) return data as Perfil;
      // 23505 = unique_violation (username já existe) — tenta de novo com sufixo
      if (error && error.code !== '23505') break;
    }

    return null;
  }

  async buscarPorUsername(username: string): Promise<Perfil | null> {
    const alvo = username.trim().replace(/^@/, '').toLowerCase();
    if (!alvo) return null;

    const { data } = await supabase.from('perfis').select('*').eq('username', alvo).maybeSingle();
    return (data as Perfil | null) ?? null;
  }

  async buscarPorUserId(userId: string): Promise<Perfil | null> {
    const { data } = await supabase.from('perfis').select('*').eq('user_id', userId).maybeSingle();
    return (data as Perfil | null) ?? null;
  }

  async atualizarUsername(novoUsername: string): Promise<{ ok: boolean; erro?: string }> {
    const perfil = this.meuPerfil();
    if (!perfil) return { ok: false, erro: 'Perfil não carregado.' };

    const username = this.normalizarUsername(novoUsername);
    if (!username) return { ok: false, erro: 'Nome de usuário inválido.' };

    const { data, error } = await supabase
      .from('perfis')
      .update({ username })
      .eq('user_id', perfil.user_id)
      .select()
      .single();

    if (error) {
      const erro =
        error.code === '23505'
          ? 'Esse nome de usuário já está em uso.'
          : 'Não foi possível salvar.';
      return { ok: false, erro };
    }

    this.meuPerfil.set(data as Perfil);
    return { ok: true };
  }

  private normalizarUsername(texto: string): string {
    return (
      texto
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9._]/g, '')
        .slice(0, 20) || 'usuario'
    );
  }
}
