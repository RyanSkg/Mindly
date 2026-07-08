import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TopbarActionsService {
  private readonly acao$ = new Subject<string>();
  readonly acoes = this.acao$.asObservable();

  disparar(acao: string): void {
    this.acao$.next(acao);
  }
}
