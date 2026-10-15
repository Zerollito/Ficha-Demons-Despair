# Plano de Aprimoramento: Clima Dividido, Peças Individuais de Armadura e Exibição de Modificadores de Etnia

Este plano endereça os ajustes solicitados na mecânica de sobrevivência e na ficha de personagem:
1. **Divisão de Clima**: Separar a proficiência "Clima" em duas: **Clima Quente** e **Clima Frio** (ambas usando a mesma regra de cálculo base).
2. **Buffs e Debuffs Climáticos de Etnias**: Atualizar a seleção de etnias para aplicar modificadores tanto em Clima Quente quanto em Clima Frio quando aplicável (incluindo o debuff de -1 em clima para Atiradores de Daedra).
3. **Exibição de Modificadores de Etnia**: Mostrar o bônus/debuff da etnia com cor diferenciada (verde para bônus, vermelho para debuff) diretamente ao lado da caixa total de cada proficiência na ficha.
4. **Armaduras Iniciais em Peças Separadas**: Dividir as vestimentas iniciais em suas peças individuais exatas com seus respectivos pesos e volumes conforme especificado no texto original (ex: capacete, peitoral, braçadeiras, grevas, luvas, botas, etc.).

---

## 1. Visão Geral das Mudanças

### A. Clima Quente e Clima Frio
- **proficienciasRules.ts**: 
  - Substituir `Clima` por `Clima Quente` e `Clima Frio` em `PROFICIENCIES`.
  - Ambas calculam o bônus com `floor(ADP / 10)`.
- **App.tsx / Estados**:
  - Adaptar os cálculos de penalidade climática para checar separadamente se o clima atual é quente (positivo) ou frio (negativo), aplicando a proficiência correspondente.

### B. Exibição de Modificadores de Etnia ao Lado da Proficiência
- Na renderização das proficiências na aba Ficha (`App.tsx`), exibir um selo numérico explicativo (ex: `+2` em verde ou `-1` em vermelho) logo após o valor total da proficiência, representando exatamente o modificador vindo da Etnia/Cultura ativa.

### C. Armaduras em Peças Separadas
- **ethnicityRules.ts**:
  - Cadastrar os arrays de peças individuais em cada vestimenta inicial (ex: *Armadura de ferro completa* gerará itens separados de armadura no inventário do personagem para Capacete, Peitoral, Luvas, Pernas, Rebraço, Botas, Malha parcial, cada um com seu peso e volume especificados).

---

## 2. Arquitetura Técnica

1. **`src/rules/proficiencyRules.ts`**:
   - Atualizar a lista de proficiências.
2. **`src/rules/ethnicityRules.ts`**:
   - Ajustar os modificadores de etnia para contemplar `Clima Quente` e `Clima Frio`.
   - Detalhar as armaduras iniciais como listas de `ArmorPiece`.
3. **`src/App.tsx`**:
   - Atualizar a UI da seção de proficiências para exibir o modificador visual de etnia com cor distinta.
   - Atualizar a lógica de aplicação de armaduras iniciais para inserir todas as peças individuais no inventário/equipamentos do personagem.
4. **`SYSTEM_RULES.md`**:
   - Documentar a separação das proficiências de clima e o detalhamento das peças de armadura inicial.
5. **Versão**:
   - Atualizar para **v1.14.15**.

---

## 3. Plano de Verificação
- Compilar com `compile_applet` e `lint_applet`.
- Verificar se as proficiências "Clima Quente" e "Clima Frio" aparecem corretamente e calculam bônus.
- Selecionar etnias como *Nativos de Lochcliff*, *Sacerdotes do monte Tabatos* e *Atiradores de Daedra* e verificar a aplicação correta nos dois climas e a exibição do bônus/debuff colorido ao lado da caixa.
- Verificar se as vestimentas iniciais criam peças de armadura separadas na ficha.
