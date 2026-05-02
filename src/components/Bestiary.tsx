import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Trash2, 
  Save, 
  Skull, 
  Image as ImageIcon, 
  X, 
  Search,
  ChevronRight,
  Shield,
  Heart,
  FileText,
  Swords,
  Zap,
  Target,
  Move,
  Info,
  MapPin,
  Smile,
  Ghost
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BestiaryMonster, MonsterAction } from "../types";
import { 
  saveMonsterToBestiary, 
  deleteMonsterFromBestiary, 
  subscribeToBestiary 
} from "../services/bestiaryService";
import { compressImageDataUrl } from "../lib/imageUtils";
import { cn } from "../lib/utils";

interface BestiaryProps {
  onMonsterSelect?: (monster: BestiaryMonster) => void;
  isSelectionMode?: boolean;
}

export const Bestiary: React.FC<BestiaryProps> = React.memo(({ onMonsterSelect, isSelectionMode = false }) => {
  const [monsters, setMonsters] = useState<BestiaryMonster[]>([]);
  const [editingMonster, setEditingMonster] = useState<BestiaryMonster | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToBestiary(setMonsters);
    return () => unsubscribe();
  }, []);

  const generateId = () => Math.random().toString(36).substring(2, 11);

  const getInitialMonster = (): BestiaryMonster => ({
    id: generateId(),
    name: "Novo Monstro",
    maxHp: 20,
    esquiva: 0,
    acuracia: 0,
    deslocamento: "5 metros",
    bonus: "",
    masterId: "",
    ataque: {
      corte: 0, perfuracao: 0, impacto: 0, resistencia: 0,
      feitico: 0, elemental: 0, magiaNegra: 0, potencial: 0
    },
    defesa: {
      corte: 0, perfuracao: 0, impacto: 0,
      feitico: 0, elemental: 0, magiaNegra: 0
    },
    acoes: [],
    local: "",
    personalidade: "",
    gostaNaoGosta: "",
    partesUteis: "",
    informacoes: "",
    habitos: ""
  });

  const handleCreate = () => {
    setEditingMonster(getInitialMonster());
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (editingMonster) {
      // Garantir que valores numéricos vazios sejam salvos como 0 ou convertidos para número
      const cleanedMonster = {
        ...editingMonster,
        maxHp: Number(editingMonster.maxHp) || 0,
        esquiva: Number(editingMonster.esquiva) || 0,
        acuracia: Number(editingMonster.acuracia) || 0,
        ataque: Object.fromEntries(
          Object.entries(editingMonster.ataque).map(([k, v]) => [k, Number(v) || 0])
        ),
        defesa: Object.fromEntries(
          Object.entries(editingMonster.defesa).map(([k, v]) => [k, Number(v) || 0])
        ),
        acoes: editingMonster.acoes.map(acao => ({
          ...acao,
          acerto: Number(acao.acerto) || 0
        }))
      } as BestiaryMonster;

      await saveMonsterToBestiary(cleanedMonster);
      setEditingMonster(null);
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Deseja realmente excluir este monstro?")) {
      await deleteMonsterFromBestiary(id);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingMonster) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      try {
        const compressed = await compressImageDataUrl(result, 512, 0.7);
        setEditingMonster({ ...editingMonster, imageUrl: compressed });
      } catch {
        setEditingMonster({ ...editingMonster, imageUrl: result });
      }
    };
    reader.readAsDataURL(file);
  };

  const addAction = () => {
    if (!editingMonster) return;
    const newAction: MonsterAction = {
      id: generateId(),
      name: "Novo Ataque",
      type: "Major",
      categoria: "Outro",
      acerto: 10,
      dano: "1d4",
      description: ""
    };
    setEditingMonster({
      ...editingMonster,
      acoes: [...editingMonster.acoes, newAction]
    });
  };

  const removeAction = (id: string) => {
    if (!editingMonster) return;
    setEditingMonster({
      ...editingMonster,
      acoes: editingMonster.acoes.filter(a => a.id !== id)
    });
  };

  const updateAction = (id: string, updates: Partial<MonsterAction>) => {
    if (!editingMonster) return;
    setEditingMonster({
      ...editingMonster,
      acoes: editingMonster.acoes.map(a => a.id === id ? { ...a, ...updates } : a)
    });
  };

  const filteredMonsters = monsters.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar demônio no bestiário..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>
        {!isSelectionMode && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleCreate}
            className="flex items-center gap-2 bg-amber-500 text-zinc-950 px-4 py-2 rounded-xl font-bold uppercase tracking-widest text-xs"
          >
            <Plus size={18} /> Novo Demônio
          </motion.button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
        {filteredMonsters.map(monster => (
          <motion.div
            key={monster.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-4 relative group"
          >
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-xl bg-zinc-800 overflow-hidden flex-shrink-0 border border-zinc-700">
                {monster.imageUrl ? (
                  <img src={monster.imageUrl} alt={monster.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600">
                    <Skull size={40} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-zinc-100 truncate text-lg uppercase tracking-tight">{monster.name}</h3>
                <div className="flex flex-wrap gap-2 mt-1">
                    <div className="flex items-center gap-1 text-red-500 text-[10px] font-bold bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                        <Heart size={10} /> {monster.maxHp} HP
                    </div>
                    <div className="flex items-center gap-1 text-amber-500 text-[10px] font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        <Target size={10} /> {monster.acuracia} ACC
                    </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                <div className="flex justify-between border-b border-zinc-800 pb-1">
                    <span>Ataque Corte:</span>
                    <span className="text-white">{monster.ataque.corte}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800 pb-1">
                    <span>Defesa Corte:</span>
                    <span className="text-white">{monster.defesa.corte}</span>
                </div>
            </div>

            {isSelectionMode ? (
              <button
                onClick={() => onMonsterSelect?.(monster)}
                className="w-full py-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-amber-500 hover:text-zinc-950 transition-all flex items-center justify-center gap-2"
              >
                Invocação <ChevronRight size={14} />
              </button>
            ) : (
              <div className="flex gap-2 mt-auto">
                <button 
                  onClick={() => setEditingMonster(monster)}
                  className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold uppercase transition-all"
                >
                  Editar Ficha
                </button>
                <button 
                  onClick={() => handleDelete(monster.id)}
                  className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingMonster && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-hidden">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                <h3 className="text-xl font-bold text-amber-500 uppercase tracking-widest flex items-center gap-3">
                  <Skull size={24} /> {isAdding ? "Nova Entidade" : `Ficha de ${editingMonster.name}`}
                </h3>
                <button onClick={() => setEditingMonster(null)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-10">
                {/* Header & Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-32 h-32 rounded-3xl bg-zinc-900 border-2 border-zinc-800 overflow-hidden relative group shadow-2xl">
                      {editingMonster.imageUrl ? (
                        <img src={editingMonster.imageUrl} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-800">
                          <ImageIcon size={60} />
                        </div>
                      )}
                      <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                        <div className="text-white flex flex-col items-center gap-1">
                            <Plus size={24} />
                            <span className="text-[10px] font-black uppercase">Alterar</span>
                        </div>
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                      </label>
                    </div>
                  </div>

                  <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-2 mb-1 block">Nome do Demônio</label>
                        <input 
                            type="text" 
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                            value={editingMonster.name}
                            onChange={(e) => setEditingMonster({ ...editingMonster, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-2 mb-1 block flex items-center gap-1">
                            <Heart size={10} /> Vida (HP)
                        </label>
                        <input 
                            type="number" 
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none"
                            value={editingMonster.maxHp}
                            onChange={(e) => setEditingMonster({ ...editingMonster, maxHp: e.target.value === "" ? "" : parseInt(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-2 mb-1 block flex items-center gap-1">
                            <Move size={10} /> Deslocamento
                        </label>
                        <input 
                            type="text" 
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none"
                            value={editingMonster.deslocamento}
                            onChange={(e) => setEditingMonster({ ...editingMonster, deslocamento: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-2 mb-1 block flex items-center gap-1">
                            <Shield size={10} /> Esquiva
                        </label>
                        <input 
                            type="number" 
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none"
                            value={editingMonster.esquiva}
                            onChange={(e) => setEditingMonster({ ...editingMonster, esquiva: e.target.value === "" ? "" : parseInt(e.target.value) })}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-2 mb-1 block flex items-center gap-1">
                            <Target size={10} /> Acurácia
                        </label>
                        <input 
                            type="number" 
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none"
                            value={editingMonster.acuracia}
                            onChange={(e) => setEditingMonster({ ...editingMonster, acuracia: e.target.value === "" ? "" : parseInt(e.target.value) })}
                        />
                    </div>
                  </div>
                </div>

                {/* Levels Tables */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Attack Table */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-black text-red-500 uppercase tracking-widest flex items-center gap-2 border-b border-red-500/20 pb-2">
                        <Swords size={18} /> Níveis de Ataque
                    </h4>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden overflow-x-auto">
                        <table className="w-full text-left text-[10px] border-collapse">
                            <thead>
                                <tr className="bg-zinc-950 border-b border-zinc-800 text-zinc-500 uppercase">
                                    <th className="p-3">Atributo</th>
                                    <th className="p-3">Nível</th>
                                    <th className="p-3">Mágico</th>
                                    <th className="p-3">Nível</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800 text-zinc-100">
                                <tr>
                                    <td className="p-3 font-bold border-r border-zinc-800">Corte</td>
                                    <td className="p-1 border-r border-zinc-800">
                                        <input type="number" value={editingMonster.ataque.corte} onChange={(e) => setEditingMonster({...editingMonster, ataque: {...editingMonster.ataque, corte: e.target.value === "" ? "" : parseInt(e.target.value)}})} className="w-full bg-transparent p-2 text-center focus:outline-none" />
                                    </td>
                                    <td className="p-3 font-bold border-r border-zinc-800">Feitiço</td>
                                    <td className="p-1">
                                        <input type="number" value={editingMonster.ataque.feitico} onChange={(e) => setEditingMonster({...editingMonster, ataque: {...editingMonster.ataque, feitico: e.target.value === "" ? "" : parseInt(e.target.value)}})} className="w-full bg-transparent p-2 text-center focus:outline-none" />
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-bold border-r border-zinc-800">Perfuração</td>
                                    <td className="p-1 border-r border-zinc-800">
                                        <input type="number" value={editingMonster.ataque.perfuracao} onChange={(e) => setEditingMonster({...editingMonster, ataque: {...editingMonster.ataque, perfuracao: e.target.value === "" ? "" : parseInt(e.target.value)}})} className="w-full bg-transparent p-2 text-center focus:outline-none" />
                                    </td>
                                    <td className="p-3 font-bold border-r border-zinc-800">Elemental</td>
                                    <td className="p-1">
                                        <input type="number" value={editingMonster.ataque.elemental} onChange={(e) => setEditingMonster({...editingMonster, ataque: {...editingMonster.ataque, elemental: e.target.value === "" ? "" : parseInt(e.target.value)}})} className="w-full bg-transparent p-2 text-center focus:outline-none" />
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-bold border-r border-zinc-800">Impacto</td>
                                    <td className="p-1 border-r border-zinc-800">
                                        <input type="number" value={editingMonster.ataque.impacto} onChange={(e) => setEditingMonster({...editingMonster, ataque: {...editingMonster.ataque, impacto: e.target.value === "" ? "" : parseInt(e.target.value)}})} className="w-full bg-transparent p-2 text-center focus:outline-none" />
                                    </td>
                                    <td className="p-3 font-bold border-r border-zinc-800">Magia Negra</td>
                                    <td className="p-1">
                                        <input type="number" value={editingMonster.ataque.magiaNegra} onChange={(e) => setEditingMonster({...editingMonster, ataque: {...editingMonster.ataque, magiaNegra: e.target.value === "" ? "" : parseInt(e.target.value)}})} className="w-full bg-transparent p-2 text-center focus:outline-none" />
                                    </td>
                                </tr>
                                <tr className="bg-amber-500/5">
                                    <td className="p-3 font-black text-amber-500 border-r border-zinc-800">Resistência</td>
                                    <td className="p-1 border-r border-zinc-800">
                                        <input type="number" value={editingMonster.ataque.resistencia} onChange={(e) => setEditingMonster({...editingMonster, ataque: {...editingMonster.ataque, resistencia: e.target.value === "" ? "" : parseInt(e.target.value)}})} className="w-full bg-transparent p-2 text-center font-bold text-amber-500 focus:outline-none" />
                                    </td>
                                    <td className="p-3 font-black text-amber-500 border-r border-zinc-800">Potencial</td>
                                    <td className="p-1">
                                        <input type="number" value={editingMonster.ataque.potencial} onChange={(e) => setEditingMonster({...editingMonster, ataque: {...editingMonster.ataque, potencial: e.target.value === "" ? "" : parseInt(e.target.value)}})} className="w-full bg-transparent p-2 text-center font-bold text-amber-500 focus:outline-none" />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                  </div>

                  {/* Defense Table */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-black text-blue-500 uppercase tracking-widest flex items-center gap-2 border-b border-blue-500/20 pb-2">
                        <Shield size={18} /> Níveis de Defesa
                    </h4>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden overflow-x-auto">
                        <table className="w-full text-left text-[10px] border-collapse">
                            <thead>
                                <tr className="bg-zinc-950 border-b border-zinc-800 text-zinc-500 uppercase">
                                    <th className="p-3">Atributo</th>
                                    <th className="p-3 text-center">Defesa</th>
                                    <th className="p-3">Mágico</th>
                                    <th className="p-3 text-center">Defesa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800 text-zinc-100">
                                <tr>
                                    <td className="p-3 font-bold border-r border-zinc-800">Corte</td>
                                    <td className="p-1 border-r border-zinc-800">
                                        <input type="number" value={editingMonster.defesa.corte} onChange={(e) => setEditingMonster({...editingMonster, defesa: {...editingMonster.defesa, corte: e.target.value === "" ? "" : parseInt(e.target.value)}})} className="w-full bg-transparent p-2 text-center focus:outline-none" />
                                    </td>
                                    <td className="p-3 font-bold border-r border-zinc-800">Feitiço</td>
                                    <td className="p-1">
                                        <input type="number" value={editingMonster.defesa.feitico} onChange={(e) => setEditingMonster({...editingMonster, defesa: {...editingMonster.defesa, feitico: e.target.value === "" ? "" : parseInt(e.target.value)}})} className="w-full bg-transparent p-2 text-center focus:outline-none" />
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-bold border-r border-zinc-800">Perfuração</td>
                                    <td className="p-1 border-r border-zinc-800">
                                        <input type="number" value={editingMonster.defesa.perfuracao} onChange={(e) => setEditingMonster({...editingMonster, defesa: {...editingMonster.defesa, perfuracao: e.target.value === "" ? "" : parseInt(e.target.value)}})} className="w-full bg-transparent p-2 text-center focus:outline-none" />
                                    </td>
                                    <td className="p-3 font-bold border-r border-zinc-800">Elemental</td>
                                    <td className="p-1">
                                        <input type="number" value={editingMonster.defesa.elemental} onChange={(e) => setEditingMonster({...editingMonster, defesa: {...editingMonster.defesa, elemental: e.target.value === "" ? "" : parseInt(e.target.value)}})} className="w-full bg-transparent p-2 text-center focus:outline-none" />
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-bold border-r border-zinc-800">Impacto</td>
                                    <td className="p-1 border-r border-zinc-800">
                                        <input type="number" value={editingMonster.defesa.impacto} onChange={(e) => setEditingMonster({...editingMonster, defesa: {...editingMonster.defesa, impacto: e.target.value === "" ? "" : parseInt(e.target.value)}})} className="w-full bg-transparent p-2 text-center focus:outline-none" />
                                    </td>
                                    <td className="p-3 font-bold border-r border-zinc-800">Magia Negra</td>
                                    <td className="p-1">
                                        <input type="number" value={editingMonster.defesa.magiaNegra} onChange={(e) => setEditingMonster({...editingMonster, defesa: {...editingMonster.defesa, magiaNegra: e.target.value === "" ? "" : parseInt(e.target.value)}})} className="w-full bg-transparent p-2 text-center focus:outline-none" />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                  </div>
                </div>

                {/* Lore Sections */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-sm font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2 border-b border-zinc-800 pb-2">
                        <MapPin size={18} /> Lore & Geografia
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1 block">Localização / Origem</label>
                            <input 
                                value={editingMonster.local}
                                onChange={(e) => setEditingMonster({...editingMonster, local: e.target.value})}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white"
                                placeholder="Goundospauh, Florestas, etc..."
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1 block">Personalidade</label>
                            <input 
                                value={editingMonster.personalidade}
                                onChange={(e) => setEditingMonster({...editingMonster, personalidade: e.target.value})}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white"
                                placeholder="Agressivo, Moderado, etc..."
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1 block">Gosta / Não Gosta</label>
                            <input 
                                value={editingMonster.gostaNaoGosta}
                                onChange={(e) => setEditingMonster({...editingMonster, gostaNaoGosta: e.target.value})}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white"
                                placeholder="Carne. / Prata."
                            />
                        </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2 border-b border-zinc-800 pb-2">
                        <Info size={18} /> Biologia & Caça
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1 block">Partes Úteis (Dentes, Garras...)</label>
                            <input 
                                value={editingMonster.partesUteis}
                                onChange={(e) => setEditingMonster({...editingMonster, partesUteis: e.target.value})}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1 block">Bônus Adicionais</label>
                            <input 
                                value={editingMonster.bonus}
                                onChange={(e) => setEditingMonster({...editingMonster, bonus: e.target.value})}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white"
                                placeholder="+1 Atletismo, Voo, etc..."
                            />
                        </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    <div className="space-y-4">
                        <h4 className="text-sm font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2 border-b border-zinc-800 pb-2">
                            <FileText size={18} /> Informações Gerais & Hábitos
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1 block">Descrição da Entidade</label>
                                <textarea 
                                    rows={5}
                                    value={editingMonster.informacoes}
                                    onChange={(e) => setEditingMonster({...editingMonster, informacoes: e.target.value})}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white resize-none leading-relaxed"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1 block">Hábitos de Caça / Defesa</label>
                                <textarea 
                                    rows={5}
                                    value={editingMonster.habitos}
                                    onChange={(e) => setEditingMonster({...editingMonster, habitos: e.target.value})}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white resize-none leading-relaxed"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Attacks/Actions Section */}
                <div className="space-y-6 pb-12">
                   <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                       <h4 className="text-sm font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
                           <Zap size={18} /> Ataques
                       </h4>
                       <button 
                        onClick={addAction}
                        className="text-[10px] font-black uppercase text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 hover:bg-amber-500 hover:text-zinc-950 transition-all"
                       >
                           + Novo Ataque
                       </button>
                   </div>

                   <div className="grid grid-cols-1 gap-4">
                        {editingMonster.acoes.map((acao) => (
                            <div key={acao.id} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-4">
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className="flex-1 min-w-[200px]">
                                        <label className="text-[9px] font-black text-zinc-600 uppercase mb-1 block">Nome do Golpe</label>
                                        <input 
                                            value={acao.name}
                                            onChange={(e) => updateAction(acao.id, { name: e.target.value })}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white"
                                        />
                                    </div>
                                    <div className="w-20">
                                        <label className="text-[9px] font-black text-zinc-600 uppercase mb-1 block">Acerto</label>
                                        <input 
                                            type="number"
                                            value={acao.acerto}
                                            onChange={(e) => updateAction(acao.id, { acerto: e.target.value === "" ? "" : parseInt(e.target.value) })}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                                        />
                                    </div>
                                    <div className="w-24">
                                        <label className="text-[9px] font-black text-zinc-600 uppercase mb-1 block">Dano</label>
                                        <input 
                                            value={acao.dano}
                                            onChange={(e) => updateAction(acao.id, { dano: e.target.value })}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                                            placeholder="Ex: 2d6+4"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-zinc-600 uppercase mb-1 block">Tipo</label>
                                        <select 
                                            value={acao.type}
                                            onChange={(e) => updateAction(acao.id, { type: e.target.value as any })}
                                            className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white"
                                        >
                                            <option value="Major">Major</option>
                                            <option value="Minor">Minor</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-zinc-600 uppercase mb-1 block">Categoria</label>
                                        <select 
                                            value={acao.categoria}
                                            onChange={(e) => updateAction(acao.id, { categoria: e.target.value as any })}
                                            className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white"
                                        >
                                            <option value="Corte">Corte</option>
                                            <option value="Perfuração">Perfuração</option>
                                            <option value="Impacto">Impacto</option>
                                            <option value="Feitiço">Feitiço</option>
                                            <option value="Elemental">Elemental</option>
                                            <option value="Magia Negra">Magia Negra</option>
                                            <option value="Efeito">Efeito</option>
                                            <option value="Outro">Outro</option>
                                        </select>
                                    </div>
                                    <button 
                                        onClick={() => removeAction(acao.id)}
                                        className="mt-5 p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-zinc-600 uppercase mb-1 block">Descrição do Efeito</label>
                                    <textarea 
                                        rows={2}
                                        value={acao.description}
                                        onChange={(e) => updateAction(acao.id, { description: e.target.value })}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white resize-none"
                                        placeholder="Efeitos secundários (sangramento, etc)..."
                                    />
                                </div>
                            </div>
                        ))}
                        {editingMonster.acoes.length === 0 && (
                            <div className="py-8 text-center bg-zinc-950/30 border border-dashed border-zinc-800 rounded-2xl">
                                <p className="text-zinc-600 text-xs italic">Nenhuma ação cadastrada para este demônio.</p>
                            </div>
                        )}
                   </div>
                </div>
              </div>

              <div className="p-6 bg-zinc-900/50 border-t border-zinc-800 flex gap-4">
                <button 
                  onClick={() => setEditingMonster(null)}
                  className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-xs font-black uppercase tracking-widest text-zinc-400 transition-all"
                >
                  Descartar Alterações
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-[2] py-4 bg-amber-500 text-zinc-950 hover:bg-amber-400 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <Save size={20} /> Registrar no Bestiário
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});
