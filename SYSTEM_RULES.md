# Regras do Sistema - Demons Despair

Este documento contém todas as regras lógicas e mecânicas do sistema para garantir a consistência entre a Ficha do Jogador, os Dados de Combate e o VTT.

## 1. Atributos e Vitais

### Atributos Base
- **CON (Constituição)**: Vitalidade física.
- **RES (Resistência)**: Capacidade de carga e resistência física.
- **ADP (Adaptabilidade)**: Sobrevivência e adaptação a climas.
- **MEN (Mentalidade)**: Estabilidade psicológica e resistência mental.
- **APR (Apreço/Aparência)**: Relacionado à reserva de mana e interações sociais.
- **FOR (Força)**: Poder físico e dano de armas de força.
- **DEX (Destreza)**: Agilidade, esquiva e armas de destreza.
- **INT (Inteligência)**: Conhecimento e magia (catalisadores).
- **RIT (Ritual)**: Poder ritualístico e magias sombrias.

### Cálculos de Vitais
- **Vida Máxima**: `CON * 2` (Base 0 + 2 por ponto de CON).
- **Mana Máxima**: `APR * 2` (Base 0 + 2 por ponto de APR).
- **Carga Máxima**: `200 + (RES * 5)` (Base de 200 de carga = 20kg; no sistema, 1 carga equivale a 100g, logo 10 cargas = 1kg).
- **Deslocamento Base**: `3 + floor(DEX / 3)`.

---

## 2. Combate (Acerto e Dano)

### Teste de Acerto (Acurácia)
- **Fórmula Geral**: `3d8 + Bônus de Acurácia - Esquiva do Alvo >= Base de Acerto da Arma`.
- **Bônus de Acurácia (Personagem)**: Calculado pela proficiência "Acurácia" (FOR + DEX).
- **Esquiva (Alvo)**: Calculada pela proficiência "Esquiva" (DEX + ADP).
- **Base de Acerto**: Definida individualmente em cada arma (geralmente 10-15).

### Cálculo de Dano e Escala
- **Bônus de Atributo**: `floor(Valor do Atributo / 2)`.
- **Escalas (Multiplicadores)**:
  - `0`: 0x
  - `D`: 0.25x
  - `C`: 0.50x
  - `B`: 0.75x
  - `A`: 1.00x
- **Dano Final**: `Roll(Dados da Arma) + floor(Bônus de Atributo * Multiplicador de Escala) + Bônus Manual`.
- **Atributo de Escala**:
  - Armas Físicas: Usam `FOR` ou `DEX` conforme definido na arma (`atributoBase`).
  - Catalisadores/Spells: Geralmente usam `INT` ou `RIT`.

### Vantagem e Desvantagem
- **Vantagem**: Role duas vezes (2x 3d8) e use o **maior** resultado total.
  - **Condição**: O alvo está com efeitos negativos (**Caído**, **Tonto**, **Preso Parcialmente**).
  - **Flanqueamento**: Atacante e pelo menos um aliado estão a até **2 metros** do alvo.
- **Desvantagem**: Role duas vezes (2x 3d8) e use o **menor** resultado total.
  - **Condição**: O alvo está usando um **Escudo** para se defender.

### Defesa e Contra-Ataque
- **Postura de Defesa**: Durante o turno, pode-se usar uma ação menor para preparar defesa.
- **Defesa com Escudo**: Impõe **Desvantagem** ao atacante. 
  - **Mecânica de Nivel de Escudo**: Se o nível de defesa do escudo que está defendendo for menor que o nível de ataque da arma atacante (mesmo se a arma atacante estiver fazendo uso de sua resistência/ressonância), o escudo só bloqueia **metade (50%) do dano** e perde **1 de Durabilidade** em caso de acerto. Se o nível de defesa do escudo for maior ou igual ao nível de ataque do agressor, o escudo bloqueia o ataque totalmente (100% de redução).
  - Se o ataque falhar e o atacante rolar pelo menos dois dados com valor **"1"**, o defensor pode realizar um **Contra-Ataque**.
- **Defesa com Arma**: O defensor rola **3d8**. Bloqueia o ataque se o resultado for **Atacante + 3**. 
  - **Contra-Ataque**: Se o bloqueio for bem-sucedido e o defensor rolar pelo menos um **"8"**, pode realizar um contra-ataque.
  - **Restrições**: 
    - **Lanças**: Só podem defender se o atacante estiver a pelo menos **2 metros**.
    - **Adagas/Facas**: Não podem defender contra **Armas Pesadas** (Machados de Guerra, Martelos de Guerra, Espadas Grandes, Porretes, Maças de Guerra, Montantes).
    - **Projéteis/Magia**: Armas não podem defender ataques à distância ou mágicos; apenas escudos podem.
- **Regras de Nível para Defesa Passiva (Armaduras e Proteção Corporal)**:
  - **Nível Defensor >= Nível Atacante**: Bloqueio automático bem-sucedido.
  - **Nível Defensor + Resistência >= Nível Atacante**: Bloqueio bem-sucedido, mas o item de defesa perde **1 de Durabilidade**.
  - **Nível Defensor + Resistência < Nível Atacante**: O bloqueio falha, o defensor recebe o dano e o item de defesa ainda perde **1 de Durabilidade**.
- **Erro Crítico**: Se um ataque falhar (errou o alvo ou foi bloqueado) e o atacante rolar pelo menos dois dados com valor **"1"**, a arma perde **1 de Durabilidade** obrigatoriamente, mesmo que os níveis de dano/defesa fossem compatíveis. Alvo também ganha oportunidade de Contra-Ataque.

### Localização de Dano (1d6)
1. Braço Esquerdo
2. Braço Direito
3. Perna Esquerda
4. Perna Direita
5. Tronco
6. Cabeça

---

## 3. Proficiências e Progressão

### Cálculo de Bônus de Proficiência
- **Atributo Único**: `floor(Atributo / 10)`. (Ex: Mentalidade usa MEN).
- **Atributo Duplo**: `min(floor(Stat1 / 5), floor(Stat2 / 5))`. (Ex: Vigor usa FOR e RES, Esquiva usa DEX e ADP, Acurácia usa FOR e DEX).
- **Casos Especiais**:
  - **Fome**: `min(RES, ADP)`.
  - **Resistência**: `floor(RES / 2)`.
  - **Adaptabilidade**: `floor(ADP / 2)`.
  - **Clima Quente e Clima Frio**: `floor(ADP / 10)`.
  - **Forja Manual e Forja Rústica**: O bônus base é derivado diretamente do nível do conhecimento correspondente (`Forja manual` e `Forja rústica`):
    - Não treinado (Nível -1 ou desconhecido): `-1`
    - Treinamento básico (Nível 0): `0`
    - A partir do Nível 1: `+1` por nível de conhecimento (Nível 1 = +1, Nível 2 = +2, Nível 3 = +3, Nível 4 = +4, Nível 5 = +5).
    - **Total da Proficiência**: É a soma exata de `Bônus Base + Bônus de Etnia (+1 para Anões de Marble Edge em Forja Manual e +1 para Nativos de Goundospauh em Forja Rústica) + Bônus Manual + Penalidades Gerais`. O modificador de etnia é sempre computado e somado ao valor exibido no círculo total da proficiência na ficha.

---

## 4. Sobrevivência e Penalidades

### Fome e Sede
- Afetam as proficiências, o deslocamento e a Mentalidade (Sanidade).
- Penalidades aumentam conforme os valores (fome/sede) diminuem.
- **Rolagem de Sobrevivência**:
  - Quando **Cansaço < 3**, aplica-se **-1** no resultado do dado.
  - Quando **Fome ou Sede < 20**, aplica-se **-5** no resultado do dado.
- **Fome (Penalidades por Nível)**:
  - **Moderada (< 50)**: -1 Dano, -1 Deslocamento.
  - **Grave (< 30)**: -3 Dano, -2 Sanidade, -2 Deslocamento.
  - **Crítica (< 5)**: -5 Dano, -2 Sanidade, -2 Deslocamento, -1 em todas as proficiências.
- **Sede (Penalidades por Nível)**:
  - **Moderada (< 50)**: -1 Dano, -1 Deslocamento.
  - **Grave (< 30)**: -3 Dano, -2 Deslocamento.
  - **Crítica (< 5)**: -3 Dano, -2 Deslocamento, -1 em todas as proficiências.

### Clima
- `Diff = abs(Clima Atual) - Proficiência em Clima`.
- **Diff >= 2**: -1 em INT/APR/RIT e -5 em Mentalidade.
- **Diff >= 4**: -1 em todos os atributos físicos.
- **Diff >= 6**: Hipotermia/Desidratação (Penalidades severas de dano e movimento).

### Integração VTT (Virtual Tabletop)
- **Sincronização de Regras**: O VTT utiliza as mesmas lógicas de dano e acerto da ficha técnica.
- **Penalidades de Combate**:
  - Penalidades de dano por **Fome** e **Sede** são aplicadas automaticamente nos ataques.
  - Efeitos negativos que aumentam o dano recebido (**Ossos Quebrados**, **Hemorragia**) são processados no cálculo final de dano.
  - Multiplicadores de **Acurácia**, **Esquiva** e penalidades de **Defesa** de efeitos negativos são integrados às rolagens de combate.
- **Feedback de Deslocamento**:
  - Ao arrastar um token, o indicador de distância muda para **vermelho** caso o movimento exceda o deslocamento máximo permitido para aquele personagem ou criatura (considerando penalidades atuais).

### Carga (Peso)
- **Até Carga Máxima**: Sem penalidades.
- **Acima da Carga**: Perda de 50% do deslocamento, -2 em Acerto e -5 em Mentalidade por ponto de excesso (conforme definido em `rulesConfig.json`).
- **Compartimentos Externos**: Itens guardados em compartimentos marcados como "Externo" não contam para o peso total carregado pelo personagem (embora ainda ocupem volume dentro do compartimento).

---

## 5. VTT (Virtual Tabletop)

### Sincronização de Tokens
- Tokens do tipo `character` devem estar vinculados a um `characterId`.
- Estatísticas (Vida, HP, Defesa) são lidas em tempo real da ficha vinculada.
- Ataques realizados no VTT devem seguir as mesmas fórmulas de bônus e scaling da ficha (`SYSTEM_RULES.md` seção 2).
- **Membros Inutilizados**: O sistema de combate do VTT exclui automaticamente membros marcados como "Inutilizados" (arrancados ou quebrados) da tabela de alvos aleatórios.

### Resolução de Combate VTT
1. **Verificação de Nível**: `Nível de Ataque vs Nível de Defesa`.
2. **Durabilidade**: Armas perdem durabilidade se o nível de ataque for menor que o de defesa.
3. **Resonância/Potencial**: Permite causar dano mesmo se o nível for inferior, se a soma `Ataque + Potencial >= Defesa`.

### Ciclo de Turnos
- **Botão "Turno"**: Exclusivo do Mestre. Ao ser clicado, processa a passagem de tempo em combate.
- **Danos Automáticos**: Efeitos como Sangramento aplicam seu dano (conforme o nível/stacks) automaticamente ao HP do token e à ficha do personagem quando o turno é passado.

---

## 6. Efeitos Negativos (Status)

### Gatilho de Efeitos
- Um efeito negativo é disparado quando um ataque bem sucedido rola pelo menos um **"8"** nos dados de acerto (3d8), **exceto** se qualquer um dos outros dados for um **"1"**.
- O alvo deve rolar **1d100 + Bônus de Proficiência em Resistência**. Se o total for **inferior a 70**, o efeito é aplicado.

### Tipos de Efeitos (conforme Tipo de Arma)

#### Ossos Quebrados (Impacto)
- **Gatilho**: Dano de Impacto.
- **Efeito**: +3 de dano extra recebido quando o local afetado é atingido.
- **Inutilização**: O membro afetado torna-se inutilizável.
- **Ponto Fraco**: O local torna-se um ponto fraco.
- **Dano Permanente**: Se o membro for atingido mais 3 vezes enquanto quebrado, ele não poderá ser recuperado.
- **Recuperação**: 4 dias após tratamento.

#### Sangramento (Corte)
- **Gatilho**: Dano de Corte.
- **Níveis de Sangramento**:
  - **Nível 1**: 1 de dano contínuo por turno.
  - **Nível 2**: 2 de dano contínuo por turno.
  - **Nível 3**: 3 de dano contínuo por turno.
- **Acúmulo e Agravamento**:
  - Se o local for atingido novamente por um golpe de corte que ative o efeito, o nível aumenta em 1.
  - Se um membro (braços/pernas) já estiver no **Nível 3** e for atingido novamente por um golpe de corte, o membro é **ARRANCADO** (Amputação).
- **Amputação e Inutilização**: Membros arrancados tornam-se permanentemente inutilizáveis. Isso remove o membro da rolagem de acerto aleatória e impede qualquer ação que dependa dele.
- **Ponto Fraco**: O local torna-se um ponto fraco (recebe bônus de dano em ataques subsequentes).
- **Recuperação**: 2 dias (pode variar se tratado).

#### Hemorragia (Perfuração)
- **Gatilho**: Dano de Perfuração.
- **Efeito**: 
  - **Esquiva e Deslocamento**: Redução de 1/3 (multiplicador 0.66x).
  - **Acurácia**: Redução de **-1** bônus na proficiência (Ex: +3 vira +2).
  - **Defesa com Arma**: Penalidade de **-2**.
  - **Dano**: +2 de dano extra no local.
- **Localização**:
  - **Braços**: Afeta Acurácia e Defesa.
  - **Pernas**: Afeta Esquiva e Deslocamento.
  - **Tronco**: Todos os efeitos negativos se aplicam.
- **Ponto Fraco**: O local torna-se um ponto fraco.
- **Incurável**: Se atingido mais 3 vezes no local, a hemorragia torna-se intratável, causando a morte.
- **Recuperação**: 3 dias após tratamento especializado.

---

## 7. Materiais e Forja

### Proficiências de Forja (Forja Manual e Forja Rústica)
- **Forja Manual**: Capacidade de criar, reparar e moldar peças de armas e equipamentos manualmente. Bônus derivado do Conhecimento em Forja Manual (-1 se Não Treinado / Nível -1, 0 no Nível Básico 0, +1 por nível a partir do 1, até +5 no Nível 5). Anões de Marble Edge possuem +1 de bônus de etnia somado ao total.
- **Forja Rústica**: Criação e adaptação de armas e peças artesanais com materiais brutos ou improvisados. Bônus derivado do Conhecimento em Forja Rústica (-1 se Não Treinado / Nível -1, 0 no Nível Básico 0, +1 por nível a partir do 1, até +5 no Nível 5). Nativos de Goundospauh possuem +1 de bônus de etnia somado ao total.

### Materiais Ignorados no Gerador de Inimigos
Certos materiais possuem propriedades que, embora úteis para jogadores em contextos específicos, não são adequadas para a geração automática de equipamentos para inimigos comuns (por serem muito fracos, líquidos ou valiosos/macios demais para combate padrão).

- **Estanho**: Baixo nível de impacto e resistência; material muito macio.
- **Mercúrio**: Líquido em temperatura ambiente; impossível de manter forma sólida em armas padrão.
- **Ouro**: Principalmente decorativo ou condutor; excessivamente pesado e macio para armas de guerra eficazes no gerador de NPCs.

---

## 8. Munições e Níveis de Dano/Resistência (Arcos e Armas de Fogo)

Munições são consumíveis necessários para o uso de armas à distância (arcos, bestas, armas de fogo). 

### Derivação de Níveis de Dano e Resistência
- **Arcos (`categoria: 'Arco'`)**: Possuem um sistema de escolha de flechas. Os níveis de **Corte**, **Perfuração**, **Impacto** e **Resistência** são determinados exclusivamente pela **flecha selecionada/carregada**, e **não pelo próprio arco**.
- **Armas de Fogo (`categoria: 'Arma de Fogo'`)**: Os níveis de **Corte**, **Perfuração**, **Impacto** e **Resistência** são determinados exclusivamente pelas **balas selecionadas/carregadas**, e **não pela própria arma de fogo**.
- **Armas Brancas (`categoria: 'Arma Branca'`)**: Mantêm seus próprios níveis de Corte, Perfuração, Impacto e Resistência configurados na própria arma, já que não utilizam projéteis.
- **Caso sem Munição Selecionada/Carregada**: Caso nenhuma flecha ou bala esteja selecionada/carregada, os níveis de ataque físico e resistência derivados da munição são considerados 0.

### Propriedades Base de Munição
| Tipo de Munição | Peso (Un) | Volume (Un) |
| :--- | :--- | :--- |
| **Balas** | 0.1 | 0.3 |
| **Flechas (Arco Curto)** | 0.5 | 0.9 |
| **Flechas (Arco Longo)** | 0.6 | 1.3 |

### Integração VTT e Ficha Técnica
- Tanto a Ficha Técnica quanto o VTT permitem selecionar a munição (flecha ou bala) a partir dos compartimentos do personagem.
- Ao selecionar ou recarregar a munição, os níveis de Corte, Perfuração, Impacto e Resistência são atualizados para refletir a munição ativa.
- A cada disparo no VTT ou rolagem com consumo, a munição carregada é reduzida.

---

## 9. Manutenção e Recarga

### Recarga (Armas de Fogo e Arcos)
- **Armas de Fogo**: Capacidade definida por `municaoTotal`. Permite recarregar 1 ou o pente completo a partir das balas do inventário.
- **Arcos**: Possuem sistema de seleção e carregamento de flechas a partir dos compartimentos (aljava/bolsa).
- **Lógica**: Reduz a quantidade de munição no compartimento e armazena as instâncias de munição em `magazineAmmo` e `municaoCarregada` na arma.

### Manutenção (Exclusiva para Armas de Fogo)
- **Exclusividade**: A manutenção é aplicada **apenas a Armas de Fogo**. Armas brancas e arcos não possuem ação de manutenção.
- **Restauração**: Restaura a `durabilidade` da arma de fogo para `durabilidadeMaxUtil` (ou `maxDurabilidade`).
- **Integração VTT e Ficha**: A ação de manutenção redefine a durabilidade útil e sincroniza com a ficha.

---

## 10. Etnias e Culturas

A Ficha do Personagem conta com um seletor nativo de Etnia/Cultura com aplicação automática de modificadores de atributos/proficiências, habilidades contextuais e equipamento de vestimenta inicial.

### Tabela de Etnias e Efeitos
1. **Customizado (Padrão)**: Sem bônus ou debuffs automáticos. Permite escrita livre.
2. **Nativos de Goundospauh**:
   - **Bônus**: +1 no primeiro d8 de cansaço; +1 ao tentar criar armas artesanais.
   - **Debuff**: -1 em Comunicação em cidades grandes.
   - **Vestimenta Inicial**: Veste de guerra de peles e madeira (Corte 1, Impacto 2, Perfuração 1, Durabilidade 2, Peso 48, Volume 32, Redução de Dano 2).
3. **Nativos de Lochcliff**:
   - **Bônus**: +5 no primeiro d100 para fome; +2 bônus de dano de Força (não entra na escala); +1 nível para climas quentes.
   - **Debuff**: -1 em Comunicação em cidades grandes.
   - **Vestimenta Inicial**: Armadura de couro (Corte 1, Impacto 1, Perfuração 1, Durabilidade 1, Peso 47, Volume 30, Redução de Dano 1).
4. **Anões de Marble Edge**:
   - **Bônus**: +1 para identificar peças de uma arma; +1 para criar peças manualmente; +1 em Comunicação em grandes cidades.
   - **Debuff**: Alimentos têm metade do bônus no próximo dado para fome e redução de -5 nos dados seguintes contra fome.
   - **Vestimenta Inicial**: Armadura de ferro completa (Corte 3, Impacto 3, Perfuração 3, Durabilidade 4, Peso 165, Volume 36.5, Redução de Dano 5, Efeito: -2 em furtividade).
5. **Cidadãos da cidade central (Shentil)**:
   - **Bônus**: +2 em Comunicação (aplicado às proficiências).
   - **Vestimenta Inicial**: Armadura de ferro simples (Corte 3, Impacto 3, Perfuração 3, Durabilidade 3, Peso 115, Volume 27, Redução de Dano 3, Efeito: -1 em furtividade).
6. **Cidadãos de Dellmont**:
   - **Bônus**: +1 em Conhecimento (proficiência); +1 para identificar peças de uma arma.
   - **Vestimenta Inicial**: Armadura de placas de bambu (Corte 3, Impacto 2, Perfuração 2, Durabilidade 2, Peso 63, Volume 30, Redução de Dano 2).
7. **Sacerdotes do monte Tabatos**:
   - **Bônus**: +1 nível de clima para frio; +1 em Religião (conhecimento); +1 em Medicina (conhecimento).
   - **Debuff**: -2 em todas as proficiências de Força e Destreza (Intimidação, Vigor, Furtividade, Atletismo, Acurácia, Esquiva); -3 em Comunicação em locais com cultos a demônios.
   - **Vestimenta Inicial**: Manto de sacerdote (Corte 0, Impacto 0, Perfuração 0, Durabilidade 1, Peso 20, Volume 5, Redução de Dano 0, Efeito: Religião +1).
8. **Nativos da vila Icefield**:
   - **Bônus**: +2 nível de clima frio; +1 em Percepção; +1 em Intuição; +1 em Acurácia.
   - **Debuff**: -2 nível de calor; -2 em Comunicação.
   - **Vestimenta Inicial**: Manto de couro grosso (Corte 2, Impacto 2, Perfuração 2, Durabilidade 2, Peso 30, Volume 6, Redução de Dano 2, Efeito: Clima +2 (frio)).
9. **Guerreiros de Stonebarrow**:
   - **Bônus**: +2 em Intimidação; +2 no bônus de dano de Força; +5 no dado contra Resistência.
   - **Debuff**: -1 no dado contra cansaço; -1 no bônus de bem descansado (teto máximo reduzido para +2).
   - **Vestimenta Inicial**: Armadura de guerra de Vayekhel (Corte 4, Impacto 4, Perfuração 4, Durabilidade 3, Peso 147, Volume 36.5, Redução de Dano 5).
10. **Atiradores da escola de Daedra**:
    - **Bônus**: +2 em Acurácia.
    - **Debuff**: -1 no nível de clima geral; -2 em Comunicação em cidades onde são considerados assassinos/mentirosos.
    - **Vestimenta Inicial**: Roupas elegantes (Corte 0, Impacto 0, Perfuração 0, Durabilidade 1, Peso 2.7, Volume 10.5, Redução de Dano 0, Efeito: Comunicação +1).
11. **Monges do pico enevoado**:
    - **Bônus**: +5 no dado de Mentalidade; +1 em Intuição.
    - **Vestimenta Inicial**: Panos sagrados (Corte 0, Impacto 0, Perfuração 0, Durabilidade 1, Peso 7, Volume 4, Redução de Dano 0, Efeito: Conhecimento +1).
12. **Povos subterrâneos**:
    - **Bônus**: +2 em Percepção; +5 no d100 de Adaptabilidade; +2 em Comunicação com povos das copas.
    - **Debuff**: -3 em Comunicação em locais hostis aos povos subterrâneos.
    - **Vestimenta Inicial**: Armadura de carapaça de Chaurus (Corte 3, Impacto 3, Perfuração 3, Durabilidade 3, Peso 29, Volume 27, Redução de Dano 3).
13. **Povos das copas**:
    - **Bônus**: +2 em Atletismo; +5 no d100 contra Resistência.
    - **Debuff**: -2 em Comunicação em locais com aversão a povos nativos.
    - **Vestimenta Inicial**: Manto de pele de Tobi Kadachi (Corte 2, Impacto 2, Perfuração 2, Durabilidade 3, Peso 40, Volume 26, Redução de Dano 3, Efeito: Elemental: 3).
14. **Híbridos**:
    - **Debuff**: -5 permanente em Comunicação geral (odiado por todos os povos e criaturas).
    - **Bônus**: Personalizados conforme o animal escolhido pelo jogador via Habilidade de Herança Bestial.
    - **Vestimenta Inicial**: Trapos velhos (Corte 0, Impacto 0, Perfuração 0, Durabilidade 1, Peso 5, Volume 3, Redução de Dano 0).

---

## 11. Ficha Unificada de Criaturas (Toca & Bestiário)

As criaturas cadastradas na **Toca** (companheiros, montarias, animais e demônios do jogador) e os monstros do **Bestiário** compartilham o exato mesmo motor e layout de ficha da Ficha de Jogador, mantendo o padrão estético e as mesmas regras de rolagem, cálculo de carga e inventário, com as seguintes regras de omissão e seções especiais:

### Omissões Estruturais (Criaturas)
1. **Etnia / Cultura**: Ocultado completamente.
2. **Dinheiro**: Ocultado completamente (sem moedas de cobre, prata, ouro).
3. **Barra de Sanidade**: Ocultada (mantêm-se apenas Vida Atual/Máxima e Carga).
4. **Conhecimentos**: Ocultada a seção inteira de Conhecimentos.
5. **Escalas**: Ocultada a aba/seção inteira de Escalas (criaturas não utilizam a aba de escalas de atributos de jogadores).
6. **Identificação no Topo**: A seção principal no topo da ficha exibe o título **"Criatura"** (em vez de "Personagem").
7. **Status (Atributos)**: Ocultados **Aprendizado (APR)**, **Ritual (RIT)** e **Mentalidade (MEN)**. A criatura opera exclusivamente com **CON, RES, ADP, FOR, DEX, INT**.
8. **Bônus de Dano**: Ocultada a linha de escala de **Ritual (RIT)**.
9. **Proficiências**: Ocultadas **Forja Manual**, **Forja Artesanal/Rústica**, **Ritualismo** e **Mentalidade**.
10. **Compartimentos**: Iniciam vazios (`compartimentos: []`) por padrão, sem nenhuma bolsa pré-criada.

### Seções Especiais de Criatura
- **Informações**: Localização, Personalidade, Gosta / Não Gosta, Descrição / Lore, Hábitos / Comportamento.
- **Ataques**: Ações e ataques rápidos da criatura (dano, acerto, tipo de ação, custo de mana, efeito).
- **Níveis de Ataque**: Corte, Perfuração, Impacto, Resistência, Feitiço, Elemental, Magia Negra, Potencial.
- **Níveis de Defesa**: Corte, Perfuração, Impacto, Feitiço, Elemental, Magia Negra.

---

*Nota: Arredonde frações sempre para baixo.*

