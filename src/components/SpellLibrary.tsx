import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Plus, Search, Trash2, Edit2, Save, ArrowUpRight, 
  Zap, PlusCircle, Check, Info, X, Wand2, HelpCircle
} from 'lucide-react';
import { Spell, Character } from '../types';
import { subscribeToSpellsLibrary, saveSpellToLibrary, deleteSpellFromLibrary, saveSpellsBatch } from '../services/spellLibraryService';
import { generateId } from '../lib/random';

interface SpellLibraryProps {
  characters: Character[];
  activeCharId: string | null;
  onAddSpellToCharacter: (charId: string, spell: Spell) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  user: any;
}

const DEFAULT_SPELLS: Spell[] = [];

export const SpellLibrary: React.FC<SpellLibraryProps> = ({
  characters,
  activeCharId,
  onAddSpellToCharacter,
  showToast,
  user
}) => {
  const [spells, setSpells] = useState<Spell[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [editingSpell, setEditingSpell] = useState<Partial<Spell> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const editorRef = useRef<HTMLDivElement>(null);

  const [localForm, setLocalForm] = useState<Record<string, string>>({});
  const [selectedCharId, setSelectedCharId] = useState<string>('');

  // Scroll to editor
  useEffect(() => {
    if (editingSpell) {
      setTimeout(() => {
        editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [editingSpell?.id]);

  // Sync editingSpell to localForm
  useEffect(() => {
    if (editingSpell) {
      setLocalForm({
        nome: editingSpell.nome || '',
        escola: editingSpell.escola || 'Feitiço',
        tipo: editingSpell.tipo || 'Ataque',
        escala: editingSpell.escala || '0',
        efeito: editingSpell.efeito || '',
        dano: editingSpell.dano || '0',
        mana: editingSpell.mana !== undefined ? String(editingSpell.mana) : '0',
        acerto: editingSpell.acerto !== undefined ? String(editingSpell.acerto) : '0',
      });
    } else {
      setLocalForm({});
    }
  }, [editingSpell?.id]);

  const handleLocalChange = (field: string, val: string) => {
    setLocalForm(prev => ({ ...prev, [field]: val }));
    
    setEditingSpell(prev => {
      if (!prev) return null;
      const updated = { ...prev };
      if (field === 'nome') updated.nome = val;
      else if (field === 'escola') updated.escola = val;
      else if (field === 'tipo') updated.tipo = val as any;
      else if (field === 'escala') updated.escala = val as any;
      else if (field === 'efeito') updated.efeito = val;
      else if (field === 'dano') updated.dano = val;
      else {
        const num = parseInt(val, 10) || 0;
        (updated as any)[field] = num;
      }
      return updated;
    });
  };

  // Subscribe to library spells
  useEffect(() => {
    if (!user) {
      setSpells([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToSpellsLibrary(user.uid, (loadedSpells) => {
      setSpells(loadedSpells);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Set default send destination based on active character
  useEffect(() => {
    if (activeCharId) {
      setSelectedCharId(activeCharId);
    } else if (characters.length > 0) {
      setSelectedCharId(characters[0].id);
    }
  }, [activeCharId, characters]);

  // Filter spells
  const filteredSpells = useMemo(() => {
    return spells.filter(spell => {
      const matchesSearch = (spell.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (spell.efeito || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesSchool = selectedSchool === 'All' || 
                            spell.escola?.toLowerCase() === selectedSchool.toLowerCase();
      
      const matchesType = selectedType === 'All' || 
                          spell.tipo === selectedType;

      return matchesSearch && matchesSchool && matchesType;
    });
  }, [spells, searchTerm, selectedSchool, selectedType]);

  const handleCreateNew = () => {
    setIsCreating(true);
    setEditingSpell({
      id: generateId(),
      nome: 'Nova Magia',
      escola: 'Feitiço',
      tipo: 'Ataque',
      escala: '0',
      efeito: '',
      dano: '1d6',
      mana: 5,
      acerto: 0,
    });
  };

  const handleSave = async () => {
    if (!user) return;
    if (!editingSpell || !localForm.nome) {
      showToast("Preencha o nome da magia.", "error");
      return;
    }

    try {
      const spellToSave: Spell = {
        id: editingSpell.id || generateId(),
        nome: localForm.nome,
        escola: localForm.escola || 'Feitiço',
        tipo: (localForm.tipo as any) || 'Ataque',
        escala: (localForm.escala as any) || '0',
        efeito: localForm.efeito || '',
        dano: localForm.dano || '0',
        mana: parseInt(localForm.mana, 10) || 0,
        acerto: parseInt(localForm.acerto, 10) || 0,
      };

      await saveSpellToLibrary(user.uid, spellToSave);
      showToast("Magia salva com sucesso!", "success");
      setEditingSpell(null);
      setIsCreating(false);
    } catch (err: any) {
      showToast("Erro ao salvar magia.", "error");
    }
  };

  const handleDelete = async (spellId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteSpellFromLibrary(spellId);
      showToast("Magia removida com sucesso.", "success");
      if (editingSpell?.id === spellId) {
        setEditingSpell(null);
        setIsCreating(false);
      }
    } catch (err) {
      showToast("Erro ao remover magia.", "error");
    }
  };

  const handleSendToCharacter = () => {
    if (!selectedCharId) {
      showToast("Selecione um personagem primeiro.", "error");
      return;
    }
    if (!editingSpell) return;

    const char = characters.find(c => c.id === selectedCharId);
    if (!char) return;

    const spellToSend: Spell = {
      id: generateId(),
      nome: localForm.nome || editingSpell.nome || 'Nova Magia',
      escola: localForm.escola || editingSpell.escola || 'Feitiço',
      tipo: (localForm.tipo as any) || editingSpell.tipo || 'Ataque',
      escala: (localForm.escala as any) || editingSpell.escala || '0',
      efeito: localForm.efeito || editingSpell.efeito || '',
      dano: localForm.dano || editingSpell.dano || '0',
      mana: parseInt(localForm.mana, 10) || editingSpell.mana || 0,
      acerto: parseInt(localForm.acerto, 10) || editingSpell.acerto || 0,
    };

    onAddSpellToCharacter(selectedCharId, spellToSend);
    showToast(`Magia '${spellToSend.nome}' adicionada à ficha de ${char.nome}!`, "success");
  };

  const schoolNames: Record<string, string> = {
    'feitiço': 'Feitiço',
    'elemental': 'Elemental',
    'magia negra': 'Magia Negra',
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full max-w-[1600px] mx-auto animate-fadeIn">
      
      {/* LEFT COLUMN - SEARCH AND LIST */}
      <div className="xl:col-span-5 flex flex-col space-y-4 h-full min-h-0">
        
        {/* Header & Controls */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-amber-500 tracking-widest flex items-center gap-2">
              <Wand2 size={16} /> Biblioteca de Magias
            </h3>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCreateNew}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center gap-1"
            >
              <Plus size={12} /> Nova Magia
            </motion.button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar magia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50 placeholder:text-zinc-600 transition-colors"
            />
          </div>

          {/* School & Type Filters */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Escola</label>
              <select
                value={selectedSchool}
                onChange={(e) => setSelectedSchool(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 font-medium focus:outline-none focus:border-amber-500/30"
              >
                <option value="All">Todas as Escolas</option>
                <option value="Feitiço">Feitiço</option>
                <option value="elemental">Elemental</option>
                <option value="magia negra">Magia Negra</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Tipo</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 font-medium focus:outline-none focus:border-amber-500/30"
              >
                <option value="All">Todos os Tipos</option>
                <option value="Ataque">Ataque</option>
                <option value="Efeito">Efeito</option>
                <option value="Utilidade">Utilidade</option>
              </select>
            </div>
          </div>
        </div>

        {/* Spells List */}
        <div className="flex-1 bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-2 overflow-y-auto max-h-[500px] xl:max-h-[calc(100vh-280px)] scrollbar-none space-y-1.5">
          {loading ? (
            <div className="text-center py-12 text-xs text-zinc-500 animate-pulse">
              Carregando biblioteca...
            </div>
          ) : filteredSpells.length === 0 ? (
            <div className="text-center py-12 text-xs text-zinc-500 italic">
              Nenhuma magia encontrada.
            </div>
          ) : (
            filteredSpells.map((spell) => {
              const isSelected = editingSpell?.id === spell.id;
              const typeColors: Record<string, string> = {
                'Ataque': 'bg-red-500/10 text-red-400 border-red-500/20',
                'Efeito': 'bg-teal-500/10 text-teal-400 border-teal-500/20',
                'Utilidade': 'bg-sky-500/10 text-sky-400 border-sky-500/20'
              };
              const schoolLabel = schoolNames[spell.escola?.toLowerCase()] || spell.escola || 'Feitiço';

              return (
                <div
                  key={spell.id}
                  onClick={() => {
                    setEditingSpell(spell);
                    setIsCreating(false);
                  }}
                  className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected 
                      ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/5' 
                      : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700/80 hover:bg-zinc-900/60'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-zinc-100 truncate block">
                        {spell.nome}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded border text-[8px] font-black uppercase tracking-wider ${typeColors[spell.tipo] || typeColors.Ataque}`}>
                        {spell.tipo}
                      </span>
                    </div>

                    <div className="flex items-center gap-x-2 text-[10px] text-zinc-400 font-medium">
                      <span className="text-zinc-500 font-bold uppercase tracking-tight">
                        {schoolLabel}
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span>Mana: <b className="text-zinc-200">{spell.mana}</b></span>
                      {spell.tipo !== 'Utilidade' && (
                        <>
                          <span className="text-zinc-600">•</span>
                          <span>Dano: <b className="text-zinc-200">{spell.dano || '0'}</b></span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleDelete(spell.id, e)}
                      className="p-1.5 bg-zinc-950/40 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 border border-zinc-800/60 rounded-lg transition-colors"
                      title="Excluir da biblioteca"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* RIGHT COLUMN - EDITOR & SEND PANEL */}
      <div ref={editorRef} className="xl:col-span-7 flex flex-col space-y-4 h-full min-h-0">
        
        {editingSpell ? (
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl flex-1 overflow-y-auto scrollbar-none">
            
            {/* Form Header */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <h3 className="text-xs font-black uppercase text-amber-500 tracking-widest flex items-center gap-1.5">
                {isCreating ? <PlusCircle size={14} /> : <Edit2 size={14} />}
                {isCreating ? 'Criar Magia Modelo' : 'Editar Magia Modelo'}
              </h3>
              <span className="text-[10px] font-mono text-zinc-500">{editingSpell.id}</span>
            </div>

            {/* General Information */}
            <div className="space-y-4">
              
              {/* Name */}
              <div>
                <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-1">
                  Nome da Magia
                </label>
                <input
                  type="text"
                  value={localForm.nome ?? ''}
                  onChange={(e) => handleLocalChange('nome', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                  placeholder="Ex: Bola de Fogo"
                />
              </div>

              {/* School & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-1">
                    Escola
                  </label>
                  <select
                    value={localForm.escola ?? 'Feitiço'}
                    onChange={(e) => handleLocalChange('escola', e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="Feitiço">Feitiço</option>
                    <option value="elemental">Elemental</option>
                    <option value="magia negra">Magia Negra</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-1">
                    Tipo de Magia
                  </label>
                  <select
                    value={localForm.tipo ?? 'Ataque'}
                    onChange={(e) => handleLocalChange('tipo', e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="Ataque">Ataque</option>
                    <option value="Efeito">Efeito</option>
                    <option value="Utilidade">Utilidade</option>
                  </select>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                
                {/* Damage */}
                <div>
                  <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-1">
                    Dano (Dado)
                  </label>
                  <input
                    type="text"
                    value={localForm.dano ?? ''}
                    onChange={(e) => handleLocalChange('dano', e.target.value)}
                    disabled={localForm.tipo === 'Utilidade'}
                    className={`w-full px-3 py-2 bg-zinc-950 border rounded-xl text-xs text-white focus:outline-none text-center ${
                      localForm.tipo === 'Utilidade' 
                        ? 'border-zinc-850 text-zinc-600 bg-zinc-900/20 cursor-not-allowed' 
                        : 'border-zinc-800 focus:border-amber-500/50'
                    }`}
                    placeholder="Ex: 2d8 ou 1d6+2"
                  />
                </div>

                {/* Accuracy difficulty / bonus */}
                <div>
                  <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-1">
                    Acerto (Ficha)
                  </label>
                  <input
                    type="number"
                    value={localForm.acerto ?? '0'}
                    onChange={(e) => handleLocalChange('acerto', e.target.value)}
                    disabled={localForm.tipo === 'Utilidade'}
                    className={`w-full px-3 py-2 bg-zinc-950 border rounded-xl text-xs text-white focus:outline-none text-center ${
                      localForm.tipo === 'Utilidade' 
                        ? 'border-zinc-850 text-zinc-600 bg-zinc-900/20 cursor-not-allowed' 
                        : 'border-zinc-800 focus:border-amber-500/50'
                    }`}
                  />
                </div>

                {/* Mana cost */}
                <div>
                  <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-1">
                    Custo de Mana
                  </label>
                  <input
                    type="number"
                    value={localForm.mana ?? '0'}
                    onChange={(e) => handleLocalChange('mana', e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/50 text-center"
                  />
                </div>

                {/* Scaling */}
                <div>
                  <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-1">
                    Escala Atributo
                  </label>
                  <select
                    value={localForm.escala ?? '0'}
                    onChange={(e) => handleLocalChange('escala', e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/50 text-center font-bold"
                  >
                    <option value="0">Nenhuma (0)</option>
                    <option value="D">D</option>
                    <option value="C">C</option>
                    <option value="B">B</option>
                    <option value="A">A</option>
                  </select>
                </div>

              </div>

              {/* Description / Effect */}
              <div>
                <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-1">
                  Efeito / Descrição
                </label>
                <textarea
                  value={localForm.efeito ?? ''}
                  onChange={(e) => handleLocalChange('efeito', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/50 h-20 resize-none placeholder:text-zinc-700"
                  placeholder="Escreva as propriedades adicionais da magia, efeitos especiais ou condições de acerto..."
                />
              </div>

            </div>

            {/* Save Buttons */}
            <div className="flex items-center gap-3 justify-end border-t border-zinc-800/80 pt-4">
              <button
                onClick={() => {
                  setEditingSpell(null);
                  setIsCreating(false);
                }}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
              >
                Cancelar
              </button>
              
              <button
                onClick={handleSave}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center gap-1.5"
              >
                <Save size={14} /> Salvar na Biblioteca
              </button>
            </div>

            {/* SEND PANEL (Only if editing an existing spell, not during initial creation) */}
            {!isCreating && (
              <div className="bg-zinc-950/40 border border-zinc-850 rounded-2xl p-4 mt-4 space-y-4">
                <h3 className="text-xs font-black uppercase text-amber-500 tracking-widest flex items-center gap-1.5">
                  <ArrowUpRight size={14} /> Ensinar Magia para Personagem
                </h3>
                
                <p className="text-[10px] text-zinc-500">
                  Adicione esta magia diretamente à lista de magias aprendidas de qualquer personagem ativo na campanha.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-1">
                      Personagem Destino
                    </label>
                    <select
                      value={selectedCharId}
                      onChange={(e) => setSelectedCharId(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                    >
                      <option value="" disabled>Selecione um Jogador</option>
                      {characters.map(char => (
                        <option key={char.id} value={char.id}>
                          {char.nome} {char.id === activeCharId ? '(Ativo)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSendToCharacter}
                      disabled={!selectedCharId}
                      className={`w-full sm:w-auto px-5 py-2 rounded-xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-1.5 shadow-lg transition-all ${
                        !selectedCharId
                          ? 'bg-zinc-800 text-zinc-600 border border-zinc-700/30 cursor-not-allowed'
                          : 'bg-emerald-500 hover:bg-emerald-600 text-zinc-950 hover:shadow-emerald-500/10'
                      }`}
                    >
                      <PlusCircle size={14} /> Adicionar à Ficha
                    </motion.button>
                  </div>
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="bg-zinc-900/10 border border-dashed border-zinc-800/80 rounded-2xl p-12 text-center text-zinc-500 italic text-xs h-[350px] flex flex-col items-center justify-center">
            <Wand2 size={36} className="text-zinc-700 mb-3 animate-pulse" />
            Selecione ou crie uma magia na lista ao lado para editar ou enviar para a ficha de um jogador.
          </div>
        )}

      </div>

    </div>
  );
};
