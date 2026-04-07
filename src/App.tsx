import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Plus, Trash2, Save, Download, Upload, Copy, ChevronDown, ChevronUp, 
  Shield, Sword, Backpack, BookOpen, Activity, Coins, User, MapPin, 
  Thermometer, Utensils, Droplets, Battery, Weight, Package, Gem, Zap,
  MoreVertical, Flame, Skull, Biohazard, Bone, RotateCw, X, Droplet, FileText, Dices
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
  fome: 100,
  sede: 100,
  cansaco: 8,
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
  acessorios: [],
  compartimentos: [
    { id: crypto.randomUUID(), nome: 'Mochila de Viagem', volumeMax: 30, itens: [] },
    { id: crypto.randomUUID(), nome: 'Bolsa de Cinto', volumeMax: 3, itens: [] }
  ],
  conhecimentos: INITIAL_KNOWLEDGES.map(name => ({ name, nivel: 0, xp: 0, limite: 5 })),
  efeitosNegativos: [],
  anotacoes: [{ id: crypto.randomUUID(), titulo: 'Anotações Gerais', conteudo: '' }],
  dadosCustomizados: [],
});

const NEGATIVE_EFFECTS = [
  { id: 'ossos_quebrados', name: 'Ossos quebrados', icon: Bone, color: 'text-zinc-400', info: 'Ponto fraco\n+3 dano extra\nImobilizado' },
  { id: 'sangramento', name: 'Sangramento', icon: Droplet, color: 'text-red-500', info: 'Ponto fraco\nDano continuo' },
  { id: 'hemorragia', name: 'Hemorragia', icon: Droplets, color: 'text-red-600', info: 'Ponto fraco\n-⅓ Deslocamento, esquiva e acurácia\n-2 Defesa com armas' },
  { id: 'envenenamento', name: 'Envenenamento', icon: Biohazard, color: 'text-emerald-500', info: 'Dano continuo' },
  { id: 'putrefacao', name: 'Putrefação', icon: Skull, color: 'text-zinc-600', info: 'Ponto fraco\n-1 em todas as proficiências' },
  { id: 'queimadura', name: 'Queimadura', icon: Flame, color: 'text-orange-500', info: 'Ponto fraco\n+2 de dano' },
  { id: 'tontura', name: 'Tontura', icon: RotateCw, color: 'text-amber-400', info: 'Ponto fraco\nRedução de acerto e esquiva a 0 por 2 turnos\n-⅔ de deslocamento por 2 turnos\nProficiências e testes tem desvantagem de -2 por 2 turnos' },
];

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [vitaisTab, setVitaisTab] = useState<'status' | 'efeitos'>('status');
  const [activePage, setActivePage] = useState<'sheet' | 'notes' | 'dice'>('sheet');
  const [diceQuantity, setDiceQuantity] = useState(1);
  const [diceBonus, setDiceBonus] = useState(0);
  const [diceHistory, setDiceHistory] = useState<{ id: string; result: number; formula: string; timestamp: number }[]>([]);
  const [lastRoll, setLastRoll] = useState<{ result: number; formula: string; rolls: number[]; bonus: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const rollDice = (sides: number, quantity: number, bonus: number, label?: string) => {
    const rolls: number[] = [];
    let total = 0;
    for (let i = 0; i < quantity; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      rolls.push(roll);
      total += roll;
    }
    const finalResult = total + bonus;
    const formula = `${quantity}d${sides}${bonus !== 0 ? (bonus > 0 ? ` + ${bonus}` : ` - ${Math.abs(bonus)}`) : ''}${label ? ` (${label})` : ''}`;
    
    setDiceHistory(prev => [{
      id: crypto.randomUUID(),
      result: finalResult,
      formula,
      timestamp: Date.now()
    }, ...prev].slice(0, 50));

    setLastRoll({ result: finalResult, formula, rolls, bonus });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const copyToClipboard = (type: 'Arma' | 'Armadura' | 'Item' | 'Magia' | 'Habilidade', data: any) => {
    const dataWithTipo = { ...data, id: crypto.randomUUID() };
    if (type === 'Arma') dataWithTipo.tipo = 'Arma';
    if (type === 'Armadura') dataWithTipo.tipo = 'Armadura';
    setClipboard({ type, data: dataWithTipo });
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
  const acessorios = activeChar?.acessorios || [];

  const invTotals = calculateInventoryTotals(compartimentos);
  const weaponPeso = armas.reduce((acc, w) => acc + (w.peso || 0), 0);
  const armorPeso = armaduras.reduce((acc, a) => acc + (a.peso || 0), 0);
  const accessoryPeso = acessorios.reduce((acc, a) => acc + (a.peso || 0), 0);
  const pesoTotal = invTotals.peso + weaponPeso + armorPeso + accessoryPeso;
  
  const penalties = getLoadPenalties(pesoTotal, cargaMax);
  const deslocamentoFinal = Math.max(0, Math.floor(deslocamentoBase * penalties.deslocamentoMult));

  const exportJSON = () => {
    const jsonString = JSON.stringify(activeChar, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeChar.nome || 'personagem'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
      <header className="sticky top-0 z-50 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20">
            <User size={20} className="text-zinc-950" />
          </div>
          
          <div className="flex items-center bg-zinc-950/50 p-1 rounded-lg border border-zinc-800">
            <button 
              onClick={() => setActivePage('sheet')}
              className={cn(
                "p-2 rounded-md transition-all",
                activePage === 'sheet' ? "bg-amber-500 text-zinc-950" : "text-zinc-500 hover:text-zinc-300"
              )}
              title="Ficha do Personagem"
            >
              <User size={18} />
            </button>
            <button 
              onClick={() => setActivePage('notes')}
              className={cn(
                "p-2 rounded-md transition-all",
                activePage === 'notes' ? "bg-amber-500 text-zinc-950" : "text-zinc-500 hover:text-zinc-300"
              )}
              title="Anotações"
            >
              <FileText size={18} />
            </button>
            <button 
              onClick={() => setActivePage('dice')}
              className={cn(
                "p-2 rounded-md transition-all",
                activePage === 'dice' ? "bg-amber-500 text-zinc-950" : "text-zinc-500 hover:text-zinc-300"
              )}
              title="Rolagem de Dados"
            >
              <Dices size={18} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 relative" ref={menuRef}>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-10 h-10 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-full transition-all border border-zinc-700 shadow-lg"
          >
            <MoreVertical size={20} className="text-amber-500" />
          </button>
          
          <div className={cn(
            "absolute right-0 top-full mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl transition-all duration-200 z-[60] p-2 space-y-1",
            isMenuOpen ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-2 pointer-events-none"
          )}>
            <div className="px-3 py-2 border-b border-zinc-800 mb-1">
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Escolha de Ficha</label>
              <select 
                value={state.activeCharacterId || ''} 
                onChange={(e) => {
                  setState(prev => ({ ...prev, activeCharacterId: e.target.value }));
                  setIsMenuOpen(false);
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 truncate"
              >
                {state.characters.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={() => {
                const nc = createEmptyCharacter();
                setState(prev => ({ characters: [...prev.characters, nc], activeCharacterId: nc.id }));
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium text-zinc-300"
            >
              <Plus size={18} className="text-amber-500" /> Adicionar Nova Ficha
            </button>

            <button 
              onClick={() => {
                duplicateChar();
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium text-zinc-300"
            >
              <Copy size={18} className="text-amber-500" /> Copiar Ficha
            </button>

            <button 
              onClick={() => {
                exportJSON();
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium text-zinc-300"
            >
              <Download size={18} className="text-amber-500" /> Exportar JSON
            </button>

            <label className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium text-zinc-300 cursor-pointer">
              <Upload size={18} className="text-amber-500" /> Importar JSON
              <input type="file" className="hidden" onChange={(e) => { importJSON(e); setIsMenuOpen(false); }} accept=".json" />
            </label>

            <button 
              onClick={() => {
                exportPDF();
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium text-zinc-300"
            >
              <Activity size={18} className="text-amber-500" /> Exportar PDF
            </button>

            <div className="pt-1 border-t border-zinc-800 mt-1">
              <button 
                onClick={() => {
                  setShowDeleteConfirm(true);
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-red-500/10 rounded-lg transition-colors text-sm font-medium text-red-400"
              >
                <Trash2 size={18} /> Excluir Ficha
              </button>
            </div>
          </div>
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

      <main className="max-w-7xl mx-auto p-4 md:p-6 pb-20">
        {activePage === 'sheet' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
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

          <Section title="Vitais" icon={<Activity size={18}/>} collapsible>
            <div className="flex gap-2 mb-4 p-1 bg-zinc-950/50 rounded-lg border border-zinc-800">
              <button 
                onClick={() => setVitaisTab('status')}
                className={cn(
                  "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                  vitaisTab === 'status' ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Status
              </button>
              <button 
                onClick={() => setVitaisTab('efeitos')}
                className={cn(
                  "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                  vitaisTab === 'efeitos' ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Efeitos Negativos
              </button>
            </div>

            {vitaisTab === 'status' ? (
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
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {NEGATIVE_EFFECTS.map(effect => {
                    const isActive = (activeChar.efeitosNegativos || []).includes(effect.id);
                    return (
                      <button
                        key={effect.id}
                        onClick={() => {
                          const current = activeChar.efeitosNegativos || [];
                          if (isActive) {
                            updateChar({ efeitosNegativos: current.filter(id => id !== effect.id) });
                          } else {
                            updateChar({ efeitosNegativos: [...current, effect.id] });
                          }
                        }}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg border transition-all text-left",
                          isActive 
                            ? "bg-zinc-800 border-amber-500/50 text-amber-500" 
                            : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                        )}
                      >
                        <effect.icon size={16} className={isActive ? effect.color : "text-zinc-600"} />
                        <span className="text-[10px] font-bold uppercase truncate">{effect.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeChar.efeitosNegativos && activeChar.efeitosNegativos.length > 0 && (
              <div className="mt-6 pt-4 border-t border-zinc-800 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {activeChar.efeitosNegativos.map(id => {
                    const effect = NEGATIVE_EFFECTS.find(e => e.id === id);
                    if (!effect) return null;
                    return (
                      <div key={id} className="group relative">
                        <div className={cn("p-2 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center gap-2", effect.color)}>
                          <effect.icon size={18} />
                          <button 
                            onClick={() => updateChar({ efeitosNegativos: activeChar.efeitosNegativos.filter(eid => eid !== id) })}
                            className="p-0.5 hover:bg-zinc-800 rounded text-zinc-500"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="space-y-2">
                  {activeChar.efeitosNegativos.map(id => {
                    const effect = NEGATIVE_EFFECTS.find(e => e.id === id);
                    if (!effect || !effect.info) return null;
                    return (
                      <div key={`info-${id}`} className="bg-red-500/5 border border-red-500/10 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <effect.icon size={14} className={effect.color} />
                          <span className="text-sm font-bold uppercase text-zinc-300">{effect.name}</span>
                        </div>
                        <div className="text-sm text-red-400/80 leading-relaxed whitespace-pre-line">
                          {effect.info}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
              {Object.entries(activeChar.defesa).map(([part, val]) => (
                <div key={part} className="bg-zinc-900 border border-zinc-800 p-2 rounded flex justify-between items-center">
                  <span className="text-xs text-zinc-400">{part}</span>
                  <NumericInput 
                    value={val as number} 
                    onChange={v => updateChar({ defesa: { ...activeChar.defesa, [part]: v } })}
                    className="w-16"
                    size="sm"
                  />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Status" icon={<Zap size={18}/>} collapsible>
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
                          onClick={() => {
                            const newXP = Math.max(0, currentXP - 1);
                            updateChar({ statsXP: { ...(activeChar?.statsXP || createEmptyCharacter().statsXP), [stat]: newXP } });
                          }}
                          className="w-6 h-6 flex items-center justify-center bg-zinc-800 rounded hover:bg-zinc-700 text-zinc-400 transition-colors"
                        >
                          -
                        </button>
                        <NumericInput 
                          value={currentXP}
                          onChange={v => {
                            if (v >= xpLimit) {
                              updateChar({ 
                                stats: { ...stats, [stat]: statVal + 1 },
                                statsXP: { ...(activeChar?.statsXP || createEmptyCharacter().statsXP), [stat]: 0 }
                              });
                            } else {
                              updateChar({ 
                                statsXP: { ...(activeChar?.statsXP || createEmptyCharacter().statsXP), [stat]: v }
                              });
                            }
                          }}
                          className="w-16"
                          size="sm"
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
               <SubSection title="Armas" icon={<Sword size={14} />} defaultCollapsed={false}>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase">Armas</h4>
                    <button 
                      onClick={() => updateChar({ armas: [...(activeChar?.armas || []), { id: crypto.randomUUID(), nome: 'Nova Arma', dano: '0', acerto: 0, tipo: 'Arma', escala: '', atributoBase: 'FOR', peso: 0, volume: 0, durabilidade: 0, maxDurabilidade: 0, corte: 0, impacto: 0, perfuracao: 0, resistencia: 0 }] })}
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  
                  {clipboard && (clipboard.type === 'Arma' || (clipboard.type === 'Item' && clipboard.data.tipo === 'Arma')) && (
                    <button 
                      onClick={() => {
                        updateChar({ armas: [...(activeChar?.armas || []), { ...clipboard.data, id: crypto.randomUUID() }] });
                        setClipboard(null);
                      }}
                      className="w-full py-2 mb-2 bg-emerald-500/10 border border-dashed border-emerald-500/50 rounded text-[10px] font-bold uppercase text-emerald-500 hover:bg-emerald-500/20 transition-all"
                    >
                      Colar Arma
                    </button>
                  )}
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
                         <div className="flex items-center gap-2">
                           <button 
                             onClick={() => copyToClipboard('Arma', w)}
                             className="text-zinc-500 hover:text-zinc-300 p-1"
                             title="Copiar Arma"
                           >
                             <Copy size={20} />
                           </button>
                           <button 
                            onClick={() => updateChar({ armas: armas.filter(a => a.id !== w.id) })}
                            className="text-red-500 hover:text-red-400 p-1"
                           >
                             <Trash2 size={20} />
                           </button>
                         </div>
                       </div>
                       
                        <WeaponProperties 
                          item={w} 
                          onChange={updates => {
                            const na = [...armas];
                            na[idx] = { ...na[idx], ...updates };
                            updateChar({ armas: na });
                          }} 
                        />
                     </div>
                   ))}
                 </div>
               </SubSection>

               {/* Armaduras Section */}
               <SubSection title="Armaduras" icon={<Shield size={14} />} defaultCollapsed={false}>
                   <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase">Armaduras</h4>
                    <button 
                      onClick={() => updateChar({ armaduras: [...(activeChar?.armaduras || []), { id: crypto.randomUUID(), nome: 'Nova Armadura', tipo: 'Armadura', corte: 0, impacto: 0, perfuracao: 0, durabilidade: 0, peso: 0, volume: 0, reducaoDano: 0, efeito: '' }] })}
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {clipboard && (clipboard.type === 'Armadura' || (clipboard.type === 'Item' && clipboard.data.tipo === 'Armadura')) && (
                    <button 
                      onClick={() => {
                        updateChar({ armaduras: [...(activeChar?.armaduras || []), { ...clipboard.data, id: crypto.randomUUID() }] });
                        setClipboard(null);
                      }}
                      className="w-full py-2 mb-2 bg-emerald-500/10 border border-dashed border-emerald-500/50 rounded text-[10px] font-bold uppercase text-emerald-500 hover:bg-emerald-500/20 transition-all"
                    >
                      Colar Armadura
                    </button>
                  )}
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
                         <div className="flex items-center gap-2">
                           <button 
                             onClick={() => copyToClipboard('Armadura', a)}
                             className="text-zinc-500 hover:text-zinc-300 p-1"
                             title="Copiar Armadura"
                           >
                             <Copy size={20} />
                           </button>
                           <button 
                            onClick={() => updateChar({ armaduras: (activeChar?.armaduras || []).filter(arm => arm.id !== a.id) })}
                            className="text-red-500 hover:text-red-400 p-1"
                           >
                             <Trash2 size={20} />
                           </button>
                         </div>
                       </div>
                       
                        <ArmorProperties 
                          item={a} 
                          onChange={updates => {
                            const na = [...(activeChar?.armaduras || [])];
                            na[idx] = { ...na[idx], ...updates };
                            updateChar({ armaduras: na });
                          }} 
                        />
                     </div>
                   ))}
                 </div>
               </SubSection>

               {/* Acessórios Section */}
               <SubSection title="Acessórios" icon={<Gem size={14} />} defaultCollapsed={false}>
                   <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase">Acessórios</h4>
                    <button 
                      onClick={() => updateChar({ acessorios: [...(activeChar?.acessorios || []), { id: crypto.randomUUID(), nome: 'Novo Acessório', tipo: 'Armadura', corte: 0, impacto: 0, perfuracao: 0, durabilidade: 0, peso: 0, volume: 0, reducaoDano: 0, efeito: '' }] })}
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {clipboard && (clipboard.type === 'Armadura' || (clipboard.type === 'Item' && clipboard.data.tipo === 'Armadura')) && (
                    <button 
                      onClick={() => {
                        updateChar({ acessorios: [...(activeChar?.acessorios || []), { ...clipboard.data, id: crypto.randomUUID() }] });
                        setClipboard(null);
                      }}
                      className="w-full py-2 mb-2 bg-emerald-500/10 border border-dashed border-emerald-500/50 rounded text-[10px] font-bold uppercase text-emerald-500 hover:bg-emerald-500/20 transition-all"
                    >
                      Colar Acessório
                    </button>
                  )}
                 <div className="space-y-3">
                   {(activeChar?.acessorios || []).map((a, idx) => (
                     <div key={a.id} className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs relative group space-y-2">
                       <div className="flex justify-between items-center">
                         <input 
                          value={a.nome} 
                          onChange={e => {
                            const newAccs = [...(activeChar?.acessorios || [])];
                            newAccs[idx].nome = e.target.value;
                            updateChar({ acessorios: newAccs });
                          }}
                          className="bg-transparent font-bold focus:outline-none flex-1 text-amber-500"
                         />
                         <div className="flex items-center gap-2">
                           <button 
                             onClick={() => copyToClipboard('Armadura', a)}
                             className="text-zinc-500 hover:text-zinc-300 p-1"
                             title="Copiar Acessório"
                           >
                             <Copy size={20} />
                           </button>
                           <button 
                            onClick={() => updateChar({ acessorios: (activeChar?.acessorios || []).filter(acc => acc.id !== a.id) })}
                            className="text-red-500 hover:text-red-400 p-1"
                           >
                             <Trash2 size={20} />
                           </button>
                         </div>
                       </div>
                       
                        <ArmorProperties 
                          item={a} 
                          onChange={updates => {
                            const na = [...(activeChar?.acessorios || [])];
                            na[idx] = { ...na[idx], ...updates };
                            updateChar({ acessorios: na });
                          }} 
                        />
                     </div>
                   ))}
                 </div>
               </SubSection>
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
                             <span className="text-xs text-zinc-500 font-bold">CAPACIDADE MÁXIMA:</span>
                             <NumericInput 
                                value={comp.volumeMax} 
                                onChange={v => {
                                  const nc = [...compartimentos];
                                  nc[cIdx].volumeMax = v;
                                  updateChar({ compartimentos: nc });
                                }}
                                className="w-20"
                                size="lg"
                              />
                           </div>
                           <button 
                            onClick={() => updateChar({ compartimentos: compartimentos.filter(c => c.id !== comp.id) })}
                            className="text-red-500 hover:text-red-400 p-1"
                           >
                             <Trash2 size={20} />
                           </button>
                         </div>
                       </div>

                       <div className="p-2 space-y-2">
                         <div className="flex justify-between text-xs mb-1 font-bold px-1">
                           <span className="text-zinc-500 uppercase">VOLUME OCUPADO</span>
                           <span className={cn(compVolume > comp.volumeMax ? "text-red-400" : "text-zinc-400")}>
                             {compVolume.toFixed(1)} / {comp.volumeMax}
                           </span>
                         </div>
                         
                         <div className="space-y-2">
                           <SubSection title="Armas" icon={<Sword size={14} />} defaultCollapsed={false}>
                             {(comp.itens || []).map((item, iIdx) => item.tipo === 'Arma' ? (
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
                                       onClick={() => copyToClipboard(item.tipo === 'Arma' ? 'Arma' : item.tipo === 'Armadura' ? 'Armadura' : 'Item', item)}
                                       className="text-zinc-500 hover:text-zinc-300 p-1"
                                       title="Copiar Item"
                                     >
                                       <Copy size={20} />
                                     </button>
                                     <button 
                                      onClick={() => {
                                        const nc = [...compartimentos];
                                        nc[cIdx].itens = nc[cIdx].itens.filter(it => it.id !== item.id);
                                        updateChar({ compartimentos: nc });
                                      }}
                                      className="text-red-500 transition-opacity p-1"
                                     >
                                       <Trash2 size={20} />
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

                                 <WeaponProperties 
                                   item={item} 
                                   onChange={updates => {
                                     const nc = [...compartimentos];
                                     nc[cIdx].itens[iIdx] = { ...nc[cIdx].itens[iIdx], ...updates };
                                     updateChar({ compartimentos: nc });
                                   }} 
                                 />
                               </div>
                             ) : null)}
                           </SubSection>

                           <SubSection title="Armaduras" icon={<Shield size={14} />} defaultCollapsed={false}>
                             {(comp.itens || []).map((item, iIdx) => item.tipo === 'Armadura' ? (
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
                                       onClick={() => copyToClipboard(item.tipo === 'Arma' ? 'Arma' : item.tipo === 'Armadura' ? 'Armadura' : 'Item', item)}
                                       className="text-zinc-500 hover:text-zinc-300 p-1"
                                       title="Copiar Item"
                                     >
                                       <Copy size={20} />
                                     </button>
                                     <button 
                                      onClick={() => {
                                        const nc = [...compartimentos];
                                        nc[cIdx].itens = nc[cIdx].itens.filter(it => it.id !== item.id);
                                        updateChar({ compartimentos: nc });
                                      }}
                                      className="text-red-500 transition-opacity p-1"
                                     >
                                       <Trash2 size={20} />
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

                                 <ArmorProperties 
                                   item={item} 
                                   onChange={updates => {
                                     const nc = [...compartimentos];
                                     nc[cIdx].itens[iIdx] = { ...nc[cIdx].itens[iIdx], ...updates };
                                     updateChar({ compartimentos: nc });
                                   }} 
                                 />
                               </div>
                             ) : null)}
                           </SubSection>

                           <SubSection title="Itens" icon={<Package size={14} />} defaultCollapsed={false}>
                             {(comp.itens || []).map((item, iIdx) => (item.tipo !== 'Arma' && item.tipo !== 'Armadura') ? (
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
                                       onClick={() => copyToClipboard(item.tipo === 'Arma' ? 'Arma' : item.tipo === 'Armadura' ? 'Armadura' : 'Item', item)}
                                       className="text-zinc-500 hover:text-zinc-300 p-1"
                                       title="Copiar Item"
                                     >
                                       <Copy size={20} />
                                     </button>
                                     <button 
                                      onClick={() => {
                                        const nc = [...compartimentos];
                                        nc[cIdx].itens = nc[cIdx].itens.filter(it => it.id !== item.id);
                                        updateChar({ compartimentos: nc });
                                      }}
                                      className="text-red-500 transition-opacity p-1"
                                     >
                                       <Trash2 size={20} />
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
                             ) : null)}
                           </SubSection>
                         </div>
                         
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
                              nc[cIdx].itens.push({ id: crypto.randomUUID(), nome: 'Nova Arma', peso: 0, volume: 0, quantidade: 0, tipo: 'Arma', durabilidade: 0, maxDurabilidade: 0, descricao: '', dano: '0', acerto: 0, escala: '', atributoBase: 'FOR', corte: 0, impacto: 0, perfuracao: 0, resistencia: 0 });
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
                               setClipboard(null);
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
                       onClick={() => {
                         updateChar({ magias: [...(activeChar?.magias || []), { ...clipboard.data, id: crypto.randomUUID() }] });
                         setClipboard(null);
                       }}
                       className="text-emerald-500 hover:text-emerald-400 flex items-center gap-1 text-[10px] font-bold uppercase"
                     >
                       <Plus size={12} /> Colar
                     </button>
                   )}
                   <button 
                    onClick={() => updateChar({ magias: [...(activeChar?.magias || []), { id: crypto.randomUUID(), nome: 'Nova Magia', efeito: '', dano: '0', mana: 0, acerto: 0 }] })}
                    className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                   >
                     <Plus size={16} />
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
                        className="text-red-500 hover:text-red-400 p-1"
                       >
                         <Trash2 size={20} />
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
                  className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                 >
                   <Plus size={16} />
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
                        className="text-red-500 hover:text-red-400 p-1"
                       >
                         <Trash2 size={20} />
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
                <div key={k.name} className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold uppercase tracking-widest text-zinc-300">{k.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-zinc-500 font-bold">NÍVEL</span>
                      <NumericInput 
                        value={k.nivel} 
                        onChange={v => {
                          const newKs = [...(activeChar?.conhecimentos || [])];
                          newKs[idx].nivel = v;
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
        </div>
      ) : activePage === 'dice' ? (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-amber-500 flex items-center gap-2">
              <Dices size={24} /> Rolagem de Dados
            </h2>
          </div>

          {/* Dice Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { sides: 4, img: 'd4.png' },
              { sides: 6, img: 'd6.png' },
              { sides: 8, img: 'd8.png' },
              { sides: 10, img: 'd10.png' },
              { sides: 12, img: 'd12.png' },
              { sides: 20, img: 'd20.png' },
              { sides: 100, img: 'd100.png' },
            ].map(dice => (
              <button
                key={`d${dice.sides}`}
                onClick={() => rollDice(dice.sides, diceQuantity, diceBonus)}
                className="flex flex-col items-center justify-center p-6 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-amber-500/50 transition-all group shadow-lg"
              >
                <div className="w-16 h-16 mb-2 flex items-center justify-center relative">
                  <DiceImage 
                    sides={dice.sides} 
                    fileName={dice.img} 
                    className="w-full h-full object-contain group-hover:scale-110 transition-transform invert" 
                  />
                </div>
                <span className="text-sm font-bold text-zinc-300 uppercase">d{dice.sides}</span>
              </button>
            ))}
            
            {/* Special 3d8 Preset */}
            <button
              onClick={() => rollDice(8, 3, diceBonus, '3d8')}
              className="flex flex-col items-center justify-center p-6 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-amber-500/50 transition-all group shadow-lg"
            >
              <div className="w-16 h-16 mb-2 flex items-center justify-center relative">
                <DiceImage 
                  sides={8} 
                  fileName="3d8.png" 
                  className="w-full h-full object-contain group-hover:scale-110 transition-transform invert" 
                />
                <div className="absolute -top-2 -right-2 bg-amber-500 text-zinc-950 text-[10px] font-bold px-1 rounded shadow-sm">3d8</div>
              </div>
              <span className="text-sm font-bold text-zinc-300 uppercase">3d8</span>
            </button>

            {/* Custom Dice */}
            {(activeChar.dadosCustomizados || []).map(dice => (
              <div key={dice.id} className="relative group">
                <button
                  onClick={() => rollDice(dice.lados, diceQuantity, diceBonus, dice.nome)}
                  className="w-full flex flex-col items-center justify-center p-6 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-amber-500/50 transition-all shadow-lg"
                >
                  <div className="w-16 h-16 mb-2 flex items-center justify-center">
                    <Dices size={32} className="text-amber-500 group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="text-sm font-bold text-zinc-300 uppercase truncate w-full text-center">{dice.nome || `d${dice.lados}`}</span>
                </button>
                <button 
                  onClick={() => updateChar({ dadosCustomizados: activeChar.dadosCustomizados.filter(d => d.id !== dice.id) })}
                  className="absolute top-2 right-2 p-1 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-md opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Create Custom Dice */}
          <Section title="Criar Dado Personalizado" icon={<Plus size={18} />} collapsible defaultCollapsed>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[120px]">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Lados</label>
                <input 
                  type="number"
                  id="new-dice-sides"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 transition-all text-amber-500 font-bold text-center"
                  defaultValue={20}
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Nome (Opcional)</label>
                <input 
                  type="text"
                  id="new-dice-name"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 transition-all text-zinc-300"
                  placeholder="Ex: Dado de Sorte"
                />
              </div>
              <button 
                onClick={() => {
                  const sidesInput = document.getElementById('new-dice-sides') as HTMLInputElement;
                  const nameInput = document.getElementById('new-dice-name') as HTMLInputElement;
                  const sides = parseInt(sidesInput?.value) || 20;
                  const name = nameInput?.value || `d${sides}`;
                  updateChar({ dadosCustomizados: [...(activeChar.dadosCustomizados || []), { id: crypto.randomUUID(), lados: sides, nome: name }] });
                  if (nameInput) nameInput.value = '';
                }}
                className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-6 py-2 rounded-lg font-bold transition-all shadow-lg shadow-amber-500/20"
              >
                Criar Dado
              </button>
            </div>
          </Section>

          {/* Selectors and Results */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-zinc-800">
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase text-zinc-500 tracking-widest">Configurações de Rolagem</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Quantidade de Dados</label>
                  <NumericInput 
                    value={diceQuantity} 
                    onChange={setDiceQuantity} 
                    min={1}
                    size="lg"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Bônus / Ônus</label>
                  <NumericInput 
                    value={diceBonus} 
                    onChange={setDiceBonus} 
                    size="lg"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase text-zinc-500 tracking-widest">Histórico</h3>
                <button 
                  onClick={() => setDiceHistory([])}
                  className="text-[10px] font-bold text-red-400 hover:text-red-300 uppercase"
                >
                  Limpar
                </button>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 min-h-[200px] max-h-[400px] overflow-y-auto custom-scrollbar space-y-3">
                {diceHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-600 py-10">
                    <Dices size={48} className="mb-2 opacity-20" />
                    <p className="text-sm italic">Nenhuma rolagem ainda...</p>
                  </div>
                ) : (
                  diceHistory.map(roll => (
                    <motion.div 
                      key={roll.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-lg shadow-sm"
                    >
                      <div>
                        <div className="text-xs font-bold text-amber-500/70 uppercase tracking-tighter">{roll.formula}</div>
                        <div className="text-[10px] text-zinc-600">{new Date(roll.timestamp).toLocaleTimeString()}</div>
                      </div>
                      <div className="text-2xl font-black text-amber-500">{roll.result}</div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-amber-500 flex items-center gap-2">
                <FileText size={24} /> Anotações
              </h2>
              <button 
                onClick={() => updateChar({ anotacoes: [...(activeChar.anotacoes || []), { id: crypto.randomUUID(), titulo: 'Nova Anotação', conteudo: '' }] })}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 rounded-lg font-bold transition-all shadow-lg shadow-amber-500/20"
              >
                <Plus size={18} /> Adicionar Aba
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {(activeChar.anotacoes || []).map((note, idx) => (
                <div key={note.id}>
                  <Section 
                    title={note.titulo || 'Sem Título'} 
                    icon={<FileText size={18} />} 
                    collapsible 
                  >
                    <div className="space-y-4">
                      <div className="flex justify-between items-center gap-4">
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Título da Aba</label>
                          <input 
                            value={note.titulo}
                            onChange={e => {
                              const newNotes = [...activeChar.anotacoes];
                              newNotes[idx].titulo = e.target.value;
                              updateChar({ anotacoes: newNotes });
                            }}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 transition-all text-amber-500 font-bold"
                            placeholder="Digite o título..."
                          />
                        </div>
                        <button 
                          onClick={() => {
                            const newNotes = activeChar.anotacoes.filter(n => n.id !== note.id);
                            updateChar({ anotacoes: newNotes });
                          }}
                          className="mt-5 p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                          title="Excluir Aba"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Conteúdo</label>
                        <textarea 
                          value={note.conteudo}
                          onChange={e => {
                            const newNotes = [...activeChar.anotacoes];
                            newNotes[idx].conteudo = e.target.value;
                            updateChar({ anotacoes: newNotes });
                          }}
                          rows={15}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 transition-all resize-none leading-relaxed"
                          placeholder="Escreva suas anotações aqui..."
                        />
                      </div>
                    </div>
                  </Section>
                </div>
              ))}

              {(!activeChar.anotacoes || activeChar.anotacoes.length === 0) && (
                <div className="text-center py-20 bg-zinc-900/20 border border-dashed border-zinc-800 rounded-xl">
                  <FileText size={48} className="mx-auto text-zinc-800 mb-4" />
                  <p className="text-zinc-500">Nenhuma aba de anotação criada.</p>
                  <button 
                    onClick={() => updateChar({ anotacoes: [{ id: crypto.randomUUID(), titulo: 'Anotações Gerais', conteudo: '' }] })}
                    className="mt-4 text-amber-500 hover:text-amber-400 font-bold uppercase text-xs tracking-widest"
                  >
                    Criar Primeira Aba
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <AnimatePresence>
        {lastRoll && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLastRoll(null)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] cursor-pointer p-4"
          >
            <motion.div 
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 50 }}
              className="bg-zinc-900 border-2 border-amber-500 rounded-3xl p-8 shadow-[0_0_50px_rgba(245,158,11,0.3)] flex flex-col items-center gap-4 max-w-md w-full pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{lastRoll.formula}</span>
                <span className="text-7xl font-black text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">{lastRoll.result}</span>
              </div>
              
              {lastRoll.rolls.length > 1 && (
                <div className="w-full space-y-2">
                  <div className="h-px bg-zinc-800 w-full" />
                  <div className="flex flex-wrap justify-center gap-2">
                    {lastRoll.rolls.map((roll, idx) => (
                      <div key={idx} className="w-10 h-10 bg-zinc-800 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-300 font-bold text-sm shadow-inner">
                        {roll}
                      </div>
                    ))}
                    {lastRoll.bonus !== 0 && (
                      <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-center text-amber-500 font-bold text-sm">
                        {lastRoll.bonus > 0 ? `+${lastRoll.bonus}` : lastRoll.bonus}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button 
                onClick={() => setLastRoll(null)}
                className="mt-2 text-zinc-500 text-[10px] uppercase font-bold tracking-widest hover:text-zinc-300 transition-colors"
              >
                Clique para fechar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }
      `}</style>
    </div>
  );
}

function SubSection({ title, icon, children, defaultCollapsed = true }: { title: string, icon: React.ReactNode, children: React.ReactNode, defaultCollapsed?: boolean }) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const hasChildren = React.Children.toArray(children).some(child => child !== null);
  
  if (!hasChildren) return null;

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/20">
      <div 
        className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-zinc-800/30 transition-colors bg-zinc-800/20"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-500/70">{icon}</span>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{title}</h4>
        </div>
        {isCollapsed ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronUp size={14} className="text-zinc-500" />}
      </div>
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-2 space-y-2 border-t border-zinc-800">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
        value={value ?? ''} 
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
        value={value ?? ''} 
        onChange={e => onChange(e.target.value)}
        rows={2}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 transition-all break-words whitespace-normal resize-none"
      />
    </div>
  );
}

function ProgressBar({ label, current, max, color, onChange }: { label: string, current: number, max: number, color: string, onChange: (v: number) => void }) {
  const percent = Math.min(100, (current / max) * 100);
  const [innerValue, setInnerValue] = useState(current?.toString() ?? '');

  useEffect(() => {
    if (current !== undefined && current !== null && current.toString() !== innerValue) {
      if (current === 0 && innerValue === '') return;
      setInnerValue(current.toString());
    }
  }, [current]);

  return (
    <div>
      <div className="flex justify-between items-end mb-1.5">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{label}</span>
        <div className="flex items-center gap-1">
          <input 
            type="number" 
            value={innerValue} 
            onChange={e => {
              setInnerValue(e.target.value);
              onChange(parseInt(e.target.value) || 0);
            }}
            className="min-w-[3rem] w-auto bg-transparent text-right font-bold text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
  const [innerValue, setInnerValue] = useState(value?.toString() ?? '');

  useEffect(() => {
    if (value !== undefined && value !== null && value.toString() !== innerValue) {
      if (value === 0 && innerValue === '') return;
      setInnerValue(value.toString());
    }
  }, [value]);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 p-2 rounded-lg">
      <div className="text-[9px] text-zinc-500 font-bold uppercase mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <input 
          type="number" 
          value={innerValue} 
          onChange={e => {
            setInnerValue(e.target.value);
            onChange(parseInt(e.target.value) || 0);
          }}
          className="w-full bg-transparent text-xs font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      <div className="h-1 bg-zinc-800 rounded-full mt-1 overflow-hidden">
        <div className={cn("h-full", color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function WeaponProperties({ item, onChange }: { item: any, onChange: (updates: any) => void }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <MiniInput label="Dano" value={item.dano || '0'} onChange={v => onChange({ dano: v })} />
        <MiniInput label="Acerto" value={item.acerto || 0} type="number" onChange={v => onChange({ acerto: parseInt(v) || 0 })} />
        <MiniInput label="Escala" value={item.escala ?? ''} onChange={v => onChange({ escala: v })} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MiniInput label="Corte" value={item.corte || 0} type="number" onChange={v => onChange({ corte: parseInt(v) || 0 })} />
        <MiniInput label="Impacto" value={item.impacto || 0} type="number" onChange={v => onChange({ impacto: parseInt(v) || 0 })} />
        <MiniInput label="Perf." value={item.perfuracao || 0} type="number" onChange={v => onChange({ perfuracao: parseInt(v) || 0 })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniInput label="Resist." value={item.resistencia || 0} type="number" onChange={v => onChange({ resistencia: parseInt(v) || 0 })} />
        <MiniInput label="Durab." value={item.durabilidade || 0} type="number" onChange={v => onChange({ durabilidade: parseInt(v) || 0 })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniInput label="Peso" value={item.peso || 0} type="number" onChange={v => onChange({ peso: parseFloat(v) || 0 })} />
        <MiniInput label="Vol" value={item.volume || 0} type="number" onChange={v => onChange({ volume: parseFloat(v) || 0 })} />
      </div>
      <TextArea label="Descrição" value={item.descricao || item.efeito || ''} onChange={v => onChange({ descricao: v, efeito: v })} />
    </div>
  );
}

function ArmorProperties({ item, onChange }: { item: any, onChange: (updates: any) => void }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <MiniInput label="Corte" value={item.corte || 0} type="number" onChange={v => onChange({ corte: parseInt(v) || 0 })} />
        <MiniInput label="Impacto" value={item.impacto || 0} type="number" onChange={v => onChange({ impacto: parseInt(v) || 0 })} />
        <MiniInput label="Perf." value={item.perfuracao || 0} type="number" onChange={v => onChange({ perfuracao: parseInt(v) || 0 })} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <MiniInput label="Durab." value={item.durabilidade || 0} type="number" onChange={v => onChange({ durabilidade: parseInt(v) || 0 })} />
        <MiniInput label="Peso" value={item.peso || 0} type="number" onChange={v => onChange({ peso: parseFloat(v) || 0 })} />
        <MiniInput label="Vol" value={item.volume || 0} type="number" onChange={v => onChange({ volume: parseFloat(v) || 0 })} />
        <MiniInput label="Redução de Dano" value={item.reducaoDano || 0} type="number" onChange={v => onChange({ reducaoDano: parseInt(v) || 0 })} />
      </div>
      <TextArea label="Descrição" value={item.descricao || item.efeito || ''} onChange={v => onChange({ descricao: v, efeito: v })} />
    </div>
  );
}

function DiceImage({ sides, fileName, className }: { sides: number, fileName?: string, className?: string }) {
  const [error, setError] = useState(false);
  
  if (fileName && !error) {
    return (
      <img 
        src={`/${fileName}`} 
        alt={`d${sides}`} 
        className={className} 
        onError={() => setError(true)}
        referrerPolicy="no-referrer"
      />
    );
  }
  
  return <Dices className={className} />;
}

function NumericInput({ label, value, onChange, className, min, max, size = "md" }: { label?: string, value: number, onChange: (v: number) => void, className?: string, min?: number, max?: number, size?: "sm" | "md" | "lg" }) {
  const [innerValue, setInnerValue] = useState(value?.toString() ?? '');

  useEffect(() => {
    if (value !== undefined && value !== null && value.toString() !== innerValue) {
      if (value === 0 && innerValue === '') return;
      setInnerValue(value.toString());
    }
  }, [value]);

  return (
    <div className={cn("flex flex-col min-w-0", className)}>
      {label && <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 truncate">{label}</label>}
      <div className="flex items-center gap-1">
        <button 
          onClick={() => {
            const newVal = Math.max(min ?? -999, value - 1);
            onChange(newVal);
          }}
          className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 transition-colors"
        >
          <ChevronDown size={size === "lg" ? 20 : 16} />
        </button>
        <input 
          type="number" 
          value={innerValue} 
          min={min}
          max={max}
          onChange={e => {
            setInnerValue(e.target.value);
            onChange(parseInt(e.target.value) || 0);
          }}
          className={cn(
            "bg-black/20 border border-zinc-800/50 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 transition-all text-amber-500 font-bold text-center flex-1 min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            size === "sm" && "py-1 px-1 text-xs",
            size === "md" && "py-2 px-2 text-sm",
            size === "lg" && "py-3 px-3 text-lg"
          )}
        />
        <button 
          onClick={() => {
            const newVal = Math.min(max ?? 999, value + 1);
            onChange(newVal);
          }}
          className="p-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 transition-colors"
        >
          <ChevronUp size={size === "lg" ? 20 : 16} />
        </button>
      </div>
    </div>
  );
}

function MiniInput({ label, value, type = "text", onChange }: { label: string, value: any, type?: string, onChange: (v: string) => void }) {
  const [innerValue, setInnerValue] = useState(value?.toString() ?? '');

  useEffect(() => {
    if (value !== undefined && value !== null && value.toString() !== innerValue) {
      if (value === 0 && innerValue === '') return;
      setInnerValue(value.toString());
    }
  }, [value]);

  return (
    <div className="flex flex-col min-w-0">
      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter mb-0.5 truncate">{label}</span>
      {type === "text" ? (
        <textarea 
          value={innerValue} 
          onChange={e => {
            setInnerValue(e.target.value);
            onChange(e.target.value);
          }}
          rows={1}
          className="bg-transparent text-sm font-bold focus:outline-none border-b border-zinc-800 focus:border-amber-500/50 break-words whitespace-normal resize-none overflow-hidden min-h-[20px] w-full"
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${target.scrollHeight}px`;
          }}
        />
      ) : (
        <input 
          type={type} 
          value={innerValue} 
          onChange={e => {
            setInnerValue(e.target.value);
            onChange(e.target.value);
          }}
          className="bg-transparent text-sm font-bold focus:outline-none border-b border-zinc-800 focus:border-amber-500/50 w-full min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      )}
    </div>
  );
}
