import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { supabase } from '../../integrations/supabase/client';
import { tempoRelativo } from '../../shared/tempo.util';
import { TopbarActionsService } from '../../shared/topbar-actions.service';

interface Contato {
  id: string;
  iniciais: string;
  nome: string;
  relacao: string;
  status: 'disponivel' | 'ocupado' | 'nao-perturbe';
  ultimaConversa: string;
}

@Component({
  selector: 'app-oito-minutos',
  imports: [FormsModule],
  templateUrl: './oito-minutos.html',
  styleUrl: './oito-minutos.css',
})
export class OitoMinutos implements OnInit {
  mensagem: string = '';
  contatos: Contato[] = [];

  mostrarFormulario: boolean = false;
  novoNome: string = '';
  novaRelacao: string = '';
  salvandoContato: boolean = false;

  private topbarActions = inject(TopbarActionsService);
  private destroyRef = inject(DestroyRef);

  async ngOnInit() {
    await this.carregarContatos();
    this.topbarActions.acoes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(acao => {
      if (acao === 'adicionar-contato') this.abrirFormulario();
    });
  }

  private async carregarContatos() {
    const { data, error } = await supabase
      .from('contatos')
      .select('id, nome, relacao, status, criado_em')
      .order('criado_em', { ascending: true });

    if (!error && data) {
      this.contatos = data.map(c => this.mapearContato(c));
    }
  }

  private mapearContato(c: { id: string; nome: string; relacao: string; status: string; criado_em: string }): Contato {
    return {
      id: c.id,
      nome: c.nome,
      relacao: c.relacao,
      status: c.status as Contato['status'],
      iniciais: this.gerarIniciais(c.nome),
      ultimaConversa: tempoRelativo(new Date(c.criado_em)),
    };
  }

  private gerarIniciais(nome: string): string {
    const partes = nome.trim().split(/\s+/);
    const iniciais = partes.length > 1
      ? partes[0][0] + partes[partes.length - 1][0]
      : partes[0].slice(0, 2);
    return iniciais.toUpperCase();
  }

  abrirFormulario() {
    this.mostrarFormulario = true;
  }

  cancelarFormulario() {
    this.mostrarFormulario = false;
    this.novoNome = '';
    this.novaRelacao = '';
  }

  async adicionarContato() {
    if (!this.novoNome.trim() || !this.novaRelacao.trim() || this.salvandoContato) return;
    this.salvandoContato = true;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      this.salvandoContato = false;
      return;
    }

    const { data, error } = await supabase
      .from('contatos')
      .insert({ user_id: user.id, nome: this.novoNome, relacao: this.novaRelacao, status: 'disponivel' })
      .select()
      .single();

    if (!error && data) {
      this.contatos.push(this.mapearContato(data));
      this.cancelarFormulario();
    }
    this.salvandoContato = false;
  }

  avisar(contato: Contato) {}

  encerrarSessao() {}

  ligarCVV() {
    window.open('tel:188');
  }

  ligarSAMU() {
    window.open('tel:192');
  }
}
