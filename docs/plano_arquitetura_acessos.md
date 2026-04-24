# Guia Completo: Evolução Multi-Tenant, Acessos e Login

Este documento detalha exatamente quais arquivos devem ser alterados, os trechos de código envolvidos e a ordem das operações para implementar a nova arquitetura do sistema.

## Etapa 1: Injeção Dinâmica de Layout (Branding Customizado)

Atualmente, `CompanyBranding` contém códigos HEX no banco, mas o Tailwind CSS na versão utilizada requer os valores definidos em `HSL (Hue Saturation Lightness)` separados por espaço na raiz raiz (`src/main.css`).

**Arquivos Impactados:**
- `src/shared/lib/colorUtils.ts` (Novo): Criar função utilitária `hexToHslString(hex: string)` para converter HEX em sintaxe compatível com variáveis de cor do tailwind `H S% L%`.
- `src/shared/providers/TenantProvider.tsx`:
  - **Onde alterar:** Dentro do `fetchConfig` após popular o `setConfig(data)`.
  - **O que alterar:**
    ```typescript
    if (data?.branding) {
      const root = document.documentElement;
      root.style.setProperty('--primary', hexToHslString(data.branding.primary_hex));
      root.style.setProperty('--secondary', hexToHslString(data.branding.secondary_hex));
      root.style.setProperty('--accent', hexToHslString(data.branding.accent_hex));
      // Replicar mapeamento para foreground_hex e background_hex
    }
    ```

## Etapa 2: Customização do Módulo de Feature Flags

Queremos sair do booleano simples e ir para um objeto descritivo JSON para que os clientes tenham seus relatórios/telas mais personalizáveis e segmentáveis.

**Arquivos Impactados:**
- `src/shared/types/tenant.ts`:
  - **Onde alterar:** Alterar a interface `ModuleConfig`.
  - **O que alterar:**
    ```typescript
    export interface ModuleConfig {
      enabled: boolean;
      label: string;
      features?: Record<string, any>; // Nova propriedade adicionada
    }
    ```
- Extensão Futura de Interfaces Limites (Ex: Dashboard): Em componentes como `AdminNavMenu.tsx` ou Painéis de Indicadores, adicionar a leitura paramétrica do estado atual da Tenant flag: `config.modules.agenda.features?.allow_appointments` ou assemelhado dependendo da regra de negócios em questão.

## Etapa 3: Relação Multi-Workspace de Usuários (Entitlements)

Essa é a alteração primária no Schema do Banco de Dados para que ele consiga suportar de maneira escalável que um profissional trabalhe em 2 ou mais lugares sem quebrar ou mesclar fluxos.

**Mudanças no Firestore (Banco de Dados):**
- **Antes**: O documento de usuário em `users/{uid}` contém dependências engessadas de `companyId: 'x'` e `role: 'professional'`.
- **Depois**: `users/{uid}/memberships/{companyId}`, onde o documento dessa subcoleção dita o escopo específico dessa clínica `{ role: 'professional', active: true, joined_at: timestamp }`. O schema mestre (`users/{uid}`) guarda apenas o perfil imutável (nome e e-mail).

**Arquivos Impactados:**
- `src/shared/providers/AuthProvider.tsx`:
  - **Onde alterar:** Na função principal `fetchProfileAndRole(currentUser)`.
  - **O que alterar:**
    - Ao invés de extrair `userData?.companyId`, devemos efetuar um request/query via Firestore `getDocs` listando a sub-coleção `users/${uid}/memberships`.
    - Se a query retornar de fato `.docs.length === 1`, processamos o login automático como é feito hoje.
    - Se `.docs.length > 1`, setamos no context uma lista `availableWorkspaces: Membership[]`, pausamos a tela de loading de sessão (para false) no estado de login, forçar a troca visual.
- `src/modules/auth/pages/WorkspaceSelector.tsx` (Novo Arquivo Opcional de Fluxo Estendido):
  - Componente que serve de "Passo 2" após o sucesso inicial do auth, listando as empresas. Ao selecionar: aciona método novo no context chamado `selectWorkspace(companyId)` para alocar os dados em definitivo.
- `firestore.rules` (Crucial do Projeto do Google Firebase):
  - **Onde alterar:** Nas regras globais com base em `{companyId}`.
  - **O que alterar:** O validador atual em requests p/ leitura de agenda que checava equivalência de root nodes do usuário deve consultar a função auxiliar `exists(/databases/$(database)/documents/users/$(request.auth.uid)/memberships/$(companyId))`. (Ou utilizando as "Custom Claims" se optar por Node Admin SDK).

## Etapa 4: Isolamento da Página de Login em Relação à Clínica

Tornaremos a rota de login dinâmica de acordo com a premissa de que sua clínica X vai ter visual "X" antes mesmo de ocorrer a autenticação do seu profissional ou cliente final.

**Arquivos Impactados:**
- `src/modules/auth/pages/Login.tsx`:
  - **Onde alterar:** Componentização e Use Effect Initial Mount.
  - **O que alterar:**
    - Fazer leitura de `window.location.hostname` ou `URL Params` (?tenant=slug).
    - Iniciar um block para consultar unicamente as cores institucionais do slug em questão na API sem envolver a autenticação segura do tenant (que precisa de autorização restrita do banco de dados).
    - Assim que os dados públicos do "Slug" forem carregados, injetar no escopo CSS.
- Função Cloud Auxiliar p/ API Pública ou Regra Simples:
  - Precisamos permitir que as referências primárias de Logo/Cor do Firebase dentro da `companies` possam ser lidas caso solicitem a verificação de Branding (separar o endpoint ou as regras `auth != null` se fizer via fetch direto e limitar apenas a queries de `logo_url` e `hex_codes`).

---

### Resumo do Cronograma Sugerido de Implementação Racionalizada e Ágil

1. **Fase 1 (Injeção Visual Dinâmica e Feature Flags):** Desenvolver as funções Utilitárias HexToHSL, integrar no `TenantProvider`, expandir o Tipo de dados TS e testar na UI. Permite entregar valor customizado super rápido.
2. **Fase 2 (Refatoração Silenciosa de Auth & DB):** Criar script de back-office que migrará os `roles/companyIds` antigos parciais do banco Firebase antigo (Collection Users) para o layout de Sub-Coleção de Memberships e re-deploy do `firestore.rules`.
3. **Fase 3 (Multi-Workspace UI):** Modificar o contexto AuthProvider do cliente FPL e implementar a View Selector e menu cascata para troca entre clínicas em tempo real.
4. **Fase 4 (Página de Login Personalizada - White Labelling):** Criar rota pública com verificação de URL de domínios ou query de Tenant que busque o branding do cliente de maneira imediata.
