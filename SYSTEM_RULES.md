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
- **Carga Máxima**: `200 + (RES * 5)`.
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
- **Dano Final**: `Roll(Dados da Arma ou Dados da Munição) + floor(Bônus de Atributo * Multiplicador de Escala) + Bônus Manual`.
  - **Armas de Fogo**: O dano base (dados de rolagem) não é fixo na arma de fogo, mas sim definido pelas propriedades da bala/munição atualmente carregada ou selecionada.
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
  - **Mecânica de Nivel de Escudo**: Escudos não usam atributo de resistência. Se o nível de defesa do escudo for maior que o nível de ataque do agressor (Nível Defesa > Nível Ataque), o escudo bloqueia o ataque totalmente (100% de redução) e não perde durabilidade. Se o nível de ataque do agressor for igual ao nível de defesa do escudo, o escudo bloqueia totalmente o ataque, mas perde **1 de Durabilidade**. Se o nível de defesa do escudo for menor que o nível de ataque, o escudo só bloqueia **metade (50%) do dano** e perde **1 de Durabilidade** em caso de acerto.
  - Se o ataque falhar e o atacante rolar pelo menos dois dados com valor **"1"**, o defensor pode realizar um **Contra-Ataque**.
- **Defesa com Arma**: O defensor rola **3d8**. Bloqueia o ataque se o resultado for **Atacante + 3**. Armas continuam usando resistência.
  - **Contra-Ataque**: Se o bloqueio for bem-sucedido e o defensor rolar pelo menos um **"8"**, pode realizar um contra-ataque.
  - **Restrições**: 
    - **Lanças**: Só podem defender se o atacante estiver a pelo menos **2 metros**.
    - **Adagas/Facas**: Não podem defender contra **Armas Pesadas** (Machados de Guerra, Martelos de Guerra, Espadas Grandes, Porretes, Maças de Guerra, Montantes).
    - **Projéteis/Magia**: Armas não podem defender ataques à distância ou mágicos; apenas escudos podem.
- **Regras de Nível para Defesa Passiva (Armaduras e Proteção Corporal)**:
  - Armaduras não usam atributo de resistência.
  - **Nível Defesa > Nível Ataque**: Bloqueio bem-sucedido e a armadura **não** recebe dano na durabilidade.
  - **Nível Defesa <= Nível Ataque**: O bloqueio falha ou é parcial, e a armadura **recebe dano na durabilidade** (perde **1 de Durabilidade**).
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
- **Atributo Duplo**: `min(floor(Stat1 / 5), floor(Stat2 / 5))`. (Ex: Vigor usa FOR e RES).
- **Casos Especiais**:
  - **Fome**: `min(RES, ADP)`.
  - **Resistência**: `floor(RES / 2)`.
  - **Adaptabilidade**: `floor(ADP / 2)`.
  - **Clima**: `floor(ADP / 10)`.

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

### Materiais Ignorados no Gerador de Inimigos
Certos materiais possuem propriedades que, embora úteis para jogadores em contextos específicos, não são adequadas para a geração automática de equipamentos para inimigos comuns (por serem muito fracos, líquidos ou valiosos/macios demais para combate padrão).

- **Estanho**: Baixo nível de impacto e resistência; material muito macio.
- **Mercúrio**: Líquido em temperatura ambiente; impossível de manter forma sólida em armas padrão.
- **Ouro**: Principalmente decorativo ou condutor; excessivamente pesado e macio para armas de guerra eficazes no gerador de NPCs.

---

## 8. Munições

Munições são consumíveis necessários para o uso de armas à distância (arcos, bestas, armas de fogo). Elas agora carregam a propriedade de **Dano** diretamente (removendo o dano fixo das armas de fogo). Ao disparar uma arma de fogo, o dano da bala/munição ativa é usado para a rolagem de combate.

### Propriedades Base e Presets de Munição
| Tipo de Munição | Peso (Un) | Volume (Un) | Dano Base |
| :--- | :--- | :--- | :--- |
| **Balas** | 0.1 | 0.3 | `2d6` |
| **Flechas (Arco Curto)** | 0.5 | 0.9 | `1d6` |
| **Flechas (Arco Longo)** | 0.6 | 1.3 | `1d8` |

### Integração VTT
- O sistema de VTT permite selecionar a munição carregada para cada arma compatível.
- O dano do ataque em combate é obtido diretamente da munição ativamente carregada (magazine/cylinder) no VTT.
- A quantidade de munição é reduzida automaticamente a cada disparo realizado no VTT.

---

*Nota: Arredonde frações sempre para baixo.*
