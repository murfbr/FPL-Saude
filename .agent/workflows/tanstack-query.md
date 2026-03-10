---
description: Como implementar o TanStack Query para sofisticação do projeto
---

Este workflow serve para padronizar a transição de chamadas diretas para o TanStack Query.

### Passo 1: Instalação
- Executar: `pnpm add @tanstack/react-query`
- Configurar o `QueryClientProvider` no `src/App.tsx`.

### Passo 2: Padronização de Hooks
- Para cada serviço em `src/services/`, criar um hook correspondente em `src/hooks/queries/`.
- Nomear como `usePatients`, `useAppointments`, etc.

### Passo 3: Implementação nos Componentes
- Substituir `useEffect` + `useState` locais pelo hook do TanStack Query.
- Utilizar os estados de `isLoading`, `isError` e `data` para melhorar a UX.

### Passo 4: Cache e Invalidação
- Sempre que houver uma mutação (create/update/delete), certifique-se de invalidar a query relevante para que o dado na tela atualize instantaneamente.
