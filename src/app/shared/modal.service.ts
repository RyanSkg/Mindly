import { Injectable, signal } from '@angular/core';

export interface ModalEstado {
  titulo: string;
  mensagem: string;
  textoConfirmar: string;
  textoCancelar: string;
  perigo: boolean;
  somenteAviso: boolean;
}

@Injectable({ providedIn: 'root' })
export class ModalService {
  aberto = signal(false);
  estado = signal<ModalEstado>({
    titulo: '',
    mensagem: '',
    textoConfirmar: 'Confirmar',
    textoCancelar: 'Cancelar',
    perigo: false,
    somenteAviso: false,
  });

  private resolver: ((valor: boolean) => void) | null = null;

  /** Pergunta ao usuário e espera a resposta (substitui o confirm() nativo). */
  confirmar(opcoes: { titulo: string; mensagem: string; textoConfirmar?: string; textoCancelar?: string; perigo?: boolean }): Promise<boolean> {
    this.estado.set({
      titulo: opcoes.titulo,
      mensagem: opcoes.mensagem,
      textoConfirmar: opcoes.textoConfirmar ?? 'Confirmar',
      textoCancelar: opcoes.textoCancelar ?? 'Cancelar',
      perigo: opcoes.perigo ?? false,
      somenteAviso: false,
    });
    this.aberto.set(true);
    return new Promise(resolve => {
      this.resolver = resolve;
    });
  }

  /** Mostra um aviso simples com um botão OK (substitui o alert() nativo). */
  avisar(opcoes: { titulo: string; mensagem: string }): Promise<void> {
    this.estado.set({
      titulo: opcoes.titulo,
      mensagem: opcoes.mensagem,
      textoConfirmar: 'OK',
      textoCancelar: '',
      perigo: false,
      somenteAviso: true,
    });
    this.aberto.set(true);
    return new Promise(resolve => {
      this.resolver = () => resolve();
    });
  }

  responder(valor: boolean): void {
    this.aberto.set(false);
    this.resolver?.(valor);
    this.resolver = null;
  }
}
