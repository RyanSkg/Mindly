import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { supabase } from '../../integrations/supabase/client';
import { PerfisService, Perfil } from '../../shared/perfis.service';
import { ModalService } from '../../shared/modal.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin implements OnInit {
  carregando = true;
  pendentes: Perfil[] = [];
  aprovados: Perfil[] = [];
  totalUsuarios = 0;
  processandoId: string | null = null;

  private perfis = inject(PerfisService);
  private modal = inject(ModalService);
  private router = inject(Router);

  async ngOnInit() {
    const meuPerfil = await this.perfis.carregar();
    if (!meuPerfil?.admin) {
      this.router.navigate(['/diario']);
      return;
    }
    await this.carregarDados();
    this.carregando = false;
  }

  private async carregarDados() {
    const [pendentes, aprovados, total] = await Promise.all([
      supabase
        .from('perfis')
        .select('*')
        .eq('tipo', 'psicologo')
        .eq('aprovado', false)
        .order('criado_em', { ascending: true }),
      supabase
        .from('perfis')
        .select('*')
        .eq('tipo', 'psicologo')
        .eq('aprovado', true)
        .order('criado_em', { ascending: false }),
      supabase.from('perfis').select('user_id', { count: 'exact', head: true }),
    ]);

    this.pendentes = (pendentes.data as Perfil[] | null) ?? [];
    this.aprovados = (aprovados.data as Perfil[] | null) ?? [];
    this.totalUsuarios = total.count ?? 0;
  }

  async aprovar(perfil: Perfil) {
    if (this.processandoId) return;
    this.processandoId = perfil.user_id;

    const { error } = await supabase
      .from('perfis')
      .update({ aprovado: true })
      .eq('user_id', perfil.user_id);
    if (error) {
      this.modal.avisar({
        titulo: 'Não foi possível aprovar',
        mensagem: 'Verifique se a migração de admin foi aplicada no Supabase e tente de novo.',
      });
    } else {
      await this.carregarDados();
    }
    this.processandoId = null;
  }

  async recusar(perfil: Perfil) {
    if (this.processandoId) return;

    const confirmou = await this.modal.confirmar({
      titulo: 'Recusar cadastro',
      mensagem: `Recusar o cadastro de psicólogo(a) de @${perfil.username}? A conta continua existindo, mas vira uma conta de usuário comum.`,
      textoConfirmar: 'Recusar',
      perigo: true,
    });
    if (!confirmou) return;

    this.processandoId = perfil.user_id;
    const { error } = await supabase
      .from('perfis')
      .update({ tipo: 'usuario', aprovado: true })
      .eq('user_id', perfil.user_id);
    if (error) {
      this.modal.avisar({
        titulo: 'Não foi possível recusar',
        mensagem: 'Verifique se a migração de admin foi aplicada no Supabase e tente de novo.',
      });
    } else {
      await this.carregarDados();
    }
    this.processandoId = null;
  }

  async revogar(perfil: Perfil) {
    if (this.processandoId) return;

    const confirmou = await this.modal.confirmar({
      titulo: 'Revogar aprovação',
      mensagem: `Revogar a aprovação de @${perfil.username}? Ele(a) perde o acesso ao painel de pacientes até ser aprovado(a) de novo.`,
      textoConfirmar: 'Revogar',
      perigo: true,
    });
    if (!confirmou) return;

    this.processandoId = perfil.user_id;
    const { error } = await supabase
      .from('perfis')
      .update({ aprovado: false })
      .eq('user_id', perfil.user_id);
    if (!error) await this.carregarDados();
    this.processandoId = null;
  }
}
