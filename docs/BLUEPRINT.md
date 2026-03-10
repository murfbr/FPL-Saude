# 📘 Blueprint do Projeto: FLP Saúde

## 1. Visão Geral
O FLP Saúde é um sistema de gestão para clínicas ou profissionais de saúde, permitindo o controle de pacientes, agendamentos, planos de assinatura, pacotes de serviços e gestão financeira.

## 2. Stack Tecnológica
*   **Frontend:** React 19 + Vite (TypeScript).
*   **Estilização:** Tailwind CSS + Shadcn/UI (Radix UI).
*   **Roteamento:** React Router Dom v6.
*   **Backend/Banco de Dados:** Estrutura híbrida com suporte a **Firebase** e **Supabase** via Adapter.
*   **Formulários & Validação:** React Hook Form + Zod.
*   **Visualização de Dados:** Recharts (KPIs e Dashboards).
*   **Qualidade:** Vitest (Testes) + Oxlint (Linting) + Prettier (Formatação).

## 3. Arquitetura do Sistema

### 🏗️ Padrões de Design
*   **Adapter Pattern:** Localizado em `src/services/index.ts`, este padrão permite que a aplicação troque de banco de dados (`Firebase` vs `Supabase`) apenas alterando a variável de ambiente `VITE_DB_PROVIDER`.
*   **Service Layer:** Toda a lógica de comunicação com o banco de dados está isolada em `src/services/`, separando a UI da lógica de dados.
*   **Context API:** Utilizada para gestão de estado global de autenticação (`AuthProvider.tsx`).
*   **Guards:** Componentes de proteção de rota (`ProtectedRoute`) e de papéis de usuário (`RoleGuard`).

### 📂 Estrutura de Pastas
```text
src/
├── components/          # Componentes reutilizáveis (Layouts, UI, Proteção)
├── hooks/               # Hooks customizados (useToast, useMobile, etc.)
├── lib/                 # Configurações de bibliotecas (utils de CSS, etc.)
├── pages/               # Telas da aplicação (Admin, Profissional, Público)
├── providers/           # Provedores de contexto (Auth)
├── services/            # Camada de serviços (Adapters Firebase/Supabase)
│   ├── firebase/        # Implementações específicas do Firebase
│   └── supabase/        # Implementações específicas do Supabase (Legacy)
├── types/                # Definições de interfaces TypeScript (Entidades de domínio)
└── main.tsx             # Ponto de entrada
```

## 4. Domínio de Dados (Entidades Principais)
As interfaces em `src/types/index.ts` definem o coração do negócio:
*   **UserRole:** `admin`, `professional`, `client`.
*   **Services:** Gestão de procedimentos (preço, duração, tipo).
*   **Professional:** Perfis de atendimento, especialidades e disponibilidade.
*   **Client:** Perfil do paciente, avaliações e associações (parcerias).
*   **Appointments:** Agendamentos vinculando cliente, profissional e serviço.
*   **Financials:** Registros de pagamentos, assinaturas e pacotes.
*   **Packages/Subscriptions:** Modelos de recorrência e venda de pacotes de sessões.

## 5. Fluxos de Navegação e Acessos
O sistema possui 3 níveis de acesso principais gerenciados pelo `App.tsx`:

1.  **Público:** Login, Cadastro, Recuperação de Senha.
2.  **Área Administrativa (Admin):**
    *   Dashboard Geral (KPIs de receita e atendimento).
    *   Gestão de Pacientes e Profissionais.
    *   Configurações do sistema.
3.  **Área Profissional:**
    *   Visão de agenda e pacientes vinculados.
    *   Prontuário/Notas de atendimento.
    *   Notificações.

---

### 💡 Observações de Manutenção
*   **Scripts:** O projeto possui scripts em `scripts/` (como `fix-migration.ts`) indicando uma manutenção ativa de dados e migrações.
*   **Configurações:** O projeto possui linting via Oxlint e formatação Prettier para manter a qualidade do código.
