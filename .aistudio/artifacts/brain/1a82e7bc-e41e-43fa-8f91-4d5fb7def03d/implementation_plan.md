# Unificação da Toca e Bestiário: Nova Biblioteca de Criaturas e Ficha Unificada

Reestruturação completa da aba Toca para o padrão visual e funcional de Biblioteca (busca, importação/exportação JSON, cards com envio para mesa e ficha do jogador), integrando um modelo de ficha compartilhado e padronizado entre as criaturas da Toca e os monstros do Bestiário, com todas as regras de atributos, proficiências e seções ajustadas.

---

## Confirmação de Layout da Ficha (Ficha de Jogador vs Ficha de Criatura)

> [!IMPORTANT]
> **Sim, o layout é 100% idêntico ao da Ficha de Jogador!**
> 
> A ficha de criaturas (usada tanto na **Toca** quanto no **Bestiário**) é renderizada exatamente pelo **mesmo componente e estrutura visual da ficha de jogador** (`App.tsx`), compartilhando o mesmo design system, inputs, cálculo de carga/peso, rolagem de dados e mecânica de combate.
> 
> **Apenas os seguintes pontos específicos são omitidos ou ajustados:**
> 1. **Etnia**: O seletor de etnia e seu cálculo de bônus são omitidos.
> 2. **Dinheiro**: O quadro de moedas (ouro, prata, cobre) é omitido.
> 3. **Barra de Sanidade**: A barra/cálculo de sanidade é omitida (permanecem Vida Atual/Máxima e Carga).
> 4. **Conhecimentos**: A seção de Conhecimentos é omitida.
> 5. **Atributos (Status)**: Exibidos exatamente nos mesmos cartões de atributo da ficha de jogador, porém contendo apenas **CON, RES, ADP, FOR, DEX, INT** (removidos: **APR**, **RIT** e **MEN**).
> 6. **Bônus de Dano**: A mesma tabela/quadro de bônus de dano da ficha de jogador, apenas sem a linha de **RIT**.
> 7. **Proficiências**: Os mesmos círculos e controles de proficiências da ficha de jogador, apenas sem as perícias: **Forja Manual**, **Forja Artesanal/Rústica**, **Ritualismo** e **Mentalidade**.
> 8. **Compartimentos**: A mesma seção completa de mochilas/compartimentos da ficha de jogador (com adição de armas, catalisadores, armaduras, munições e itens gerais), iniciando **vazia por padrão** (sem nenhuma bolsa pré-criada).
> 9. **Abas / Seções Especiais de Monstro**: Adicionadas no mesmo padrão estético da ficha:
>    - **Informações** (Local, Personalidade, Gostos/Desgostos, Partes Úteis, Informações gerais, Hábitos).
>    - **Ataques** (Ações/ataques rápidos da criatura).
>    - **Níveis de Ataque** (Corte, Perfuração, Impacto, Resistência, Feitiço, Elemental, Magia Negra, Potencial).
>    - **Níveis de Defesa** (Corte, Perfuração, Impacto, Feitiço, Elemental, Magia Negra).

---

## 1. Overview & Core Concept

- **O que faz**: Transforma a Toca em uma biblioteca completa de companheiros, animais e demônios do jogador com a mesma elegância das abas de Itens e Magias. Ao clicar em "Ficha Completa", abre a ficha de jogo completa da criatura, que agora segue rigorosamente o mesmo layout e as mesmas regras do Bestiário.
- **Público-alvo**: Jogadores que possuem montarias, animais de caça ou demônios invocados, e Mestres que precisam de consistência absoluta entre as fichas de criaturas da Toca e as criaturas do Bestiário.
- **Benefício**: Elimina a duplicidade de formulários, reduz a complexidade visual retirando campos irrelevantes para monstros/animais (como sanidade humana, dinheiro e etnias humanas) e unifica a experiência de combate no VTT.

---

## 2. User Experience & Visual Design

### Fluxo de Uso
1. **Biblioteca da Toca**:
   - Barra superior com campo de busca rápido, botões de ação ("Exportar JSON", "Importar JSON", "Novo Companheiro") e contadores informativos.
   - Grade responsiva de cards (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) apresentando foto/avatar, nome, HP, Acurácia, Esquiva e resumo de níveis de Ataque/Defesa.
   - Botões de ação em cada card:
     - **Ficha Completa**: Abre a ficha completa da criatura na visualização principal, com banner de contexto e botão de retorno direto.
     - **Enviar p/ Mesa (VTT)**: Spawna o token da criatura diretamente no tabuleiro ativo.
     - **Enviar p/ Ficha**: Permite vincular a criatura ao personagem ativo como companheiro/montaria.
     - **Exportar JSON / Excluir**: Ações rápidas de backup e remoção com confirmação visual.

2. **Ficha Completa Unificada (Toca & Bestiário)**:
   - Banner superior indicando o modo de criatura (âmbar para Toca, roxo para Bestiário).
   - Cabeçalho limpo com Nome, Imagem, HP Atual/Máximo e Deslocamento (sem etnia, sem dinheiro, sem sanidade).
   - Grade de Atributos contendo apenas os 6 atributos relevantes: `CON`, `RES`, `ADP`, `FOR`, `DEX`, `INT`.
   - Bônus de Dano limpo sem linha de RIT.
   - Proficiências filtradas exibindo apenas as perícias físicas e de sobrevivência aplicáveis a criaturas.
   - Seções padronizadas: Informações, Níveis de Ataque, Níveis de Defesa, Ataques/Ações, Compartimentos (iniciando vazios), Equipamentos e Habilidades.

### Identidade Visual e Estilo
- **Paleta de Cores**: Base `zinc-950` e `zinc-900`, com acentos em âmbar (`amber-500`) para a Toca e toques de contraste em vermelho para ataque e azul para defesa.
- **Tipografia**: Hierarquia sólida com títulos uppercase compactos (`tracking-wider`), números monoespaçados legíveis e contraste refinado.
- **Feedback Interativo**: Confirmação em 2 passos para deleção, microanimações nos cards e estados vazios com ícones temáticos e mensagens de orientação.

---

## 3. Key Product Decisions & Trade-Offs

- **Decisão 1: Componentização da Biblioteca da Toca**:
  - *Abordagem*: Criar/substituir o componente de gerenciamento da Toca por um visual alinhado com `Bestiary.tsx` e `ItemLibrary.tsx`, desacoplando o código redundante antigo.
  - *Motivo*: Facilita a manutenção e garante paridade de funcionalidades (busca, importação, exportação e criação).
- **Decisão 2: Motor de Ficha Único (`isCreatureMode`)**:
  - *Abordagem*: Reutilizar a estrutura da ficha principal (`App.tsx`) ativada pelo modo de criatura (`tocaEditingCreatureId` ou `bestiaryEditingMonsterId`), unificando o schema de dados e os cálculos matemáticos.
  - *Motivo*: O layout fica 100% idêntico ao da ficha de jogador com consistência visual imediata.
- **Decisão 3: Compartimentos Vazios por Padrão**:
  - *Abordagem*: Ao criar uma nova criatura na Toca ou no Bestiário, `compartimentos: []` é atribuído por padrão, permitindo que o usuário crie compartimentos customizados sob demanda (ex: "Alforjes", "Bolsa Lateral").

---

## 4. Technical Architecture & Data Strategy

### Diagrama do Sistema e Fluxo de Dados

```
┌────────────────────────────────────────────────────────────────────────┐
│                              APP STATE                                 │
├──────────────────────────────────┬─────────────────────────────────────┤
│      Biblioteca Bestiário        │          Biblioteca Toca            │
│  - CRUD de Monstros Globais      │  - CRUD de Companheiros do Jogador  │
│  - Import / Export JSON          │  - Import / Export JSON             │
│  - Enviar p/ Mesa (VTT)          │  - Enviar p/ Mesa e p/ Ficha        │
└─────────────────┬────────────────┴──────────────────┬──────────────────┘
                  │                                   │
                  ▼                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   FICHA UNIFICADA (isCreatureMode)                     │
│  - Mesmo componente, inputs e estilo da Ficha de Jogador               │
│  - Atributos: CON, RES, ADP, FOR, DEX, INT (sem APR, RIT, MEN)         │
│  - Vitais: Vida Máx e Deslocamento (sem Sanidade)                      │
│  - Sem Etnia, Sem Dinheiro, Sem Conhecimentos                          │
│  - Dano: Sem escala de Ritual                                          │
│  - Proficiências: Sem forjas, ritualismo e mentalidade                 │
│  - Compartimentos: Lista vazia por padrão                              │
│  - Abas Especiais: Informações, Ataques, Níveis Ataque e Níveis Defesa │
└────────────────────────────────────────────────────────────────────────┘
```

### Mapeamento das Alterações de Código
1. **Regras e Tipagem (`types.ts`, `SYSTEM_RULES.md`, `package.json`)**:
   - Atualizar a versão do aplicativo (`package.json`).
   - Documentar as especificações da Ficha Unificada de Criaturas em `SYSTEM_RULES.md`.
   - Ajustar as interfaces `TocaCreature` e `BestiaryMonster` para compartilhar a mesma estrutura de ficha base.
2. **Componente de Biblioteca da Toca (`src/components/TocaManager.tsx`)**:
   - Reescrever como componente de biblioteca modular com busca, filtros, cartões estatísticos, importação/exportação JSON, e botões de ação ("Ficha Completa", "Enviar p/ Mesa", "Excluir").
3. **Ficha em `App.tsx`**:
   - Ocultar campos de etnia, dinheiro, sanidade e conhecimentos no modo criatura.
   - Filtrar a lista de atributos removendo APR, RIT, MEN.
   - Filtrar as proficiências retirando Forja Manual, Forja Artesanal/Rústica, Ritualismo e Mentalidade.
   - Remover bônus de Ritual do cálculo/exibição de dano.
   - Assegurar que tanto a edição de criatura da Toca quanto a do Bestiário carreguem e salvem os dados com essa mesma interface uniforme.
4. **Verificação de Compilação e Lint**:
   - Executar `compile_applet` e `lint_applet` para assegurar ausência de erros e integridade do applet.
