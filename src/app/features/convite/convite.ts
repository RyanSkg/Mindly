import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PerfisService, Perfil } from '../../shared/perfis.service';
import { ConexoesService, TipoConexao } from '../../shared/conexoes.service';

@Component({
  selector: 'app-convite',
  imports: [RouterLink],
  templateUrl: './convite.html',
  styleUrl: './convite.css',
})
export class Convite implements OnInit {
  private route = inject(ActivatedRoute);
  private perfis = inject(PerfisService);
  private conexoes = inject(ConexoesService);
  router = inject(Router);

  carregando = true;
  enviando = false;
  enviado = false;
  erro = '';
  perfilAlvo: Perfil | null = null;
  tipo: TipoConexao = 'contato';

  async ngOnInit() {
    const userId = this.route.snapshot.paramMap.get('userId');
    this.tipo = this.route.snapshot.queryParamMap.get('tipo') === 'psicologo' ? 'psicologo' : 'contato';

    if (userId) {
      this.perfilAlvo = await this.perfis.buscarPorUserId(userId);
    }
    this.carregando = false;
  }

  async enviarPedido() {
    if (!this.perfilAlvo || this.enviando) return;
    this.enviando = true;
    this.erro = '';

    const resultado = await this.conexoes.solicitarPorUserId(this.perfilAlvo.user_id, this.tipo, this.perfilAlvo);
    if (resultado.ok) {
      this.enviado = true;
    } else {
      this.erro = resultado.erro ?? 'Não foi possível enviar o pedido.';
    }
    this.enviando = false;
  }
}
