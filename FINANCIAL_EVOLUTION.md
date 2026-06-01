# Evolução da Gestão Financeira: Módulo de Despesas e Fluxo de Caixa

Este documento serve como um guia para o desenvolvimento da evolução do módulo financeiro do FPL-Saúde. O sistema atual já gerencia o faturamento (receitas). Para termos controle financeiro real, vamos incorporar o registro de despesas e ferramentas de análise de fluxo de caixa, **mantendo a estrutura de receitas atual separada**.

---

## 1. Funcionalidades a serem implementadas

### 1.1. Gestão de Despesas (Saídas)
Permitir o registro e controle do que sai do caixa da clínica, em um módulo separado do faturamento.
*   **Categorização:** Criar um sistema de categorias para classificar despesas (ex: "Aluguel", "Impostos", "Salários", "Materiais", "Marketing"). (Ponto em aberto: Fixo ou CRUD dinâmico?)
*   **Gestão de Fornecedores:** Vincular a despesa a quem está recebendo o pagamento. (Ponto em aberto: Cadastro formal ou campo de texto?)
*   **Recorrência:** Possibilidade de marcar uma despesa como fixa mensal, gerando o lançamento automaticamente a cada mês.

### 1.2. Relatórios e BI (Business Intelligence)
*   **Fluxo de Caixa Mensal:** Um painel visual mostrando as receitas (buscadas do módulo de faturamento atual), as saídas (do novo módulo de despesas) e o saldo projetado do mês. As duas fontes de dados serão unidas no frontend para gerar essa visão.
*   **Filtros Avançados:** Poder filtrar despesas por período, por categoria, ou por profissional.

---

## 2. Impacto Técnico e Arquitetura

Seguindo nossos `/combinados` (Shadcn, Zod, Adapter Pattern), as mudanças ocorreriam nas seguintes áreas:

### 2.1. Banco de Dados e Serviços (Adapter Pattern)
*   **Novas Tabelas/Coleções:** 
    *   `expenses` (nova tabela exclusiva para controle das saídas).
    *   `categories` (se decidirmos que as categorias são editáveis pelo usuário).
*   **Adapters:** Criar `expenses.service.ts` dentro de `src/services/` para abstrair as chamadas ao banco (`VITE_DB_PROVIDER`).
*   **Integração (Sem Migração):** Não unificaremos receitas e despesas no banco de dados. Os dados atuais de faturamento permanecem intactos, eliminando a necessidade de scripts de migração.

### 2.2. Tipagem e Validação (Typescript & Zod)
*   Criar interfaces sólidas para as despesas:
    ```typescript
    export type ExpenseStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED';

    export interface Expense {
      id: string;
      amount: number;
      categoryId: string;
      status: ExpenseStatus;
      dueDate: Date;
      paymentDate?: Date;
      description: string;
      // fornecedorId ou fornecedorNome dependendo da decisão abaixo
    }
    ```
*   Criar o `expenseSchema` com Zod para validar os formulários de despesas.

### 2.3. Frontend (UI/UX)
*   **Novas Páginas:**
    *   `/financial/dashboard`: Gráficos e números gerais de Fluxo de Caixa (agregando requisições de faturamento e despesas via chamadas paralelas do TanStack Query).
    *   `/financial/expenses`: Tabela listando apenas as despesas com filtros (usando DataTable do Shadcn).
*   **Formulários:** Modal ou Drawer para adicionar uma nova Despesa. Uso de React Hook Form + Zod.
*   **Feedback:** Uso do Sonner (`toast`) para confirmar salvar/deletar e estados de "Loading" para as requisições.
*   **Gráficos:** Implementar bibliotecas como `recharts` para o Fluxo de Caixa.

---

## 3. Pontos de Discussão Restantes (Para decidirmos juntos)

Alguns pontos ainda precisam de definição antes de iniciarmos a codificação:

1.  **Categorias:** Queremos que o usuário possa criar suas próprias categorias de despesa, ou entregamos uma lista fixa e padronizada (ex: Impostos, Pessoal, Infraestrutura)?
2.  **Fornecedores:** É importante cadastrar formalmente os "Fornecedores" (com CNPJ, etc.) ou apenas um campo de texto "Descrição/Para quem foi pago" é suficiente agora?
3.  **Centros de Custo:** Precisaremos separar despesas por setores da clínica (ex: Custos do Consultório 1, Custos Administrativos), ou não há essa necessidade ainda?

---

*Assim que definirmos os 3 pontos acima, podemos iniciar a codificação.*
