import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Plus, Wand2, Zap, Trash2, X, Droplet, Sparkles, Flame, Skull
} from 'lucide-react';
import { Character, Spell } from '../types';
import { SpellData, SPELLS_LIBRARY } from '../data/spells';
import { cn } from '../lib/utils';

interface SpellLibraryProps {
  characters: Character[];
  activeCharId: string | null;
  onAddSpellToCharacter: (characterId: string, spell: Spell) => void;
  showToast?: (message: string, type?: "success" | "error" | "info") => void;
  user?: any;
  onAddToken?: (token: any) => void;
}

export const SpellLibrary: React.FC<SpellLibraryProps> = ({
  characters,
  activeCharId,
  onAddSpellToCharacter,
  showToast,
  user,
  onAddToken
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [customSpells, setCustomSpells] = useState<SpellData[]>(() => {
    try {
      const saved = localStorage.getItem('demons_despair_custom_spells');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modal Send to Character
  const [spellToSend, setSpellToSend] = useState<SpellData | null>(null);
  const [targetCharId, setTargetCharId] = useState<string>(activeCharId || (characters[0]?.id ?? ''));

  // Modal Create Custom Spell (with AoE shape, width, height, color)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSpell, setNewSpell] = useState<Partial<SpellData & { hasAoE: boolean; aoeShape: 'circle' | 'square' | 'rectangle' | 'cone' | 'arc'; aoeWidth: number; aoeHeight: number; aoeColor: string }>>({
    nome: '',
    escola: 'Feitiço',
    tipo: 'Ataque',
    dano: '1d6',
    mana: 2,
    acerto: 2,
    efeito: '',
    hasAoE: false,
    aoeShape: 'circle',
    aoeWidth: 3,
    aoeHeight: 3,
    aoeColor: 'blue'
  });

  useEffect(() => {
    try {
      localStorage.setItem('demons_despair_custom_spells', JSON.stringify(customSpells));
    } catch (e) {
      console.error("Erro ao salvar magias personalizadas", e);
    }
  }, [customSpells]);

  useEffect(() => {
    if (activeCharId) {
      setTargetCharId(activeCharId);
    } else if (characters.length > 0 && !targetCharId) {
      setTargetCharId(characters[0].id);
    }
  }, [activeCharId, characters]);

  const selectedChar = useMemo(() => {
    return characters.find(c => c.id === targetCharId) || characters[0] || null;
  }, [characters, targetCharId]);

  const allSpells = useMemo(() => {
    return [...SPELLS_LIBRARY, ...customSpells];
  }, [customSpells]);

  const filteredSpells = useMemo(() => {
    return allSpells.filter(spell => {
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = spell.nome.toLowerCase().includes(query);
        const matchesEfeito = spell.efeito?.toLowerCase().includes(query);
        const matchesEscola = spell.escola?.toLowerCase().includes(query);
        return matchesName || matchesEfeito || matchesEscola;
      }
      return true;
    });
  }, [allSpells, searchTerm]);

  const handleOpenSendModal = (spell: SpellData) => {
    setSpellToSend(spell);
    if (activeCharId) setTargetCharId(activeCharId);
  };

  const handleConfirmSend = () => {
    if (!spellToSend) return;
    if (!selectedChar) {
      showToast?.("Selecione um personagem para aprender a magia.", "error");
      return;
    }

    const payload: Spell = {
      id: `spell-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      nome: spellToSend.nome,
      escola: spellToSend.escola,
      tipo: spellToSend.tipo,
      escala: '0',
      efeito: spellToSend.efeito,
      dano: spellToSend.dano || '0',
      mana: spellToSend.mana || 0,
      acerto: spellToSend.acerto || 0,
      aoeShape: (spellToSend as any).aoeShape,
      aoeWidth: (spellToSend as any).aoeWidth,
      aoeHeight: (spellToSend as any).aoeHeight,
      aoeColor: (spellToSend as any).aoeColor,
    };

    onAddSpellToCharacter(selectedChar.id, payload);
    showToast?.(`Magia "${payload.nome}" adicionada à ficha de ${selectedChar.nome}!`, "success");
    setSpellToSend(null);
  };

  const handleCreateCustomSpell = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpell.nome?.trim()) {
      showToast?.("Informe o nome da magia.", "error");
      return;
    }

    const created: SpellData & { aoeShape?: string; aoeWidth?: number; aoeHeight?: number; aoeColor?: string } = {
      id: `custom-spell-${Date.now()}`,
      nome: newSpell.nome.trim(),
      escola: newSpell.escola || 'Feitiço',
      tipo: newSpell.tipo || 'Ataque',
      escala: '0',
      dano: newSpell.dano?.trim() || '0',
      mana: Number(newSpell.mana) || 0,
      acerto: Number(newSpell.acerto) || 0,
      efeito: newSpell.efeito?.trim() || "Efeito mágico.",
      aoeShape: newSpell.hasAoE ? newSpell.aoeShape : undefined,
      aoeWidth: newSpell.hasAoE ? Number(newSpell.aoeWidth) || 3 : undefined,
      aoeHeight: newSpell.hasAoE ? Number(newSpell.aoeHeight) || 3 : undefined,
      aoeColor: newSpell.hasAoE ? newSpell.aoeColor || 'blue' : undefined,
    };

    setCustomSpells(prev => [created, ...prev]);
    showToast?.(`Magia "${created.nome}" criada com sucesso!`, "success");
    setIsCreateModalOpen(false);
    setNewSpell({
      nome: '',
      escola: 'Feitiço',
      tipo: 'Ataque',
      dano: '1d6',
      mana: 2,
      acerto: 2,
      efeito: '',
      hasAoE: false,
      aoeShape: 'circle',
      aoeWidth: 3,
      aoeHeight: 3,
      aoeColor: 'blue'
    });
  };

  const handleDeleteCustomSpell = (id: string) => {
    setCustomSpells(prev => prev.filter(s => s.id !== id));
    showToast?.("Magia personalizada removida.", "info");
  };

  // Trigger AoE on VTT Map when casting/using spell if it has AoE
  const handleDeployAoE = (spell: SpellData) => {
    if (!spell.aoeShape) {
      showToast?.(`A magia "${spell.nome}" não possui área de efeito configurada.`, "info");
      return;
    }

    if (onAddToken) {
      const aoeWidth = spell.aoeWidth || 3;
      const aoeHeight = spell.aoeHeight || aoeWidth;
      const newToken = {
        id: `aoe-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: `${spell.nome} (Área)`,
        x: 250,
        y: 250,
        size: aoeWidth,
        type: 'aoe',
        aoeShape: spell.aoeShape,
        aoeColor: spell.aoeColor || 'blue',
        aoeWidth: aoeWidth,
        aoeHeight: aoeHeight,
        rotation: 0
      };
      onAddToken(newToken);
      showToast?.(`Área de Efeito de "${spell.nome}" adicionada ao mapa VTT!`, "success");
    } else {
      showToast?.("Mapa VTT não está disponível no momento.", "error");
    }
  };

  return (
    <div className="w-full h-full min-h-[calc(100vh-100px)] flex flex-col p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
                <Wand2 size={22} />
              </span>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-zinc-100">
                Grimório de Magias & Rituais
              </h2>
            </div>
            <p className="text-xs md:text-sm text-zinc-400 max-w-2xl">
              Consulte e adicione magias ao grimório. Magias com área de efeito sincronizam diretamente com o mapa VTT.
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsCreateModalOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              <Plus size={16} />
              Criar Magia
            </motion.button>
          </div>
        </div>

        <div className="mt-6 relative z-10">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar magias por nome, escola ou efeito..."
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-11 pr-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/60 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid matching character sheet layout without character selector */}
      <div className="flex-1">
        <div className="flex justify-between items-center mb-3 px-1">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
            Mostrando {filteredSpells.length} magias
          </span>
        </div>

        {filteredSpells.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-2xl">
            <Wand2 size={48} className="text-zinc-700 mx-auto mb-3" />
            <h4 className="text-base font-bold text-zinc-400">Nenhuma magia no grimório</h4>
            <p className="text-xs text-zinc-600 mt-1 max-w-sm mx-auto">
              Clique em "Criar Magia" acima para adicionar magias customizadas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pb-12">
            {filteredSpells.map((spell) => {
              const isCustom = customSpells.some(cs => cs.id === spell.id);
              const alreadyLearned = selectedChar?.magias?.some(m => m.nome.toLowerCase() === spell.nome.toLowerCase());
              const hasAoE = !!spell.aoeShape;

              return (
                <div
                  key={spell.id}
                  className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs relative group space-y-2 shadow-sm"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center flex-1 min-w-0 gap-1.5">
                      <span className="font-bold text-amber-500 truncate text-sm">{spell.nome}</span>
                      {hasAoE && (
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400 border border-teal-500/30">
                          Área ({spell.aoeShape})
                        </span>
                      )}
                      {isCustom && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-indigo-400 border border-zinc-700">
                          Custom
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {isCustom && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleDeleteCustomSpell(spell.id)}
                          className="text-red-500 hover:text-red-400 p-1"
                          title="Excluir magia"
                        >
                          <Trash2 size={16} />
                        </motion.button>
                      )}
                      {hasAoE && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleDeployAoE(spell)}
                          className="flex items-center gap-1 px-2 py-1 bg-teal-500/15 hover:bg-teal-500/25 text-teal-400 rounded text-[10px] font-bold transition-all cursor-pointer border border-teal-500/30"
                          title="Lançar Área de Efeito no VTT"
                        >
                          <span>VTT</span>
                        </motion.button>
                      )}
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleOpenSendModal(spell)}
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer border",
                          alreadyLearned
                            ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                            : "bg-indigo-600/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-600/30"
                        )}
                      >
                        <Zap size={13} />
                        <span>{alreadyLearned ? 'Adicionar Cópia' : 'Aprender'}</span>
                      </motion.button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter mb-0.5">Escola</span>
                      <span className="bg-black/40 border border-zinc-700/50 rounded px-2 py-1 text-xs text-zinc-300 font-bold">
                        {spell.escola}
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter mb-0.5">Tipo</span>
                      <span className="bg-black/40 border border-zinc-700/50 rounded px-2 py-1 text-xs text-zinc-300 font-bold">
                        {spell.tipo}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter mb-0.5">Dano</span>
                      <span className="bg-black/40 border border-zinc-700/50 rounded px-2 py-1 text-xs text-zinc-300 font-bold font-mono">
                        {spell.dano || '0'}
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter mb-0.5">Acerto</span>
                      <span className="bg-black/40 border border-zinc-700/50 rounded px-2 py-1 text-xs text-zinc-300 font-bold font-mono">
                        {spell.acerto}
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter mb-0.5">Mana</span>
                      <span className="bg-black/40 border border-zinc-700/50 rounded px-2 py-1 text-xs text-zinc-300 font-bold font-mono">
                        {spell.mana}
                      </span>
                    </div>
                  </div>

                  {spell.efeito && (
                    <p className="text-zinc-400 text-[11px] leading-relaxed pt-1 border-t border-zinc-800/60">
                      {spell.efeito}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Aprender Magia */}
      <AnimatePresence>
        {spellToSend && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                    <Wand2 className="text-indigo-400" size={18} />
                    Adicionar Magia à Ficha
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Magia: <strong className="text-indigo-400">{spellToSend.nome}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setSpellToSend(null)}
                  className="text-zinc-500 hover:text-zinc-300 p-1"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                    Personagem Destino
                  </label>
                  <select
                    value={targetCharId}
                    onChange={(e) => setTargetCharId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                  >
                    {characters.map(char => (
                      <option key={char.id} value={char.id}>
                        {char.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSpellToSend(null)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancelar
                </button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleConfirmSend}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/20"
                >
                  Confirmar Aprendizado
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Criar Magia com suporte a Área de Efeito */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                    <Plus className="text-indigo-400" size={18} />
                    Criar Magia Personalizada
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Configure propriedades de magia e opcionalmente uma Área de Efeito para o VTT.
                  </p>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-zinc-500 hover:text-zinc-300 p-1"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateCustomSpell} className="space-y-3 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                    Nome da Magia *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nome da magia"
                    value={newSpell.nome}
                    onChange={(e) => setNewSpell(prev => ({ ...prev, nome: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Escola</label>
                    <select
                      value={newSpell.escola}
                      onChange={(e) => setNewSpell(prev => ({ ...prev, escola: e.target.value as any }))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Feitiço">Feitiço</option>
                      <option value="elemental">Elemental</option>
                      <option value="magia negra">Magia Negra</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Tipo</label>
                    <select
                      value={newSpell.tipo}
                      onChange={(e) => setNewSpell(prev => ({ ...prev, tipo: e.target.value as any }))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Ataque">Ataque</option>
                      <option value="Efeito">Efeito</option>
                      <option value="Utilidade">Utilidade</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Dano</label>
                    <input
                      type="text"
                      placeholder="1d6"
                      value={newSpell.dano}
                      onChange={(e) => setNewSpell(prev => ({ ...prev, dano: e.target.value }))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Acerto</label>
                    <input
                      type="number"
                      value={newSpell.acerto}
                      onChange={(e) => setNewSpell(prev => ({ ...prev, acerto: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Mana</label>
                    <input
                      type="number"
                      min="0"
                      value={newSpell.mana}
                      onChange={(e) => setNewSpell(prev => ({ ...prev, mana: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* AoE Settings matching VTT AoE templates */}
                <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!newSpell.hasAoE}
                      onChange={(e) => setNewSpell(prev => ({ ...prev, hasAoE: e.target.checked }))}
                      className="rounded bg-zinc-800 border-zinc-700 text-indigo-500 focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-zinc-200">Adicionar Área de Efeito VTT (AoE)</span>
                  </label>

                  {newSpell.hasAoE && (
                    <div className="space-y-3 pt-2 border-t border-zinc-800/60">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Formato</label>
                          <select
                            value={newSpell.aoeShape}
                            onChange={(e) => setNewSpell(prev => ({ ...prev, aoeShape: e.target.value as any }))}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="circle">Círculo</option>
                            <option value="square">Quadrado</option>
                            <option value="rectangle">Retângulo</option>
                            <option value="cone">Cone</option>
                            <option value="arc">Arco</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Cor / Efeito</label>
                          <select
                            value={newSpell.aoeColor}
                            onChange={(e) => setNewSpell(prev => ({ ...prev, aoeColor: e.target.value }))}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="red">Vermelho</option>
                            <option value="blue">Azul</option>
                            <option value="green">Verde</option>
                            <option value="yellow">Amarelo</option>
                            <option value="purple">Roxo</option>
                            <option value="gray">Cinza</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Tamanho / Raio (m)</label>
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={newSpell.aoeWidth}
                            onChange={(e) => setNewSpell(prev => ({ ...prev, aoeWidth: parseInt(e.target.value) || 3 }))}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        {(newSpell.aoeShape === 'rectangle' || newSpell.aoeShape === 'arc') && (
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Comprimento / Espessura</label>
                            <input
                              type="number"
                              min="1"
                              max="30"
                              value={newSpell.aoeHeight}
                              onChange={(e) => setNewSpell(prev => ({ ...prev, aoeHeight: parseInt(e.target.value) || 3 }))}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                    Efeito
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Efeito da magia..."
                    value={newSpell.efeito}
                    onChange={(e) => setNewSpell(prev => ({ ...prev, efeito: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <div className="pt-4 border-t border-zinc-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-colors"
                  >
                    Cancelar
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/20"
                  >
                    Salvar Magia
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
