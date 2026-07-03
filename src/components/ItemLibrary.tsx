import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, Plus, Search, Trash2, Edit2, Save, ArrowUpRight, 
  Sword, Zap, Shield, PlusCircle, Check, Info, Coins, X, Target
} from 'lucide-react';
import { Item, Compartment } from '../rules/inventoryRules';
import { Character } from '../types';
import { subscribeToItemsLibrary, saveItemToLibrary, deleteItemFromLibrary } from '../services/itemLibraryService';
import { generateId } from '../lib/random';

interface ItemLibraryProps {
  characters: Character[];
  activeCharId: string | null;
  onAddItemToCharacter: (charId: string, compartmentId: string, item: Item) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  user: any;
}

export const ItemLibrary: React.FC<ItemLibraryProps> = ({
  characters,
  activeCharId,
  onAddItemToCharacter,
  showToast,
  user
}) => {
  const [items, setItems] = useState<Item[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [editingItem, setEditingItem] = useState<Partial<Item> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const editorRef = React.useRef<HTMLDivElement>(null);

  const [localForm, setLocalForm] = useState<Record<string, string>>({});

  // Scroll to editor when item is selected or created
  useEffect(() => {
    if (editingItem) {
      setTimeout(() => {
        editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [editingItem]);

  // Sync editingItem to localForm
  useEffect(() => {
    if (editingItem) {
      setLocalForm({
        nome: editingItem.nome || '',
        descricao: editingItem.descricao || '',
        peso: editingItem.peso !== undefined ? String(editingItem.peso) : '0',
        volume: editingItem.volume !== undefined ? String(editingItem.volume) : '0',
        durabilidade: editingItem.durabilidade !== undefined ? String(editingItem.durabilidade) : '0',
        maxDurabilidade: editingItem.maxDurabilidade !== undefined ? String(editingItem.maxDurabilidade) : '0',
        preco: editingItem.preco !== undefined ? String(editingItem.preco) : '0',
        
        // Arma
        dano: editingItem.dano || '',
        acerto: editingItem.acerto !== undefined ? String(editingItem.acerto) : '0',
        escala: editingItem.escala || 'D',
        atributoBase: editingItem.atributoBase || 'Força',
        corte: editingItem.corte !== undefined ? String(editingItem.corte) : '0',
        impacto: editingItem.impacto !== undefined ? String(editingItem.impacto) : '0',
        perfuracao: editingItem.perfuracao !== undefined ? String(editingItem.perfuracao) : '0',
        resistencia: editingItem.resistencia !== undefined ? String(editingItem.resistencia) : '0',

        // Catalisador
        feitico: editingItem.feitico !== undefined ? String(editingItem.feitico) : '0',
        elemental: editingItem.elemental !== undefined ? String(editingItem.elemental) : '0',
        magiaNegra: editingItem.magiaNegra !== undefined ? String(editingItem.magiaNegra) : '0',
        potencial: editingItem.potencial !== undefined ? String(editingItem.potencial) : '0',

        // Armadura
        reducaoDano: editingItem.reducaoDano !== undefined ? String(editingItem.reducaoDano) : '0',
        efeito: editingItem.efeito || '',
      });
    } else {
      setLocalForm({});
    }
  }, [editingItem?.id, editingItem?.tipo]);

  const handleLocalChange = (field: string, val: string) => {
    setLocalForm(prev => ({ ...prev, [field]: val }));
    
    setEditingItem(prev => {
      if (!prev) return null;
      const updated = { ...prev };
      if (field === 'nome') updated.nome = val;
      else if (field === 'descricao') updated.descricao = val;
      else if (field === 'dano') updated.dano = val;
      else if (field === 'escala') updated.escala = val;
      else if (field === 'atributoBase') updated.atributoBase = val;
      else if (field === 'efeito') updated.efeito = val;
      else {
        const isFloat = ['peso', 'volume', 'preco'].includes(field);
        const normalized = val.replace(',', '.');
        const num = isFloat ? (parseFloat(normalized) || 0) : (parseInt(val, 10) || 0);
        (updated as any)[field] = num;
      }
      return updated;
    });
  };

  // Send states
  const [selectedCharId, setSelectedCharId] = useState<string>('');
  const [selectedCompartmentId, setSelectedCompartmentId] = useState<string>('');
  const [sendQuantity, setSendQuantity] = useState<number>(1);

  // Subscribe to library items
  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToItemsLibrary(user.uid, (loadedItems) => {
      setItems(loadedItems);
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

  // Set default compartment when character changes
  useEffect(() => {
    const char = characters.find(c => c.id === selectedCharId);
    if (char && char.compartimentos && char.compartimentos.length > 0) {
      setSelectedCompartmentId(char.compartimentos[0].id);
    } else {
      setSelectedCompartmentId('');
    }
  }, [selectedCharId, characters]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = (item.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (item.descricao || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'All' || item.tipo === selectedType;
      return matchesSearch && matchesType;
    });
  }, [items, searchTerm, selectedType]);

  const handleCreateNew = (type: string) => {
    const newItem: Partial<Item> = {
      id: generateId(),
      nome: `Novo Item (${type})`,
      peso: 0,
      volume: 0,
      quantidade: 1,
      tipo: type,
      durabilidade: 0,
      maxDurabilidade: 0,
      descricao: '',
      preco: 0
    };

    if (type === 'Arma') {
      newItem.dano = '1d6';
      newItem.acerto = 0;
      newItem.escala = 'D';
      newItem.atributoBase = 'Força';
      newItem.corte = 0;
      newItem.impacto = 0;
      newItem.perfuracao = 0;
      newItem.resistencia = 0;
    } else if (type === 'Catalisador') {
      newItem.escala = 'D';
      newItem.atributoBase = 'Inteligência';
      newItem.feitico = 0;
      newItem.elemental = 0;
      newItem.magiaNegra = 0;
      newItem.potencial = 0;
    } else if (type === 'Armadura') {
      newItem.reducaoDano = 0;
      newItem.corte = 0;
      newItem.impacto = 0;
      newItem.perfuracao = 0;
      newItem.efeito = '';
    } else if (type === 'Munição') {
      newItem.perfuracao = 0;
      newItem.impacto = 0;
      newItem.resistencia = 0;
      newItem.efeito = '';
    }

    setEditingItem(newItem);
    setIsCreating(true);
  };

  const handleSave = async () => {
    if (!editingItem || !editingItem.nome || !editingItem.tipo || !user) {
      showToast('Por favor, preencha o nome do item.', 'error');
      return;
    }

    try {
      await saveItemToLibrary(user.uid, editingItem as Item);
      showToast(`Item "${editingItem.nome}" salvo com sucesso!`, 'success');
      setEditingItem(null);
      setIsCreating(false);
    } catch (e) {
      showToast('Erro ao salvar item na biblioteca.', 'error');
    }
  };

  const handleDelete = async (itemId: string, name: string) => {
    if (window.confirm(`Deseja realmente excluir "${name}" da biblioteca?`)) {
      try {
        await deleteItemFromLibrary(itemId);
        showToast('Item excluído com sucesso.', 'success');
        if (editingItem?.id === itemId) {
          setEditingItem(null);
        }
      } catch (e) {
        showToast('Erro ao excluir item.', 'error');
      }
    }
  };

  const handleSendToCharacter = (item: Item) => {
    if (!selectedCharId) {
      showToast('Selecione um personagem para enviar.', 'error');
      return;
    }
    if (!selectedCompartmentId) {
      showToast('Selecione um compartimento.', 'error');
      return;
    }

    const char = characters.find(c => c.id === selectedCharId);
    const comp = char?.compartimentos?.find(c => c.id === selectedCompartmentId);

    if (!char || !comp) {
      showToast('Personagem ou compartimento inválido.', 'error');
      return;
    }

    const itemToSend: Item = {
      ...item,
      id: generateId(),
      quantidade: sendQuantity
    };

    onAddItemToCharacter(selectedCharId, selectedCompartmentId, itemToSend);
    showToast(`${sendQuantity}x "${item.nome}" enviado(s) para [${comp.nome}] de ${char.nome}!`, 'success');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4">
      
      {/* Sidebar: Item list and search (5 cols) */}
      <div className="lg:col-span-5 bg-zinc-950/40 border border-zinc-800/80 rounded-2xl p-4 flex flex-col h-[calc(100vh-180px)] min-h-[500px]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="text-amber-500" size={20} />
            <span className="text-xs font-black uppercase text-zinc-400 tracking-wider font-sans">
              Biblioteca de Itens ({items.length})
            </span>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setIsCreateOpen(!isCreateOpen)}
              className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-zinc-950 text-[10px] font-black uppercase rounded-lg shadow transition-all flex items-center gap-1 z-50"
            >
              <Plus size={12} /> Criar Item
            </button>
            {isCreateOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40 bg-transparent" 
                  onClick={() => setIsCreateOpen(false)}
                />
                <div className="absolute right-0 mt-1 w-40 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 p-1 animate-fadeIn">
                  {['Geral', 'Arma', 'Catalisador', 'Armadura', 'Munição'].map(type => (
                    <button
                      key={type}
                      onClick={() => {
                        handleCreateNew(type);
                        setIsCreateOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 text-[10px] font-bold text-zinc-300 hover:text-white uppercase tracking-wider rounded-lg transition-colors"
                    >
                      + {type}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 text-zinc-600" size={14} />
          <input
            type="text"
            placeholder="Buscar item por nome ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-950/50 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/50 transition-colors"
          />
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-1 mb-4">
          {['All', 'Geral', 'Arma', 'Catalisador', 'Armadura', 'Munição'].map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                selectedType === type
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {type === 'All' ? 'Todos' : type}
            </button>
          ))}
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-zinc-600 text-xs italic">
              Nenhum item encontrado.
            </div>
          ) : (
            filteredItems.map(item => {
              const isSelected = editingItem?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setEditingItem(item);
                    setIsCreating(false);
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer relative group ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/50'
                      : 'bg-zinc-900/30 border-zinc-800/60 hover:bg-zinc-900/50 hover:border-zinc-700/80'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase text-zinc-200 tracking-tight">
                          {item.nome}
                        </span>
                        <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase rounded ${
                          item.tipo === 'Arma' ? 'bg-red-500/20 text-red-400' :
                          item.tipo === 'Catalisador' ? 'bg-purple-500/20 text-purple-400' :
                          item.tipo === 'Armadura' ? 'bg-blue-500/20 text-blue-400' :
                          item.tipo === 'Munição' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-zinc-800 text-zinc-400'
                        }`}>
                          {item.tipo}
                        </span>
                      </div>
                      
                      {item.descricao && (
                        <p className="text-[10px] text-zinc-500 mt-1 line-clamp-1">
                          {item.descricao}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-1.5 font-mono text-[9px] text-zinc-500">
                        <span>Peso: {(item.peso || 0).toFixed(1)}</span>
                        <span>Vol: {(item.volume || 0).toFixed(1)}</span>
                        {item.preco !== undefined && item.preco > 0 && (
                          <span className="text-amber-500/90 flex items-center gap-0.5" title="Preço">
                            <Coins size={10} /> {item.preco}
                          </span>
                        )}
                        {item.tipo === 'Arma' && item.dano && (
                          <span className="text-red-400/80">Dano: {item.dano}</span>
                        )}
                        {item.tipo === 'Armadura' && item.reducaoDano !== undefined && (
                          <span className="text-blue-400/80">RD: {item.reducaoDano}</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id, item.nome);
                      }}
                      className="text-zinc-600 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Excluir da biblioteca"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Content Area: Editor and Sender (7 cols) */}
      <div ref={editorRef} className="lg:col-span-7 space-y-6">
        {editingItem ? (
          <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="text-amber-500" size={16} />
                <span className="text-xs font-black uppercase text-white tracking-wider">
                  {isCreating ? 'Novo Modelo de Item' : 'Configurar Modelo de Item'}
                </span>
              </div>
              <button 
                onClick={() => {
                  setEditingItem(null);
                  setIsCreating(false);
                }}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X size={16} />
              </button>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block mb-1">
                  Nome do Item
                </label>
                <input
                  type="text"
                  value={localForm.nome ?? ''}
                  onChange={(e) => handleLocalChange('nome', e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                  placeholder="Ex: Espada Curta de Bronze"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block mb-1">
                  Tipo do Item
                </label>
                <select
                  value={editingItem.tipo || 'Geral'}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setEditingItem(prev => ({ ...prev, tipo: newType }));
                  }}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                >
                  {['Geral', 'Arma', 'Catalisador', 'Armadura', 'Munição'].map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block mb-1">
                Descrição / Propriedades
              </label>
              <textarea
                value={localForm.descricao ?? ''}
                onChange={(e) => handleLocalChange('descricao', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/50 resize-none"
                placeholder="Insira detalhes, efeitos adicionais ou observações do mestre..."
              />
            </div>

            {/* Item Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-zinc-900/20 p-3 rounded-xl border border-zinc-800/30">
              <div>
                <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-0.5">
                  Peso (kg)
                </label>
                <input
                  type="text"
                  value={localForm.peso ?? ''}
                  onChange={(e) => handleLocalChange('peso', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-0.5">
                  Volume
                </label>
                <input
                  type="text"
                  value={localForm.volume ?? ''}
                  onChange={(e) => handleLocalChange('volume', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold uppercase text-amber-500 tracking-wider block mb-0.5">
                  Preço
                </label>
                <input
                  type="text"
                  value={localForm.preco ?? ''}
                  onChange={(e) => handleLocalChange('preco', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-amber-400 focus:outline-none text-center font-bold"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-0.5">
                  Durab. Atual
                </label>
                <input
                  type="text"
                  value={localForm.durabilidade ?? ''}
                  onChange={(e) => handleLocalChange('durabilidade', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-0.5">
                  Durab. Max
                </label>
                <input
                  type="text"
                  value={localForm.maxDurabilidade ?? ''}
                  onChange={(e) => handleLocalChange('maxDurabilidade', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                />
              </div>
            </div>

            {/* Type Specific Fields */}
            {editingItem.tipo === 'Arma' && (
              <div className="border-t border-zinc-800/40 pt-4 space-y-4">
                <h4 className="text-[10px] font-black uppercase text-amber-500 tracking-widest flex items-center gap-1">
                  <Sword size={12} /> Propriedades de Arma
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-0.5">
                      Fórmula de Dano
                    </label>
                    <input
                      type="text"
                      value={localForm.dano ?? ''}
                      onChange={(e) => handleLocalChange('dano', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                      placeholder="Ex: 1d6+2"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-0.5">
                      Bônus de Acerto
                    </label>
                    <input
                      type="text"
                      value={localForm.acerto ?? ''}
                      onChange={(e) => handleLocalChange('acerto', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-0.5">
                      Escala (0-A)
                    </label>
                    <select
                      value={localForm.escala || 'D'}
                      onChange={(e) => handleLocalChange('escala', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                    >
                      {['0', 'D', 'C', 'B', 'A'].map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-0.5">
                      Atributo Base
                    </label>
                    <select
                      value={localForm.atributoBase || 'Força'}
                      onChange={(e) => handleLocalChange('atributoBase', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                    >
                      {['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Carisma'].map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-900/10 p-3 rounded-lg border border-zinc-800/20">
                  <div>
                    <label className="text-[9px] font-bold uppercase text-red-500/80 tracking-wider block mb-0.5 text-center">
                      Corte
                    </label>
                    <input
                      type="text"
                      value={localForm.corte ?? ''}
                      onChange={(e) => handleLocalChange('corte', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-amber-500/80 tracking-wider block mb-0.5 text-center">
                      Impacto
                    </label>
                    <input
                      type="text"
                      value={localForm.impacto ?? ''}
                      onChange={(e) => handleLocalChange('impacto', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-blue-500/80 tracking-wider block mb-0.5 text-center">
                      Perfuração
                    </label>
                    <input
                      type="text"
                      value={localForm.perfuracao ?? ''}
                      onChange={(e) => handleLocalChange('perfuracao', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-purple-500/80 tracking-wider block mb-0.5 text-center">
                      Resistência
                    </label>
                    <input
                      type="text"
                      value={localForm.resistencia ?? ''}
                      onChange={(e) => handleLocalChange('resistencia', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                    />
                  </div>
                </div>
              </div>
            )}

            {editingItem.tipo === 'Catalisador' && (
              <div className="border-t border-zinc-800/40 pt-4 space-y-4">
                <h4 className="text-[10px] font-black uppercase text-amber-500 tracking-widest flex items-center gap-1">
                  <Zap size={12} /> Propriedades de Catalisador
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-0.5">
                      Escala (0-A)
                    </label>
                    <select
                      value={localForm.escala || 'D'}
                      onChange={(e) => handleLocalChange('escala', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                    >
                      {['0', 'D', 'C', 'B', 'A'].map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-0.5">
                      Atributo Base
                    </label>
                    <select
                      value={localForm.atributoBase || 'Inteligência'}
                      onChange={(e) => handleLocalChange('atributoBase', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                    >
                      {['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Carisma'].map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-900/10 p-3 rounded-lg border border-zinc-800/20">
                  <div>
                    <label className="text-[9px] font-bold uppercase text-purple-400 tracking-wider block mb-0.5 text-center">
                      Feitiço
                    </label>
                    <input
                      type="text"
                      value={localForm.feitico ?? ''}
                      onChange={(e) => handleLocalChange('feitico', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-red-400 tracking-wider block mb-0.5 text-center">
                      Elemental
                    </label>
                    <input
                      type="text"
                      value={localForm.elemental ?? ''}
                      onChange={(e) => handleLocalChange('elemental', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-emerald-400 tracking-wider block mb-0.5 text-center">
                      M. Negra
                    </label>
                    <input
                      type="text"
                      value={localForm.magiaNegra ?? ''}
                      onChange={(e) => handleLocalChange('magiaNegra', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-amber-400 tracking-wider block mb-0.5 text-center">
                      Potencial
                    </label>
                    <input
                      type="text"
                      value={localForm.potencial ?? ''}
                      onChange={(e) => handleLocalChange('potencial', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                    />
                  </div>
                </div>
              </div>
            )}

            {editingItem.tipo === 'Armadura' && (
              <div className="border-t border-zinc-800/40 pt-4 space-y-4">
                <h4 className="text-[10px] font-black uppercase text-amber-500 tracking-widest flex items-center gap-1">
                  <Shield size={12} /> Propriedades de Armadura
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-0.5">
                      Redução Dano
                    </label>
                    <input
                      type="text"
                      value={localForm.reducaoDano ?? ''}
                      onChange={(e) => handleLocalChange('reducaoDano', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold uppercase text-red-500/80 tracking-wider block mb-0.5 text-center">
                      Corte
                    </label>
                    <input
                      type="text"
                      value={localForm.corte ?? ''}
                      onChange={(e) => handleLocalChange('corte', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold uppercase text-amber-500/80 tracking-wider block mb-0.5 text-center">
                      Impacto
                    </label>
                    <input
                      type="text"
                      value={localForm.impacto ?? ''}
                      onChange={(e) => handleLocalChange('impacto', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold uppercase text-blue-500/80 tracking-wider block mb-0.5 text-center">
                      Perfuração
                    </label>
                    <input
                      type="text"
                      value={localForm.perfuracao ?? ''}
                      onChange={(e) => handleLocalChange('perfuracao', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-0.5">
                    Efeitos Especiais de Proteção
                  </label>
                  <input
                    type="text"
                    value={localForm.efeito ?? ''}
                    onChange={(e) => handleLocalChange('efeito', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none"
                    placeholder="Ex: Reduz em 2 o dano de venenos no braço"
                  />
                </div>
              </div>
            )}

            {editingItem.tipo === 'Munição' && (
              <div className="border-t border-zinc-800/40 pt-4 space-y-4">
                <h4 className="text-[10px] font-black uppercase text-amber-500 tracking-widest flex items-center gap-1">
                  <Target size={12} /> Propriedades de Munição
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[9px] font-bold uppercase text-blue-500/80 tracking-wider block mb-0.5 text-center">
                      Perfuração
                    </label>
                    <input
                      type="text"
                      value={localForm.perfuracao ?? ''}
                      onChange={(e) => handleLocalChange('perfuracao', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold uppercase text-amber-500/80 tracking-wider block mb-0.5 text-center">
                      Impacto
                    </label>
                    <input
                      type="text"
                      value={localForm.impacto ?? ''}
                      onChange={(e) => handleLocalChange('impacto', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold uppercase text-purple-500/80 tracking-wider block mb-0.5 text-center">
                      Resistência
                    </label>
                    <input
                      type="text"
                      value={localForm.resistencia ?? ''}
                      onChange={(e) => handleLocalChange('resistencia', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-0.5">
                    Efeitos Especiais da Munição
                  </label>
                  <input
                    type="text"
                    value={localForm.efeito ?? ''}
                    onChange={(e) => handleLocalChange('efeito', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none"
                    placeholder="Ex: Inflama o alvo ao perfurar armadura de pano"
                  />
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex items-center gap-3 justify-end border-t border-zinc-800/80 pt-4">
              <button
                onClick={() => {
                  setEditingItem(null);
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
          </div>
        ) : (
          <div className="bg-zinc-900/10 border border-dashed border-zinc-800/80 rounded-2xl p-12 text-center text-zinc-500 italic text-xs h-[250px] flex flex-col items-center justify-center">
            <Package size={36} className="text-zinc-700 mb-3 animate-pulse" />
            Selecione ou crie um modelo de item ao lado para editar ou enviar.
          </div>
        )}

        {/* Sender Section */}
        {editingItem && !isCreating && (
          <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-black uppercase text-amber-500 tracking-widest flex items-center gap-1.5">
              <ArrowUpRight size={14} /> Enviar Item para Personagem
            </h3>
            
            <p className="text-[11px] text-zinc-500">
              Você pode enviar cópias deste item modelo diretamente para o inventário de qualquer personagem ativo.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Select Character */}
              <div>
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

              {/* Select Compartment */}
              <div>
                <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-1">
                  Compartimento / Bolsa
                </label>
                <select
                  value={selectedCompartmentId}
                  onChange={(e) => setSelectedCompartmentId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/50 animate-fadeIn"
                  disabled={!selectedCharId}
                >
                  <option value="" disabled>Selecione um Compartimento</option>
                  {(() => {
                    const char = characters.find(c => c.id === selectedCharId);
                    const compartments = char?.compartimentos || [];
                    if (compartments.length === 0) {
                      return <option value="">Sem compartimentos disponíveis</option>;
                    }
                    return compartments.map(comp => (
                      <option key={comp.id} value={comp.id}>
                        {comp.nome} ({comp.itens?.length || 0} itens)
                      </option>
                    ));
                  })()}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-1">
                  Quantidade a Enviar
                </label>
                <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1">
                  <button
                    onClick={() => setSendQuantity(prev => Math.max(1, prev - 1))}
                    className="p-1 text-zinc-500 hover:text-white text-xs font-black"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={sendQuantity}
                    onChange={(e) => setSendQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-transparent text-center text-xs text-white focus:outline-none"
                  />
                  <button
                    onClick={() => setSendQuantity(prev => prev + 1)}
                    className="p-1 text-zinc-500 hover:text-white text-xs font-black"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Action button */}
            <div className="pt-2 flex justify-end">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSendToCharacter(editingItem as Item)}
                disabled={!selectedCharId || !selectedCompartmentId}
                className={`px-6 py-2.5 rounded-xl font-black uppercase text-xs tracking-wider flex items-center gap-1.5 shadow-lg transition-all ${
                  (!selectedCharId || !selectedCompartmentId)
                    ? 'bg-zinc-800 text-zinc-600 border border-zinc-700/30 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-zinc-950 hover:shadow-emerald-500/10'
                }`}
              >
                <PlusCircle size={14} /> Enviar para Mochila
              </motion.button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
