import { Injectable, inject } from '@angular/core';
import { supabase } from '../integrations/supabase/client';
import { PerfisService, Perfil } from './perfis.service';
import { obterUsuarioValido } from './sessao.util';

export type TipoConexao = 'contato' | 'psicologo';

export interface ConexaoComPerfil {
  id: string;
  solicitanteId: string;
  destinatarioId: string;
  status: 'pendente' | 'aceito' | 'recusado';
  criadoEm: string;
  outroPerfil: Perfil;
  souSolicitante: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConexoesService {
  private perfis = inject(PerfisService);

  async solicitarPorUsername(username: string, tipo: TipoConexao): Promise<{ ok: boolean; erro?: string }> {
    const alvo = await this.perfis.buscarPorUsername(username);
    if (!alvo) return { ok: false, erro: 'Nenhum usuário do Mindly encontrado com esse nome.' };
    return this.solicitarPorUserId(alvo.user_id, tipo, alvo);
  }

  async solicitarPorUserId(userId: string, tipo: TipoConexao, perfilAlvo?: Perfil): Promise<{ ok: boolean; erro?: string }> {
    const user = await obterUsuarioValido();
    if (!user) return { ok: false, erro: 'Sessão expirada. Atualize a página e tente de novo.' };
    if (userId === user.id) return { ok: false, erro: 'Você não pode se conectar consigo mesmo.' };

    const alvo = perfilAlvo ?? (await this.perfis.buscarPorUserId(userId));
    if (!alvo) return { ok: false, erro: 'Perfil não encontrado.' };

    if (tipo === 'psicologo') {
      const meuPerfil = await this.perfis.carregar();
      const souPsicologoAprovado = meuPerfil?.tipo === 'psicologo' && meuPerfil.aprovado;

      if (souPsicologoAprovado) {
        // Psicólogo adicionando um paciente: o alvo precisa ser um usuário comum.
        if (alvo.tipo !== 'usuario') {
          return { ok: false, erro: 'Esse perfil não é de um paciente (usuário comum) do Mindly.' };
        }
      } else if (alvo.tipo !== 'psicologo' || !alvo.aprovado) {
        return { ok: false, erro: 'Esse perfil não é de um(a) psicólogo(a) aprovado(a) no Mindly.' };
      }
    }

    const { error } = await supabase.from('conexoes').insert({
      solicitante_id: user.id,
      destinatario_id: userId,
      tipo,
      status: 'pendente',
    });

    if (error) {
      const erro = error.code === '23505' ? 'Vocês já têm uma conexão ou pedido em andamento.' : 'Não foi possível enviar o pedido.';
      return { ok: false, erro };
    }
    return { ok: true };
  }

  async listar(tipo: TipoConexao, status?: 'pendente' | 'aceito' | 'recusado'): Promise<ConexaoComPerfil[]> {
    const user = await obterUsuarioValido();
    if (!user) return [];

    let query = supabase
      .from('conexoes')
      .select('id, solicitante_id, destinatario_id, status, criado_em')
      .eq('tipo', tipo)
      .or(`solicitante_id.eq.${user.id},destinatario_id.eq.${user.id}`)
      .order('criado_em', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error || !data || data.length === 0) return [];

    const outrosIds = [...new Set(data.map(c => (c.solicitante_id === user.id ? c.destinatario_id : c.solicitante_id)))];
    const { data: perfis } = await supabase.from('perfis').select('*').in('user_id', outrosIds);
    const mapaPerfis = new Map((perfis ?? []).map(p => [p.user_id, p as Perfil]));

    return data
      .map(c => {
        const outroId = c.solicitante_id === user.id ? c.destinatario_id : c.solicitante_id;
        const outroPerfil = mapaPerfis.get(outroId);
        if (!outroPerfil) return null;
        return {
          id: c.id,
          solicitanteId: c.solicitante_id,
          destinatarioId: c.destinatario_id,
          status: c.status,
          criadoEm: c.criado_em,
          outroPerfil,
          souSolicitante: c.solicitante_id === user.id,
        } as ConexaoComPerfil;
      })
      .filter((c): c is ConexaoComPerfil => c !== null);
  }

  async responder(conexaoId: string, aceitar: boolean): Promise<boolean> {
    const { error } = await supabase
      .from('conexoes')
      .update({ status: aceitar ? 'aceito' : 'recusado', respondido_em: new Date().toISOString() })
      .eq('id', conexaoId);
    return !error;
  }

  async remover(conexaoId: string): Promise<boolean> {
    const { error } = await supabase.from('conexoes').delete().eq('id', conexaoId);
    return !error;
  }

  async buscarHumorRecente(userId: string): Promise<{ humor: string; atualizadoEm: string } | null> {
    const { data } = await supabase
      .from('humor_recente')
      .select('humor, atualizado_em')
      .eq('user_id', userId)
      .maybeSingle();
    return data ? { humor: data.humor, atualizadoEm: data.atualizado_em } : null;
  }

  linkConvite(tipo: TipoConexao, userId: string): string {
    return `${window.location.origin}/convite/${userId}?tipo=${tipo}`;
  }
}
