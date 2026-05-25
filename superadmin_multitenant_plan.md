# Plano de Evolução Estratégica: Arquitetura Multi-Tenant e Superadmin

Este documento consolida o planejamento técnico para evoluir as funcionalidades de Superadmin e a infraestrutura Multi-Tenant do FPL-Saúde, alinhando-se estritamente à realidade do código atual (incluindo as necessidades de refatoração identificadas).

---

## 1. Isolamento de Dados Robusto (Segurança e Compliance)

**A Necessidade Atual:**
O isolamento entre tenants depende de passagem de filtros pelo frontend e funções do backend (usando `getCompanyId()`).

**Evolução Arquitetural:**
Transferir a fronteira de segurança para a camada do banco de dados (Firestore Security Rules ou RLS), rejeitando ativamente qualquer leitura que fuja do escopo do inquilino.

### 🏆 Benefícios
- **Segurança "Zero Trust":** Impossibilita vazamento de dados cruzado mesmo em caso de falha ou esquecimento no código.
- **Auditoria LGPD:** Fundamental para fechar contratos B2B com clínicas maiores, garantindo isolamento técnico incontestável.

### 🛠️ Execução Técnica
1. **Injeção de Contexto no Auth:** Assegurar que o Custom Token do usuário possua a claim do `companyId`.
2. **Regras Estritas de Banco:** Escrever regras que bloqueiem queries se o `companyId` do documento não bater com o do token da requisição.
3. **Refatoração de Acesso:** Adequar a interface para lidar com erros de permissão (`403 Permission Denied`).

---

## 2. Dashboard de Visão Global (Business Intelligence do Superadmin)

**A Necessidade Atual:**
O arquivo `SuperAdminDashboard.tsx` lista as empresas e a contagem de usuários. Faltam métricas de negócio executivas para o Superadmin entender o engajamento e a saúde financeira das clínicas usando o sistema.

**Evolução Arquitetural:**
Expandir o `SuperAdminDashboard.tsx` com painéis de BI alimentados por agregadores assíncronos.

### 🏆 Benefícios
- **Decisão Orientada a Dados:** Ver de forma agregada o crescimento de agendamentos, usuários ativos e uso do sistema sem precisar entrar na conta de cada clínica.

### 🛠️ Execução Técnica
1. **Modelagem de Agregadores (Cloud Functions):** Criar rotinas em background que consolidam os números de todos os tenants (total de consultas realizadas no mês, total faturado pelas clínicas) e salvam em um documento global cacheados.
2. **Desenvolvimento de UI/Gráficos:** Inserir gráficos no painel usando o dado em cache para não onerar o banco.

---

## 3. Refatoração e Gestão de Módulos / Features (Painel Superadmin)

**A Necessidade Atual:**
O arquivo `CompanyDetail.tsx` (onde o Superadmin liga/desliga módulos, ajusta roles, e edita as features) cresceu para quase 800 linhas, concentrando todas as abas e regras em um único lugar, causando lentidão e sobrecarga cognitiva (conforme já apontado no `refactoring_plan.md`).

**Evolução Arquitetural:**
Desacoplar a página de gestão do Tenant no Superadmin em componentes isolados e introduzir o conceito de "Pacotes de Configuração" base.

### 🏆 Benefícios
- **Performance e Manutenibilidade:** Separar as abas de "Módulos", "Features", "Branding" e "Roles" isolará o código, facilitando muito a manutenção por parte dos desenvolvedores.
- **Organização Operacional:** Permite ao Superadmin gerir as configurações (`ModuleConfig` e `CompanyFeatures`) de forma modular.

### 🛠️ Execução Técnica
1. **Separação de Componentes:** Mover os blocos como `ModulesTab`, `FeaturesTab` e `BrandingTab` para arquivos independentes (ex: `/super-admin/components/CompanyDetail/`).
2. **Lazy Loading:** Utilizar TanStack Query para carregar apenas os dados da aba clicada (ex: carregar a lista de usuários apenas quando clicar na aba `Users`), acelerando a montagem inicial da página da empresa.
3. **Pacotes de Features:** Adicionar funcionalidade para o Superadmin aplicar "Configurações em Lote" (aplicar um pacote padrão que já liga Módulos X e Y de uma vez para agilizar o setup de uma nova clínica).

---

## 4. Whitelabeling e Customização Visual Dinâmica

**A Necessidade Atual:**
A estrutura de marca `CompanyBranding` (logo e cores) já existe e está perfeitamente manipulável no `CompanyDetail.tsx`. Agora precisamos garantir que ela permeie todo o ciclo de contato do cliente.

**Evolução Arquitetural:**
Um motor de propagação da identidade visual do tenant que atinja áreas externas ao painel React (documentos gerados e disparos de e-mail).

### 🏆 Benefícios
- **Efeito Lock-in B2B:** Quando o paciente recebe relatórios ou lembretes com a logo e cores exatas da clínica, o valor percebido do FPL-Saúde atinge seu ápice.

### 🛠️ Execução Técnica
1. **Padronização em PDFs:** Alterar geradores (como o export de Ficha de Avaliação) para buscar a `logo_url` e `primary_hex` no banco e renderizar no cabeçalho.
2. **E-mails Dinâmicos:** Integrar as cores e logo nos templates de e-mail transacional (confirmação de agenda, boas-vindas).
3. **Propagação de Estilo UI:** Injeção das variáveis CSS no SSR para assegurar que componentes de UI base herdem as cores da clínica instaneamente.

---

## 5. Motor Interno de Geração de Módulos (Formulários Dinâmicos)

**A Necessidade Atual:**
Hoje, formulários como o `GeneralAssessmentForm` possuem campos fixos (`mainComplaint`, `physicalExam`) via código estático, embora salvem em um array flexível no banco (`general_assessment`). Lançar especialidades novas requer criar componentes React do zero.

**Evolução Arquitetural:**
Criar um construtor de esquemas (JSON Schema) para uso **interno** dos desenvolvedores do FPL-Saúde.

### 🏆 Benefícios
- **Agilidade de Lançamento:** A equipe de TI lança uma ficha completa de Anamnese Psiquiátrica apenas escrevendo um arquivo JSON, sem desenhar inputs na mão. Mantém o código incrivelmente limpo.

### 🛠️ Execução Técnica
1. **Implementação de Renderizador JSON:** Adotar uma lib como `react-jsonschema-form` para ler os esquemas e gerar inputs validados.
2. **Modelagem de Schemas por Especialidade:** Cadastrar no sistema os "tipos" de avaliação (Ex: `Odonto`, `Psicologia`), onde cada um devolve um JSON Schema específico.
3. **Renderização Agnóstica:** O `GeneralAssessmentForm` passará a pedir ao backend: "qual o schema dessa clínica?" e desenhará a tela magicamente, salvando os dados no formato atual.
