import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { supabase } from '../../integrations/supabase/client';
import { tempoRelativo } from '../../shared/tempo.util';
import { TopbarActionsService } from '../../shared/topbar-actions.service';
import { NotificacoesService } from '../../shared/notificacoes.service';

interface Contato {
  id: string;
  iniciais: string;
  nome: string;
  relacao: string;
  telefone: string | null;
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
  novoTelefone: string = '';
  salvandoContato: boolean = false;

  avisoEnviado: string = '';

  private topbarActions = inject(TopbarActionsService);
  private destroyRef = inject(DestroyRef);
  private notificacoes = inject(NotificacoesService);

  async ngOnInit() {
    await this.carregarContatos();
    this.topbarActions.acoes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(acao => {
      if (acao.tipo === 'adicionar-contato') this.abrirFormulario();
    });
  }

  private async carregarContatos() {
    const { data, error } = await supabase
      .from('contatos')
      .select('id, nome, relacao, telefone, status, criado_em')
      .order('criado_em', { ascending: true });

    if (!error && data) {
      this.contatos = data.map(c => this.mapearContato(c));
    }
  }

  private mapearContato(c: { id: string; nome: string; relacao: string; telefone: string | null; status: string; criado_em: string }): Contato {
    return {
      id: c.id,
      nome: c.nome,
      relacao: c.relacao,
      telefone: c.telefone,
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
    this.novoTelefone = '';
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
      .insert({
        user_id: user.id,
        nome: this.novoNome,
        relacao: this.novaRelacao,
        telefone: this.novoTelefone.trim() || null,
        status: 'disponivel',
      })
      .select()
      .single();

    if (!error && data) {
      this.contatos.push(this.mapearContato(data));
      this.cancelarFormulario();
      this.notificacoes.criar('Novo contato adicionado', `${data.nome} agora faz parte da sua rede de apoio.`);
    }
    this.salvandoContato = false;
  }

  avisar(contato: Contato) {
    this.avisoEnviado = '';

    const texto = this.mensagem.trim()
      ? this.mensagem.trim()
      : `Oi ${contato.nome}, tudo bem? Estou passando por um momento difícil e gostaria de conversar. Você tem 8 minutos?`;

    if (contato.telefone) {
      const numero = contato.telefone.replace(/\D/g, '');
      window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, '_blank');
    } else {
      this.avisoEnviado = `${contato.nome} não tem telefone cadastrado. Edite o contato para adicionar um número e avisar por WhatsApp.`;
    }
  }

  ligarCVV() {
    window.open('tel:188');
  }

  ligarSAMU() {
    window.open('tel:192');
  }
}
