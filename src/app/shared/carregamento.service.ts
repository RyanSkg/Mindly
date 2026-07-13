import { Injectable, signal } from '@angular/core';

/** Estado global da roda de carregamento (troca de rotas e operações longas). */
@Injectable({ providedIn: 'root' })
export class CarregamentoService {
  ativo = signal(false);

  mostrar(): void {
    this.ativo.set(true);
  }

  esconder(): void {
    this.ativo.set(false);
  }
}
