export interface Item {
  nome: string;
  quantidade?: number;
  peso: number;
  volume: number;
  descricao: string;
  efeito?: string;
  usos?: number;
  tipo: 'consumivel' | 'equipamento' | 'livro' | 'ferramenta' | 'municao' | 'outro' | 'acessorio';
}

export const ITEMS_LIBRARY: Item[] = [
  {
    nome: "Flechas de ferro",
    quantidade: 20,
    peso: 10,
    volume: 18,
    descricao: "Algumas flechas a mais podem salvar a vida de um arqueiro. Peso: 10 (0,5) Volume: 18 (0,9)",
    efeito: "Munição para arcos. Causa dano perfurante.",
    tipo: 'municao'
  },
  {
    nome: "Balas de metal",
    quantidade: 10,
    peso: 5,
    volume: 5,
    descricao: "Projéteis de metal fundido, pesados e letais, capazes de causar grandes estragos por impacto ou perfuração.",
    efeito: "Munição para armas de fogo. Causa dano perfurante ou impacto.",
    tipo: 'municao'
  },
  {
    nome: "Infusão de adrenalina pequena",
    quantidade: 3,
    peso: 1.5,
    volume: 3,
    descricao: "A infusão de adrenalina não recupera sua vida, mas gera uma barra de vida adicional que recebe metade do dano causado contra você, a pequena lhe oferece ⅓ da sua vida total. Peso: 1,5 (0,5 cada), volume: 3 (1 cada).",
    efeito: "Barra de vida adicional (1/3 do total) que recebe metade do dano.",
    tipo: 'consumivel'
  },
  {
    nome: "Saco pequeno de pó de osso demônio de fogo",
    usos: 3,
    peso: 0.3,
    volume: 0.5,
    descricao: "Cada parte de um demônio de fogo tem propriedades que envolvem chamas, o pó de seus ossos entram em reação quando há fricção ou impacto, gerando calor o suficiente para fazer até o metal mais duro ficar incandescente, ótimo para forjar quando não tem uma fornalha. Peso: 0.3 (0.1 cada uso), Volume: 0.5.",
    efeito: "Gera calor intenso para forja sem fornalha.",
    tipo: 'consumivel'
  },
  {
    nome: "Bombas de pólvora pequenas",
    quantidade: 3,
    peso: 1.5,
    volume: 0.9,
    descricao: "Causam um bom dano em área, terminam rápido uma luta difícil, mas perigosas de se levar correndo por aí, causa 3d4 de dano. Peso: 1.5 (0.5 cada), volume: 0.9 (0.3 cada).",
    efeito: "Dano em área. Causa 3d4 de dano.",
    tipo: 'consumivel'
  },
  {
    nome: "Kit médico",
    peso: 2,
    volume: 4.2,
    descricao: "Kit médico (x3 bandagem, agulha e linha, x3 pó de lírio carmesim, x2 solução de veneno básica): A agulha fecha ferimentos, as bandagens protegem para que não abram novamente, o pó de lírio carmesim estanca sangramentos e a solução de veneno básica cura envenenamento leve. Peso: 2 (bandagem: 0.2 cada, agulha e linha: 0.1, pó de lírio carmesim: 0.1 cada, solução de veneno básica: 0.5 cada), volume: 4,2 (bandagem: 0.5 cada, pó de lírio carmesim: 0.5 saquinho, solução de veneno básica: 1 cada, agulha e linha: 0.2).",
    efeito: "Trata ferimentos e envenenamento leve.",
    tipo: 'ferramenta'
  },
  {
    nome: "Cantil (1 Litro)",
    peso: 10,
    volume: 2,
    descricao: "É importante se manter hidratado, ou se preferir, tomar uma para passar o tempo. Peso: 10 (cheio, 1 vazio), volume 2.",
    efeito: "Recupera sede. (Peso 1 vazio)",
    tipo: 'ferramenta'
  },
  {
    nome: "Bússola",
    peso: 0.3,
    volume: 0.5,
    descricao: "Às vezes, se encontrar pode ser um desafio, sorte de quem têm uma bússola nessas horas. Peso: 0.3, volume: 0.5.",
    tipo: 'ferramenta'
  },
  {
    nome: "Mapa do continente",
    peso: 0.5,
    volume: 2,
    descricao: "Um guia confiável para qualquer país e cidades grandes que queira ir. Peso: 0.5, volume: 2",
    tipo: 'ferramenta'
  },
  {
    nome: "Ração de emergência",
    quantidade: 5,
    peso: 15,
    volume: 10,
    descricao: "Duráveis e prontas para qualquer hora, as rações lhe proporcionam um 5d10 contra fome e +20 de bônus no próximo dado, além de sobreviverem por até 2 semanas.",
    efeito: "5d10 contra fome e +20 de bônus no próximo dado.",
    tipo: 'consumivel'
  },
  {
    nome: "Receitas clássicas de viajante",
    peso: 3.5,
    volume: 2.5,
    descricao: "O conhecimento é uma dádiva, saber como utilizar os ingredientes a mão durante uma aventura pode ser crucial, este livro irá lhe dar um empurrão inicial na arte da culinária.",
    efeito: "Bônus inicial em culinária.",
    tipo: 'livro'
  },
  {
    nome: "Lições alquímicas (Freijó Lupin)",
    peso: 3.5,
    volume: 2.5,
    descricao: "Vários itens são essenciais na sua jornada, às vezes é melhor saber como os fazer do que comprar. Aprenda o básico com o grande Freijó Lupin!",
    efeito: "Lições básicas de alquimia.",
    tipo: 'livro'
  },
  {
    nome: "Infusão corta clima fraca",
    quantidade: 3,
    peso: 1.5,
    volume: 3,
    descricao: "Uma bebida capaz de adaptar levemente seu corpo para a temperatura do ambiente, aumenta temporariamente seu nível de clima em 2, para frio ou calor.",
    efeito: "Aumenta nível de clima em 2.",
    tipo: 'consumivel'
  },
  {
    nome: "Frasco de veneno fraco",
    quantidade: 3,
    peso: 1.5,
    volume: 3,
    descricao: "Aquela ajuda para finalizar os inimigos, é uma garantia de que o golpe vai ser fatal. O inimigo deve tirar mais de 60 n0 d100 de adaptabilidade para evitar o veneno, Caso seja envenenado, o inimigo recebe 2 de dano por turno. Peso: 1,5 (0,5 cada), volume: 3 (1 cada).",
    efeito: "Inimigo deve tirar >60 no d100 de ADP ou recebe 2 de dano por turno.",
    tipo: 'consumivel'
  },
  {
    nome: "Mochila de viagem",
    peso: 2,
    volume: 50, 
    descricao: "Uma mochila resistente para longas jornadas. Possui 50 de volume.",
    efeito: "Compartimento de 50 de volume.",
    tipo: 'equipamento'
  },
  {
    nome: "Bolsa de cinto",
    peso: 0.5,
    volume: 3, 
    descricao: "Uma pequena bolsa presa ao cinto para itens de acesso rápido. Possui 3 de volume.",
    efeito: "Compartimento de 3 de volume.",
    tipo: 'equipamento'
  },
  {
    nome: "Lâminas e faíscas (Mobius McMorris)",
    peso: 3.5,
    volume: 2.5,
    descricao: "Criação de armas é uma habilidade básica do aventureiro, este livro, escrito pelo mestre anão Mobius McMorris irá lhe oferecer o básico dessa habilidade.",
    efeito: "Bônus básico de ferreiro.",
    tipo: 'livro'
  },
  {
    nome: "Anel do viajante",
    peso: 0.1,
    volume: 0.1,
    descricao: "Às vezes o peso pode ser um problema, este anel vai lhe ajudar com isso aumentando sua carga suportada (Aumenta 50 de carga).",
    efeito: "Aumenta a carga suportada em 50.",
    tipo: 'acessorio'
  },
  {
    nome: "Pederneira",
    usos: 10,
    peso: 0.3,
    volume: 0.5,
    descricao: "Uma pedra capaz de gerar grandes faíscas quando riscada com algo duro, muito útil para fazer fogueiras e se aquecer no frio ou cozinhar algo (10 usos).",
    efeito: "Gera faíscas para fogueiras.",
    tipo: 'ferramenta'
  },
  {
    nome: "Kit de cozinha",
    peso: 8.5,
    volume: 4.5,
    descricao: "Cozinhar é essencial quando se precisa de energia para uma longa jornada, estar preparado é uma atitude sábia (a bolsa de temperos contém orégano, sal, cominho, páprica e alho seco, cada um com 2 usos).",
    efeito: "Bônus de +2 na redução de fome por tempero.",
    tipo: 'ferramenta'
  },
  {
    nome: "Kit de boticário",
    peso: 11,
    volume: 9,
    descricao: "Materiais básicos para um alquimista, permite fazer macerações e tinturas. Contém macerador, pilão, 5 frascos escuros pequenos e 1L de álcool de cereais.",
    efeito: "Permite criar itens alquímicos.",
    tipo: 'ferramenta'
  },
  {
    nome: "Saco de dormir",
    peso: 10,
    volume: 10,
    descricao: "Dormir no chão é uma opção, mas lhe dá uma penalização no seu cansaço por uma noite mal dormida, é recomendado dormir confortavelmente e acordar com disposição para a aventura. Peso: 10, volume: 10.",
    efeito: "Evita penalidade de mal descansado.",
    tipo: 'equipamento'
  },
  {
    nome: "Anel da sorte",
    peso: 0.2,
    volume: 0.3,
    descricao: "Há quem diga que sorte é para os fracos, mas numa aventura, um pouco de sorte pode fazer diferença entre a vida e a morte. Aumenta em +1 o dado para encontrar coisas.",
    efeito: "Bônus de +1 em testes de encontro.",
    tipo: 'acessorio'
  },
  {
    nome: "Introdução a magia (Kassandra Windhollow)",
    peso: 3.5,
    volume: 2.5,
    descricao: "A magia é um dom muito incomum e muito temido em alguns lugares, porém, muito útil e poderoso nas mãos corretas, este livro irá lhe auxiliar na busca desse conhecimento.",
    efeito: "Ajuda no aprendizado de magia básica.",
    tipo: 'livro'
  },
  {
    nome: "Armas de fogo: funcionamento e manutenção (Samuel Colt)",
    peso: 3.5,
    volume: 2.5,
    descricao: "Um guia simples de como usar e manter armas de fogo, além de explicar suas características únicas. Peso: 3,5, volume: 2,5.",
    tipo: 'livro'
  },
  {
    nome: "Petiscos Wallerman’s",
    quantidade: 5,
    peso: 0.5, 
    volume: 0.5,
    descricao: "Irresistíveis para uma variedade de criaturas, ajuda a amansar de animais a demônios. Bônus de +3 no domar.",
    efeito: "Bônus de +3 no teste de domar.",
    tipo: 'consumivel'
  },
  {
    nome: "Dinheiro extra",
    peso: 0.05,
    volume: 0.05,
    descricao: "Uma moeda de prata.",
    tipo: 'outro'
  }
];
