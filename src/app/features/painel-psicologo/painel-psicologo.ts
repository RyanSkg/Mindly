import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import jsPDF from 'jspdf';
import { supabase } from '../../integrations/supabase/client';
import { PerfisService } from '../../shared/perfis.service';
import { ConexoesService, ConexaoComPerfil } from '../../shared/conexoes.service';
import { obterUsuarioValido } from '../../shared/sessao.util';

interface RelatorioRecebido {
  id: string;
  titulo: string;
  detalhes: string;
  tags: { label: string; cor: string }[];
  criadoEm: string;
  pacienteUsername: string;
}

@Component({
  selector: 'app-painel-psicologo',
  imports: [FormsModule],
  templateUrl: './painel-psicologo.html',
  styleUrl: './painel-psicologo.css',
})
export class PainelPsicologo implements OnInit {
  perfis = inject(PerfisService);
  private conexoes = inject(ConexoesService);

  carregando = true;
  pendentes: ConexaoComPerfil[] = [];
  pacientes: ConexaoComPerfil[] = [];
  relatorios: RelatorioRecebido[] = [];
  linkConvite = '';
  linkCopiado = false;

  async ngOnInit() {
    const perfil = await this.perfis.carregar();
    if (perfil) {
      this.linkConvite = this.conexoes.linkConvite('psicologo', perfil.user_id);
    }
    await this.carregarTudo();
    this.carregando = false;
  }

  private async carregarTudo() {
    this.pendentes = await this.conexoes.listar('psicologo', 'pendente');
    this.pacientes = await this.conexoes.listar('psicologo', 'aceito');
    await this.carregarRelatorios();
  }

  private async carregarRelatorios() {
    const user = await obterUsuarioValido();
    if (!user) return;

    const { data } = await supabase
      .from('relatorios')
      .select('id, titulo, detalhes, tags, criado_em, user_id')
      .eq('psicologo_id', user.id)
      .order('criado_em', { ascending: false });

    if (!data) return;

    const mapaUsername = new Map(this.pacientes.map(p => [p.outroPerfil.user_id, p.outroPerfil.username]));
    this.relatorios = data.map(r => ({
      id: r.id,
      titulo: r.titulo,
      detalhes: r.detalhes ?? '',
      tags: r.tags ?? [],
      criadoEm: r.criado_em,
      pacienteUsername: mapaUsername.get(r.user_id) ?? 'paciente',
    }));
  }

  async responder(conexaoId: string, aceitar: boolean) {
    const sucesso = await this.conexoes.responder(conexaoId, aceitar);
    if (sucesso) await this.carregarTudo();
  }

  copiarLink() {
    navigator.clipboard?.writeText(this.linkConvite);
    this.linkCopiado = true;
    setTimeout(() => (this.linkCopiado = false), 2000);
  }

  baixarRelatorio(relatorio: RelatorioRecebido) {
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(16);
    doc.text(relatorio.titulo, 14, y);
    y += 8;

    doc.setFontSize(11);
    doc.setTextColor(120);
    doc.text(`Paciente: @${relatorio.pacienteUsername}`, 14, y);
    y += 8;
    doc.text(relatorio.detalhes, 14, y);
    doc.setTextColor(0);
    y += 12;

    if (relatorio.tags.length > 0) {
      doc.setFontSize(12);
      doc.text('Emoções observadas:', 14, y);
      y += 8;
      doc.setFontSize(11);
      relatorio.tags.forEach(tag => {
        doc.text(`• ${tag.label}`, 14, y);
        y += 7;
      });
    }

    const nomeArquivo = relatorio.titulo.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
    doc.save(`${nomeArquivo}.pdf`);
  }
}
