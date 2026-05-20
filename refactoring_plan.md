# Plano de Refatoração de Arquitetura

O sistema atualmente possui arquivos bastante extensos, tanto no backend (Cloud Functions) quanto no frontend (Componentes e Serviços). Arquivos como `index.ts` das functions (25KB, 700 linhas) e `AppointmentDetailDialog.tsx` (42KB, 1004 linhas) centralizam muitas lógicas, o que dificulta a manutenção.

O objetivo deste plano é estruturar a refatoração em fases bem definidas para dividir responsabilidades, separar componentes/lógicas complexas e utilizar nomenclaturas mais semânticas, mantendo o sistema funcional a cada passo.

## Fases Propostas

---

### Fase 1: Cloud Functions (Backend)
O arquivo `functions/src/index.ts` hoje centraliza várias responsabilidades (agendamentos, financeiro, assinaturas, reconciliação). 

**O que será feito:**
- Criar pastas/módulos para cada domínio: `appointments`, `financial`, `subscriptions`, e `cron`.
- Extrair cada trigger (`onAppointmentWrite`, `onFinancialRecordWrite`, etc.) para seu próprio arquivo (ex: `functions/src/appointments/onAppointmentWrite.ts`).
- Extrair os helpers (ex: `appointmentDelta`) para arquivos de utils (ex: `functions/src/shared/helpers.ts`).
- O `functions/src/index.ts` passará a ser apenas um indexador (barrel file), importando e exportando as funções modularizadas, por exemplo: `export * from './appointments/onAppointmentWrite'`.

---

### Fase 2: Serviços e Adoção do TanStack Query (Frontend)
Existem arquivos de serviço gigantes como `src/modules/clients/service.ts` (38KB) e `src/modules/appointments/service.ts` (34KB).

**O que será feito:**
- Quebrar os grandes arquivos de serviços em submódulos menores. Por exemplo, dividir `clients/service.ts` em:
  - `clients/services/queries.ts` (lógica de leitura)
  - `clients/services/mutations.ts` (lógica de escrita/delete)
- **Integração com TanStack Query**: Alinhado ao `/tanstack-query` workflow, extrair a lógica complexa de estado de chamadas HTTP dos componentes e movê-las para hooks de query/mutations, isolando `useEffect` e `useState` dedicados a carregar dados.

---

### Fase 3: Componentes de UI Complexos (Frontend)
Dialogs e formulários como `AppointmentDetailDialog.tsx` e `AppointmentFormDialog.tsx` possuem mais de 1.000 linhas, englobando fetch de dados, estado interno, cálculos e a renderização de várias sessões (evento vs agendamento normal, pacotes, financeiro, etc).

**O que será feito:**
- Criar uma pasta específica para cada grande componente, por exemplo `components/AppointmentDetailDialog/`.
- Dividir a renderização em subcomponentes menores e semânticos:
  - `EventPanel.tsx` (visão para evento clínico)
  - `AppointmentPanel.tsx` (visão padrão)
  - `FinancialSummary.tsx` (cálculo de descontos e pacotes)
  - `NotesSection.tsx` (gestão das evoluções)
- Extrair a lógica de negócio (funções de handle, variáveis derivadas de estado) para um Custom Hook, por exemplo `useAppointmentDetail.ts`. O componente principal orquestrará os subcomponentes passando as props.

---

### Fase 4: Páginas e Views (Frontend)
Páginas inteiras que concentram as views principais também estão inchadas, como `CompanyDetail.tsx` (Super Admin) e `AdminPatientDetail.tsx`.

**O que será feito:**
- Similar à Fase 3, quebrar as abas e seções (Dashboard, Prontuário, Financeiro do paciente) em arquivos independentes que serão renderizados dentro da página principal.
- Melhorar a legibilidade dos imports usando a padronização de indexadores.
