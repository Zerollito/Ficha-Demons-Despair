import React, { useState } from 'react';
import { 
  Plus, Trash2, Save, Download, Upload, Copy, 
  Shield, Sword, Backpack, BookOpen, Activity, Coins, User, MapPin, 
  Thermometer, Utensils, Droplets, Battery, Weight, Package, Gem, Zap,
  MoreVertical, ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Character, AppState, ArmorPiece } from '../types';
import { Stats, PROFICIENCIES, calculateProficiencyBonus } from '../rules/proficiencyRules';
import { getXpToNextLevel } from '../rules/knowledgeRules';
import { getStatBonus } from '../rules/combatRules';
import { cn } from '../lib/utils';
import { handleImageUpload, exportJSON, importJSON } from '../lib/fileUtils';
import { exportPDF } from '../lib/pdfExport';

import { Section } from './ui/Section';
import { SubSection } from './ui/SubSection';
import { Input, TextArea } from './ui/Input';
import { ProgressBar } from './ui/ProgressBar';
import { MiniBar } from './ui/MiniBar';
import { NumericInput } from './ui/NumericInput';
import { MiniInput } from './ui/MiniInput';
import { WeaponProperties } from './ui/WeaponProperties';
import { ArmorProperties } from './ui/ArmorProperties';

interface CharacterSheetProps {
  activeChar: Character;
  updateChar: (updates: Partial<Character>) => void;
  stats: Stats;
  vidaMax: number;
  manaMax: number;
  cargaMax: number;
  pesoTotal: number;
  volumeTotal: number;
  penalties: any;
  deslocamentoFinal: number;
  addCharacter: () => void;
  deleteCharacter: () => void;
  copyCharacter: () => void;
  copyToClipboard: (item: any) => void;
  clipboard: any;
  setClipboard: (v: any) => void;
  state: AppState;
  setState: (v: AppState) => void;
}

export function CharacterSheet({
  activeChar, updateChar, stats, vidaMax, manaMax, cargaMax,
  pesoTotal, volumeTotal, penalties, deslocamentoFinal,
  addCharacter, deleteCharacter, copyCharacter,
  copyToClipboard, clipboard, setClipboard,
  state, setState
}: CharacterSheetProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-amber-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20">
            <User size={20} className="text-zinc-950" />
          </div>
        </div>

        <div className="flex items-center gap-2 relative group/menu">
          <button className="w-10 h-10 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-full transition-all border border-zinc-700 shadow-lg">
            <MoreVertical size={20} className="text-amber-500" />
          </button>
          
          <div className="absolute right-0 top-full mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all duration-200 z-[60] p-2 space-y-1">
            <div className="px-3 py-2 border-b border-zinc-800 mb-1">
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Escolha de Ficha</label>
              <select 
                value={state.activeCharacterId || ''} 
                onChange={e => setState({ ...state, activeCharacterId: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 truncate"
              >
                {state.characters.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={addCharacter}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium text-zinc-300"
            >
              <Plus size={18} className="text-amber-500" /> Adicionar Nova Ficha
            </button>

            <button 
              onClick={copyCharacter}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium text-zinc-300"
            >
              <Copy size={18} className="text-amber-500" /> Copiar Ficha
            </button>

            <button 
              onClick={() => exportJSON(state)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium text-zinc-300"
            >
              <Download size={18} className="text-amber-500" /> Exportar JSON
            </button>

            <label className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium text-zinc-300 cursor-pointer">
              <Upload size={18} className="text-amber-500" /> Importar JSON
              <input type="file" className="hidden" onChange={e => importJSON(e, setState)} accept=".json" />
            </label>

            <button 
              onClick={() => exportPDF(activeChar)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium text-zinc-300"
            >
              <Activity size={18} className="text-amber-500" /> Exportar PDF
            </button>

            <div className="pt-1 border-t border-zinc-800 mt-1">
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-red-500/10 rounded-lg transition-colors text-sm font-medium text-red-400"
              >
                <Trash2 size={18} /> Excluir Ficha Atual
              </button>
            </div>
          </div>
        </div>
      </header>

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
                  onClick={() => {
                    deleteCharacter();
                    setShowDeleteConfirm(false);
                  }}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors text-sm font-medium"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main key={activeChar.id} className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
        {/* Left Column: Basic Info & Stats */}
        <div className="lg:col-span-4 space-y-6">
          <Section title="Personagem" icon={<User size={18}/>} collapsible>
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
                    <input type="file" className="hidden" onChange={e => handleImageUpload(e, img => updateChar({ imagem: img }))} accept="image/*" />
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
                      <NumericInput 
                        value={activeChar.dinheiro?.[coin] || 0} 
                        onChange={v => updateChar({ dinheiro: { ...(activeChar.dinheiro || {C:0,B:0,P:0,O:0}), [coin]: v } })}
                        className="w-full"
                        size="sm"
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

          <Section title="Vitais" icon={<Activity size={18}/>} collapsible defaultCollapsed={true}>
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
                    {(pesoTotal || 0).toFixed(1)} / {cargaMax} kg
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

          <Section title="Bônus de Dano" icon={<Sword size={18}/>} collapsible defaultCollapsed={true}>
            <div className="grid grid-cols-2 gap-3">
              {['FOR', 'DEX', 'INT', 'RIT'].map(stat => (
                <div key={stat} className="flex justify-between items-center bg-zinc-900/50 p-2 rounded border border-zinc-800">
                  <span className="text-xs text-zinc-400">{stat}</span>
                  <span className="font-bold text-amber-500">+{getStatBonus(stats[stat as keyof Stats])}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Defesa por Membro" icon={<Shield size={18}/>} collapsible defaultCollapsed={true}>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(activeChar?.defesa || { Cabeça: 0, Torso: 0, Braços: 0, Pernas: 0 }).map(([part, val]) => (
                <div key={part} className="bg-zinc-900 border border-zinc-800 p-2 rounded flex justify-between items-center">
                  <span className="text-xs text-zinc-400">{part}</span>
                  <NumericInput 
                    value={val} 
                    onChange={v => updateChar({ defesa: { ...(activeChar?.defesa || { Cabeça: 0, Torso: 0, Braços: 0, Pernas: 0 }), [part]: v } })}
                    className="w-16"
                    size="sm"
                  />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Status" icon={<Zap size={18}/>} collapsible defaultCollapsed={true}>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(stats) as (keyof Stats)[]).map(stat => {
                const statVal = stats[stat];
                const xpLimit = 5 + (Math.floor(statVal / 15) * 5);
                const currentXP = activeChar?.statsXP?.[stat] || 0;

                return (
                  <div key={stat} className="bg-zinc-900 border border-zinc-800 p-2 rounded-lg text-center group relative">
                    <div className="text-[10px] text-zinc-500 font-bold mb-1">{stat}</div>
                    <NumericInput 
                      value={statVal} 
                      onChange={v => updateChar({ stats: { ...stats, [stat]: v } })}
                      className="w-full"
                      size="lg"
                    />
                    <div className="flex flex-col items-center mt-2">
                      <span className="text-[10px] text-zinc-600 font-bold uppercase mb-1">XP (Máx {xpLimit})</span>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => updateChar({ statsXP: { ...activeChar.statsXP, [stat]: Math.max(0, currentXP - 1) } })}
                          className="w-6 h-6 flex items-center justify-center bg-zinc-800 rounded hover:bg-zinc-700 text-zinc-400 transition-colors"
                        >-</button>
                        <NumericInput 
                          value={currentXP} 
                          onChange={v => updateChar({ statsXP: { ...activeChar.statsXP, [stat]: v } })}
                          className="w-16"
                          size="sm"
                        />
                        <button 
                          onClick={() => {
                            const nextXP = currentXP + 1;
                            if (nextXP >= xpLimit) {
                              updateChar({ 
                                stats: { ...stats, [stat]: statVal + 1 },
                                statsXP: { ...activeChar.statsXP, [stat]: 0 }
                              });
                            } else {
                              updateChar({ statsXP: { ...activeChar.statsXP, [stat]: nextXP } });
                            }
                          }}
                          className="w-6 h-6 flex items-center justify-center bg-zinc-800 rounded hover:bg-zinc-700 text-zinc-400 transition-colors"
                        >+</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        {/* Middle Column: Proficiencies & Equipment */}
        <div className="lg:col-span-4 space-y-6">
          <Section title="Proficiências" icon={<MapPin size={18}/>} collapsible defaultCollapsed={true}>
            <div className="grid grid-cols-1 gap-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {PROFICIENCIES.map(prof => (
                <div key={prof.name} className="flex justify-between items-center p-2 hover:bg-zinc-800/50 rounded transition-colors border-b border-zinc-800/50 last:border-0">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{prof.name}</span>
                    <span className="text-[10px] text-zinc-500 uppercase">{prof.stats.join(' + ')}</span>
                  </div>
                  <div className={cn(
                    "w-8 h-8 rounded flex items-center justify-center font-bold text-sm",
                    calculateProficiencyBonus(stats, prof.name, prof.stats as (keyof Stats)[]) >= 0 ? "bg-amber-500/10 text-amber-500" : "bg-red-500/10 text-red-500"
                  )}>
                    {calculateProficiencyBonus(stats, prof.name, prof.stats as (keyof Stats)[])}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Equipamentos" icon={<Sword size={18}/>} collapsible defaultCollapsed={true}>
             <div className="space-y-6">
               <SubSection title="Armas" icon={<Sword size={14} />} defaultCollapsed={true}>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase">Armas</h4>
                    <button 
                      onClick={() => {
                        if (clipboard?.type === 'weapon') {
                          updateChar({ armas: [...activeChar.armas, { ...clipboard.data, id: crypto.randomUUID() }] });
                          setClipboard(null);
                        }
                      }}
                      disabled={clipboard?.type !== 'weapon'}
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors disabled:opacity-30"
                    >
                      <Save size={14} />
                    </button>
                  </div>
                  <button 
                    onClick={() => updateChar({ armas: [...activeChar.armas, { id: crypto.randomUUID(), nome: 'Nova Arma', dano: '1d6', acerto: 0, escala: 'C', peso: 0, volume: 0, resistencia: 0, durabilidade: 0, maxDurabilidade: 0, corte: 0, impacto: 0, perfuracao: 0, tipo: 'Arma', atributoBase: 'FOR' }] })}
                    className="w-full py-2 mb-2 bg-emerald-500/10 border border-dashed border-emerald-500/50 rounded text-[10px] font-bold uppercase text-emerald-500 hover:bg-emerald-500/20 transition-all"
                  >
                    + Nova Arma
                  </button>
                 <div className="space-y-3">
                   {activeChar.armas.map((w, idx) => (
                     <div key={w.id} className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs relative group space-y-2">
                       <div className="flex justify-between items-center">
                         <input 
                          value={w.nome} 
                          onChange={e => { const na = [...activeChar.armas]; na[idx].nome = e.target.value; updateChar({ armas: na }); }}
                          className="bg-transparent font-bold focus:outline-none flex-1 text-amber-500"
                         />
                         <div className="flex items-center gap-2">
                           <button 
                             onClick={() => copyToClipboard({ type: 'weapon', data: w })}
                             className="text-zinc-500 hover:text-zinc-300 p-1"
                           >
                             <Copy size={16} />
                           </button>
                           <button 
                            onClick={() => updateChar({ armas: activeChar.armas.filter(item => item.id !== w.id) })}
                            className="text-red-500 hover:text-red-400 p-1"
                           >
                             <Trash2 size={16} />
                           </button>
                         </div>
                       </div>
                       <WeaponProperties item={w} onChange={updates => { const na = [...activeChar.armas]; na[idx] = { ...na[idx], ...updates }; updateChar({ armas: na }); }} />
                     </div>
                   ))}
                 </div>
               </SubSection>

               <SubSection title="Armaduras" icon={<Shield size={14} />} defaultCollapsed={true}>
                   <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase">Armaduras</h4>
                    <button 
                      onClick={() => {
                        if (clipboard?.type === 'armor') {
                          updateChar({ armaduras: [...activeChar.armaduras, { ...clipboard.data, id: crypto.randomUUID() }] });
                          setClipboard(null);
                        }
                      }}
                      disabled={clipboard?.type !== 'armor'}
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors disabled:opacity-30"
                    >
                      <Save size={14} />
                    </button>
                  </div>
                  <button 
                    onClick={() => updateChar({ armaduras: [...activeChar.armaduras, { id: crypto.randomUUID(), nome: 'Nova Armadura', peso: 0, volume: 0, durabilidade: 0, corte: 0, impacto: 0, perfuracao: 0, reducaoDano: 0, efeito: '' }] })}
                    className="w-full py-2 mb-2 bg-emerald-500/10 border border-dashed border-emerald-500/50 rounded text-[10px] font-bold uppercase text-emerald-500 hover:bg-emerald-500/20 transition-all"
                  >
                    + Nova Armadura
                  </button>
                 <div className="space-y-3">
                   {activeChar.armaduras.map((a, idx) => (
                     <div key={a.id} className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs relative group space-y-2">
                       <div className="flex justify-between items-center">
                         <input 
                          value={a.nome} 
                          onChange={e => { const na = [...activeChar.armaduras]; na[idx].nome = e.target.value; updateChar({ armaduras: na }); }}
                          className="bg-transparent font-bold focus:outline-none flex-1 text-amber-500"
                         />
                         <div className="flex items-center gap-2">
                           <button 
                             onClick={() => copyToClipboard({ type: 'armor', data: a })}
                             className="text-zinc-500 hover:text-zinc-300 p-1"
                           >
                             <Copy size={16} />
                           </button>
                           <button 
                            onClick={() => updateChar({ armaduras: activeChar.armaduras.filter(item => item.id !== a.id) })}
                            className="text-red-500 hover:text-red-400 p-1"
                           >
                             <Trash2 size={16} />
                           </button>
                         </div>
                       </div>
                       <ArmorProperties item={a} onChange={updates => { const na = [...activeChar.armaduras]; na[idx] = { ...na[idx], ...updates }; updateChar({ armaduras: na }); }} />
                     </div>
                   ))}
                 </div>
               </SubSection>

               <SubSection title="Acessórios" icon={<Gem size={14} />} defaultCollapsed={true}>
                   <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase">Acessórios</h4>
                    <button 
                      onClick={() => {
                        if (clipboard?.type === 'accessory') {
                          updateChar({ acessorios: [...activeChar.acessorios, { ...clipboard.data, id: crypto.randomUUID() }] });
                          setClipboard(null);
                        }
                      }}
                      disabled={clipboard?.type !== 'accessory'}
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors disabled:opacity-30"
                    >
                      <Save size={14} />
                    </button>
                  </div>
                  <button 
                    onClick={() => updateChar({ acessorios: [...activeChar.acessorios, { id: crypto.randomUUID(), nome: 'Novo Acessório', peso: 0, volume: 0, durabilidade: 0, corte: 0, impacto: 0, perfuracao: 0, reducaoDano: 0, efeito: '' }] })}
                    className="w-full py-2 mb-2 bg-emerald-500/10 border border-dashed border-emerald-500/50 rounded text-[10px] font-bold uppercase text-emerald-500 hover:bg-emerald-500/20 transition-all"
                  >
                    + Novo Acessório
                  </button>
                 <div className="space-y-3">
                   {activeChar.acessorios.map((a, idx) => (
                     <div key={a.id} className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs relative group space-y-2">
                       <div className="flex justify-between items-center">
                         <input 
                          value={a.nome} 
                          onChange={e => { const na = [...activeChar.acessorios]; na[idx].nome = e.target.value; updateChar({ acessorios: na }); }}
                          className="bg-transparent font-bold focus:outline-none flex-1 text-amber-500"
                         />
                         <div className="flex items-center gap-2">
                           <button 
                             onClick={() => copyToClipboard({ type: 'accessory', data: a })}
                             className="text-zinc-500 hover:text-zinc-300 p-1"
                           >
                             <Copy size={16} />
                           </button>
                           <button 
                            onClick={() => updateChar({ acessorios: activeChar.acessorios.filter(item => item.id !== a.id) })}
                            className="text-red-500 hover:text-red-400 p-1"
                           >
                             <Trash2 size={16} />
                           </button>
                         </div>
                       </div>
                       <ArmorProperties item={a} onChange={updates => { const na = [...activeChar.acessorios]; na[idx] = { ...na[idx], ...updates }; updateChar({ acessorios: na }); }} />
                     </div>
                   ))}
                 </div>
               </SubSection>

               <div className="space-y-4">
               <div className="flex justify-between items-center">
                 <h4 className="text-[10px] font-bold text-zinc-500 uppercase">Compartimentos</h4>
                 <button 
                  onClick={() => updateChar({ compartimentos: [...activeChar.compartimentos, { id: crypto.randomUUID(), nome: 'Novo Compartimento', volumeMax: 10, itens: [] }] })}
                  className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                 >
                   <Plus size={16} />
                 </button>
               </div>
               <div className="space-y-4">
                 {activeChar.compartimentos.map((comp, cIdx) => {
                   const compVolume = comp.itens.reduce((acc, i) => acc + (i.volume * i.quantidade), 0);
                   const compartimentos = activeChar.compartimentos;
                   return (
                     <div key={comp.id} className="bg-zinc-900/50 rounded-lg border border-zinc-800 overflow-hidden">
                       <div className="bg-zinc-800/50 px-3 py-2 flex justify-between items-center border-b border-zinc-800">
                         <div className="flex-1 mr-2">
                           <input 
                            value={comp.nome} 
                            onChange={e => { const nc = [...compartimentos]; nc[cIdx].nome = e.target.value; updateChar({ compartimentos: nc }); }}
                            className="bg-transparent text-sm font-bold focus:outline-none w-full"
                           />
                         </div>
                         <div className="flex items-center gap-2">
                           <div className="flex items-center gap-1">
                             <span className="text-xs text-zinc-500 font-bold">CAPACIDADE MÁXIMA:</span>
                             <NumericInput 
                                value={comp.volumeMax} 
                                onChange={v => { const nc = [...compartimentos]; nc[cIdx].volumeMax = v; updateChar({ compartimentos: nc }); }}
                                className="w-20"
                                size="sm"
                              />
                           </div>
                           <button 
                            onClick={() => updateChar({ compartimentos: compartimentos.filter(c => c.id !== comp.id) })}
                            className="text-red-500 hover:text-red-400 p-1"
                           >
                             <Trash2 size={18} />
                           </button>
                         </div>
                       </div>
                       <div className="p-2 space-y-2">
                         <div className="flex justify-between text-xs mb-1 font-bold px-1">
                           <span className="text-zinc-500 uppercase">VOLUME OCUPADO</span>
                           <span className={cn(compVolume > comp.volumeMax ? "text-red-400" : "text-zinc-400")}>
                             {(compVolume || 0).toFixed(1)} / {comp.volumeMax}
                           </span>
                         </div>
                         <div className="space-y-2">
                           <SubSection title="Armas" icon={<Sword size={12} />}>
                             {comp.itens.filter(i => i.tipo === 'arma').map((item, iIdx) => (
                               <div key={item.id} className="bg-zinc-900 p-2 rounded border border-zinc-800 group relative space-y-2">
                                 <div className="flex justify-between items-center mb-1">
                                   <input 
                                    value={item.nome} 
                                    onChange={e => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].nome = e.target.value; updateChar({ compartimentos: nc }); }}
                                    className="bg-transparent text-sm font-bold focus:outline-none flex-1 text-amber-500"
                                   />
                                   <div className="flex items-center gap-2">
                                     <button 
                                       onClick={() => copyToClipboard({ type: 'item', data: item })}
                                       className="text-zinc-500 hover:text-zinc-300 p-1"
                                     >
                                       <Copy size={14} />
                                     </button>
                                     <button 
                                      onClick={() => { const nc = [...compartimentos]; nc[cIdx].itens = nc[cIdx].itens.filter(i => i.id !== item.id); updateChar({ compartimentos: nc }); }}
                                      className="text-red-500 transition-opacity p-1"
                                     >
                                       <Trash2 size={14} />
                                     </button>
                                   </div>
                                 </div>
                                 <div className="grid grid-cols-4 gap-2">
                                   <MiniInput label="Qtd" type="number" value={item.quantidade} onChange={v => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].quantidade = parseInt(v) || 1; updateChar({ compartimentos: nc }); }} />
                                   <div className="flex flex-col">
                                     <span className="text-[10px] text-zinc-600 uppercase tracking-tighter font-bold">Total</span>
                                     <span className="text-xs font-bold text-zinc-400">{(item.peso * item.quantidade).toFixed(1)}kg</span>
                                   </div>
                                 </div>
                                 <WeaponProperties item={item} onChange={updates => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx] = { ...nc[cIdx].itens[iIdx], ...updates }; updateChar({ compartimentos: nc }); }} />
                               </div>
                             ))}
                           </SubSection>

                           <SubSection title="Armaduras" icon={<Shield size={12} />}>
                             {comp.itens.filter(i => i.tipo === 'armadura').map((item, iIdx) => (
                               <div key={item.id} className="bg-zinc-900 p-2 rounded border border-zinc-800 group relative space-y-2">
                                 <div className="flex justify-between items-center mb-1">
                                   <input 
                                    value={item.nome} 
                                    onChange={e => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].nome = e.target.value; updateChar({ compartimentos: nc }); }}
                                    className="bg-transparent text-sm font-bold focus:outline-none flex-1 text-amber-500"
                                   />
                                   <div className="flex items-center gap-2">
                                     <button 
                                       onClick={() => copyToClipboard({ type: 'item', data: item })}
                                       className="text-zinc-500 hover:text-zinc-300 p-1"
                                     >
                                       <Copy size={14} />
                                     </button>
                                     <button 
                                      onClick={() => { const nc = [...compartimentos]; nc[cIdx].itens = nc[cIdx].itens.filter(i => i.id !== item.id); updateChar({ compartimentos: nc }); }}
                                      className="text-red-500 transition-opacity p-1"
                                     >
                                       <Trash2 size={14} />
                                     </button>
                                   </div>
                                 </div>
                                 <div className="grid grid-cols-4 gap-2">
                                   <MiniInput label="Qtd" type="number" value={item.quantidade} onChange={v => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].quantidade = parseInt(v) || 1; updateChar({ compartimentos: nc }); }} />
                                   <div className="flex flex-col">
                                     <span className="text-[10px] text-zinc-600 uppercase tracking-tighter font-bold">Total</span>
                                     <span className="text-xs font-bold text-zinc-400">{(item.peso * item.quantidade).toFixed(1)}kg</span>
                                   </div>
                                 </div>
                                 <ArmorProperties item={item} onChange={updates => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx] = { ...nc[cIdx].itens[iIdx], ...updates }; updateChar({ compartimentos: nc }); }} />
                               </div>
                             ))}
                           </SubSection>

                           <SubSection title="Itens" icon={<Package size={12} />}>
                             {comp.itens.filter(i => i.tipo === 'item').map((item, iIdx) => (
                               <div key={item.id} className="bg-zinc-900 p-2 rounded border border-zinc-800 group relative space-y-2">
                                 <div className="flex justify-between items-center mb-1">
                                   <input 
                                    value={item.nome} 
                                    onChange={e => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].nome = e.target.value; updateChar({ compartimentos: nc }); }}
                                    className="bg-transparent text-sm font-bold focus:outline-none flex-1 text-amber-500"
                                   />
                                   <div className="flex items-center gap-2">
                                     <button 
                                       onClick={() => copyToClipboard({ type: 'item', data: item })}
                                       className="text-zinc-500 hover:text-zinc-300 p-1"
                                     >
                                       <Copy size={14} />
                                     </button>
                                     <button 
                                      onClick={() => { const nc = [...compartimentos]; nc[cIdx].itens = nc[cIdx].itens.filter(i => i.id !== item.id); updateChar({ compartimentos: nc }); }}
                                      className="text-red-500 transition-opacity p-1"
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
                                 <TextArea label="Descrição" value={item.descricao || ''} onChange={v => { const nc = [...compartimentos]; nc[cIdx].itens[iIdx].descricao = v; updateChar({ compartimentos: nc }); }} />
                               </div>
                             ))}
                           </SubSection>
                         </div>
                         <div className="flex gap-2">
                           <button 
                            onClick={() => {
                              const nc = [...compartimentos];
                              nc[cIdx].itens.push({ id: crypto.randomUUID(), nome: 'Nova Arma', tipo: 'arma', quantidade: 1, peso: 0, volume: 0, dano: '1d6', acerto: 0, escala: 'C', resistencia: 0, durabilidade: 0, maxDurabilidade: 0, corte: 0, impacto: 0, perfuracao: 0, descricao: '' });
                              updateChar({ compartimentos: nc });
                            }}
                            className="flex-1 py-2 border border-dashed border-zinc-700 rounded text-[10px] font-bold uppercase text-zinc-500 hover:border-amber-500/50 hover:text-amber-500 transition-all"
                           >
                             + Arma
                           </button>
                           <button 
                            onClick={() => {
                              const nc = [...compartimentos];
                              nc[cIdx].itens.push({ id: crypto.randomUUID(), nome: 'Nova Armadura', tipo: 'armadura', quantidade: 1, peso: 0, volume: 0, durabilidade: 0, maxDurabilidade: 0, corte: 0, impacto: 0, perfuracao: 0, reducaoDano: 0, efeito: '', descricao: '' });
                              updateChar({ compartimentos: nc });
                            }}
                            className="flex-1 py-2 border border-dashed border-zinc-700 rounded text-[10px] font-bold uppercase text-zinc-500 hover:border-amber-500/50 hover:text-amber-500 transition-all"
                           >
                             + Armadura
                           </button>
                           <button 
                            onClick={() => {
                              const nc = [...compartimentos];
                              nc[cIdx].itens.push({ id: crypto.randomUUID(), nome: 'Novo Item', tipo: 'item', quantidade: 1, peso: 0, volume: 0, descricao: '', durabilidade: 0, maxDurabilidade: 0 });
                              updateChar({ compartimentos: nc });
                            }}
                            className="flex-1 py-2 border border-dashed border-zinc-700 rounded text-[10px] font-bold uppercase text-zinc-500 hover:border-amber-500/50 hover:text-amber-500 transition-all"
                           >
                             + Item
                           </button>
                         </div>
                         <div className="pt-2 border-t border-zinc-800">
                             <button 
                               onClick={() => {
                                 if (clipboard?.type === 'item') {
                                   const nc = [...compartimentos];
                                   nc[cIdx].itens.push({ ...clipboard.data, id: crypto.randomUUID() });
                                   updateChar({ compartimentos: nc });
                                   setClipboard(null);
                                 }
                               }}
                               disabled={clipboard?.type !== 'item'}
                               className="w-full py-2 bg-emerald-500/10 border border-dashed border-emerald-500/50 rounded text-[10px] font-bold uppercase text-emerald-500 hover:bg-emerald-500/20 transition-all disabled:opacity-30"
                             >
                               <Save size={14} className="inline mr-1" /> Colar Item
                             </button>
                         </div>
                       </div>
                     </div>
                   );
                 })}
               </div>
             </div>
             </div>
          </Section>
        </div>

        {/* Right Column: Spells & Abilities */}
        <div className="lg:col-span-4 space-y-6">
          <Section title="Magias" icon={<BookOpen size={18}/>} collapsible defaultCollapsed={true}>
             <div className="space-y-3">
               <div className="flex justify-between items-center">
                 <h4 className="text-[10px] font-bold text-zinc-500 uppercase">Magias</h4>
                 <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        if (clipboard?.type === 'spell') {
                          updateChar({ magias: [...activeChar.magias, { ...clipboard.data, id: crypto.randomUUID() }] });
                          setClipboard(null);
                        }
                      }}
                      disabled={clipboard?.type !== 'spell'}
                      className="text-emerald-500 hover:text-emerald-400 flex items-center gap-1 text-[10px] font-bold uppercase disabled:opacity-30"
                    >
                      <Save size={14} /> Colar
                    </button>
                    <button 
                      onClick={() => updateChar({ magias: [...activeChar.magias, { id: crypto.randomUUID(), nome: 'Nova Magia', efeito: '', dano: '', mana: 0, acerto: 0 }] })}
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                 </div>
               </div>
               <div className="space-y-3">
                 {activeChar.magias.map((m, idx) => (
                   <div key={m.id} className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs relative group space-y-2">
                     <div className="flex justify-between items-center">
                       <input 
                        value={m.nome} 
                        onChange={e => { const na = [...(activeChar?.magias || [])]; na[idx].nome = e.target.value; updateChar({ magias: na }); }}
                        className="bg-transparent font-bold focus:outline-none flex-1 text-amber-500"
                       />
                       <div className="flex items-center gap-2">
                         <button 
                           onClick={() => copyToClipboard({ type: 'spell', data: m })}
                           className="text-zinc-500 hover:text-zinc-300 p-1"
                         >
                           <Copy size={16} />
                         </button>
                         <button 
                          onClick={() => updateChar({ magias: activeChar.magias.filter(item => item.id !== m.id) })}
                          className="text-red-500 hover:text-red-400 p-1"
                         >
                           <Trash2 size={16} />
                         </button>
                       </div>
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

          <Section title="Habilidades" icon={<Battery size={18}/>} collapsible defaultCollapsed={true}>
             <div className="space-y-3">
               <div className="flex justify-between items-center">
                 <h4 className="text-[10px] font-bold text-zinc-500 uppercase">Habilidades</h4>
                 <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        if (clipboard?.type === 'ability') {
                          updateChar({ habilidades: [...activeChar.habilidades, { ...clipboard.data, id: crypto.randomUUID() }] });
                          setClipboard(null);
                        }
                      }}
                      disabled={clipboard?.type !== 'ability'}
                      className="text-emerald-500 hover:text-emerald-400 flex items-center gap-1 text-[10px] font-bold uppercase disabled:opacity-30"
                    >
                      <Save size={14} /> Colar
                    </button>
                    <button 
                      onClick={() => updateChar({ habilidades: [...activeChar.habilidades, { id: crypto.randomUUID(), nome: 'Nova Habilidade', efeito: '' }] })}
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                 </div>
               </div>
               <div className="space-y-3">
                 {activeChar.habilidades.map((h, idx) => (
                   <div key={h.id} className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs relative group space-y-2">
                     <div className="flex justify-between items-center">
                       <input 
                        value={h.nome} 
                        onChange={e => { const na = [...(activeChar?.habilidades || [])]; na[idx].nome = e.target.value; updateChar({ habilidades: na }); }}
                        className="bg-transparent font-bold focus:outline-none flex-1 text-amber-500"
                       />
                       <div className="flex items-center gap-2">
                         <button 
                           onClick={() => copyToClipboard({ type: 'ability', data: h })}
                           className="text-zinc-500 hover:text-zinc-300 p-1"
                         >
                           <Copy size={16} />
                         </button>
                         <button 
                          onClick={() => updateChar({ habilidades: activeChar.habilidades.filter(item => item.id !== h.id) })}
                          className="text-red-500 hover:text-red-400 p-1"
                         >
                           <Trash2 size={16} />
                         </button>
                       </div>
                     </div>
                     <TextArea label="Efeito" value={h.efeito} onChange={v => { const na = [...(activeChar?.habilidades || [])]; na[idx].efeito = v; updateChar({ habilidades: na }); }} />
                   </div>
                 ))}
               </div>
             </div>
          </Section>

          <Section title="Conhecimentos" icon={<BookOpen size={18}/>} collapsible defaultCollapsed={true}>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {(activeChar?.conhecimentos || []).map((k, idx) => (
                <div key={k.name} className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold uppercase tracking-widest text-zinc-300">{k.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-zinc-500 font-bold">NÍVEL</span>
                      <NumericInput 
                        value={k.nivel} 
                        onChange={v => {
                          const newKs = [...(activeChar?.conhecimentos || [])];
                          newKs[idx] = { ...k, nivel: v };
                          updateChar({ conhecimentos: newKs });
                        }}
                        className="w-20"
                        size="lg"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/50">
                      <div 
                        className="h-full bg-amber-500 transition-all shadow-[0_0_10px_rgba(245,158,11,0.3)]" 
                        style={{ width: `${(k.xp / getXpToNextLevel(k.nivel)) * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <NumericInput 
                        value={k.xp} 
                        onChange={v => {
                          const nextXp = getXpToNextLevel(k.nivel);
                          let updatedK = { ...k, xp: v };
                          if (v >= nextXp) {
                            updatedK.nivel += 1;
                            updatedK.xp = 0;
                          }
                          const newKs = [...(activeChar?.conhecimentos || [])];
                          newKs[idx] = updatedK;
                          updateChar({ conhecimentos: newKs });
                        }}
                        className="w-16"
                        size="sm"
                      />
                      <span className="text-sm text-zinc-500 font-bold">/ {getXpToNextLevel(k.nivel)}</span>
                    </div>
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
