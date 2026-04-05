import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, Trash2, Save, Download, Upload, Copy, ChevronDown, ChevronUp, 
  Shield, Sword, Backpack, BookOpen, Activity, Coins, User, MapPin, 
  Thermometer, Utensils, Droplets, Battery, Weight, Package, Gem, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { jsPDF } from 'jspdf';

import { Character, AppState, ArmorPiece } from './types';
import { Stats, PROFICIENCIES, calculateProficiencyBonus } from './rules/proficiencyRules';
import { getVidaMaxima, getManaMaxima, getCargaMaxima, getDeslocamentoBase } from './rules/statusRules';
import { Item, calculateInventoryTotals, getLoadPenalties } from './rules/inventoryRules';
import { Weapon, getStatBonus, calculateWeaponDamageBonus } from './rules/combatRules';
import { Knowledge, getXpToNextLevel, INITIAL_KNOWLEDGES } from './rules/knowledgeRules';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const STORAGE_KEY = 'rpg_system_x_chars';

const createEmptyCharacter = (): Character => ({
  id: crypto.randomUUID(),
  nome: 'Novo Personagem',
  etnia: '',
  dinheiro: { C: 0, B: 0, P: 0, O: 0 },
  vidaAtual: 0,
  manaAtual: 0,
  fome: 0,
  sede: 0,
  cansaco: 0,
  defesa: { Cabeça: 0, Torso: 0, Braços: 0, Pernas: 0 },
  clima: { frio: 0, calor: 0 },
  stats: { CON: 0, RES: 0, ADP: 0, MEN: 0, APR: 0, FOR: 0, DEX: 0, INT: 0, RIT: 0 },
  statsXP: { CON: 0, RES: 0, ADP: 0, MEN: 0, APR: 0, FOR: 0, DEX: 0, INT: 0, RIT: 0 },
  joias: [],
  imagem: '',
  armas: [],
  habilidades: [],
  magias: [],
  armaduras: [],
  compartimentos: [
    { id: crypto.randomUUID(), nome: 'Mochila de Viagem', volumeMax: 30, itens: [] },
    { id: crypto.randomUUID(), nome: 'Bolsa de Cinto', volumeMax: 3, itens: [] }
  ],
  conhecimentos: INITIAL_KNOWLEDGES.map(name => ({ name, nivel: 0, xp: 0, limite: 5 })),
});

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed;
      } catch (e) {
        console.error("Error loading characters", e);
      }
    }
    const initialChar = createEmptyCharacter();
    return { characters: [initialChar], activeCharacterId: initialChar.id };
  });

  const [clipboard, setClipboard] = useState<{ type: 'Arma' | 'Armadura' | 'Item' | 'Magia' | 'Habilidade', data: any } | null>(null);

  const copyToClipboard = (type: any, data: any) => {
    setClipboard({ type, data: { ...data, id: crypto.randomUUID() } });
  };

  const activeChar = useMemo(() => 
    state.characters.find(c => c.id === state.activeCharacterId) || state.characters[0],
  [state]);

  // Auto-save
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const updateChar = useCallback((updates: Partial<Character>) => {
    setState(prev => ({
      ...prev,
      characters: prev.characters.map(c => 
        c.id === prev.activeCharacterId ? { ...c, ...updates } : c
      )
    }));
  }, []);

  // Derived Values
  const stats = activeChar?.stats || createEmptyCharacter().stats;
  const vidaMax = getVidaMaxima(stats.CON);
  const manaMax = getManaMaxima(stats.APR);
  const cargaMax = getCargaMaxima(stats.RES);
  const deslocamentoBase = getDeslocamentoBase(stats.DEX);

  const compartimentos = activeChar?.compartimentos || [];
  const armas = activeChar?.armas || [];
  const armaduras = activeChar?.armaduras || [];

  const invTotals = calculateInventoryTotals(compartimentos);
  const weaponPeso = armas.reduce((acc, w) => acc + (w.peso || 0), 0);
  const armorPeso = armaduras.reduce((acc, a) => acc + (a.peso || 0), 0);
  const pesoTotal = invTotals.peso + weaponPeso + armorPeso;
  
  const penalties = getLoadPenalties(pesoTotal, cargaMax);
  const deslocamentoFinal = Math.max(0, Math.floor(deslocamentoBase * penalties.deslocamentoMult));

  const exportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeChar));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${activeChar.nome}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const char = JSON.parse(event.target?.result as string);
        char.id = crypto.randomUUID(); // New ID for safety
        setState(prev => ({
          characters: [...prev.characters, char],
          activeCharacterId: char.id
        }));
      } catch (err) {
        alert("Erro ao importar ficha.");
      }
    };
    reader.readAsText(file);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`Ficha: ${activeChar.nome}`, 10, 20);
    doc.setFontSize(12);
    doc.text(`Etnia: ${activeChar.etnia}`, 10, 30);
    doc.text(`Vida: ${activeChar.vidaAtual}/${vidaMax}`, 10, 40);
    doc.text(`Mana: ${activeChar.manaAtual}/${manaMax}`, 10, 50);
    doc.text(`Deslocamento: ${deslocamentoFinal}m`, 10, 60);
    
    let y = 80;
    doc.text("Status:", 10, y);
    Object.entries(stats).forEach(([key, val], i) => {
      doc.text(`${key}: ${val}`, 10, y + 10 + (i * 7));
    });

    doc.save(`${activeChar.nome}.pdf`);
  };

  const duplicateChar = () => {
    const newChar = { ...activeChar, id: crypto.randomUUID(), nome: `${activeChar.nome} (Cópia)` };
    setState(prev => ({
      characters: [...prev.characters, newChar],
      activeCharacterId: newChar.id
    }));
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteChar = () => {
    if (state.characters.length <= 1) return;
    setState(prev => {
      const remaining = prev.characters.filter(c => c.id !== prev.activeCharacterId);
      return {
        characters: remaining,
        activeCharacterId: remaining[0].id
      };
    });
    setShowDeleteConfirm(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      updateChar({ imagem: event.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-amber-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 px-2 sm:px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <select 
            value={state.activeCharacterId || ''} 
            onChange={(e) => setState(prev => ({ ...prev, activeCharacterId: e.target.value }))}
            className="bg-zinc-800 border border-zinc-700 rounded-md px-2 sm:px-3 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 truncate max-w-[140px] sm:max-w-none"
          >
            {state.characters.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <button 
            onClick={() => {
              const nc = createEmptyCharacter();
              setState(prev => ({ characters: [...prev.characters, nc], activeCharacterId: nc.id }));
            }}
            className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors flex-shrink-0"
            title="Novo Personagem"
          >
            <Plus size={18} className="text-amber-500" />
          </button>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <button onClick={duplicateChar} className="p-1.5 sm:p-2 hover:bg-zinc-800 rounded-md transition-colors" title="Duplicar">
            <Copy size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>
          <button onClick={exportJSON} className="p-1.5 sm:p-2 hover:bg-zinc-800 rounded-md transition-colors" title="Exportar JSON">
            <Download size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>
          <label className="p-1.5 sm:p-2 hover:bg-zinc-800 rounded-md transition-colors cursor-pointer" title="Importar JSON">
            <Upload size={16} className="sm:w-[18px] sm:h-[18px]" />
            <input type="file" className="hidden" onChange={importJSON} accept=".json" />
          </label>
          <button onClick={exportPDF} className="p-1.5 sm:p-2 hover:bg-zinc-800 rounded-md transition-colors" title="Exportar PDF">
            <Activity size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} className="p-1.5 sm:p-2 hover:bg-zinc-800 rounded-md transition-colors text-red-400" title="Excluir">
            <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>
        </div>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl max-w-sm w-full shadow-2xl"
              >
                <h3 className="text-lg font-bold mb-2">Excluir Personagem?</h3>
                <p className="text-zinc-400 text-sm mb-6">Esta ação não pode ser desfeita. Tem certeza que deseja excluir "{activeChar.nome}"?</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm font-medium"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={deleteChar}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors text-sm font-medium"
                  >
                    Excluir
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
        
        {/* Left Column: Basic Info & Stats */}
        <div className="lg:col-span-4 space-y-6">
          <Section title="Identidade" icon={<User size={18}/>} collapsible>
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-4 mb-4">
                <div className="w-32 h-32 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex items-center justify-center relative group">
                  {activeChar.imagem ? (
                    <img src={activeChar.imagem} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User size={48} className="text-zinc-700" />
                  )}
                  <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                    <Upload size={24} className="text-white" />
                    <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                  </label>
                </div>
                {activeChar.imagem && (
                  <button 
                    onClick={() => updateChar({ imagem: '' })}
                    className="text-[10px] text-red-400 hover:text-red-300 uppercase font-bold"
                  >
                    Remover Imagem
                  </button>
                )}
              </div>

              <Input label="Nome" value={activeChar?.nome || ''} onChange={v => updateChar({ nome: v })} />
              <Input label="Etnia/Cultura" value={activeChar?.etnia || ''} onChange={v => updateChar({ etnia: v })} />
              
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Dinheiro</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['C', 'B', 'P', 'O'] as const).map(coin => (
                    <div key={coin} className="flex flex-col items-center bg-zinc-900 border border-zinc-800 rounded p-1">
                      <span className="text-[10px] font-bold text-zinc-600 mb-1">{coin}</span>
                      <input 
                        type="number" 
                        value={activeChar.dinheiro?.[coin] || 0} 
                        onChange={e => updateChar({ dinheiro: { ...(activeChar.dinheiro || {C:0,B:0,P:0,O:0}), [coin]: parseInt(e.target.value) || 0 } })}
                        className="w-full bg-transparent text-center text-sm font-bold focus:outline-none text-amber-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1">
                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Deslocamento</label>
                <div className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-amber-400 font-bold">
                  {deslocamentoFinal}m
                </div>
              </div>
            </div>
          </Section>

          <Section title="Vitais" icon={<Activity size={18}/>} collapsible>
            <div className="space-y-4">
              <ProgressBar 
                label="Vida" 
                current={activeChar?.vidaAtual || 0} 
                max={vidaMax} 
                color="bg-red-500" 
                onChange={v => updateChar({ vidaAtual: v })} 
              />
              <ProgressBar 
                label="Mana" 
                current={activeChar?.manaAtual || 0} 
                max={manaMax} 
                color="bg-blue-500" 
                onChange={v => updateChar({ manaAtual: v })} 
              />
              <div className="grid grid-cols-3 gap-3">
                <MiniBar label="Fome" value={activeChar?.fome || 0} color="bg-orange-500" onChange={v => updateChar({ fome: v })} />
                <MiniBar label="Sede" value={activeChar?.sede || 0} color="bg-cyan-500" onChange={v => updateChar({ sede: v })} />
                <MiniBar label="Cansaço" value={activeChar?.cansaco || 0} max={8} color="bg-purple-500" onChange={v => updateChar({ cansaco: v })} />
              </div>

              <div className="pt-4 border-t border-zinc-800">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-500 uppercase font-bold tracking-tighter">Carga Total</span>
                  <span className={cn(pesoTotal > cargaMax ? "text-red-400" : "text-zinc-300")}>
                    {pesoTotal.toFixed(1)} / {cargaMax} kg
                  </span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full transition-all duration-500", pesoTotal > cargaMax ? "bg-red-500" : "bg-amber-500")} 
                    style={{ width: `${Math.min(100, (pesoTotal / cargaMax) * 100)}%` }}
                  />
                </div>

                {penalties.acertoPenalty !== 0 && (
                  <div className="mt-2 bg-red-500/10 border border-red-500/20 p-2 rounded text-[10px] text-red-400 flex items-center gap-2">
                    <Zap size={12} />
                    PENALIDADE: {penalties.acertoPenalty} Acerto, {penalties.mentalidadePenalty} Mentalidade
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section title="Bônus de Dano" icon={<Sword size={18}/>} collapsible>
            <div className="grid grid-cols-2 gap-3">
              {['FOR', 'DEX', 'INT', 'RIT'].map(stat => (
                <div key={stat} className="flex justify-between items-center bg-zinc-900/50 p-2 rounded border border-zinc-800">
                  <span className="text-xs text-zinc-400">{stat}</span>
                  <span className="font-bold text-amber-500">+{getStatBonus(stats[stat as keyof Stats])}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Defesa por Membro" icon={<Shield size={18}/>} collapsible>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(activeChar?.defesa || {}).map(([part, val]) => (
                <div key={part} className="bg-zinc-900 border border-zinc-800 p-2 rounded flex justify-between items-center">
                  <span className="text-xs text-zinc-400">{part}</span>
                  <input 
                    type="number" 
                    value={val} 
                    onChange={e => updateChar({ defesa: { ...(activeChar?.defesa || {}), [part]: parseInt(e.target.value) || 0 } })}
                    className="w-10 bg-transparent text-right font-bold focus:outline-none text-amber-500"
                  />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Status Primários" icon={<Zap size={18}/>} collapsible>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(stats) as (keyof Stats)[]).map(stat => {
                const statVal = stats[stat];
                const xpLimit = 5 + (Math.floor(statVal / 15) * 5);
                const currentXP = activeChar?.statsXP?.[stat] || 0;

                return (
                  <div key={stat} className="bg-zinc-900 border border-zinc-800 p-2 rounded-lg text-center group relative">
                    <div className="text-[10px] text-zinc-500 font-bold mb-1">{stat}</div>
                    <input 
                      type="number" 
                      value={statVal} 
                      onChange={e => updateChar({ stats: { ...stats, [stat]: parseInt(e.target.value) || 0 } })}
                      className="w-full bg-transparent text-center text-xl font-bold focus:outline-none text-amber-500"
                    />
                    <div className="flex flex-col items-center mt-2">
                      <span className="text-[10px] text-zinc-600 font-bold uppercase mb-1">XP (Máx {xpLimit})</span>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => {
                            const newXP = Math.max(0, currentXP - 1);
                            updateChar({ statsXP: { ...(activeChar?.statsXP || createEmptyCharacter().statsXP), [stat]: newXP } });
                          }}
                          className="w-6 h-6 flex items-center justify-center bg-zinc-800 rounded hover:bg-zinc-700 text-zinc-400 transition-colors"
                        >
                          -
                        </button>
                        <input 
                          type="number"
                          value={currentXP}
                          onChange={e => {
                            const newXP = parseInt(e.target.value) || 0;
                            if (newXP >= xpLimit) {
                              updateChar({ 
                                stats: { ...stats, [stat]: statVal + 1 },
                                statsXP: { ...(activeChar?.statsXP || createEmptyCharacter().statsXP), [stat]: 0 }
                              });
                            } else {
                              updateChar({ 
                                statsXP: { ...(activeChar?.statsXP || createEmptyCharacter().statsXP), [stat]: newXP }
                              });
                            }
                          }}
                          className="w-14 bg-zinc-800 border border-zinc-700 rounded text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-amber-500 py-1"
                        />
                        <button 
                          onClick={() => {
                            const newXP = currentXP + 1;
                            if (newXP >= xpLimit) {
                              updateChar({ 
                                stats: { ...stats, [stat]: statVal + 1 },
                                statsXP: { ...(activeChar?.statsXP || createEmptyCharacter().statsXP), [stat]: 0 }
                              });
                            } else {
                              updateChar({ statsXP: { ...(activeChar?.statsXP || createEmptyCharacter().statsXP), [stat]: newXP } });
                            }
                          }}
                          className="w-6 h-6 flex items-center justify-center bg-zinc-800 rounded hover:bg-zinc-700 text-zinc-400 transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        {/* Center Column: Proficiencies */}
        <div className="lg:col-span-4 space-y-6">
          <Section title="Proficiências" icon={<Shield size={18}/>} collapsible>
            <div className="grid grid-cols-1 gap-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {PROFICIENCIES.map(prof => {
                const bonus = calculateProficiencyBonus(stats, prof.name, prof.stats as (keyof Stats)[]);
                return (
                  <div key={prof.name} className="flex justify-between items-center p-2 hover:bg-zinc-800/50 rounded transition-colors border-b border-zinc-800/50 last:border-0">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{prof.name}</span>
                      <span className="text-[10px] text-zinc-500 uppercase">{prof.stats.join(' + ')}</span>
                    </div>
                    <div className={cn(
                      "w-8 h-8 flex items-center justify-center rounded-full border text-sm font-bold",
                      bonus > 0 ? "border-amber-500 text-amber-500 bg-amber-500/10" : "border-zinc-700 text-zinc-500"
                    )}>
                      +{bonus}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        {/* Right Column: Knowledge & Equipment */}
        <div className="lg:col-span-4 space-y-6">
          <Section title="Equipamentos" icon={<Package size={18}/>} collapsible>
             <div className="space-y-6">
               {/* Armas Section */}
               <div className="space-y-3">
                 <div className="flex justify-between items-center">
                   <h4 className="text-[10px] font-bold text-zinc-500 uppercase">Armas</h4>
                   <div className="flex items-center gap-2">
                     {clipboard?.type === 'Arma' && (
                       <button 
                         onClick={() => updateChar({ armas: [...(activeChar?.armas || []), { ...clipboard.data, id: crypto.randomUUID() }] })}
                         className="text-emerald-500 hover:text-emerald-400 flex items-center gap-1 text-[10px] font-bold uppercase"
                       >
                         <Plus size={12} /> Colar
                       </button>
                     )}
                     <button 
                       onClick={() => updateChar({ armas: [...(activeChar?.armas || []), { id: crypto.randomUUID(), nome: 'Nova Arma', dano: '0', acerto: 0, tipo: '', escala: 'C', atributoBase: 'FOR', peso: 0, volume: 0, durabilidade: 0, maxDurabilidade: 0, corte: 0, impacto: 0, perfuracao: 0, resistencia: 0 }] })}
                       className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                     >
                       <Plus size={16} />
                     </button>
                   </div>
                 </div>
                 <div className="space-y-3">
                   {armas.map((w, idx) => (
                     <div key={w.id} className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs relative group space-y-2">
                       <div className="flex justify-between items-center">
                         <input 
                          value={w.nome} 
                          onChange={e => {
                            const newArmas = [...armas];
                            newArmas[idx].nome = e.target.value;
                            updateChar({ armas: newArmas });
                          }}
                          className="bg-transparent font-bold focus:outline-none flex-1 text-amber-500"
                         />
                         <button 
                          onClick={() => updateChar({ armas: armas.filter(a => a.id !== w.id) })}
                          className="text-red-500 hover:text-red-400"
                         >
                           <Trash2 size={12} />
                         </button>
                       </div>
                       
                       <div className="grid grid-cols-3 gap-2">
                         <MiniInput label="Dano" value={w.dano} onChange={v => { const na = [...armas]; na[idx].dano = v; updateChar({ armas: na }); }} />
                         <MiniInput label="Acerto" value={w.acerto} type="number" onChange={v => { const na = [...armas]; na[idx].acerto = parseInt(v) || 0; updateChar({ armas: na }); }} />
                         <MiniInput label="Escala" value={w.escala} onChange={v => { const na = [...armas]; na[idx].escala = v as any; updateChar({ armas: na }); }} />
                       </div>

                       <div className="grid grid-cols-3 gap-2">
                         <MiniInput label="Corte" value={w.corte} type="number" onChange={v => { const na = [...armas]; na[idx].corte = parseInt(v) || 0; updateChar({ armas: na }); }} />
                         <MiniInput label="Impacto" value={w.impacto} type="number" onChange={v => { const na = [...armas]; na[idx].impacto = parseInt(v) || 0; updateChar({ armas: na }); }} />
                         <MiniInput label="Perf." value={w.perfuracao} type="number" onChange={v => { const na = [...armas]; na[idx].perfuracao = parseInt(v) || 0; updateChar({ armas: na }); }} />
                       </div>

                       <div className="grid grid-cols-4 gap-2">
                         <MiniInput label="Resist." value={w.resistencia} type="number" onChange={v => { const na = [...armas]; na[idx].resistencia = parseInt(v) || 0; updateChar({ armas: na }); }} />
                         <MiniInput label="Durab." value={w.durabilidade} type="number" onChange={v => { const na = [...armas]; na[idx].durabilidade = parseInt(v) || 0; updateChar({ armas: na }); }} />
                         <MiniInput label="Peso" value={w.peso} type="number" onChange={v => { const na = [...armas]; na[idx].peso = parseFloat(v) || 0; updateChar({ armas: na }); }} />
                         <MiniInput label="Vol" value={w.volume} type="number" onChange={v => { const na = [...armas]; na[idx].volume = parseFloat(v) || 0; updateChar({ armas: na }); }} />
                       </div>
                     </div>
                   ))}
                 </div>
               </div>

               {/* Armaduras Section */}
               <div className="space-y-3">
                 <div className="flex justify-between items-center">
                   <h4 className="text-[10px] font-bold text-zinc-500 uppercase">Armaduras</h4>
                   <div className="flex items-center gap-2">
                     {clipboard?.type === 'Armadura' && (
                       <button 
                         onClick={() => updateChar({ armaduras: [...(activeChar?.armaduras || []), { ...clipboard.data, id: crypto.randomUUID() }] })}
                         className="text-emerald-500 hover:text-emerald-400 flex items-center gap-1 text-[10px] font-bold uppercase"
                       >
                         <Plus size={12} /> Colar
                       </button>
                     )}
                     <button 
                       onClick={() => updateChar({ armaduras: [...(activeChar?.armaduras || []), { id: crypto.randomUUID(), nome: 'Nova Armadura', corte: 0, impacto: 0, perfuracao: 0, durabilidade: 0, peso: 0, volume: 0, reducaoDano: 0, efeito: '' }] })}
                       className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                     >
                       <Plus size={16} />
                     </button>
                   </div>
                 </div>
                 <div className="space-y-3">
                   {(activeChar?.armaduras || []).map((a, idx) => (
                     <div key={a.id} className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs relative group space-y-2">
                       <div className="flex justify-between items-center">
                         <input 
                          value={a.nome} 
                          onChange={e => {
                            const newArms = [...(activeChar?.armaduras || [])];
                            newArms[idx].nome = e.target.value;
                            updateChar({ armaduras: newArms });
                          }}
                          className="bg-transparent font-bold focus:outline-none flex-1 text-amber-500"
                         />
                         <button 
                          onClick={() => updateChar({ armaduras: (activeChar?.armaduras || []).filter(arm => arm.id !== a.id) })}
                          className="text-red-500 hover:text-red-400"
                         >
                           <Trash2 size={12} />
                         </button>
                       </div>
                       
                       <div className="grid grid-cols-3 gap-2">
                         <MiniInput label="Corte" value={a.corte} type="number" onChange={v => { const na = [...(activeChar?.armaduras || [])]; na[idx].corte = parseInt(v) || 0; updateChar({ armaduras: na }); }} />
                         <MiniInput label="Impacto" value={a.impacto} type="number" onChange={v => { const na = [...(activeChar?.armaduras || [])]; na[idx].impacto = parseInt(v) || 0; updateChar({ armaduras: na }); }} />
                         <MiniInput label="Perf." value={a.perfuracao} type="number" onChange={v => { const na = [...(activeChar?.armaduras || [])]; na[idx].perfuracao = parseInt(v) || 0; updateChar({ armaduras: na }); }} />
                       </div>

                       <div className="grid grid-cols-4 gap-2">
                         <MiniInput label="Durab." value={a.durabilidade} type="number" onChange={v => { const na = [...(activeChar?.armaduras || [])]; na[idx].durabilidade = parseInt(v) || 0; updateChar({ armaduras: na }); }} />
                         <MiniInput label="Peso" value={a.peso} type="number" onChange={v => { const na = [...(activeChar?.armaduras || [])]; na[idx].peso = parseFloat(v) || 0; updateChar({ armaduras: na }); }} />
                         <MiniInput label="Vol" value={a.volume} type="number" onChange={v => { const na = [...(activeChar?.armaduras || [])]; na[idx].volume = parseFloat(v) || 0; updateChar({ armaduras: na }); }} />
                         <MiniInput label="Redução de Dano" value={a.reducaoDano} type="number" onChange={v => { const na = [...(activeChar?.armaduras || [])]; na[idx].reducaoDano = parseInt(v) || 0; updateChar({ armaduras: na }); }} />
                       </div>

                       <TextArea label="Efeito" value={a.efeito} onChange={v => { const na = [...(activeChar?.armaduras || [])]; na[idx].efeito = v; updateChar({ armaduras: na }); }} />
                     </div>
                   ))}
                 </div>
               </div>
             </div>
           </Section>
           <Section title="Compartimentos" icon={<Backpack size={18}/>} collapsible defaultCollapsed>
             <div className="space-y-4">
               <div className="flex justify-between items-center">
                 <h4 className="text-[10px] font-bold text-zinc-500 uppercase">Compartimentos</h4>
                 <button 
                  onClick={() => updateChar({ compartimentos: [...(activeChar?.compartimentos || []), { id: crypto.randomUUID(), nome: 'Novo Compartimento', volumeMax: 0, itens: [] }] })}
                  className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                 >
                   <Plus size={16} />
                 </button>
               </div>
               
               <div className="space-y-4">
                 {compartimentos.map((comp, cIdx) => {
                   const compVolume = (comp.itens || []).reduce((acc, i) => acc + ((i.volume || 0) * (i.quantidade || 0)), 0);
                   return (
                     <div key={comp.id} className="bg-zinc-900/50 rounded-lg border border-zinc-800 overflow-hidden">
                       <div className="bg-zinc-800/50 px-3 py-2 flex justify-between items-center border-b border-zinc-800">
                         <div className="flex-1 mr-2">
                           <input 
                            value={comp.nome} 
                            onChange={e => {
                              const nc = [...compartimentos];
                              nc[cIdx].nome = e.target.value;
                              updateChar({ compartimentos: nc });
                            }}
                            className="bg-transparent text-sm font-bold focus:outline-none w-full"
                           />
                         </div>
                         <div className="flex items-center gap-2">
                           <div className="flex items-center gap-1">
                             <span className="text-[10px] text-zinc-500 font-bold">MAX:</span>
                             <input 
                               type="number" 
                               value={comp.volumeMax} 
                               onChange={e => {
                                 const nc = [...compartimentos];
                                 nc[cIdx].volumeMax = parseInt(e.target.value) || 0;
                                 updateChar({ compartimentos: nc });
                               }}
                               className="w-12 bg-transparent text-right text-sm focus:outline-none text-amber-500 font-bold"
                             />
                           </div>
                           <button 
                            onClick={() => updateChar({ compartimentos: compartimentos.filter(c => c.id !== comp.id) })}
                            className="text-red-500 hover:text-red-400"
                           >
                             <Trash2 size={14} />
                           </button>
                         </div>
                       </div>

                       <div className="p-2 space-y-2">
                         <div className="flex justify-between text-xs mb-1 font-bold">
                           <span className="text-zinc-500 uppercase">VOLUME OCUPADO</span>
                           <span className={cn(compVolume > comp.volumeMax ? "text-red-400" : "text-zinc-400")}>
                             {compVolume.toFixed(1)} / {comp.volumeMax}
                           </span>
                         </div>
                         
                         {(comp.itens || []).map((item, iIdx) => (
                           <div key={item.id} className="bg-zinc-900 p-2 rounded border border-zinc-800 group relative space-y-2">
                             <div className="flex justify-between items-center mb-1">
                               <input 
                                value={item.nome} 
                                onChange={e => {
                                  const nc = [...compartimentos];
                                  nc[cIdx].itens[iIdx].nome = e.target.value;
                                  updateChar({ compartimentos: nc });
                                }}
                                className="bg-transparent text-sm font-bold focus:outline-none flex-1 text-amber-500"
                               />
                               <div className="flex items-center gap-2">
                                 <button 
                                   onClick={() => copyToClipboard('Item', item)}
                                   className="text-zinc-500 hover:text-zinc-300"
                                   title="Copiar Item"
                                 >
                                   <Copy size={12} />
                                 </button>
                                 <button 
                                  onClick={() => {
                                    const nc = [...compartimentos];
                                    nc[cIdx].itens = nc[cIdx].itens.filter(it => it.id !== item.id);
                                    updateChar({ compartimentos: nc });
                                  }}
                                  className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                 >
                                   <Trash2 size={14} />
                                 </button>
                               </div>
                             </div>
                             
                             <div className="grid grid-cols-4 gap-2">
                               <MiniInput label="Qtd" type="number" value={item.quantidade} onChange={v => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].quantidade = parseInt(v) || 1; updateChar({ compartimentos: nc }); }} />
                               <MiniInput label="Kg" type="number" value={item.peso} onChange={v => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].peso = parseFloat(v) || 0; updateChar({ compartimentos: nc }); }} />
                               <MiniInput label="Vol" type="number" value={item.volume} onChange={v => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].volume = parseFloat(v) || 0; updateChar({ compartimentos: nc }); }} />
                               <div className="flex flex-col">
                                 <span className="text-[10px] text-zinc-600 uppercase tracking-tighter font-bold">Total</span>
                                 <span className="text-xs font-bold text-zinc-400">{(item.peso * item.quantidade).toFixed(1)}kg</span>
                               </div>
                             </div>

                             {item.tipo === 'Arma' && (
                               <>
                                 <div className="grid grid-cols-3 gap-2">
                                   <MiniInput label="Dano" value={item.dano || '0'} onChange={v => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].dano = v; updateChar({ compartimentos: nc }); }} />
                                   <MiniInput label="Acerto" value={item.acerto || 0} type="number" onChange={v => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].acerto = parseInt(v) || 0; updateChar({ compartimentos: nc }); }} />
                                   <MiniInput label="Escala" value={item.escala || 'C'} onChange={v => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].escala = v; updateChar({ compartimentos: nc }); }} />
                                 </div>
                                 <div className="grid grid-cols-3 gap-2">
                                   <MiniInput label="Corte" value={item.corte || 0} type="number" onChange={v => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].corte = parseInt(v) || 0; updateChar({ compartimentos: nc }); }} />
                                   <MiniInput label="Impacto" value={item.impacto || 0} type="number" onChange={v => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].impacto = parseInt(v) || 0; updateChar({ compartimentos: nc }); }} />
                                   <MiniInput label="Perf." value={item.perfuracao || 0} type="number" onChange={v => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].perfuracao = parseInt(v) || 0; updateChar({ compartimentos: nc }); }} />
                                 </div>
                                 <div className="grid grid-cols-2 gap-2">
                                   <MiniInput label="Resist." value={item.resistencia || 0} type="number" onChange={v => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].resistencia = parseInt(v) || 0; updateChar({ compartimentos: nc }); }} />
                                   <MiniInput label="Atrib. Base" value={item.atributoBase || 'FOR'} onChange={v => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].atributoBase = v; updateChar({ compartimentos: nc }); }} />
                                 </div>
                               </>
                             )}

                             {item.tipo === 'Armadura' && (
                               <>
                                 <div className="grid grid-cols-3 gap-2">
                                   <MiniInput label="Corte" value={item.corte || 0} type="number" onChange={v => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].corte = parseInt(v) || 0; updateChar({ compartimentos: nc }); }} />
                                   <MiniInput label="Impacto" value={item.impacto || 0} type="number" onChange={v => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].impacto = parseInt(v) || 0; updateChar({ compartimentos: nc }); }} />
                                   <MiniInput label="Perf." value={item.perfuracao || 0} type="number" onChange={v => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].perfuracao = parseInt(v) || 0; updateChar({ compartimentos: nc }); }} />
                                 </div>
                                 <div className="grid grid-cols-1 gap-2">
                                   <MiniInput label="Redução de Dano" value={item.reducaoDano || 0} type="number" onChange={v => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].reducaoDano = parseInt(v) || 0; updateChar({ compartimentos: nc }); }} />
                                   <TextArea label="Efeito" value={item.efeito || ''} onChange={v => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].efeito = v; updateChar({ compartimentos: nc }); }} />
                                 </div>
                               </>
                             )}

                             <TextArea label="Descrição" value={item.descricao || ''} onChange={v => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].descricao = v; updateChar({ compartimentos: nc }); }} />
                           </div>
                         ))}
                         
                         <div className="flex gap-2">
                           <button 
                            onClick={() => {
                              const nc = [...compartimentos];
                              nc[cIdx].itens.push({ id: crypto.randomUUID(), nome: 'Novo Item', peso: 0, volume: 0, quantidade: 0, tipo: 'Geral', durabilidade: 0, maxDurabilidade: 0, descricao: '' });
                              updateChar({ compartimentos: nc });
                            }}
                            className="flex-1 py-2 border border-dashed border-zinc-700 rounded text-[10px] font-bold uppercase text-zinc-500 hover:border-amber-500/50 hover:text-amber-500 transition-all"
                           >
                             + Item
                           </button>
                           <button 
                            onClick={() => {
                              const nc = [...compartimentos];
                              nc[cIdx].itens.push({ id: crypto.randomUUID(), nome: 'Nova Arma', peso: 0, volume: 0, quantidade: 0, tipo: 'Arma', durabilidade: 0, maxDurabilidade: 0, descricao: '', dano: '0', acerto: 0, escala: 'C', atributoBase: 'FOR', corte: 0, impacto: 0, perfuracao: 0, resistencia: 0 });
                              updateChar({ compartimentos: nc });
                            }}
                            className="flex-1 py-2 border border-dashed border-zinc-700 rounded text-[10px] font-bold uppercase text-zinc-500 hover:border-amber-500/50 hover:text-amber-500 transition-all"
                           >
                             + Arma
                           </button>
                           <button 
                            onClick={() => {
                              const nc = [...compartimentos];
                              nc[cIdx].itens.push({ id: crypto.randomUUID(), nome: 'Nova Armadura', peso: 0, volume: 0, quantidade: 0, tipo: 'Armadura', durabilidade: 0, maxDurabilidade: 0, descricao: '', corte: 0, impacto: 0, perfuracao: 0, reducaoDano: 0, efeito: '' });
                              updateChar({ compartimentos: nc });
                            }}
                            className="flex-1 py-2 border border-dashed border-zinc-700 rounded text-[10px] font-bold uppercase text-zinc-500 hover:border-amber-500/50 hover:text-amber-500 transition-all"
                           >
                             + Armadura
                           </button>
                         </div>
                         {clipboard && (
                           <button 
                             onClick={() => {
                               const nc = [...compartimentos];
                               nc[cIdx].itens.push({ ...clipboard.data, id: crypto.randomUUID() });
                               updateChar({ compartimentos: nc });
                             }}
                             className="w-full py-2 bg-emerald-500/10 border border-dashed border-emerald-500/50 rounded text-[10px] font-bold uppercase text-emerald-500 hover:bg-emerald-500/20 transition-all"
                           >
                             Colar {clipboard.type}
                           </button>
                         )}
                       </div>
                     </div>
                   );
                 })}
               </div>
             </div>
          </Section>

          <Section title="Magias" icon={<Zap size={18}/>} collapsible defaultCollapsed>
             <div className="space-y-3">
               <div className="flex justify-between items-center">
                 <h4 className="text-[10px] font-bold text-zinc-500 uppercase">Magias</h4>
                 <div className="flex items-center gap-2">
                   {clipboard?.type === 'Magia' && (
                     <button 
                       onClick={() => updateChar({ magias: [...(activeChar?.magias || []), { ...clipboard.data, id: crypto.randomUUID() }] })}
                       className="text-emerald-500 hover:text-emerald-400 flex items-center gap-1 text-[10px] font-bold uppercase"
                     >
                       <Plus size={12} /> Colar
                     </button>
                   )}
                   <button 
                    onClick={() => updateChar({ magias: [...(activeChar?.magias || []), { id: crypto.randomUUID(), nome: 'Nova Magia', efeito: '', dano: '0', mana: 0, acerto: 0 }] })}
                    className="text-amber-500 hover:text-amber-400"
                   >
                     <Plus size={14} />
                   </button>
                 </div>
               </div>
               <div className="space-y-3">
                 {(activeChar?.magias || []).map((m, idx) => (
                   <div key={m.id} className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs relative group space-y-2">
                     <div className="flex justify-between items-center">
                       <input 
                        value={m.nome} 
                        onChange={e => {
                          const newMags = [...(activeChar?.magias || [])];
                          newMags[idx].nome = e.target.value;
                          updateChar({ magias: newMags });
                        }}
                        className="bg-transparent font-bold focus:outline-none flex-1 text-amber-500"
                       />
                       <button 
                        onClick={() => updateChar({ magias: (activeChar?.magias || []).filter(mag => mag.id !== m.id) })}
                        className="text-red-500 hover:text-red-400"
                       >
                         <Trash2 size={12} />
                       </button>
                     </div>
                     
                     <div className="grid grid-cols-3 gap-2">
                       <MiniInput label="Dano" value={m.dano} onChange={v => { const na = [...(activeChar?.magias || [])]; na[idx].dano = v; updateChar({ magias: na }); }} />
                       <MiniInput label="Mana" value={m.mana} type="number" onChange={v => { const na = [...(activeChar?.magias || [])]; na[idx].mana = parseInt(v) || 0; updateChar({ magias: na }); }} />
                       <MiniInput label="Acerto" value={m.acerto} type="number" onChange={v => { const na = [...(activeChar?.magias || [])]; na[idx].acerto = parseInt(v) || 0; updateChar({ magias: na }); }} />
                     </div>

                     <TextArea label="Efeito" value={m.efeito} onChange={v => { const na = [...(activeChar?.magias || [])]; na[idx].efeito = v; updateChar({ magias: na }); }} />
                   </div>
                 ))}
               </div>
             </div>
          </Section>

          <Section title="Habilidades" icon={<Activity size={18}/>} collapsible defaultCollapsed>
             <div className="space-y-3">
               <div className="flex justify-between items-center">
                 <h4 className="text-[10px] font-bold text-zinc-500 uppercase">Habilidades</h4>
                 <button 
                  onClick={() => updateChar({ habilidades: [...(activeChar?.habilidades || []), { id: crypto.randomUUID(), nome: 'Nova Habilidade', efeito: '' }] })}
                  className="text-amber-500 hover:text-amber-400"
                 >
                   <Plus size={14} />
                 </button>
               </div>
               <div className="space-y-3">
                 {(activeChar?.habilidades || []).map((h, idx) => (
                   <div key={h.id} className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs relative group space-y-2">
                     <div className="flex justify-between items-center">
                       <input 
                        value={h.nome} 
                        onChange={e => {
                          const newHabs = [...(activeChar?.habilidades || [])];
                          newHabs[idx].nome = e.target.value;
                          updateChar({ habilidades: newHabs });
                        }}
                        className="bg-transparent font-bold focus:outline-none flex-1 text-amber-500"
                       />
                       <button 
                        onClick={() => updateChar({ habilidades: (activeChar?.habilidades || []).filter(hab => hab.id !== h.id) })}
                        className="text-red-500 hover:text-red-400"
                       >
                         <Trash2 size={12} />
                       </button>
                     </div>
                     
                     <TextArea label="Efeito" value={h.efeito} onChange={v => { const na = [...(activeChar?.habilidades || [])]; na[idx].efeito = v; updateChar({ habilidades: na }); }} />
                   </div>
                 ))}
               </div>
             </div>
          </Section>
          <Section title="Conhecimentos" icon={<BookOpen size={18}/>} collapsible defaultCollapsed>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {(activeChar?.conhecimentos || []).map((k, idx) => (
                <div key={k.name} className="bg-zinc-900/50 p-2 rounded border border-zinc-800/50">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold uppercase tracking-tighter">{k.name}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-zinc-500">NV</span>
                      <input 
                        type="number" 
                        value={k.nivel} 
                        onChange={e => {
                          const newKs = [...(activeChar?.conhecimentos || [])];
                          newKs[idx].nivel = parseInt(e.target.value) || 0;
                          updateChar({ conhecimentos: newKs });
                        }}
                        className="w-6 bg-transparent text-amber-500 text-[10px] font-bold focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-500 transition-all" 
                        style={{ width: `${(k.xp / getXpToNextLevel(k.nivel)) * 100}%` }}
                      />
                    </div>
                    <input 
                      type="number" 
                      value={k.xp} 
                      onChange={e => {
                        const newXp = parseInt(e.target.value) || 0;
                        const nextXp = getXpToNextLevel(k.nivel);
                        let updatedK = { ...k, xp: newXp };
                        if (newXp >= nextXp) {
                          updatedK.nivel += 1;
                          updatedK.xp = 0;
                        }
                        const newKs = [...(activeChar?.conhecimentos || [])];
                        newKs[idx] = updatedK;
                        updateChar({ conhecimentos: newKs });
                      }}
                      className="w-8 bg-transparent text-right text-[10px] focus:outline-none"
                    />
                    <span className="text-[10px] text-zinc-600">/ {getXpToNextLevel(k.nivel)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }
      `}</style>
    </div>
  );
}

function Section({ title, icon, children, collapsible = false, defaultCollapsed = false }: { title: string, icon: React.ReactNode, children: React.ReactNode, collapsible?: boolean, defaultCollapsed?: boolean }) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  return (
    <div className="bg-zinc-900/30 border-y sm:border border-zinc-800 sm:rounded-xl overflow-hidden -mx-4 sm:mx-0">
      <div 
        className={cn("px-4 py-3 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50", collapsible && "cursor-pointer hover:bg-zinc-800/50")}
        onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-500">{icon}</span>
          <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-300">{title}</h3>
        </div>
        {collapsible && (isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />)}
      </div>
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Input({ label, value, onChange, className }: { label: string, value: string, onChange: (v: string) => void, className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">{label}</label>
      <textarea 
        value={value} 
        onChange={e => onChange(e.target.value)}
        rows={1}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 transition-all break-words whitespace-normal resize-none overflow-hidden min-h-[38px]"
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = 'auto';
          target.style.height = `${target.scrollHeight}px`;
        }}
      />
    </div>
  );
}

function TextArea({ label, value, onChange, className }: { label: string, value: string, onChange: (v: string) => void, className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">{label}</label>
      <textarea 
        value={value} 
        onChange={e => onChange(e.target.value)}
        rows={2}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 transition-all break-words whitespace-normal resize-none"
      />
    </div>
  );
}

function ProgressBar({ label, current, max, color, onChange }: { label: string, current: number, max: number, color: string, onChange: (v: number) => void }) {
  const percent = Math.min(100, (current / max) * 100);
  return (
    <div>
      <div className="flex justify-between items-end mb-1.5">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{label}</span>
        <div className="flex items-center gap-1">
          <input 
            type="number" 
            value={current} 
            onChange={e => onChange(parseInt(e.target.value) || 0)}
            className="w-12 bg-transparent text-right font-bold text-sm focus:outline-none"
          />
          <span className="text-xs text-zinc-600">/ {max}</span>
        </div>
      </div>
      <div className="h-3 bg-zinc-800 rounded-full p-0.5 border border-zinc-700/50">
        <motion.div 
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function MiniBar({ label, value, max = 100, color, onChange }: { label: string, value: number, max?: number, color: string, onChange: (v: number) => void }) {
  const percent = Math.min(100, (value / max) * 100);
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 p-2 rounded-lg">
      <div className="text-[9px] text-zinc-500 font-bold uppercase mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <input 
          type="number" 
          value={value} 
          onChange={e => onChange(parseInt(e.target.value) || 0)}
          className="w-full bg-transparent text-xs font-bold focus:outline-none"
        />
      </div>
      <div className="h-1 bg-zinc-800 rounded-full mt-1 overflow-hidden">
        <div className={cn("h-full", color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function MiniInput({ label, value, type = "text", onChange }: { label: string, value: any, type?: string, onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter mb-0.5">{label}</span>
      {type === "text" ? (
        <textarea 
          value={value} 
          onChange={e => onChange(e.target.value)}
          rows={1}
          className="bg-transparent text-sm font-bold focus:outline-none border-b border-zinc-800 focus:border-amber-500/50 break-words whitespace-normal resize-none overflow-hidden min-h-[20px]"
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${target.scrollHeight}px`;
          }}
        />
      ) : (
        <input 
          type={type} 
          value={value} 
          onChange={e => onChange(e.target.value)}
          className="bg-transparent text-sm font-bold focus:outline-none border-b border-zinc-800 focus:border-amber-500/50"
        />
      )}
    </div>
  );
}
