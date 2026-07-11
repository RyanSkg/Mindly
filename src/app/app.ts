import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Modal } from './shared/modal/modal';
import { TemaService } from './shared/tema.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Modal],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('Mindly');
  private tema = inject(TemaService);

  ngOnInit() {
    this.tema.iniciar();
  }
}
