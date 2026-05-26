# Plano de Evolução Estratégica: Arquitetura Multi-Tenant e Superadmin

Este documento consolida o planejamento técnico para evoluir as funcionalidades de Superadmin e a infraestrutura Multi-Tenant do FPL-Saúde. A análise apresentada aqui é conclusiva e reflete a arquitetura exata encontrada no código-fonte do sistema.

---

## 1. Isolamento de Dados Robusto (Segurança e Compliance)

**Status Geral:** 🟢 Concluído

**Diagnóstico Arquitetural:**
- O isolamento via *Firestore Rules* está ativo. O arquivo `firestore.rules` foi reescrito e valida permissões pelo Token JWT e fallback via banco.
- O problema da criação de novos usuários no client-side sem claims foi **resolvido** com a Cloud Function `onUserWrite.ts` escutando a coleção raiz `users` e aplicando `admin.auth().setCustomUserClaims()`.
- A lógica de Soft Delete de ponta-a-ponta foi implementada: a exclusão apenas marca `is_active: false` na raiz, e a Cloud Function intercepta essa flag para suspender o Auth e anonimizar a interface do profissional.
- A exceção de Catálogo Público para dropdowns (`services` e `subscription_plans`) já está regida corretamente no Firestore.

### ✅ O Que Já Está Feito
- Refatoração total do `firestore.rules` (RBAC e Catálogos).
- Injeção das Custom Claims pela Cloud Function `onUserWrite.ts`.
- Refatoração do fluxo de Deleção para proteger integridade referencial ("Soft Delete").

---

## 2. Dashboard de Visão Global (Business Intelligence do Superadmin)

**Status Geral:** 🔴 Pendente

**Diagnóstico Arquitetural:**
O `SuperAdminDashboard.tsx` atual renderiza a contagem de usuários fazendo um loop com `Promise.all` (`getUsersByCompany`). Isso não escala e não provê inteligência de negócios real.

### 🚧 O Que Falta Fazer
- Eliminar as dezenas de leituras em paralelo na renderização do componente.
- Criar a rotina assíncrona que mastigue os dados do banco para o dashboard.

---

## 3. Refatoração e Gestão de Módulos / Features (Painel Superadmin)

**Status Geral:** 🟡 Em Andamento

**Diagnóstico Arquitetural:**
O antigo arquivo monolítico `CompanyDetail` foi fragmentado com sucesso (`ModulesTab.tsx`, `BrandingTab.tsx`, etc.). Contudo, o fluxo de "Onboarding" de um novo inquilino exige acionar toggle por toggle na aba de módulos e features. Precisamos de **Templates de Configuração**.

### 🛠️ Plano de Implementação Técnico Profundo (Templates)

1. **Definição Estrita dos Templates (`src/modules/super-admin/constants/templates.ts`):**
   Vamos criar um dicionário de configurações seladas no código-fonte para refletir os planos comerciais reais:
   ```typescript
   export const COMPANY_TEMPLATES = {
     'basico': {
       name: 'Clínica Básica',
       modules: { agenda: true, prontuario: true, financeiro: false, notificacoes: false }
     },
     'completo': {
       name: 'Gestão Completa',
       modules: { agenda: true, prontuario: true, financeiro: true, notificacoes: true, relatorios: true }
     }
   }
   ```
2. **Refatoração da `ModulesTab.tsx`:**
   - Adicionar o componente `<Select>` (Shadcn UI) no cabeçalho da tab.
   - Ao selecionar um template, interceptar a escolha com um Alert Dialog: *"Atenção: Aplicar este pacote sobrescreverá as permissões atuais. Deseja continuar?"*
   - O botão 'Aplicar' chamará a função existente `updateCompanyModules(company.id, generatedModulesObject)`.
   - Como os módulos no banco também guardam uma propriedade `label`, será necessário um mapeador iterativo que junte os defaults do `MODULE_REGISTRY` com o status do Template antes de injetar no Firebase.

---

## 4. Whitelabeling Comercial (Experiência Customizada por Inquilino)

**Status Geral:** 🔴 Pendente

**Diagnóstico Arquitetural:**
A infraestrutura de banco de dados (`BrandingTab.tsx` -> `logo_url`, `primary_hex`, `app_name`, etc.) já existe. Porém, a "cara" do sistema continua sendo da FPL-Saúde. Para o produto ser *comercializável* no modelo SaaS B2B, a clínica precisa sentir que o software é dela desde o momento do login até a barra de navegação.

### 🛠️ Plano de Implementação Técnico Profundo (Commercial Whitelabel)

1. **Roteamento Dinâmico de Login por Tenant (Slug):**
   - Atualmente o login é genérico (`/login`).
   - Implementar roteamento por *Slug* da empresa: `/:companySlug/login`.
   - Ao acessar essa URL, a tela de login fará um fetch assíncrono público (sem auth) das configurações de branding dessa clínica.
   - A tela de login exibirá a `logo_url` da clínica e o `app_name` no cabeçalho em vez do logo da plataforma matriz. O botão de "Entrar" já será tingido com o `primary_hex` da clínica.

2. **Injeção de Metatags (Favicon e Title):**
   - Criar um hook `useDynamicBranding()` que será acionado no `TenantProvider.tsx`.
   - Ele alterará a tag `<title>` do documento HTML dinamicamente para o `app_name` da clínica (ex: "Clínica Nova Vida - Gestão").
   - Trocará o `<link rel="icon">` (Favicon) para a `logo_url` da clínica.

3. **Substituição Visual em toda a UI (Sidebar e Navbar):**
   - O logo do FPL-Saúde que fica fixo no topo da barra lateral/menu superior será trocado dinamicamente pelo `config.branding.logo_url`.
   - O nome do software exibido aos pacientes no portal ou nos exports de PDF/Atestados também usará as chaves de branding.

4. **Injeção de Variáveis CSS Nativas no DOM:**
   - Para que todo o *Shadcn UI* respire as cores da clínica sem piscar tela, injetaremos o `primary_hex` (convertido para HSL) diretamente no `:root` através do `TenantProvider`, garantindo que toda a navegação do usuário seja "tingida" instantaneamente.

---

## 5. Motor Interno de Geração de Módulos (Formulários Dinâmicos)

**Status Geral:** 🔴 Pendente

**Diagnóstico Arquitetural:**
Hoje os formulários usam `react-hook-form`, mas seus inputs estão hardcoded. Lançar uma ficha diferente exige deploy de código.

### 🚧 O Que Falta Fazer
- O Motor que transforme um JSON estrito em um componente React renderizável na tela do usuário.
