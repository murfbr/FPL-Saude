# Plano de Refatoração de Arquitetura - Visão Geral e Status

O sistema acumulou arquivos bastante extensos ao longo do tempo. O objetivo deste plano é estruturar a refatoração em fases bem definidas para dividir responsabilidades, separar componentes/lógicas complexas e utilizar nomenclaturas mais semânticas, garantindo o bom desempenho do frontend e backend.

---

## ✅ Fases Concluídas (O que já foi resolvido)

### Fase 1: Cloud Functions (Backend) - *Concluído*
O arquivo `functions/src/index.ts` centralizava todas as funções.
- **O que foi feito:** Migração para o padrão TypeScript, separação dos triggers (`onAppointmentWrite`, `onFinancialRecordWrite`) em pastas por domínio (`appointments`, `financial`), e o arquivo `index.ts` virou apenas um indexador de exportações.
- **Benefícios Obtidos:** Melhor legibilidade, deploy de funções mais seguro, redução drástica de conflitos de git e facilidade extrema de testar/manter cron jobs isolados.

### Fase 2: Serviços e Adoção do TanStack Query (Frontend) - *Concluído*
Arquivos como `clients/service.ts` e `appointments/service.ts` eram gigantes.
- **O que foi feito:** Quebra desses serviços pesados em múltiplos submódulos (`queries.ts`, `mutations.ts`). Criação dos *Custom Hooks* usando **TanStack Query** (`useClients`, `useAppointments`).
- **Benefícios Obtidos:** Cache poderoso de memória. Agora o app não trava com `useEffects` pesados na mesma tela, e temos a famosa renderização rápida (cache-first).

### Fase 3: Componentes de UI Complexos (Frontend) - *Concluído*
Os gigantes `AppointmentDetailDialog.tsx` e `AppointmentFormDialog.tsx` tinham mais de 1.000 linhas cada.
- **O que foi feito:** Criação de diretórios modulares, fatiamento em componentes visuais simples (`EventPanel.tsx`, `FinancialSection.tsx`) e delegação de toda a lógica para os hooks recém criados (`useAppointmentDetail.ts`).
- **Benefícios Obtidos:** Remoção de código monolítico. Agora bugs isolados (como desconto) são ajustados em um mini-arquivo, sem risco de corromper o layout do resto da plataforma, permitindo total reutilização de peças.

### Fase 5: Integração Total do TanStack Query nos Serviços Restantes - *Concluído*
A estrutura de serviços foi expandida além dos Agendamentos. Os serviços de `Professionals`, `Financial` e `Availability` foram completamente refatorados.
- **O que foi feito:** O monolítico `service.ts` de cada módulo foi quebrado em `queries.ts` e `mutations.ts` utilizando *barrel files*. Os hooks correspondentes foram criados e componentes-chave como o `AdminDashboard.tsx` e `FinancialManagement.tsx` foram atualizados para utilizá-los.
- **Benefícios Obtidos:** Melhoria imensa na gestão de estado do aplicativo e transições visuais aceleradas pelo cache inteligente, evitando travas nas renderizações da interface.

---

## 🚀 Fases Restantes (O que falta fazer)

### Fase 4: Refatoração de Páginas Inchadas (Frontend)
Páginas inteiras que concentram as rotas principais cresceram fora do ideal, como por exemplo o `AdminPatientDetail.tsx` (Prontuário/Perfil do paciente) e o `CompanyDetail.tsx` (Dashboard do Super Admin).

**O que será feito de forma detalhada:**
- Transformar cada "Aba" ou "Seção" dessas páginas em um componente avulso dentro de um diretório `components/AdminPatientDetail/`. Exemplo:
  - `PatientOverviewPanel.tsx` (Dados básicos)
  - `PatientHistoryTab.tsx` (Aba de Prontuário)
  - `PatientFinancialTab.tsx` (Aba Financeira / Assinaturas / Contratos)
- Extrair as queries pesadas da raiz da página e utilizar *lazy load* via TanStack Query para carregar apenas a aba em que o usuário clicar.

**Benefícios:**
- **Performance Imediata:** O usuário não precisará esperar todas as transações financeiras carregarem se ele apenas quer ler a evolução médica do paciente. O tempo de renderização (Time To Interactive) da tela cairá drasticamente.
- **Isolamento Cognitivo:** Se precisarmos adicionar um novo botão no Prontuário, editaremos um arquivo de 50 linhas focado somente no prontuário, ao invés de abrir uma página de 800 linhas.

---


### Fase 6: Otimização de Componentes e Contextos Globais
Alguns componentes que ficam na raiz do layout sofrem muito processamento não-focado, como o `Header.tsx` e o sininho `NotificationBell.tsx`.

**O que será feito de forma detalhada:**
- Otimização do `NotificationBell.tsx` que hoje é engatado num Contexto Geral. Iremos separá-lo para que ele escute e realize polling das notificações sozinho de forma assíncrona.
- Separação de lógicas de "Perfil do Usuário Autenticado" para evitar re-renderizações acidentais em todo o esqueleto da aplicação.

**Benefícios:**
- **Fluidez (Sem Engasgos):** O sino de notificação não vai re-renderizar o gráfico do dashboard principal quando um novo aviso chegar. A navegação será suave como a de um app nativo de celular.
- **Redução do Consumo de Rede:** Com um controle mais afiado, bateremos menos vezes no Firebase sem necessidade, reduzindo a conta final de Cloud Database da empresa.
