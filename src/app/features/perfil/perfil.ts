import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { supabase } from '../../integrations/supabase/client';
import { PerfilService } from '../../shared/perfil.service';
import { emojiDoHumor, valorDoHumor } from '../../shared/humor.util';
import { obterUsuarioValido } from '../../shared/sessao.util';

interface AtividadeRecente {
  id: string;
  humor: string;
  texto: string;
  data: Date;
}

@Component({
  selector: 'app-perfil',
  imports: [FormsModule, DatePipe],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class Perfil implements OnInit {
  perfil = inject(PerfilService);
  private router = inject(Router);

  metodoLogin = 'Email e senha';

  totalRegistros = 0;
  diasAtivos = 0;
  humorMedio = '0.0';
  totalContatos = 0;
  totalRelatorios = 0;

  atividadeRecente: AtividadeRecente[] = [];
  carregando = true;

  editando = false;
  nomeEmEdicao = '';
  salvando = false;

  saindo = false;

  emojiDoHumor = emojiDoHumor;

  async ngOnInit() {
    await this.perfil.carregar();

    const user = await obterUsuarioValido();
    if (!user) {
      this.carregando = false;
      return;
    }

    this.metodoLogin = user.app_metadata?.['provider'] === 'google' ? 'Google' : 'Email e senha';

    const [registros, contatos, relatorios] = await Promise.all([
      supabase.from('registros').select('id, humor, texto, criado_em').eq('user_id', user.id).order('criado_em', { ascending: false }),
      supabase.from('contatos').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('relatorios').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ]);

    if (registros.data) {
      this.totalRegistros = registros.data.length;
      this.diasAtivos = new Set(registros.data.map(r => new Date(r.criado_em).toDateString())).size;
      this.atividadeRecente = registros.data.slice(0, 5).map(r => ({
        id: r.id,
        humor: r.humor,
        texto: r.texto ?? '',
        data: new Date(r.criado_em),
      }));

      if (registros.data.length > 0) {
        const soma = registros.data.reduce((s, r) => s + valorDoHumor(r.humor), 0);
        this.humorMedio = (soma / registros.data.length).toFixed(1);
      }
    }

    this.totalContatos = contatos.count ?? 0;
    this.totalRelatorios = relatorios.count ?? 0;
    this.carregando = false;
  }

  editarPerfil() {
    this.nomeEmEdicao = this.perfil.nome();
    this.editando = true;
  }

  cancelarEdicao() {
    this.editando = false;
  }

  async salvarPerfil() {
    if (this.salvando) return;
    this.salvando = true;

    const sucesso = await this.perfil.atualizarNome(this.nomeEmEdicao);
    if (sucesso) {
      this.editando = false;
    }
    this.salvando = false;
  }

  async sair() {
    if (this.saindo) return;
    this.saindo = true;
    await supabase.auth.signOut();
    this.router.navigate(['/auth']);
  }
}
