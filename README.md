# 🧠 EchoMind

> App de Saúde Mental com Inteligência Artificial

EchoMind é um aplicativo web que detecta padrões emocionais e conecta usuários aos seus psicólogos. Por meio de um diário emocional inteligente, análise de IA e ferramentas de apoio, o app ajuda o usuário a entender seus próprios padrões emocionais e facilita a comunicação com profissionais de saúde mental.

---

## ✨ Funcionalidades

| Funcionalidade | Descrição |
|---|---|
| 📓 Diário Emocional | Registro diário de humor com análise automática por IA |
| 📊 Dashboard | Gráficos de evolução emocional semanal |
| ⏱️ Modo 8 Minutos | Timer de acolhimento com notificação a contatos de confiança |
| 📄 Relatório PDF | Documento clínico gerado automaticamente para o psicólogo |
| 🩺 Portal do Psicólogo | Painel exclusivo para profissionais de saúde mental |

---

## 🛠️ Stack Tecnológica

| Tecnologia | Versão | Finalidade |
|---|---|---|
| Angular | 20.3.x | Framework principal (frontend) |
| TypeScript | 5.9 | Linguagem de programação |
| CSS3 | Nativo | Estilização dos componentes |
| Angular SSR | 20.3.x | Server Side Rendering |
| API Anthropic (Claude) | Sonnet | Análise emocional com IA |
| jsPDF | Latest | Geração de relatórios PDF |
| Zone.js | 0.15.x | Detecção de mudanças no Angular |
| RxJS | 7.8 | Programação reativa |

---

## 📁 Estrutura do Projeto

```
src/app/
├── core/
│   ├── guards/          # Proteção de rotas (auth, psicólogo)
│   └── services/        # Lógica de negócio (diário, IA, notificação, relatório)
├── shared/
│   ├── components/      # Componentes reutilizáveis (header, modal)
│   └── models/          # Interfaces TypeScript (Registro, Emoção, Usuário)
├── features/
│   ├── diario/          # Diário emocional + análise de IA
│   ├── dashboard/       # Gráficos e estatísticas emocionais
│   ├── oito-minutos/    # Timer de apoio + contatos
│   ├── relatorio/       # Geração e compartilhamento de PDF
│   └── portal-psicologo/# Painel do profissional de saúde
└── layout/
    └── app-shell/       # Layout principal (sidebar + topbar)
```

---

## 🚀 Como Rodar

```bash
# Instalar dependências
npm install

# Servidor de desenvolvimento
ng serve

# Build de produção
ng build
```

Acesse `http://localhost:4200` no navegador.

---

## 🗺️ Rotas

| Rota | Página | Proteção |
|---|---|---|
| `/login` | Tela de login | Público |
| `/cadastro` | Cadastro de usuário | Público |
| `/diario` | Diário emocional | authGuard |
| `/dashboard` | Dashboard de gráficos | authGuard |
| `/oito-minutos` | Modo 8 minutos | authGuard |
| `/relatorio` | Gerador de PDF | authGuard |
| `/configuracoes` | Configurações do perfil | authGuard |
| `/psicologo` | Portal do profissional | psicologoGuard |

---

## 📅 Plano de Desenvolvimento

| Fase | Período | Foco |
|---|---|---|
| Fase 1 — Fundamentos | 22/05 – 03/06 | Components, templates, Data Binding |
| Fase 2 — Formulários e Rotas | 04/06 – 16/06 | Reactive Forms, roteamento, guards |
| Fase 3 — APIs e HTTP | 17/06 – 23/06 | HTTP Client, Observables, RxJS |
| Fase 4 — Boas práticas | 24/06 – 29/06 | Lazy Loading, Interceptors |
| Fase 5 — EchoMind completo | 30/06 – 07/07 | Construção de todas as features |

---

## ⭐ Diferenciais

- **IA real integrada** — usa a API oficial da Anthropic (Claude Sonnet)
- **Conexão paciente-psicólogo** — portal exclusivo para o profissional
- **Modo 8 Minutos** — ferramenta de apoio emocional imediato
- **Relatório PDF clínico** — documento profissional gerado automaticamente
- **SSR ativo** — melhor performance e SEO com Angular SSR
- **Arquitetura escalável** — código organizado por features

---

## 👨‍💻 Desenvolvedor

**Ryan Sá** — ryansa.04@gmail.com

Projeto final do curso **Ford Enter — Front-end** (Alura)  
Apresentação: **07 de julho de 2026**
