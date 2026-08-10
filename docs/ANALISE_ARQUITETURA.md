# Análise de Arquitetura e Auditoria de Bugs — FPL Saúde

**Data:** 10/08/2026
**Método:** 7 auditorias em profundidade (uma por cluster de módulos, todos os arquivos lidos), levantamento mecânico do grafo de dependências (grep de imports/violations), e verificação manual linha a linha dos achados críticos. Bugs marcados com ✓ foram verificados manualmente no código além da auditoria; os demais foram confirmados por leitura do auditor com file:line.

---

## 1. Sumário Executivo

O sistema funciona, mas cresceu por remendos e hoje tem **quatro fraturas estruturais** que explicam a maioria dos bugs em produção:

1. **Três vocabulários de "módulo" que não conversam** — as chaves canônicas (`ModuleKey`: `financial`, `clients`, `notifications`...), os IDs de abas da UI (`financials`, `patients`, `messages`, `agenda`) e os nomes reais de coleção do Firestore (`financial_records`, `monthly_summaries`, `subscription_plans`...). Consequências: ligar/desligar módulos no super-admin **não tem efeito** em 4 abas; salvar a Matriz de Permissões **quebra o app para profissionais**; e o RBAC das rules nunca casa com o que a UI concede.
2. **O fluxo do dinheiro não tem idempotência, transação nem snapshot de preço** — pagamentos duplicados (origem do `clean_duplicate_payments.ts`), cobrança pelo preço cheio ignorando desconto negociado, estorno por hard-delete sem rastro, edição de preço de catálogo retroagindo sobre vendas antigas, e conclusão de atendimento que classifica assinatura **cancelada** como ativa (sessão avulsa fica sem faturamento).
3. **Três calendários simultâneos** — o app filtra por mês/dia do fuso do navegador, as Cloud Functions agregam por mês UTC, e a lógica de agenda ancora slots em `-03:00` hardcoded. O mesmo agendamento/pagamento muda de mês/dia dependendo de quem calcula; os KPIs "mudam sozinhos" às 3h da manhã.
4. **Ciclo de vida de entidades sem regra única** — profissional inativado continua logando (a conta Auth não é revogada; e o caminho que revogaria **deleta** a conta em vez de suspender); excluir paciente/serviço/parceria é hard-delete que deixa agendamentos, assinaturas e disponibilidade órfãos.

Além disso: a adoção do TanStack Query parou no meio (87 `useEffect` manuais vs 47 hooks; camadas inteiras de hooks mortos), 14 áreas ainda importam pelo barrel legado `@/shared/services`, e operações que exigem Admin SDK (criar usuário, notificar, migrar dados) rodam no navegador esbarrando nas próprias rules.

**Como o sistema se sustenta hoje:** as empresas legadas (sem campo `roles` no doc) caem no fallback permissivo das rules — por isso tudo "funciona". Toda empresa criada pelo super-admin **já nasce com `roles` configurado** e, portanto, nasce no modo estrito onde criação de profissional e escrita de prontuário falham.

---

## 2. Mapa de Módulos

| Módulo | Função | Linhas | Estado |
|---|---|---|---|
| `appointments` | Agenda, recorrência, status→efeitos financeiros | 6.552 | Maior e mais frágil: 15 bugs confirmados, 2 camadas TanStack paralelas, 3 views duplicadas |
| `clients` | Pacientes, prontuário, entitlements (packages/subscriptions), export | 5.567 | 14 bugs; hard-delete órfão; CPF guardado no campo `email` |
| `financial` | Quitação/estorno, cards de receita, recibos | 2.127 | Sem idempotência; ignora preço negociado; estorno sem rastro |
| `super-admin` | CRUD de empresas, branding, matriz de permissões | 1.801 | `createCompany` sobrescreve slug repetido; grava matriz que quebra o tenant |
| `availability` | Disponibilidade recorrente, overrides, bloqueios | 1.573 | Timezone misto; dia bloqueado não desbloqueável pela UI; hooks 100% mortos |
| `professionals` | CRUD staff, service_ids, criação de conta | 1.402 | Criação sem rollback e negada pelas rules em empresa configurada |
| `time-tracking` | Ponto eletrônico e folha | 1.027 | Folha calcula 0h em turno overnight; premissa 1 registro/dia sem garantia |
| `services-catalog` | Catálogo de serviços (fonte de preço) | 938 | Hard-delete órfão; cache 5min sem invalidação; `value_type` monthly inacessível |
| `kpis` | Dashboard de indicadores | 869 | Range de datas ilusório (lê só o mês inicial); campos com semântica híbrida |
| `gallery` | Fotos clínicas antes/depois | 800 | Sem validação de tipo/tamanho; visível para todo profissional |
| `packages` / `subscriptions` / `partnerships` | Catálogos comerciais | ~1.500 | Economia real vive em `clients`/`appointments`; desconto aplicado de 3 formas |
| `notifications` / `messages` | Sino in-app; confirmação via WhatsApp manual | ~700 | Notificação de pacote **nunca criada em tenants novos** (coleção legada) |
| `auth` / `landing` / `maintenance` / `summaries` | Login/registro; landings; ferramentas de correção; leitura de agregados | ~1.200 | Register público quebrado; manutenção roda migração em massa no navegador |
| `functions/` (Cloud Functions) | Claims, agregação monthly_summaries, cron | ~800 | 8 campos calculados de forma divergente entre trigger, cron e backfill |

## 3. Como os módulos interagem

**Grafo de imports cruzados** (medido por grep, arestas → contagem):

```
appointments → availability (5)   clients → packages (2)      kpis → summaries (1)
financial    → clients (4)        clients → gallery (2)       financial → summaries (1)
super-admin  → registry (3)       clients → appointments (2)  clients → subscriptions (1)
appointments → clients (3)        professionals → availability (2)
gallery      → clients (2)
```

- **Ciclo real:** `appointments ↔ availability` (agenda pede slots; availability pede agendamentos para calcular ocupação) e `clients ↔ appointments`. Toleráveis se a fronteira for por service, mas hoje há import de componentes também.
- **Hub de preço:** `services-catalog` é importado por praticamente todos — qualquer mudança de preço/duração irradia sem snapshot.
- **Fronteira furada:** a economia dos pacotes (compra/consumo/término) vive em `clients/services/packages.ts` e `appointments/services/mutations.ts`, não no módulo `packages`. A regra "status que consome sessão" existe duplicada em `appointments/mutations` e `maintenance/DataMaintenance`.
- **Barrel legado `@/shared/services`:** ainda usado por 14 áreas (34+ arquivos) — inclusive módulos importando **as próprias funções** via barrel (`useAppointmentForm` importa `bookRecurringAppointments` do barrel).
- **Violações de camada** (Firestore cru em componente/página): `Login.tsx`, `NotificationBell.tsx`, `Notifications.tsx`, `DataMaintenance.tsx`, `BrandingTab.tsx`, `NavbarTab.tsx`, `useAppointmentDetail.ts`.
- **Estado de servidor:** 87 `useEffect` de fetch manual vs 47 hooks TanStack; em `professionals`, `availability` e `financial` os hooks TanStack existem mas estão **mortos** (componentes chamam services direto → invalidação de cache nunca roda; a UI vive de `staleTime` 30s e reloads).

## 4. Os problemas sistêmicos (detalhe)

### T1 — Vocabulário de módulos (UI × ModuleKey × coleção) ✓
- `AdminDashboard.tsx:206-219`: abas `agenda`/`financials`/`patients`/`messages` não existem em `ModuleKey` → `config.modules['financials']?.enabled !== false` é sempre `true` → **desligar Agenda/Financeiro/Pacientes/Confirmações no super-admin não faz nada**.
- `NavbarTab.tsx:19-35` oferece as duas variantes (`financial` E `financials`...) — escolher a canônica gera botão de navbar que abre **aba em branco**.
- `firestore.rules:129-154`: RBAC compara `roles.<role>.can_view/can_edit` (que guardam ModuleKeys) com **nomes de coleção**. `financial_records`, `monthly_summaries`, `subscription_plans`, `packages`, `blocked_dates` nunca casam → em empresa com matriz salva, conceder "Gestão Financeira" a um role **não concede nada**, e o profissional default **não escreve prontuário** (can_edit sem `clients`) nem lê `blocked_dates` (a agenda dele quebra silenciosamente).
- Toda empresa nova nasce com `roles: {...DEFAULT_ROLES}` (`super-admin/service.ts:136` ✓) → nasce no modo quebrado.

### T2 — Fluxo do dinheiro ✓
- `paySubscription` (`financial/services/mutations.ts:39` ✓): cobra `subscription_plans.price || services.price`, **ignorando `subscription.amount`** (preço com desconto de parceria que a própria tabela exibe). UI mostra R$ 400, grava R$ 500.
- `payPackage` (`mutations.ts:85-111` ✓): **nenhuma checagem de duplicidade** — duplo clique = 2 registros (origem do `scripts/clean_duplicate_payments.ts`). `paySubscription` tem checagem, mas é check-then-write com ID aleatório (dois admins simultâneos passam).
- Estornos = `deleteDoc` hard (`mutations.ts:78-83,113-118` ✓), sem `created_at`/`created_by`/motivo — caixa não auditável.
- Conclusão de atendimento classifica como "assinatura" qualquer assinatura do serviço **sem filtrar status** (`appointments/services/mutations.ts:401` ✓, e também :569, :688) — cliente com plano cancelado nunca mais gera registro avulso daquele serviço. É o irmão server-side do bug corrigido em 10/08 no formulário.
- Consumo de pacote: `increment(-1)` sem piso + fluxo "Usar mesmo assim" → saldo negativo sem cobrança correspondente; `DataMaintenance.fixPackageCounts` existe justamente para consertar esse drift.
- Desconto de parceria aplicado de 3 formas diferentes (agenda congela R$; assinatura grava `amount` que a cobrança ignora; pacote só tem desconto no onboarding — `AssignPackageDialog` não aplica). Precedência "específico > global" prometida na UI **não é implementada** (vence o primeiro do array).
- Editar preço no catálogo retroage sobre vendas pendentes (payPackage usa preço atual) — sem snapshot `price_paid`.

### T3 — Timezones ✓
- Functions agregam por **mês UTC** (`helpers.ts:5-8`, runtime UTC); o app filtra por **mês local**; o backfill usa o **fuso da máquina do dev**. Agendamento/pagamento de 21h–23h59 do último dia do mês cai em meses diferentes conforme quem calcula.
- `availability-logic.ts:103` ancora slots em `-03:00` hardcoded, mas `dateStr`/`dayOfWeek`/dia do agendamento usam o fuso do navegador (`:25,28,133`) — navegador fora de UTC-3 classifica agendamentos noturnos no dia errado → slot "livre" em cima de horário ocupado (double-booking).
- `shared/lib/utils.ts:57`: `formatInTimeZone` caseiro usa o offset **de hoje** para qualquer data (quebra com DST do navegador).
- Ponto eletrônico grava o dia do navegador; folha de ponto e agenda podem discordar do dia.

### T4 — Agregação (monthly_summaries) com 3+ implementações divergentes
Matriz completa no apêndice `kpis/functions`. Piores casos:
- `by_professional.revenue` e `by_service.revenue`: trigger soma **preço de tabela de todo completed**; cron/backfill somam **só receita avulsa de financial_records** → número híbrido sem significado após um dia de operação.
- `by_partnership.revenue`: só o trigger escreve; **o cron zera toda noite**.
- `expected_subscriptions_revenue`: 3 fórmulas diferentes (trigger usa preço cheio atual; cron usa `sub.amount`; app calcula uma 4ª versão client-side) e o **backfill apaga o campo**. Proração nas functions arredonda para **reais inteiros** (parêntese errado: `Math.round(((p/d)*n*100)/100)`).
- `package/subscription/independent_sessions`: só existem no recálculo noturno → com filtro de profissional, o dashboard mostra dados de até 24h atrás ao lado de dados em tempo real.
- Cron recalcula **só o mês corrente** às 3h — o último dia do mês nunca é reconciliado; drift em mês passado é permanente.
- KPI: o DateRangePicker é ilusório — `getKpiMetrics` lê apenas o summary do mês de `startDate` (`kpis/service.ts:125-128` ✓); qualquer range mostra o mês inteiro.

### T5 — Ciclo de vida e soft delete
- **Inativar profissional não revoga acesso**: `ProfessionalEditDialog` só seta `is_active:false` no subdoc; a conta Auth continua válida e ele segue logando e vendo pacientes (a UI promete "acesso será revogado"). O caminho que revogaria (`users` raiz → `onUserWrite`) está morto/bloqueado pelas rules — e, quando roda, **deleta** a conta Auth (`onUserWrite.ts:24` ✓) em vez de suspender (`updateUser({disabled:true})`), tornando a reativação impossível.
- **Excluir paciente** (`clients/mutations.ts:113-121`): `deleteDoc` só do doc — notes/packages/subscriptions/exams/appointments/Storage ficam órfãos; cron continua somando receita esperada de assinatura ativa dele.
- **Excluir serviço** (`services-catalog/service.ts:74-82`): hard-delete; pacotes/planos/appointments/availability apontando para ele quebram silenciosamente (o dialog promete cascata que não existe).
- **Excluir parceria**: hard-delete; `clients.partnership_id` órfão, desconto some sem aviso.
- **Criar profissional** (`professionals/mutations.ts:70-129`): 3 passos sem rollback, com o passo final gravado **autenticado como o usuário novo** via `secondaryDb` — negado pelas rules em empresa com matriz → conta Auth órfã (e-mail preso) e "meio-usuário" invisível. Erro `auth/email-already-in-use` não mapeado (typo `'auth/email-already-in-set'` no super-admin).

### T6 — Estado de servidor e código morto
- Camadas TanStack duplicadas em `appointments` (chaves com e sem `companyId`) e mortas em `professionals`/`availability`/`financial`/`clients` — mutações reais não invalidam nada (concluir sessão não atualiza aba financeira montada).
- Código morto relevante: `clockIn/clockOut`, `updateClientSubscription` (removido em 10/08), `deleteProfessional`, `deleteAvailabilityOverride` (stub que lança), `getAppointmentsByScheduleId` (retorna `[]` fixo — ocupação de turma sempre 0/N), `UpcomingAppointments.tsx`, `SubscriptionManagement.tsx` (`() => null`), hooks inteiros em 4 módulos, `getInvoicedValue`/`getExpectedRevenue`.
- `error-mapping.ts` só mapeia erros da era Supabase.

### T7 — Segurança (rules/storage/sw)
- ✓ `firestore.rules:100`: doc da empresa `allow read: if true` — matriz de permissões, CNPJ, navbar e branding de **todos** os tenants legíveis sem autenticação, e enumeráveis por `list`.
- ✓ `firestore.rules:91-96`: rules de collectionGroup dão **read+write** em qualquer `**/subscriptions/*` e `**/packages/*` (inclusive o catálogo) para **qualquer usuário do tenant, inclusive `client`** — paciente pode editar o próprio `sessions_remaining` via SDK. O app nem usa collectionGroup queries.
- Em tenant legado (sem `roles`), o fallback permite `client` **ler todos os módulos** (financial_records, prontuários...) — o comentário das rules afirma o contrário.
- `allow write` genérico não tem bypass de super-admin → super-admin não consegue escrever em subcoleção nenhuma (inclusive impersonando).
- `monthly_summaries` é gravável pelo cliente (cai no match genérico) — KPIs adulteráveis.
- Notificações: qualquer usuário do tenant lê/escreve notificações de qualquer admin/profissional (`rules:128-133`).
- `storage.rules`: fotos de profissional legíveis cross-tenant; nenhum limite de `size`/`contentType` na galeria.
- ✓ `public/sw.js:71-95`: service worker cacheia respostas do **Firestore** (dados clínicos) em Cache Storage no disco; nada limpa no logout.
- Impersonation do super-admin não sobrevive a refresh (`tenantStore` não re-hidrata do localStorage → `getCompanyId()` lança).

### T8 — Operações críticas no lugar errado
- Criação de usuário/profissional, notificações de pacote, migrações em massa (`DataMaintenance`) e recálculo de saldo rodam **no navegador** com o token do operador — sem atomicidade, sem retry, esbarrando nas rules. Tudo isso é caso clássico de Cloud Function callable/trigger com Admin SDK.
- Notificação "Aviso de Pacote" busca admins em `companies/{cid}/users` — coleção **legada e vazia em tenants novos** (`appointments/mutations.ts:429` ✓) → nunca é criada fora do fpl-saude (e lá, com papéis congelados pré-migração).

---

## 5. Bugs por severidade (consolidado e deduplicado)

### P0 — Dinheiro, segurança ou perda de dados (agir primeiro)

| # | Bug | Onde | Verificado |
|---|---|---|---|
| 1 | Conclusão de atendimento trata assinatura **cancelada** como ativa → sessão avulsa sem faturamento | `appointments/services/mutations.ts:401,569,688` | ✓ |
| 2 | `paySubscription` ignora `sub.amount` (desconto negociado) → cobra preço cheio | `financial/services/mutations.ts:39` | ✓ |
| 3 | `payPackage` sem checagem de duplicidade; `paySubscription` check-then-write não atômico | `financial/services/mutations.ts:85-111` | ✓ |
| 4 | Race no duplo "Concluído": 2 financial_records / duplo débito de sessão (sem transação) | `appointments/services/mutations.ts:324-533` | auditor |
| 5 | Rules collectionGroup: `client` pode escrever `packages`/`subscriptions` (catálogo incluso) | `firestore.rules:91-96` | ✓ |
| 6 | Doc da empresa world-readable + enumerável (matriz, CNPJ) | `firestore.rules:100` | ✓ |
| 7 | Tenant legado: role `client` lê todos os módulos (fallback permissivo) | `firestore.rules:129-147` | ✓ |
| 8 | Inativar profissional não revoga login; caminho de revogação **deleta** Auth (não suspende) | `ProfessionalEditDialog.tsx:120-146`; `functions/src/auth/onUserWrite.ts:24` | ✓ (function) |
| 9 | Criação de profissional falha no meio em empresa com matriz (write como usuário novo) → Auth órfã | `professionals/services/mutations.ts:95-108` + rules | auditor |
| 10 | Matriz de permissões salva = profissional sem escrita de prontuário nem leitura de `blocked_dates` (ModuleKey ≠ coleção) | `firestore.rules:129-154` + `tenant.ts:140` | ✓ (mecanismo) |
| 11 | Recorrência grava sem checar conflito/bloqueio de cada ocorrência; remarcar série desloca tudo sem validação | `appointments/services/mutations.ts:131-223,291-313` | auditor |
| 12 | Excluir paciente/serviço/parceria = hard-delete com órfãos em cascata (e cron somando assinatura de paciente morto) | `clients/mutations.ts:113`; `services-catalog/service.ts:74`; `partnerships/service.ts:43` | auditor |
| 13 | sw.js cacheia dados do Firestore em disco; logout não limpa | `public/sw.js:71-95` | ✓ |
| 14 | `createCompany` com slug existente **sobrescreve** a empresa (zera roles/branding) | `super-admin/service.ts:140` | ✓ |
| 15 | Folha de ponto: turno cruzando meia-noite = 0h silencioso (payroll) | `TimeSheetReport.tsx:69-75` | ✓ |
| 16 | `monthly_summaries` gravável pelo cliente (match genérico) | `firestore.rules:129-154` | auditor |

### P1 — Funcionalidade quebrada visível

| # | Bug | Onde |
|---|---|---|
| 17 | Toggles de módulo sem efeito nas abas Agenda/Financeiro/Pacientes/Confirmações; NavbarTab com chave canônica → aba em branco | `AdminDashboard.tsx:206-219` ✓; `NavbarTab.tsx:19-35` |
| 18 | Recorrência aos domingos impossível (mapeiam 0→7; banco usa 0=domingo) | `RecurringOptions.tsx:77,93` ✓; `useAppointmentForm.ts:297` |
| 19 | KPI: range de datas ilusório (lê só o mês de startDate); filtro por parceria ≈ 0 (cron zera `revenue`); campos híbridos trigger×cron | `kpis/service.ts:125-128` ✓ e matriz T4 |
| 20 | Notificação "Aviso de Pacote" nunca criada em tenants novos (coleção `companies/{cid}/users` legada) | `appointments/mutations.ts:429` ✓ |
| 21 | Register público sempre falha (`getCompanyId()` lança sem tenant) + tela de sucesso mente | `AuthProvider.tsx:242` ✓; `Register.tsx:58-67` |
| 22 | Dia bloqueado não pode ser desbloqueado pela UI (modifier `disabled` do day-picker) | `AvailabilityOverridesManager.tsx:105` |
| 23 | Visão mensal da agenda quebra com eventos (`appt.clients.name` sem optional chaining; eventos têm `clients: null`) | `AgendaCalendarView.tsx:209-211` |
| 24 | Ocupação de turma sempre 0/N (`getAppointmentsByScheduleId` retorna `[]` fixo) | `appointments/services/queries.ts:221-223` |
| 25 | Filtro por serviço na lista de pacientes nunca aplicado | `clients/services/queries.ts:65-77` |
| 26 | "Sessões este mês" sempre 0 na ficha (stub `getMonthlyClientUsage`) | `clients/services/subscriptions.ts:104-106` |
| 27 | Atestados/receituários com timbre "FPL Saúde" hardcoded em qualquer tenant | `ClinicalDocumentsTab.tsx:84` |
| 28 | Upload de avatar de paciente sempre falha (path `patients/**` fora das storage.rules) | `PatientEditDialog.tsx:112` + `storage.rules` |
| 29 | Onboarding cria assinatura sem `amount`/plano → cobrança usa preço de sessão avulsa como mensalidade | `ClientOnboardingDialog.tsx:86-95` |
| 30 | Impersonation não sobrevive a refresh (`tenantStore` não re-hidrata) | `AuthProvider.tsx:119,226-235` |
| 31 | Bloquear dia com paciente agendado: sem aviso nem cancelamento (override individual) | `availability/mutations.ts:82-104` |
| 32 | Assinatura legada sem `status`: trava anti-duplicata não vê, resto do app conta como ativa → duas "ativas" | `clients/services/subscriptions.ts:55-67` |
| 33 | Ponto: 2 registros no mesmo dia = correção do admin atinge doc aleatório e relatório soma os dois | `time-tracking/service.ts:19-20,97-100` |
| 34 | Segunda nota do mesmo atendimento some da UI (dedup por `date` igual) | `useAppointmentDetail.ts:88,96` |
| 35 | Excluir "este e futuros" de série legada (sem group_id) pode apagar série nova do mesmo serviço | `appointments/mutations.ts:637-643` |
| 36 | Fallback de e-mail: `auth/email-already-in-use` não mapeado (+ typo `email-already-in-set`) | `error-mapping.ts:30-36`; `super-admin/service.ts:285` |
| 37 | Convite de senha falho é engolido — admin vê sucesso, profissional nunca recebe e-mail | `professionals/mutations.ts:112-122` |
| 38 | MobileNav: sino/menu de notificações só para professional; "Dashboard Admin" navega para `/` (landing) | `MobileNav.tsx:36,77,108` |
| 39 | Super-admin impersonando + clique no logo → `/cliente-indisponivel` | `Header.tsx:28`; `Index.tsx:41-44` |
| 40 | Backfill apaga `expected_subscriptions_revenue`/`last_full_recalc` e bucketiza por fuso da máquina | `scripts/backfill-monthly-summaries.ts:213-230,39-41` |

### P2 — Qualidade, performance e UX (amostra dos mais relevantes)

- Slots de hoje já passados continuam agendáveis (nenhum filtro de "agora") — `availability-logic.ts` + `DateTimeSelection.tsx:87`.
- `getActiveSubscriptions` N+1 (clientes × subs × 2 getDoc) a cada load; `getAllActiveClientPackages` N+1 ao cubo; cron N+1 por cliente toda noite; `getServices` = 3 full scans por dropdown (cache 5min sem invalidação no update).
- Sino de notificações: `onSnapshot` sem filtro + refetch completo por evento; `markAllNotificationsAsRead` sem batch.
- `AdminDashboard` monta overview carregando lista completa de profissionais + todos os serviços que só outras abas usam; zero code-splitting (bundle único inclui super-admin e landings).
- `TimeSheetReport` anos hardcoded `[2024,2025,2026]` (quebra em 2027); horários do ponto limitados a 06:00–23:30.
- Duplicação: AgendaDayView ≈ AgendaWeekView (slot math, cores, handlers); dedup de notas em 2 lugares; regra de consumo em 2 lugares; resolução de host em 3 lugares (Login, DomainRouter, middleware).
- `console.log` com dados reais em produção (112 ocorrências), 241 `: any`, catches silenciosos nos fluxos de agenda (índice ausente = agenda vazia sem erro).
- Landing: links `/privacidade` e `/termos` → 404; CTA "Agendar" → beco `/cliente-indisponivel` para clients; imagens hotlinked do Unsplash.
- `summaries` retorna zeros silenciosos (sem distinção "sem dados" × "zero real"); tipo `MonthlySummary` desatualizado (consumo via `any`).
- Galeria: mesmo componente admin exposto na área do profissional (todos os pacientes); double-fetch no mount; delete deixa órfãos no Storage.
- `firestore.indexes.json` mantém índices collectionGroup de queries abandonadas.

---

## 6. Plano de melhorias priorizado

### Fase 0 — Estancar o dinheiro e o acesso (dias, cirúrgico)

1. **Conclusão de atendimento**: usar `findActiveSubscriptionForService` nos 3 pontos de `appointments/services/mutations.ts` (mesma correção já aplicada ao form em 10/08). Fecha o vazamento de faturamento avulso (P0-1).
2. **`paySubscription`**: cascata `sub.amount ?? plano ?? serviço` (igual à UI). **`payPackage`/`paySubscription`**: ID determinístico (`{clientPackageId}` e `{subId}_{yyyy-MM}`) — idempotência elimina a classe inteira de duplicatas sem precisar de transação (P0-2/3).
3. **Consumo de pacote**: transação com piso 0 + recusar consumo de pacote `cancelled`/`terminated` (P0-4 parcial, drift do `fixPackageCounts`).
4. **Rules mínimas**: remover os matches collectionGroup de `subscriptions`/`packages`; `allow write: if false` para `monthly_summaries` client-side; bypass de super-admin no write genérico (P0-5/16). *(Deploy de rules pode ser feito isolado.)*
5. **Folha de ponto**: tratar saída < entrada como overnight ou sinalizar linha inválida (P0-15).
6. **`createCompany`**: checar existência do slug antes do `setDoc` (P0-14).
7. **Estorno**: trocar `deleteDoc` por soft-delete (`reversed_at/by`) + `created_at` nos records (P0 auditoria do caixa).

### Fase 1 — Unificar o vocabulário de módulos (3–5 dias, a maior alavanca de organização)

8. **Uma fonte única**: mapa `ModuleKey → { label, abaId, coleções[] }` no `registry.ts`, consumido por `AdminDashboard` (tabs), `AdminNavMenu`, `NavbarTab`, `RolesTab` e usado para gerar/validar as rules. Corrige de uma vez: gating de abas, navbar em branco, matriz de permissões e RBAC das rules (P0-10, P1-17).
9. **Rules por coleção**: reescrever `canViewModule`/`canEditModule` para traduzir coleção→ModuleKey (ou migrar a matriz das empresas para nomes de coleção); remover o fallback que dá leitura total a `client` em tenant legado; restringir o doc da empresa a um subdoc público só de branding (P0-6/7).
10. **Notificações**: fonte de admins = coleção raiz `users` (where companyId+role); rules por dono; ideal mover a criação para o trigger `onAppointmentWrite` (P1-20).

### Fase 2 — Ciclo de vida e servidor (1–2 semanas)

11. **Cloud Function callable `createStaffUser`**: cria Auth + `users` + `professionals` atomicamente com Admin SDK, valida e-mail duplicado, retorna erro limpo. Mata o hack `secondaryAuth`, o bug das rules e os órfãos (P0-9).
12. **Callable `setUserActive`**: inativar = `updateUser({disabled:true})` + claims + subdoc; reativar = reverso. `onUserWrite` para de **deletar** contas (P0-8).
13. **Soft delete consistente**: paciente/serviço/parceria viram `is_active:false` com rotina de cascata (cancelar assinaturas, desvincular futuros, avisar agendamentos); proibir hard-delete no service layer (P0-12).
14. **Recorrência**: pré-validar conflito/bloqueio de todas as ocorrências antes do batch (criar só as livres, reportar colisões); corrigir domingo 0↔7; validar remarcação de série (P0-11, P1-18).
15. **Transição de status em transação** (`runTransaction`): status + pacote + financial_record atômicos (P0-4).

### Fase 3 — Datas e agregação (1–2 semanas)

16. **Timezone única `America/Sao_Paulo`**: `date-fns-tz` real no lugar do `formatInTimeZone` caseiro; `monthKeyOf` das functions e janelas do cron/backfill em SP; `availability-logic` sem `-03:00` hardcoded e sem `getDay()` do navegador (T3).
17. **Uma implementação de agregação**: extrair `fullRecalculation` para pacote compartilhado entre cron e backfill; trigger mantém os mesmos campos que a UI lê; definir semântica única de `revenue` nos breakdowns; cron reconcilia também o mês anterior nos dias 1–3 (T4).
18. **KPI**: honrar o range de datas (ou trocar por seletor de mês) e migrar para `useMonthlySummary`/TanStack (P1-19).

### Fase 4 — Organização estrutural (contínuo)

19. **Matar o barrel `@/shared/services`**: codemod trocando por imports diretos do módulo; deletar o barrel (14 áreas).
20. **Uma camada TanStack por módulo**: apagar hooks mortos, key-factory com `companyId`, invalidação cruzada (status→financial/packages/summaries); páginas param de fazer fetch manual.
21. **Quebrar os god-components**: grade compartilhada Day/Week; AdminDashboard delega abas para os módulos; `React.lazy` por rota (mínimo super-admin/landing).
22. **PWA/segurança**: sw.js para de cachear Firestore; `caches.delete` no logout; validação de upload (tipo/tamanho) no client e nas storage.rules.
23. **Higiene**: deletar código morto listado (T6); `error-mapping` para códigos Firebase; remover `console.log` de produção (lint rule); migrações saem do bundle para `scripts/`.

**Regra de ouro para o time daqui em diante:** toda escrita com efeito financeiro ou de acesso passa por service com idempotência/transação; toda chave de módulo vem do `registry.ts`; toda data de negócio é calculada em `America/Sao_Paulo`.

---

## 7. Apêndice — relatórios por módulo

Os relatórios completos das 7 auditorias (com todos os achados [SUSPEITO] não promovidos a bug e o inventário de acoplamento por módulo) estão preservados no histórico da sessão de 10/08/2026. Os bugs confirmados estão todos consolidados na seção 5; os temas na seção 4. Pontos por módulo que não entraram nas tabelas acima:

- **appointments**: duas key-factories TanStack (`queries.ts:34-41` com companyId × `hooks/useAppointments.ts:5-14` sem); `event-layout.ts` ignora `end_time` (evento de 3h renderiza 1h); comparação lexicográfica de ISO strings pressupõe sempre `Z` (dados legados com offset quebrariam range).
- **clients**: convenção CPF-no-campo-email trava e-mail real; paginação de notas relê todos os appointments por página; migrações one-off no bundle (`fixNotesDates` com batch >500 ops).
- **financial**: status pago/pendente/atrasado 100% derivado na UI (dia >5 hardcoded); recibo com valor editável à mão e sem numeração; `paidSubMap` guarda só o último record (estorno com duplicata mantém "Pago").
- **staff**: `service_ids` como array no doc (read-modify-write sem `arrayUnion`); override parcial `is_available:true` existe no service sem UI; Zod da disponibilidade não valida `start<end`.
- **kpis/functions**: `appointmentDelta` incremental está correto e à prova de dupla contagem em edições — o problema é semântico (campos divergentes), não aritmético; eventos sem `service_id` geram chave literal `'undefined'` ("Serviço Removido") no cron.
- **plataforma**: `usePermission` espelha ModuleKeys (UI esconde) enquanto rules liberam em legado — assimetria dupla; resolução de host hardcoded em 3 lugares; `storage.ts` ignora o parâmetro `bucket`.
- **UI/misc**: ErrorBoundary único no root (erro em uma rota derruba tudo); NotFound em inglês; dois OverlayCleanups para o mesmo bug do Radix; `?tab=subscriptions` renderiza um `FinancialManagement` fantasma fora do enforcement.
