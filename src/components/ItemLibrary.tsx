import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Plus, Package, Trash2, X, Sword, Shield, Zap, Target, 
  ChevronDown, ChevronUp, Utensils, Disc
} from 'lucide-react';
import { Character } from '../types';
import { Item, ITEMS_LIBRARY } from '../data/items';
import { cn } from '../lib/utils';
import { MiniInput } from './ui/MiniInput';
import { TextArea } from './ui/Input';
import { WeaponProperties } from './ui/WeaponProperties';
import { ArmorProperties } from './ui/ArmorProperties';
import { CatalystProperties, AmmunitionProperties } from './TocaManager';
import { getItemPeso } from '../rules/inventoryRules';

interface ItemLibraryProps {
  characters: Character[];
  activeCharId: string | null;
  onAddItemToCharacter: (characterId: string, compartmentId: string, item: any) => void;
  showToast?: (message: string, type?: "success" | "error" | "info") => void;
  user?: any;
}

export const ItemLibrary: React.FC<ItemLibraryProps> = ({
  characters,
  activeCharId,
  onAddItemToCharacter,
  showToast,
  user
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [customItems, setCustomItems] = useState<Item[]>(() => {
    try {
      const saved = localStorage.getItem('demons_despair_custom_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modal Send to Character
  const [itemToSend, setItemToSend] = useState<Item | null>(null);
  const [targetCharId, setTargetCharId] = useState<string>(activeCharId || (characters[0]?.id ?? ''));
  const [targetCompId, setTargetCompId] = useState<string>('');

  // Weapon Creation Menu state (matches compartment style)
  const [showWeaponMenu, setShowWeaponMenu] = useState(false);

  // Collapsible sections state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    Arma: false,
    Catalisador: false,
    Armadura: false,
    Munição: false,
    consumivel: false,
  });

  const toggleSection = (cat: string) => {
    setCollapsedSections(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  useEffect(() => {
    try {
      localStorage.setItem('demons_despair_custom_items', JSON.stringify(customItems));
    } catch (e) {
      console.error("Erro ao salvar itens personalizados", e);
    }
  }, [customItems]);

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

  useEffect(() => {
    if (selectedChar && selectedChar.compartimentos && selectedChar.compartimentos.length > 0) {
      if (!targetCompId || !selectedChar.compartimentos.some(c => c.id === targetCompId)) {
        setTargetCompId(selectedChar.compartimentos[0].id);
      }
    }
  }, [selectedChar, targetCompId]);

  const allItems = useMemo(() => {
    return [...ITEMS_LIBRARY, ...customItems];
  }, [customItems]);

  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = item.nome?.toLowerCase().includes(query);
        const matchesDesc = item.descricao?.toLowerCase().includes(query);
        return matchesName || matchesDesc;
      }
      return true;
    });
  }, [allItems, searchTerm]);

  const handleOpenSendModal = (item: Item) => {
    setItemToSend(item);
    if (activeCharId) setTargetCharId(activeCharId);
  };

  const handleConfirmSend = () => {
    if (!itemToSend) return;
    if (!selectedChar) {
      showToast?.("Selecione um personagem para receber o item.", "error");
      return;
    }

    const compId = targetCompId || selectedChar.compartimentos?.[0]?.id;
    if (!compId) {
      showToast?.("O personagem não possui compartimentos na mochila.", "error");
      return;
    }

    const currentDate = { day: 1, month: 1, year: 2024 };
    const payload = {
      ...itemToSend,
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      quantidade: itemToSend.quantidade || 1,
      peso: itemToSend.peso || 0,
      volume: itemToSend.volume || 0,
      maxDurabilidade: itemToSend.maxDurabilidade || 100,
      durabilidade: itemToSend.durabilidade || 100,
      dataCriacao: itemToSend.isFood && !itemToSend.dataCriacao ? { ...currentDate } : itemToSend.dataCriacao
    };

    onAddItemToCharacter(selectedChar.id, compId, payload);
    const compName = selectedChar.compartimentos?.find(c => c.id === compId)?.nome || "Mochila";
    showToast?.(`${payload.nome} enviado para ${selectedChar.nome} (${compName})!`, "success");
    setItemToSend(null);
  };

  const addItemDirectly = (tipo: string, cat?: string) => {
    const created: Item = {
      id: `custom-item-${Date.now()}`,
      nome: tipo === 'Arma' ? (cat === 'Arma de Fogo' ? 'Nova Arma de Fogo' : cat === 'Arco' ? 'Novo Arco' : 'Nova Arma Branca') :
            tipo === 'Catalisador' ? 'Novo Catalisador' :
            tipo === 'Armadura' ? 'Nova Armadura' :
            tipo === 'Munição' ? 'Nova Munição' : 'Novo Item',
      tipo: tipo as any,
      peso: 0,
      volume: 0,
      quantidade: 1,
      durabilidade: 0,
      maxDurabilidade: 0,
      descricao: '',
      efeito: '',
      isFood: false,
      validade: 0,
      saciedade: '0+0',
      dano: '0',
      acerto: 0,
      escala: '0',
      atributoBase: 'Força',
      corte: 0,
      impacto: 0,
      perfuracao: 0,
      resistencia: 0,
      categoria: cat || (tipo === 'Arma' ? 'Arma Branca' : 'Corte'),
      reducaoDano: 0,
      feitico: 0,
      elemental: 0,
      magiaNegra: 0,
      potencial: 0,
      municaoTotal: 0,
      municaoCarregada: 0,
    };
    setCustomItems(prev => [created, ...prev]);
    showToast?.("Item criado na biblioteca!", "success");
  };

  const handleDeleteCustomItem = (id: string) => {
    setCustomItems(prev => prev.filter(i => i.id !== id));
    showToast?.("Item personalizado removido.", "info");
  };

  const updateCustomItem = (id: string, updates: any) => {
    setCustomItems(prev => prev.map(it => it.id === id ? { ...it, ...updates } : it));
  };

  const categories = [
    { key: 'Arma', label: 'Armas', icon: <Sword size={14} className="text-amber-500" /> },
    { key: 'Catalisador', label: 'Catalisadores', icon: <Zap size={14} className="text-purple-500" /> },
    { key: 'Armadura', label: 'Armaduras', icon: <Shield size={14} className="text-blue-500" /> },
    { key: 'Munição', label: 'Munições', icon: <Disc size={14} className="text-emerald-500" /> },
    { key: 'item', label: 'Itens', icon: <Package size={14} className="text-amber-400" /> },
  ];

  return (
    <div className="w-full h-full min-h-[calc(100vh-100px)] flex flex-col p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm relative shrink-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500">
                <Package size={22} />
              </span>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-zinc-100">
                Biblioteca de Itens & Equipamentos
              </h2>
            </div>
            <p className="text-xs md:text-sm text-zinc-400 max-w-2xl">
              Gerencie e crie itens com exatamente os mesmos botões de criação e seções da ficha.
            </p>
          </div>
        </div>

        {/* Action Buttons Bar matching exact compartment style */}
        <div className="grid grid-cols-5 gap-1.5 mt-6 relative z-10">
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => addItemDirectly('item')}
            className="py-1.5 border border-dashed border-zinc-700 rounded text-[9px] font-bold uppercase text-zinc-400 hover:border-amber-500/50 hover:text-amber-500 transition-all px-1 flex items-center justify-center gap-1"
          >
            <Plus size={11} /> + Item
          </motion.button>
          
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => setShowWeaponMenu(!showWeaponMenu)}
            className={cn(
              "py-1.5 border border-dashed rounded text-[9px] font-bold uppercase transition-all px-1 flex items-center justify-center gap-1",
              showWeaponMenu
                ? "border-amber-500 bg-amber-500/20 text-amber-400 shadow-sm"
                : "border-zinc-700 text-zinc-400 hover:border-amber-500/50 hover:text-amber-500"
            )}
          >
            <span>+ Arma</span>
            <span className="text-[7px]">▾</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => addItemDirectly('Catalisador')}
            className="py-1.5 border border-dashed border-zinc-700 rounded text-[9px] font-bold uppercase text-zinc-400 hover:border-amber-500/50 hover:text-amber-500 transition-all px-1 flex items-center justify-center gap-1"
          >
            <Plus size={11} /> + Cat
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => addItemDirectly('Armadura')}
            className="py-1.5 border border-dashed border-zinc-700 rounded text-[9px] font-bold uppercase text-zinc-400 hover:border-amber-500/50 hover:text-amber-500 transition-all px-1 flex items-center justify-center gap-1"
          >
            <Plus size={11} /> + Armad
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => addItemDirectly('Munição')}
            className="py-1.5 border border-dashed border-zinc-700 rounded text-[9px] font-bold uppercase text-zinc-400 hover:border-amber-500/50 hover:text-amber-500 transition-all px-1 flex items-center justify-center gap-1"
          >
            <Plus size={11} /> + Mun
          </motion.button>
        </div>

        {/* Weapon Selection Submenu (un-cropped, matching compartment style) */}
        {showWeaponMenu && (
          <div className="mt-3 p-2 bg-zinc-950 border border-amber-500/50 rounded-lg shadow-xl flex items-center gap-2 relative z-20">
            <span className="text-[9px] font-black uppercase text-amber-500 shrink-0 px-1">
              Arma:
            </span>
            <button
              type="button"
              onClick={() => { addItemDirectly('Arma', 'Arma Branca'); setShowWeaponMenu(false); }}
              className="flex-1 py-1 px-1.5 bg-zinc-900 hover:bg-amber-500/20 text-zinc-200 hover:text-amber-400 border border-zinc-800 hover:border-amber-500/40 rounded text-[9px] font-bold flex items-center justify-center gap-1 transition-all"
            >
              <Sword size={11} className="text-amber-500 shrink-0" />
              <span>Branca</span>
            </button>
            <button
              type="button"
              onClick={() => { addItemDirectly('Arma', 'Arma de Fogo'); setShowWeaponMenu(false); }}
              className="flex-1 py-1 px-1.5 bg-zinc-900 hover:bg-amber-500/20 text-zinc-200 hover:text-amber-400 border border-zinc-800 hover:border-amber-500/40 rounded text-[9px] font-bold flex items-center justify-center gap-1 transition-all"
            >
              <Zap size={11} className="text-amber-500 shrink-0" />
              <span>Fogo</span>
            </button>
            <button
              type="button"
              onClick={() => { addItemDirectly('Arma', 'Arco'); setShowWeaponMenu(false); }}
              className="flex-1 py-1 px-1.5 bg-zinc-900 hover:bg-amber-500/20 text-zinc-200 hover:text-amber-400 border border-zinc-800 hover:border-amber-500/40 rounded text-[9px] font-bold flex items-center justify-center gap-1 transition-all"
            >
              <Target size={11} className="text-amber-500 shrink-0" />
              <span>Arco</span>
            </button>
            <button
              type="button"
              onClick={() => setShowWeaponMenu(false)}
              className="p-1 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800 transition-colors shrink-0"
              title="Cancelar"
            >
              <X size={12} />
            </button>
          </div>
        )}

        <div className="mt-4 relative z-10">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar itens..."
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-11 pr-4 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Main Content Sections with Always-Visible Collapsible Bars */}
      <div className="space-y-4 flex-1 pb-16">
        {categories.map(cat => {
          const categoryItems = filteredItems.filter(i => {
            if (cat.key === 'item') {
              return i.tipo !== 'Arma' && i.tipo !== 'Catalisador' && i.tipo !== 'Armadura' && i.tipo !== 'Munição';
            }
            return i.tipo === cat.key;
          });

          const isCollapsed = collapsedSections[cat.key];

          return (
            <div key={cat.key} className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/30">
              {/* Collapsible Bar Header */}
              <div
                onClick={() => toggleSection(cat.key)}
                className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-zinc-800/40 transition-colors bg-zinc-800/20"
              >
                <div className="flex items-center gap-2">
                  <span className="text-amber-500">{cat.icon}</span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-zinc-300">
                    {cat.label} ({categoryItems.length})
                  </h4>
                </div>
                {isCollapsed ? <ChevronDown size={16} className="text-zinc-500" /> : <ChevronUp size={16} className="text-zinc-500" />}
              </div>

              {/* Collapsible Content */}
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="p-3 space-y-3 border-t border-zinc-800">
                      {categoryItems.map(item => {
                        const isCustom = customItems.some(ci => ci.id === item.id);
                        return (
                          <div key={item.id} className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs relative group space-y-2">
                            <div className="flex justify-between items-center mb-1 gap-2">
                              <input
                                value={item.nome}
                                onChange={(e) => updateCustomItem(item.id, { nome: e.target.value })}
                                className="bg-transparent font-bold text-sm focus:outline-none text-zinc-100 flex-1 min-w-0"
                              />
                              <div className="flex items-center gap-2 shrink-0">
                                <motion.button
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleOpenSendModal(item)}
                                  className="px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded text-[10px] font-bold uppercase border border-amber-500/30"
                                >
                                  Enviar p/ Ficha
                                </motion.button>
                                {isCustom && (
                                  <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleDeleteCustomItem(item.id)}
                                    className="text-red-500 p-1 hover:text-red-400"
                                    title="Excluir"
                                  >
                                    <Trash2 size={16} />
                                  </motion.button>
                                )}
                              </div>
                            </div>

                            {/* General items layout matching compartment items */}
                            {item.tipo !== 'Arma' && item.tipo !== 'Catalisador' && item.tipo !== 'Armadura' && item.tipo !== 'Munição' && (
                              <>
                                <div className="flex items-end gap-2">
                                  <div className="grid grid-cols-4 gap-2 flex-1">
                                    <MiniInput
                                      label="Qtd"
                                      type="number"
                                      value={item.quantidade}
                                      onChange={(v) => {
                                        const val = parseInt(v) || 1;
                                        updateCustomItem(item.id, { quantidade: val });
                                      }}
                                    />
                                    <MiniInput
                                      label="Kg"
                                      type="number"
                                      value={item.peso ?? 0}
                                      onChange={(v) => {
                                        const val = parseFloat(v) || 0;
                                        updateCustomItem(item.id, { peso: val });
                                      }}
                                    />
                                    <MiniInput
                                      label="Vol"
                                      type="number"
                                      value={item.volume ?? 0}
                                      onChange={(v) => {
                                        const val = parseFloat(v) || 0;
                                        updateCustomItem(item.id, { volume: val });
                                      }}
                                    />
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-[10px] text-zinc-600 uppercase tracking-tighter font-bold truncate">
                                        Total
                                      </span>
                                      <span className="text-xs font-bold text-zinc-400 mt-[3px]">
                                        {(
                                          (getItemPeso(item) * (item.quantidade !== undefined ? item.quantidade : 1)) / 10
                                        ).toFixed(2)}
                                        kg
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const isChecked = !item.isFood;
                                      updateCustomItem(item.id, {
                                        isFood: isChecked,
                                        validade: isChecked ? (item.validade ?? 0) : item.validade,
                                        saciedade: isChecked ? (item.saciedade ?? "0+0") : item.saciedade
                                      });
                                    }}
                                    className={cn(
                                      "w-9 h-9 rounded-xl border transition-all cursor-pointer focus:outline-none flex items-center justify-center shrink-0 mb-[1px]",
                                      item.isFood
                                        ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/30"
                                        : "bg-zinc-700 border-zinc-600 text-black hover:bg-zinc-600"
                                    )}
                                    title={item.isFood ? "Desmarcar como Comida" : "Marcar como Comida"}
                                  >
                                    <Utensils 
                                      className={cn(
                                        "w-4 h-4 transition-colors duration-200",
                                        item.isFood ? "fill-yellow-500/20" : ""
                                      )}
                                    />
                                  </button>
                                </div>

                                {/* Propriedades de Comida */}
                                {item.isFood && (
                                  <div className="bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-800/80 space-y-2.5 my-2">
                                    <div className="grid grid-cols-2 gap-2">
                                      <MiniInput
                                        label="Validade (Dias)"
                                        type="number"
                                        value={item.validade ?? 0}
                                        onChange={(v) => {
                                          const val = parseInt(v) || 0;
                                          updateCustomItem(item.id, { validade: val });
                                        }}
                                      />
                                      <MiniInput
                                        label="Saciedade (ex: 30+15)"
                                        type="text"
                                        value={item.saciedade ?? "0+0"}
                                        onChange={(v) => {
                                          updateCustomItem(item.id, { saciedade: v });
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}

                                <TextArea
                                  label="Descrição"
                                  value={item.descricao || ""}
                                  onChange={(v) => {
                                    updateCustomItem(item.id, { descricao: v });
                                  }}
                                />
                              </>
                            )}

                            {/* Specific Properties based on Item Type */}
                            {item.tipo === 'Arma' && (
                              <>
                                <div className="flex items-center gap-2 max-w-[200px]">
                                  <div className="w-20">
                                    <MiniInput
                                      label="Qtd"
                                      type="number"
                                      value={item.quantidade}
                                      onChange={(v) => updateCustomItem(item.id, { quantidade: parseInt(v) || 1 })}
                                    />
                                  </div>
                                  <div className="flex flex-col justify-center">
                                    <span className="text-[8px] text-zinc-500 uppercase tracking-tight font-bold">
                                      Peso Total
                                    </span>
                                    <span className="text-xs font-bold text-zinc-400">
                                      {((getItemPeso(item) * (item.quantidade || 1)) / 10).toFixed(2)} kg
                                    </span>
                                  </div>
                                </div>
                                <WeaponProperties
                                  item={item}
                                  character={selectedChar}
                                  updateCharacter={() => {}}
                                  onChange={(updates) => updateCustomItem(item.id, updates)}
                                />
                              </>
                            )}
                            {item.tipo === 'Catalisador' && (
                              <>
                                <div className="grid grid-cols-4 gap-2">
                                  <MiniInput
                                    label="Qtd"
                                    type="number"
                                    value={item.quantidade}
                                    onChange={(v) => updateCustomItem(item.id, { quantidade: parseInt(v) || 1 })}
                                  />
                                  <div className="flex flex-col">
                                    <span className="text-[10px] text-zinc-600 uppercase tracking-tighter font-bold">
                                      Total
                                    </span>
                                    <span className="text-xs font-bold text-zinc-400">
                                      {((getItemPeso(item) * (item.quantidade || 1)) / 10).toFixed(2)} kg
                                    </span>
                                  </div>
                                </div>
                                <CatalystProperties
                                  item={item}
                                  onChange={(updates) => updateCustomItem(item.id, updates)}
                                />
                              </>
                            )}
                            {item.tipo === 'Armadura' && (
                              <>
                                <div className="grid grid-cols-4 gap-2">
                                  <MiniInput
                                    label="Qtd"
                                    type="number"
                                    value={item.quantidade}
                                    onChange={(v) => updateCustomItem(item.id, { quantidade: parseInt(v) || 1 })}
                                  />
                                  <div className="flex flex-col">
                                    <span className="text-[10px] text-zinc-600 uppercase tracking-tighter font-bold">
                                      Total
                                    </span>
                                    <span className="text-xs font-bold text-zinc-400">
                                      {((getItemPeso(item) * (item.quantidade || 1)) / 10).toFixed(2)} kg
                                    </span>
                                  </div>
                                </div>
                                <ArmorProperties
                                  item={item}
                                  onChange={(updates) => updateCustomItem(item.id, updates)}
                                />
                              </>
                            )}
                            {item.tipo === 'Munição' && (
                              <>
                                <div className="grid grid-cols-4 gap-2">
                                  <MiniInput
                                    label="Qtd"
                                    type="number"
                                    value={item.quantidade}
                                    onChange={(v) => updateCustomItem(item.id, { quantidade: parseInt(v) || 1 })}
                                  />
                                  <div className="flex flex-col">
                                    <span className="text-[10px] text-zinc-600 uppercase tracking-tighter font-bold">
                                      Total
                                    </span>
                                    <span className="text-xs font-bold text-zinc-400">
                                      {((getItemPeso(item) * (item.quantidade || 1)) / 10).toFixed(2)} kg
                                    </span>
                                  </div>
                                </div>
                                <AmmunitionProperties
                                  item={item}
                                  onChange={(updates) => updateCustomItem(item.id, updates)}
                                />
                              </>
                            )}
                          </div>
                        );
                      })}
                      {categoryItems.length === 0 && (
                        <div className="text-center py-6 text-zinc-600 text-xs italic">
                          Nenhum item cadastrado nesta categoria. Clique nos botões acima para criar.
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Modal Send to Character Compartment */}
      <AnimatePresence>
        {itemToSend && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl relative"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black uppercase text-zinc-100 flex items-center gap-2">
                  <Package className="text-amber-500" size={20} />
                  Enviar Item para Ficha
                </h3>
                <button 
                  onClick={() => setItemToSend(null)}
                  className="text-zinc-400 hover:text-zinc-100 p-1"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <p className="text-xs text-zinc-400">Item selecionado:</p>
                <p className="text-sm font-bold text-amber-400">{itemToSend.nome}</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold uppercase text-zinc-400 block mb-1">
                    Selecionar Personagem
                  </label>
                  <select
                    value={targetCharId}
                    onChange={(e) => setTargetCharId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
                  >
                    {characters.map(c => (
                      <option key={c.id} value={c.id}>{c.nome || 'Personagem sem nome'}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-zinc-400 block mb-1">
                    Selecionar Compartimento / Mochila
                  </label>
                  <select
                    value={targetCompId}
                    onChange={(e) => setTargetCompId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
                  >
                    {selectedChar?.compartimentos?.map(comp => (
                      <option key={comp.id} value={comp.id}>{comp.nome || 'Compartimento'}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setItemToSend(null)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold uppercase rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSend}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black uppercase rounded-xl transition-all shadow-lg shadow-amber-500/20"
                >
                  Confirmar Envio
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
