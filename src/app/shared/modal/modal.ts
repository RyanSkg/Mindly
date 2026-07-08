import { Component, inject } from '@angular/core';
import { ModalService } from '../modal.service';

@Component({
  selector: 'app-modal',
  imports: [],
  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class Modal {
  modal = inject(ModalService);

  responder(valor: boolean): void {
    this.modal.responder(valor);
  }
}
