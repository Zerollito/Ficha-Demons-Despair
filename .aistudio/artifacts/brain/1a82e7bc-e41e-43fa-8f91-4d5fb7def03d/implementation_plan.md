# Cancelamento de Marcação de Tokens e Modo de Combate no VTT

## Problema Relatado
Ao entrar no modo de combate a partir de um token no VTT, caso o usuário desistisse de atacar ou fechasse o modal, não existia uma forma clara de cancelar o combate e remover os anéis de marcação (azul para atacante e vermelho para alvo) dos tokens no mapa.

## Melhorias Implementadas
1. **Função Centralizada `cancelCombatSelection`**:
   - Reseta `isAttackingMode(false)`, `attackerId(null)`, `targetId(null)`, `weaponSelectTokenId(null)`, `pendingCombatAction(null)`, armas/munições pendentes e registra no log do VTT que os tokens foram desmarcados.
2. **Barra Flutuante de Combate Aprimorada**:
   - Permanece visível enquanto houver qualquer token marcado (`isAttackingMode || attackerId || targetId`).
   - Exibe o nome do atacante (anel azul) e do alvo (anel vermelho).
   - Inclui botão de ação explícito: `Cancelar / Desmarcar`, além de `Trocar Alvo` e `Atacar`.
3. **Modal de Seleção de Armas / Ações**:
   - O botão `X` do cabeçalho e o clique fora do modal (backdrop) agora desmarcam os tokens e cancelam o combate de forma limpa.
   - Adicionado botão no rodapé: `Cancelar Ataque e Desmarcar` (ao lado de `Minimizar`).
   - Na tela de direcionar ataque (membros do corpo), adicionado o botão `Desmarcar`.
4. **Interação no Tabuleiro (Canvas)**:
   - Clicar ou tocar em espaço vazio do mapa cancela o modo de combate e desmarca os tokens (sem atrapalhar o arrasto/pan do mapa).
   - Clicar novamente no token do atacante desmarca a seleção.
5. **Atalho de Teclado**:
   - Pressionar a tecla `Escape` (`Esc`) cancela o combate e desmarca os tokens.
6. **Menu do Token e Aba Lateral**:
   - O botão do token marcado como atacante passa a exibir `Cancelar Combate (Desmarcar)` em destaque.
   - Tokens marcados como alvo exibem a opção `Desmarcar como Alvo`.
   - Na aba lateral de combate, o botão cancela e desmarca os tokens.
7. **Atualização de Versão**:
   - Versão incrementada para **v1.14.35** em `package.json`, `metadata.json`, `src/main.tsx` e `src/App.tsx`.
