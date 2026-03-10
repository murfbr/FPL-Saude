---
description: Nossos combinados sobre estilo de código e padrões do projeto
---

Sempre que você for escrever código para o FLP Saúde, siga estas regras:

### 1. Sintaxe e Estrutura
- **Arrow Functions**: Use sempre `const Componente = () => {}` para componentes e funções internas.
- **Tipagem**: Prefira `interface` para objetos de domínio e `type` para uniões ou tipos simples.
- **VITE_DB_PROVIDER**: Sempre considere que o código pode rodar em Firebase ou Supabase. Nunca quebre o "Adapter Pattern" definido no `src/services/index.ts`.

### 2. Idioma e Nomenclatura
- **Código**: Variáveis, funções e arquivos devem ser em **Inglês**.
- **Interface**: Textos visíveis para o usuário devem ser em **Português (PT-BR)**.
- **Nomes descritivos**: Prefira `handlePatientRegistration` em vez de `handleSave`.

### 3. UI e UX (Shadcn + Tailwind)
- **Componentes**: Use prioritariamente os componentes em `src/components/ui`.
- **Feedback**: Ações de escrita (save/delete) devem sempre disparar um `toast` (Sonner ou Shadcn).
- **Loading**: Operações assíncronas devem ter um estado visual de carregamento.

### 4. Boas Práticas
- **Zod**: Use o Zod para validar entradas de formulários e contratos de API.
- **Comentários**: Use comentários JSDoc em funções complexas explicando o "porquê", não apenas o "o quê".
