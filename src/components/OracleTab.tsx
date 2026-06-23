import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, Send, RefreshCw, Copy, Check, 
  Sword, Shield, User
} from 'lucide-react';
import { Character, Weapon, Catalyst, ArmorPiece, Item } from '../types';

interface OracleTabProps {
  characters: Character[];
  activeCharacterId: string | null;
  onUpdateCharacter: (updatesOrFn: Partial<Character> | ((c: Character) => Partial<Character>), characterId?: string) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  items?: {
    id: string;
    tipoItem: string;
    details: any;
  }[];
}

const SUGGESTIONS = [
  "Como funciona a vantagem e desvantagem?",
  "Crie uma espada curta de aço com escala C em Força",
  "Crie uma armadura de placas de vibrite leve",
  "Como funciona o sangramento e a amputação?"
];

export const OracleTab: React.FC<OracleTabProps> = ({
  characters,
  activeCharacterId,
  onUpdateCharacter,
  showToast
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Saudações, viajante das terras de Demons Despair. Eu sou Hefesto, o Forjador Cósmico. Aqui posso tirar suas dúvidas sobre as leis do combate, interpretar regras complexas ou forjar equipamentos lendários e equilibrados com os melhores materiais do universo. Diga-me, o que deseja que eu molde hoje?',
      timestamp: new Date()
    }
  ]);
  const [inputInput, setInputInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCharId, setSelectedCharId] = useState<string>(activeCharacterId || '');

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (activeCharacterId && !selectedCharId) {
      setSelectedCharId(activeCharacterId);
    } else if (characters.length > 0 && !selectedCharId) {
      setSelectedCharId(characters[0].id);
    }
  }, [activeCharacterId, characters, selectedCharId]);

  // Helper inside client to extract JSON code blocks
  const parseOracleMessage = (text: string) => {
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/g;
    let match;
    const items: any[] = [];
    let cleanText = text;

    while ((match = jsonRegex.exec(text)) !== null) {
      try {
        const jsonStr = match[1];
        const parsed = JSON.parse(jsonStr);
        if (parsed) {
          const addSingleItem = (obj: any) => {
            const itemPayload = obj.item || obj;
            const tipoItem = obj.tipoItem || itemPayload.tipo || "Item";
            items.push({
              id: itemPayload.id || Math.random().toString(36).substring(2, 9),
              tipoItem,
              details: itemPayload
            });
          };

          if (Array.isArray(parsed)) {
            parsed.forEach(p => {
              if (p) addSingleItem(p);
            });
          } else {
            addSingleItem(parsed);
          }
        }
        // Replace matched JSON block from displayed content
        cleanText = cleanText.replace(match[0], "");
      } catch (e) {
        console.error("Failed to parse JSON blocks from model answer:", e);
      }
    }

    return { cleanText: cleanText.trim(), items };
  };

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputInput).trim();
    if (!prompt) return;

    if (!textToSend) setInputInput('');

    // Append user message
    const userMsgId = Math.random().toString(36).substring(7);
    const newMsg: Message = {
      id: userMsgId,
      sender: 'user',
      text: prompt,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMsg]);
    setIsLoading(true);

    try {
      // Map history to avoid sending too heavy context
      const history = messages.slice(-6).map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        text: m.text
      }));

      const activeChar = characters.find(c => c.id === selectedCharId);
      const userContext = activeChar ? {
        nome: activeChar.nome,
        etnia: activeChar.etnia,
        vidaAtual: activeChar.vidaAtual,
        fome: activeChar.fome,
        sede: activeChar.sede,
        nivel: activeChar.statsXP || {}
      } : null;

      const res = await fetch('/api/oracle/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, history, userContext })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Hefesto está ocupado na forja divina no momento.');
      }
      
      // Parse response to find embedded item payloads
      const { cleanText, items } = parseOracleMessage(data.text);

      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          sender: 'assistant',
          text: cleanText || 'Item lendário forjado com perfeição divina!',
          timestamp: new Date(),
          items: items.length > 0 ? items : undefined
        }
      ]);
    } catch (err: any) {
      const errMsg = err.message || '';
      const isKeyError = errMsg.includes('GEMINI_API_KEY') || errMsg.includes('API key') || errMsg.includes('Secrets') || errMsg.includes('400') || errMsg.includes('valid');
      
      const responseText = isKeyError 
        ? `⚠️ **Erro de Configuração da Chave do Gemini (GEMINI_API_KEY)**\n\nSua chave de API do Gemini ou está ausente ou é inválida.\n\n**Não se preocupe! Você não precisa pagar por ela e leva menos de 1 minuto para ativar:**\n\n1. Acesse o site oficial de desenvolvedores do **[Google AI Studio](https://aistudio.google.com/)**.\n2. Faça login com sua conta do Google e clique em **"Get API key"** (Obter chave de API).\n3. Crie uma chave de API escolha a opção de **Free Tier (Plano Gratuito)**.\n4. Volte aqui para esta tela e clique no ícone de engrenagem **Settings ⚙️** (no canto superior direito do Google AI Studio).\n5. Vá na aba **Secrets**.\n6. Adicione uma variável com Nome: \`GEMINI_API_KEY\` e cole sua chave no campo de valor.\n7. Recarregue esta página do aplicativo para reiniciar as brasas da forja de Hefesto! 🔥`
        : `⚠️ Desculpe, viajante, mas as brasas da minha forja estão instáveis agora.\n\nDetalhe do erro: ${errMsg}`;

      showToast(isKeyError ? 'Configuração de API necessária!' : 'Erro de conexão com o Oráculo', 'error');
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          sender: 'assistant',
          text: responseText,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Add Item Loot to sheet inventory!
  const handleLootItem = (itemPayload: any, targetId: string) => {
    const targetChar = characters.find(c => c.id === targetId);
    if (!targetChar) {
      showToast('Selecione uma ficha válida para resgatar o item!', 'error');
      return;
    }

    const tipoItem = itemPayload.tipoItem || "Item";
    const details = itemPayload.details;

    onUpdateCharacter((char) => {
      // Clones existing structures safely
      const armas = [...(char.armas || [])];
      const catalisadores = [...(char.catalisadores || [])];
      const armaduras = [...(char.armaduras || [])];
      const acessorios = [...(char.acessorios || [])];
      const compartimentos = [...(char.compartimentos || [])];

      const itemID = details.id || Math.random().toString(36).substring(2, 9);

      if (tipoItem === 'Arma') {
        const newW: Weapon = {
          id: itemID,
          nome: details.nome || "Arma Divina",
          dano: details.dano || "1d6",
          acerto: Number(details.acerto) || 0,
          tipo: "Arma",
          categoria: details.categoria || "Arma Branca",
          escala: details.escala || "0",
          atributoBase: details.atributoBase || "Força",
          peso: Number(details.peso) || 1,
          volume: Number(details.volume) || 1,
          durabilidade: Number(details.durabilidade) || 100,
          maxDurabilidade: Number(details.maxDurabilidade) || 100,
          corte: Number(details.corte) || 0,
          impacto: Number(details.impacto) || 0,
          perfuracao: Number(details.perfuracao) || 0,
          resistencia: Number(details.resistencia) || 0,
          efeito: details.efeito || "",
          durabilidadeMaxUtil: Number(details.durabilidadeMaxUtil ?? details.maxDurabilidade ?? 100)
        };
        armas.push(newW);
        showToast(`"${newW.nome}" foi adicionada à ficha de ${char.nome}!`, 'success');
        return { armas };
      }

      if (tipoItem === 'Catalisador') {
        const newC: Catalyst = {
          id: itemID,
          nome: details.nome || "Catalisador Celestial",
          tipo: details.tipo || "Catalisador",
          escala: details.escala || "D",
          atributoBase: "Inteligência",
          peso: Number(details.peso) || 1,
          volume: Number(details.volume) || 1,
          durabilidade: Number(details.durabilidade) || 100,
          maxDurabilidade: Number(details.maxDurabilidade) || 100,
          feitico: Number(details.feitico) || 0,
          elemental: Number(details.elemental) || 0,
          magiaNegra: Number(details.magiaNegra) || 0,
          potencial: Number(details.potencial) || 0,
          efeito: details.efeito || ""
        };
        catalisadores.push(newC);
        showToast(`"${newC.nome}" foi adicionado à ficha de ${char.nome}!`, 'success');
        return { catalisadores };
      }

      if (tipoItem === 'Armadura') {
        const newA: ArmorPiece = {
          id: itemID,
          nome: details.nome || "Armadura Customizada",
          corte: Number(details.corte) || 0,
          impacto: Number(details.impacto) || 0,
          perfuracao: Number(details.perfuracao) || 0,
          durabilidade: Number(details.durabilidade) || 100,
          peso: Number(details.peso) || 1,
          volume: Number(details.volume) || 1,
          reducaoDano: Number(details.reducaoDano) || 1,
          efeito: details.efeito || ""
        };
        armaduras.push(newA);
        showToast(`"${newA.nome}" foi adicionada aos trajes de ${char.nome}!`, 'success');
        return { armaduras };
      }

      if (tipoItem === 'Acessório') {
        const newAce: ArmorPiece = {
          id: itemID,
          nome: details.nome || "Acessório Místico",
          corte: 0, impacto: 0, perfuracao: 0,
          durabilidade: Number(details.durabilidade) || 100,
          peso: Number(details.peso) || 0.1,
          volume: Number(details.volume) || 0.1,
          reducaoDano: 0,
          efeito: details.efeito || ""
        };
        acessorios.push(newAce);
        showToast(`"${newAce.nome}" foi equipado em ${char.nome}!`, 'success');
        return { acessorios };
      }

      // Default loose Item stored in standard compartments
      const generic: Item = {
        id: itemID,
        nome: details.nome || "Item Rústico",
        peso: Number(details.peso) || 0.5,
        volume: Number(details.volume) || 0.5,
        quantidade: Number(details.quantidade) || 1,
        tipo: details.tipo || "Geral",
        durabilidade: Number(details.durabilidade) || 100,
        maxDurabilidade: Number(details.maxDurabilidade) || 100,
        descricao: details.descricao || details.efeito || ""
      };

      if (compartimentos.length === 0) {
        compartimentos.push({
          id: 'comp_inv',
          nome: 'Inventário Geral',
          volumeMax: 50,
          itens: [generic]
        });
      } else {
        compartimentos[0].itens = [...(compartimentos[0].itens || []), generic];
      }

      showToast(`"${generic.nome}" foi guardado no inventário de ${char.nome}!`, 'success');
      return { compartimentos };
    }, targetId);
  };

  return (
    <div className="w-full h-full min-h-0 flex flex-col">
      {/* Oracle chat container */}
      <div className="flex flex-col bg-zinc-900/60 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative flex-1 min-h-0 w-full">
        {/* Top bar oracle metadata */}
        <div className="px-4 sm:px-6 py-4 bg-zinc-900 border-b border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
               <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Oráculo de Hefesto</h2>
              <p className="text-[10px] text-zinc-500 font-medium">As chamas das leis e da forja do Demons Despair</p>
            </div>
          </div>

          <div className="flex items-center gap-2 justify-between sm:justify-end w-full sm:w-auto border-t border-zinc-800/50 pt-3 sm:border-0 sm:pt-0">
            <span className="text-[10px] text-zinc-500 font-mono shrink-0">Ficha Destino:</span>
            <select
              value={selectedCharId}
              onChange={(e) => setSelectedCharId(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-xl text-xs px-3 py-1.5 focus:outline-none focus:border-amber-500/50 max-w-[180px] truncate"
            >
              <option value="">Nenhum personagem</option>
              {characters.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Conversation history area */}
        <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto space-y-4 scrollbar-thin select-text">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 sm:gap-3 max-w-[90%] sm:max-w-[85%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${
                msg.sender === 'user' 
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-300' 
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
              }`}>
                {msg.sender === 'user' ? <User size={14} /> : <Sparkles size={14} />}
              </div>

              <div className="space-y-3 min-w-0 flex-1">
                <div className={`p-4 rounded-2xl border text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-zinc-800/80 border-zinc-700/60 text-zinc-100 rounded-tr-none'
                    : 'bg-zinc-950/40 border-zinc-900 text-zinc-300 rounded-tl-none'
                }`}>
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                </div>

                {/* Interactive Parsed RPG Equipment Items */}
                {msg.items && msg.items.map((it) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={it.id}
                    className="bg-zinc-950 border-2 border-amber-500/20 hover:border-amber-500/40 rounded-2xl p-4 space-y-3 w-full max-w-sm shadow-xl"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2">
                      <div className="flex items-center gap-2">
                        {it.tipoItem === 'Arma' ? <Sword className="text-amber-500" size={16} /> : <Shield className="text-yellow-600" size={16} />}
                        <span className="text-[10px] font-black uppercase text-amber-500 tracking-widest">{it.tipoItem}</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">D: {it.details.durabilidade}/{it.details.maxDurabilidade}</span>
                    </div>

                    <div>
                      <h4 className="text-sm font-black text-white">{it.details.nome}</h4>
                      <p className="text-[11px] text-zinc-400 mt-1 italic">{it.details.descricao}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-zinc-900/50 p-2 rounded-xl">
                      {it.tipoItem === 'Arma' && (
                        <div className="col-span-3 space-y-2.5 w-full text-[11px]">
                          {/* Main Stats with bigger items */}
                          <div className="grid grid-cols-3 gap-2 border-b border-zinc-850 pb-2">
                            <div className="text-center">
                              <span className="block text-[8px] uppercase tracking-wider text-zinc-500">Dano</span>
                              <span className="text-xs font-black font-mono text-white">{it.details.dano || "0"}</span>
                            </div>
                            <div className="text-center">
                              <span className="block text-[8px] uppercase tracking-wider text-zinc-500">Escala</span>
                              <span className="text-xs font-black font-mono text-amber-500">{it.details.escala || "0"} ({it.details.atributoBase || "Força"})</span>
                            </div>
                            <div className="text-center">
                              <span className="block text-[8px] uppercase tracking-wider text-zinc-500">Acerto</span>
                              <span className="text-xs font-black font-mono text-emerald-400">+{it.details.acerto || 0}</span>
                            </div>
                          </div>
                          
                          {/* Damage Type Resistances / Secondary values */}
                          <div className="grid grid-cols-4 gap-1.5 border-b border-zinc-850 pb-2">
                            <div className="text-center bg-zinc-950/40 p-1.5 rounded">
                              <span className="block text-[7px] uppercase tracking-wider text-zinc-500">Corte</span>
                              <span className="text-[10px] font-black font-mono text-zinc-300">{it.details.corte ?? 0}</span>
                            </div>
                            <div className="text-center bg-zinc-950/40 p-1.5 rounded">
                              <span className="block text-[7px] uppercase tracking-wider text-zinc-500">Impacto</span>
                              <span className="text-[10px] font-black font-mono text-zinc-300">{it.details.impacto ?? 0}</span>
                            </div>
                            <div className="text-center bg-zinc-950/40 p-1.5 rounded">
                              <span className="block text-[7px] uppercase tracking-wider text-zinc-500">Perf.</span>
                              <span className="text-[10px] font-black font-mono text-zinc-300">{it.details.perfuracao ?? 0}</span>
                            </div>
                            <div className="text-center bg-zinc-950/40 p-1.5 rounded">
                              <span className="block text-[7px] uppercase tracking-wider text-zinc-500">Resist.</span>
                              <span className="text-[10px] font-black font-mono text-zinc-300">{it.details.resistencia ?? 0}</span>
                            </div>
                          </div>

                          {/* Physics details */}
                          <div className="grid grid-cols-3 gap-1.5 bg-zinc-950/20 p-1.5 rounded">
                            <div className="text-center">
                              <span className="block text-[7px] text-zinc-500 font-bold uppercase">Peso</span>
                              <span className="font-mono text-zinc-400 text-[10px]">{it.details.peso ?? 0} kg</span>
                            </div>
                            <div className="text-center">
                              <span className="block text-[7px] text-zinc-500 font-bold uppercase">Volume</span>
                              <span className="font-mono text-zinc-400 text-[10px]">{it.details.volume ?? 0}</span>
                            </div>
                            <div className="text-center">
                              <span className="block text-[7px] text-zinc-500 font-bold uppercase">Durab.</span>
                              <span className="font-mono text-zinc-400 text-[10px]">{it.details.durabilidade ?? 0}/{it.details.maxDurabilidade ?? 0}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {it.tipoItem === 'Catalisador' && (
                        <>
                          <div className="text-center">
                            <span className="block text-[8px] uppercase tracking-wider text-zinc-500">Feitiço</span>
                            <span className="text-xs font-black font-mono text-purple-400">+{it.details.feitico}</span>
                          </div>
                          <div className="text-center">
                            <span className="block text-[8px] uppercase tracking-wider text-zinc-500">Elemental</span>
                            <span className="text-xs font-black font-mono text-orange-400">+{it.details.elemental}</span>
                          </div>
                          <div className="text-center">
                            <span className="block text-[8px] uppercase tracking-wider text-zinc-500">Magia N.</span>
                            <span className="text-xs font-black font-mono text-red-500">+{it.details.magiaNegra}</span>
                          </div>
                        </>
                      )}

                      {it.tipoItem === 'Armadura' && (
                        <div className="col-span-3 space-y-2.5 w-full text-[11px]">
                          {/* Main Stats with bigger items */}
                          <div className="grid grid-cols-2 gap-2 border-b border-zinc-850 pb-2">
                            <div className="text-center">
                              <span className="block text-[8px] uppercase tracking-wider text-zinc-500">Redução de Dano</span>
                              <span className="text-xs font-black font-mono text-white">{it.details.reducaoDano || 0}</span>
                            </div>
                            <div className="text-center">
                              <span className="block text-[8px] uppercase tracking-wider text-zinc-500">Durabilidade</span>
                              <span className="text-xs font-black font-mono text-amber-500">{it.details.durabilidade ?? 0}/{it.details.maxDurabilidade ?? it.details.durabilidade ?? 100}</span>
                            </div>
                          </div>
                          
                          {/* Resistances */}
                          <div className="grid grid-cols-3 gap-1.5 border-b border-zinc-850 pb-2">
                            <div className="text-center bg-zinc-950/40 p-1.5 rounded">
                              <span className="block text-[7px] uppercase tracking-wider text-zinc-500">Res. Corte</span>
                              <span className="text-[10px] font-black font-mono text-emerald-400">+{it.details.corte ?? 0}</span>
                            </div>
                            <div className="text-center bg-zinc-950/40 p-1.5 rounded">
                              <span className="block text-[7px] uppercase tracking-wider text-zinc-500">Res. Impacto</span>
                              <span className="text-[10px] font-black font-mono text-amber-400">+{it.details.impacto ?? 0}</span>
                            </div>
                            <div className="text-center bg-zinc-950/40 p-1.5 rounded">
                              <span className="block text-[7px] uppercase tracking-wider text-zinc-500">Res. Perf.</span>
                              <span className="text-[10px] font-black font-mono text-sky-400">+{it.details.perfuracao ?? 0}</span>
                            </div>
                          </div>

                          {/* Physics details */}
                          <div className="grid grid-cols-2 gap-1.5 bg-zinc-950/20 p-1.5 rounded">
                            <div className="text-center">
                              <span className="block text-[7px] text-zinc-500 font-bold uppercase">Peso</span>
                              <span className="font-mono text-zinc-400 text-[10px]">{it.details.peso ?? 0} kg</span>
                            </div>
                            <div className="text-center">
                              <span className="block text-[7px] text-zinc-500 font-bold uppercase">Volume</span>
                              <span className="font-mono text-zinc-400 text-[10px]">{it.details.volume ?? 0}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {it.tipoItem === 'Acessório' && (
                        <div className="col-span-3 text-center">
                          <span className="block text-[8px] uppercase tracking-wider text-zinc-500">Efeito Místico</span>
                          <span className="text-[11px] text-yellow-500 font-bold">{it.details.efeito || "Sem efeitos adicionais"}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <select
                        value={selectedCharId}
                        onChange={(e) => setSelectedCharId(e.target.value)}
                        className="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-xl text-xs px-2.5 py-1 flex-1 focus:outline-none"
                      >
                        {characters.map(c => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleLootItem(it, selectedCharId)}
                        className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-zinc-950 font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-[0_4px_12px_rgba(245,158,11,0.2)]"
                      >
                        Pegar Item
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}

          {/* Loading bubble placeholder */}
          {isLoading && (
            <div className="flex gap-3 max-w-[80%]">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
                <RefreshCw size={14} className="animate-spin" />
              </div>
              <div className="p-4 rounded-2xl bg-zinc-950/40 border border-zinc-900 text-zinc-500 text-sm italic">
                Hefesto está soprando as brasas para moldar a resposta...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Suggestions Quick Buttons */}
        <div className="px-4 sm:px-6 py-2 bg-zinc-950/20 border-t border-zinc-850 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none w-full max-w-full">
          {SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(s)}
              className="bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white border border-zinc-800 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer select-none"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Send message form bar */}
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
          className="p-3 sm:p-4 bg-zinc-950 border-t border-zinc-800/60 flex gap-2 sm:gap-3 items-center w-full"
        >
          <input
            type="text"
            value={inputInput}
            onChange={(e) => setInputInput(e.target.value)}
            disabled={isLoading}
            placeholder="Pergunte sobre regras de combate ou peça: 'forje uma lança'..."
            className="flex-1 min-w-0 bg-zinc-900/60 border border-zinc-850 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
          />
          <button
            type="submit"
            disabled={isLoading || !inputInput.trim()}
            className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-850 disabled:text-zinc-600 transition-colors rounded-2xl flex items-center justify-center text-zinc-950 font-bold active:scale-95 shrink-0 shadow-[0_4px_12px_rgba(245,158,11,0.2)] disabled:shadow-none"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
