# Contexto Completo do Projeto: Demons Despair (Ficha & VTT RPG)

Este documento resume todo o histórico, regras, arquitetura, decisões técnicas e estado atual do aplicativo **Demons Despair** para facilitar a migração e continuação do desenvolvimento em uma nova conta ou ambiente de IA.

---

## 1. Visão Geral do Aplicativo
* **Nome do App**: Demons Despair (Sistema de RPG próprio com Ficha de Personagem, VTT - Virtual Tabletop, Bestiário, Toca de Companheiros, Biblioteca de Itens, Magias e Campanhas).
* **Stack Tecnológica**:
  - **Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion (framer-motion), Lucide React.
  - **VTT / Gráficos**: Konva / React-Konva.
  - **Persistência / Backend**: Suporte opcional a Firebase / Supabase, com armazenamento local (localStorage) robusto.
  - **Build**: Vite + TypeScript (`npm run build`).

---

## 2. Regras de Ouro e Documentação do Sistema (Hefesto)
O sistema possui regras rígidas de RPG documentadas em `SYSTEM_RULES.md` e arquivos de configuração em `src/rules/`:
1. **Atributos Base**: CON, RES, ADP, MEN, APR, FOR, DEX, INT, RIT.
2. **Vitais**: 
   - Vida Máxima: `CON * 2`
   - Mana Máxima: `APR * 2`
   - Carga Máxima: `200 + (RES * 5)` (1 carga = 100g).
3. **Combate & Escala**:
   - Acerto: `3d8 + Acurácia - Esquiva >= Base de Acerto`.
   - Escalas de Dano (Multiplicadores): `0` (0x), `D` (0.25x), `C` (0.50x), `B` (0.75x), `A` (1.00x).
   - Localização de Dano (1d6): 1-Braço Esq, 2-Braço Dir, 3-Perna Esq, 4-Perna Dir, 5-Tronco, 6-Cabeça.
4. **Efeitos Negativos**: Ossos Quebrados (Impacto), Sangramento (Corte), Hemorragia (Perfuração), além de Fome, Sede, Clima e Carga.

---

## 3. Arquitetura e Componentes Principais (`src/`)
* `App.tsx`: Ficha principal do personagem, gerenciamento de abas (Atributos, Inventário, Magias, Habilidades, Conhecimentos, Toca, Bestiário, Notas, Dados).
* `src/components/VTTBoard.tsx`: Tabuleiro de combate interativo (Tokens, grid, movimento, resolução de ataques sincronizada com as regras).
* `src/components/Bestiary.tsx`: Catálogo de monstros e demônios do sistema com importação/exportação JSON e ficha completa.
* `src/components/TocaManager.tsx`: Biblioteca de companheiros, animais e demônios do jogador (mesmo padrão da ficha unificada).
* `src/components/ItemLibrary.tsx`: Gerenciamento de itens customizados e oficiais.
* `src/components/SpellLibrary.tsx`: Biblioteca de magias.
* `src/rules/`: Regras modulares (`combatRules.ts`, `inventoryRules.ts`, `proficiencyRules.ts`, `statusRules.ts`, `rulesConfig.json`).

---

## 4. Histórico de Pedidos Recentes do Usuário (Contexto Acumulado)
1. **Configuração de IA Local (Ollama/Continue/Qwen)**: O usuário testou a integração local, mas optou por removê-la para simplificar.
2. **Padronização de Itens na Aba Itens**: Ajustado para ficar idêntico ao dos compartimentos (modificador de quantidade, peso, volume, botão de comida/utensílios, validade e saciedade).
3. **Valores Padrão de Itens**: Na criação de itens, todos os modificadores zerados por padrão, exceto quantidade em `1`.
4. **Aba de Anotações**: 
   - Criadas por padrão as abas de **"Traumas"** e **"Vícios"**.
   - Removida a aba de "Anotações Gerais".
   - Botão de adicionar aba renomeado para **"Nova anotação"** e estilizado de forma compacta e encostada nas bordas.
5. **Rolagem de Dados**:
   - Pressionar e segurar por 1 segundo os botões `+` ou `-` em quantidade e bônus reinicia o valor para o padrão dependendo do estado atual (decrementa se > 0, incrementa se < 0, ou apenas `-` para quantidade).
   - Removido pop-up de notificação de redefinição.
   - Barra colapsável de combate inicia fechada.
6. **Reestruturação Completa da Toca**:
   - Toca transformada em uma **Biblioteca de Criaturas do Jogador** (com as mesmas funcionalidades da Biblioteca do Bestiário: busca, importação/exportação JSON, cards).
   - **Ficha Unificada de Criatura**: Exatamente igual à ficha de jogador, exceto:
     - Sem Etnia, Sem Dinheiro, Sem Barra de Sanidade, Sem Conhecimentos.
     - Atributos filtrados: Apenas CON, RES, ADP, FOR, DEX, INT (sem APR, RIT, MEN).
     - Bônus de Dano: Sem linha de RIT.
     - Proficiências: Sem Forja Manual, Forja Artesanal/Rústica, Ritualismo e Mentalidade.
     - Compartimentos: Iniciam totalmente vazios por padrão.
     - Abas específicas de monstro integradas: Informações, Ataques, Níveis de Ataque e Níveis de Defesa (mesmo padrão do Bestiário).
7. **Custo e Custódia**: Discussão sobre economia do modelo Flash e procedimentos de suporte/faturamento do Google Cloud Billing.

---

## 5. Como Usar Este Contexto na Nova Conta
Ao abrir o projeto na nova conta do Google AI Studio / GitHub, basta colar este resumo para a IA (ou colocá-lo como `PROJECT_CONTEXT.md` na raiz do projeto) para que a IA recupere 100% da consciência sobre o sistema Demons Despair, as regras e o que já foi implementado.
