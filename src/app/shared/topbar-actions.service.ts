import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface AcaoTopbar {
  tipo: string;
  valor?: string;
}

@Injectable({ providedIn: 'root' })
export class TopbarActionsService {
  private readonly acao$ = new Subject<AcaoTopbar>();
  readonly acoes = this.acao$.asObservable();

  disparar(tipo: string, valor?: string): void {
    this.acao$.next({ tipo, valor });
  }
}
