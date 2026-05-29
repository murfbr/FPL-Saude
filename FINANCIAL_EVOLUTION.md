# Evolução da Gestão Financeira: De Faturamento a Controle Total

Este documento serve como um guia para discutirmos os caminhos possíveis para evoluir o módulo financeiro do FPL-Saúde. Atualmente, o sistema foca apenas no faturamento (receitas). Para termos uma visão completa e controle financeiro real, precisamos incorporar as despesas e ferramentas de análise.

Abaixo estão listadas as sugestões de funcionalidades e o impacto técnico para cada uma delas. O objetivo é ler, ajustar e, a partir das decisões tomadas aqui, bolar o plano de execução.

---

## 1. Sugestões de Caminhos e Funcionalidades

### 1.1. Gestão de Despesas (Saídas)
O passo fundamental é permitir o registro do que sai do caixa da clínica.
*   **Categorização:** Criar um sistema de categorias para classificar despesas (ex: "Aluguel", "Impostos", "Salários", "Materiais", "Marketing"). Pode ser algo fixo no código inicialmente ou um CRUD dinâmico para o usuário personalizar.
*   **Gestão de Fornecedores:** Vincular a despesa a quem está recebendo o pagamento (Enel, Sistema X, Prestador Y).
*   **Anexos de Comprovantes:** Capacidade de fazer upload da nota fiscal ou recibo da despesa (utilizando o Storage).
*   **Recorrência:** Possibilidade de marcar uma despesa como fixa mensal, gerando o lançamento automaticamente a cada mês.

### 1.2. Unificação: Transações (Transactions)
Em vez de tratar "Receitas" e "Despesas" de forma isolada, o ideal é unificarmos tudo sob o conceito de **Transações**. 
*   **Vantagem:** Facilita muito o cálculo de saldo e relatórios.
*   **Controle de Status:** Toda transação (entrada ou saída) deve ter status como `PENDING` (Pendente), `PAID` (Pago), `OVERDUE` (Atrasado) e `CANCELED` (Cancelado).
*   **Datas:** Diferenciar a Data de Vencimento (`dueDate`) da Data de Pagamento Efetivo (`paymentDate`).

### 1.3. Relatórios e BI (Business Intelligence)
Com entradas e saídas no mesmo formato, podemos gerar inteligência:
*   **Fluxo de Caixa Mensal:** Um painel visual mostrando as entradas, as saídas e o saldo projetado do mês.
*   **DRE Simplificado (Demonstrativo do Resultado do Exercício):** Um relatório contábil simples que mostra a Receita Bruta, subtrai os custos e despesas e revela o Lucro/Prejuízo real do período.
*   **Filtros Avançados:** Poder filtrar por período, por categoria de despesa, ou por profissional.

---

## 2. O que teria que ser implementado (Impacto Técnico)

Seguindo nossos `/combinados` (Shadcn, Zod, Adapter Pattern), as mudanças ocorreriam nas seguintes áreas:

### 2.1. Banco de Dados e Serviços (Adapter Pattern)
*   **Novas Tabelas/Coleções:** 
    *   `transactions` (para substituir ou englobar o faturamento atual e adicionar as despesas).
    *   `categories` (se decidirmos que as categorias são editáveis pelo usuário).
*   **Adapters:** Criar `transactions.service.ts` dentro de `src/services/` para abstrair as chamadas ao Firebase/Supabase (`VITE_DB_PROVIDER`).
*   **Migração:** Se já houver dados de faturamento reais em produção, precisaremos escrever um pequeno script para migrar essas faturas para a nova estrutura de `transactions`.

### 2.2. Tipagem e Validação (Typescript & Zod)
*   Criar interfaces sólidas como:
    ```typescript
    export type TransactionType = 'INCOME' | 'EXPENSE';
    export type TransactionStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED';

    export interface Transaction {
      id: string;
      type: TransactionType;
      amount: number;
      categoryId: string;
      status: TransactionStatus;
      dueDate: Date;
      paymentDate?: Date;
      description: string;
      attachmentUrl?: string; // Para os recibos
    }
    ```
*   Criar o `transactionSchema` com Zod para validar formulários.

### 2.3. Frontend (UI/UX)
*   **Novas Páginas:**
    *   `/financial/dashboard`: Gráficos e números gerais.
    *   `/financial/transactions`: Tabela unificada listando entradas e saídas com filtros (usando o componente DataTable do Shadcn).
*   **Formulários:** Modal ou Drawer para adicionar uma nova Entrada ou Saída. Uso de React Hook Form + Zod.
*   **Feedback:** Uso do Sonner (`toast`) para confirmar salvar/deletar e estados de "Loading" para as requisições (seguindo o padrão do TanStack Query).
*   **Gráficos:** Implementar bibliotecas como `recharts` para o Fluxo de Caixa.

---

## 3. Pontos de Discussão (Para decidirmos juntos)

Antes de transformarmos isso num plano de ação e começarmos a codar, peço que avalie e me diga sua visão sobre os pontos abaixo:

1.  **Categorias:** Queremos que o usuário possa criar suas próprias categorias de despesa, ou entregamos uma lista fixa e padronizada (ex: Impostos, Pessoal, Infraestrutura)?
2.  **Fornecedores:** É importante cadastrar formalmente os "Fornecedores" (com CNPJ, etc.) ou apenas um campo de texto "Descrição/Para quem foi pago" é suficiente agora?
3.  **Migração:** O que já existe hoje de faturamento precisa ser preservado e migrado para o novo formato de Transações, ou podemos recriar do zero?
4.  **Centros de Custo:** Precisaremos separar despesas por setores da clínica (ex: Custos do Consultório 1, Custos Administrativos), ou não há essa necessidade ainda?

---

*Por favor, sinta-se à vontade para editar este arquivo e adicionar ou remover ideias. Quando estivermos alinhados sobre os pontos acima, transformamos isso em tarefas (tasks) e inicio a codificação conforme nossos combinados.*
