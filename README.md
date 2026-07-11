# 🧠 Mindly

> Diário emocional com IA, feito em Angular

Mindly é um app web de bem-estar emocional. O usuário registra como está se sentindo, recebe uma análise empática e sugestões práticas de uma IA (que também recomenda conteúdos pra ler/assistir/ouvir e permite continuar a conversa), acompanha sua evolução em um dashboard com gráficos, tem um modo de apoio rápido pra avisar contatos de confiança, e pode enviar relatórios pro seu psicólogo.

---

## ✨ Funcionalidades

| Funcionalidade | Descrição |
|---|---|
| 📓 Diário emocional | Registro de humor com texto ou áudio (transcrito automaticamente); exclusão individual ou em massa; filtro por data |
| 🤖 Análise de IA | Reflexão específica sobre o registro, sugestão prática de ação, sugestões de conteúdo (ler/assistir/ouvir) e um chat pra continuar a conversa com a IA |
| 📊 Dashboard | Estatísticas do mês, carrossel com gráfico semanal + distribuição de humores (donut) + sequência de dias ativos, exportação em PDF |
| 💛 8 Minutos | Contatos de confiança (adicionar/editar), aviso via WhatsApp, botões de emergência (CVV/SAMU) |
| 🩺 Psicólogo | Envio de relatórios mensais automáticos (gerados a partir dos registros reais) e download em PDF |
| 👤 Perfil | Estatísticas pessoais, atividade recente, edição de nome, dados da conta |
| ⚙️ Configurações | Preferências de notificação/aparência, exportação de todos os dados em JSON, exclusão de conta |
| 🔔 Notificações | Painel real com contador de não lidas, geradas por eventos do app (novo contato, relatório enviado, marcos no diário) |
| 🔐 Autenticação | Email/senha e login com Google, rotas protegidas |

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | Angular 21 (standalone components, signals, `@for`/`@if`, SSR) |
| Estilo | CSS puro com variáveis (paleta OKLCH), sem framework de UI |
| Backend / banco | Supabase (Postgres + Auth + Row Level Security) |
| IA | Groq — Llama 3.3 70B (análise e chat) e Whisper Large v3 Turbo (transcrição de áudio) |
| PDF | jsPDF |
| Hospedagem | Vercel (SPA estático + funções serverless em `/api`) |

---

## 📁 Estrutura do Projeto

```
src/app/
├── features/
│   ├── auth/            # Login e cadastro
│   ├── diario/           # Diário emocional + análise/chat de IA
│   ├── dashboard/        # Estatísticas e carrossel de gráficos
│   ├── oito-minutos/     # Contatos de confiança e apoio rápido
│   ├── psicologo/        # Relatórios para o profissional
│   ├── perfil/           # Perfil do usuário
│   └── configuracoes/    # Preferências e dados da conta
├── shared/
│   ├── modal/             # Modal de confirmação/aviso (substitui alert/confirm)
│   ├── humor.util.ts       # Mapeamento de humor → emoji/valor/label
│   ├── tempo.util.ts       # Formatação de tempo relativo
│   ├── perfil.service.ts   # Estado global do perfil do usuário
│   ├── notificacoes.service.ts
│   └── topbar-actions.service.ts  # Comunicação topbar → página ativa
├── layout/
│   └── app-shell/        # Sidebar (hamburguer no mobile), topbar, notificações
├── guards/
│   └── auth.guard.ts      # Protege as rotas autenticadas
└── integrations/
    └── supabase/client.ts

api/                       # Funções serverless da Vercel (produção)
├── analisar.mjs            # Análise de IA do registro do diário
├── conversar.mjs           # Chat com a IA sobre um registro
├── transcrever.mjs         # Transcrição de áudio
└── excluir-conta.mjs       # Exclusão de conta (usa a service role key)

src/server.ts               # Servidor Express (mesmas rotas, usado em dev local)
```

---

## 🚀 Como Rodar

```bash
npm install
```

Crie um arquivo `.env` na raiz com:

```
GROQ_API_KEY=sua_chave_gratuita_do_console_groq_com
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_do_supabase
```

```bash
ng serve
```

Acesse `http://localhost:4200`.

### Banco de dados

O schema (tabelas `registros`, `contatos`, `relatorios`, `preferencias`, `notificacoes`, todas com Row Level Security) precisa ser criado no Supabase antes do primeiro uso — peça o script SQL atualizado se for configurar o projeto do zero.

---

## 🗺️ Rotas

| Rota | Página | Proteção |
|---|---|---|
| `/auth` | Login e cadastro | Público |
| `/diario` | Diário emocional | authGuard |
| `/dashboard` | Dashboard | authGuard |
| `/oito-minutos` | 8 Minutos | authGuard |
| `/psicologos` | Portal do psicólogo | authGuard |
| `/perfil` | Perfil do usuário | authGuard |
| `/configuracoes` | Configurações | authGuard |

---

## ⭐ Diferenciais

- **IA de verdade, gratuita** — análise, sugestões de conteúdo e chat via Groq, sem depender de plano pago
- **Segurança por padrão** — Row Level Security no Supabase: cada usuário só acessa os próprios dados
- **Responsivo** — menu hamburguer e layout adaptado para celular
- **Sem `alert`/`confirm` nativos** — modal próprio, consistente com o design do app
- **Deploy real** — publicado na Vercel, com funções serverless separadas do build estático

---

## 🔒 Segurança e privacidade dos dados

- **Criptografia em repouso**: o banco (Supabase/Postgres) criptografa todos os dados armazenados em disco com AES-256, de forma automática — não depende de nenhuma configuração da aplicação.
- **Criptografia em trânsito**: toda comunicação entre navegador, servidor e banco usa TLS/HTTPS.
- **Row Level Security**: cada tabela tem políticas que garantem que um usuário só consegue ler, criar ou apagar os próprios registros — mesmo que alguém tente burlar o app e chamar a API diretamente.
- **Segredos fora do navegador**: chaves sensíveis (IA, exclusão de conta) só existem no servidor, nunca no código que roda no navegador do usuário.
- **Proteção contra SQL injection**: nenhuma query é montada como texto SQL — todo acesso ao banco passa pelo cliente do Supabase (PostgREST), que parametriza os valores automaticamente; as funções SQL do banco usam parâmetros (nunca concatenação); e os poucos filtros montados como string (`.or(...)`) validam que o valor é um UUID antes de interpolar.

---

## 👨‍💻 Desenvolvedor

**Ryan Sá** — ryansa.04@gmail.com

Projeto final do curso **Ford Enter — Front-end**
