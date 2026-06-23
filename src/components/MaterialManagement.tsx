import React, { useState } from 'react';
import { Plus, Trash2, Save, X, Hammer, Shield, Sword, Thermometer, Weight, Zap, Activity, CheckSquare } from 'lucide-react';
import { MaterialData, MATERIALS } from '../data/materials';
import { motion, AnimatePresence } from 'motion/react';

interface MaterialManagementProps {
  materials: MaterialData[];
  onSave: (material: MaterialData) => void;
  onDelete: (id: string) => void;
}

export const MaterialManagement: React.FC<MaterialManagementProps> = ({ 
  materials, 
  onSave, 
  onDelete 
}) => {
  const [editingMaterial, setEditingMaterial] = useState<Partial<MaterialData> | null>(null);
  
  // Combine base materials and custom materials, ensuring no duplicate IDs
  const allMaterials = [
    ...MATERIALS.filter(bm => !materials.some(cm => cm.id === bm.id)),
    ...materials
  ];

  const handleStartCreate = () => {
    setEditingMaterial({
      id: crypto.randomUUID(),
      nome: "Novo Material",
      corte: { fisico: 0, magico: 0 },
      impacto: { fisico: 0, magico: 0 },
      perfuracao: { fisico: 0, magico: 0 },
      resistencia: { fisico: 0, magico: 0 },
      durabilidade: "5",
      efeitos: [],
      isPesado: false,
      isLeve: false,
      aparencia: "Novo material"
    });
  };

  const handleSave = () => {
    if (editingMaterial && editingMaterial.id && editingMaterial.nome) {
      onSave(editingMaterial as MaterialData);
      setEditingMaterial(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Hammer className="w-6 h-6 text-amber-500" />
          BIBLIOTECA DE MATERIAIS
        </h2>
        <button
          onClick={handleStartCreate}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition-all text-sm"
        >
          <Plus className="w-4 h-4" />
          NOVO MATERIAL
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allMaterials.map((mat) => {
          const isCustom = materials.some(m => m.id === mat.id);
          return (
            <div 
              key={mat.id}
              className={`p-4 rounded-xl border ${isCustom ? 'border-amber-500/30 bg-amber-500/5' : 'border-zinc-800 bg-zinc-900/50'} relative group hover:border-zinc-700 transition-all ${mat.ignorarNoGerador ? 'opacity-50' : ''}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-white uppercase tracking-tighter">{mat.nome}</h3>
                  {mat.ignorarNoGerador && (
                    <span className="text-[10px] text-red-500 font-bold uppercase">Ignorado no Gerador</span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => setEditingMaterial(mat)}
                    className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors"
                  >
                    <Hammer className="w-4 h-4" />
                  </button>
                  {isCustom && (
                    <button 
                      onClick={() => onDelete(mat.id)}
                      className="p-1.5 hover:bg-red-500/20 text-zinc-400 hover:text-red-500 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Sword className="w-3 h-3 text-red-500" /> Corte: <span className="text-white font-mono">{mat.corte.fisico}</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Thermometer className="w-3 h-3 text-amber-500" /> Impacto: <span className="text-white font-mono">{mat.impacto.fisico}</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Shield className="w-3 h-3 text-blue-500" /> Perfuração: <span className="text-white font-mono">{mat.perfuracao.fisico}</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Zap className="w-3 h-3 text-yellow-500" /> Resist: <span className="text-white font-mono">{mat.resistencia.fisico}</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Activity className="w-3 h-3 text-green-500" /> Durab: <span className="text-white font-mono">{mat.durabilidade}</span>
                </div>
                {(mat.isPesado || mat.isLeve) && (
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Weight className="w-3 h-3 text-purple-500" /> {mat.isPesado ? 'Pesado' : 'Leve'}
                  </div>
                )}
              </div>

              {mat.efeitos.length > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-800/50">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Efeitos</p>
                  <div className="flex flex-wrap gap-1">
                    {mat.efeitos.map((eff, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-300">
                        {eff}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {editingMaterial && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                <h3 className="text-xl font-bold text-white flex items-center gap-2 uppercase tracking-tighter">
                  <Hammer className="w-6 h-6 text-amber-500" />
                  Editor de Material
                </h3>
                <button onClick={() => setEditingMaterial(null)} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5 ml-1">Nome do Material</label>
                  <input
                    type="text"
                    value={editingMaterial.nome ?? ""}
                    onChange={(e) => setEditingMaterial({ ...editingMaterial, nome: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500/50 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5 ml-1">Corte</label>
                    <input
                      type="number"
                      value={editingMaterial.corte?.fisico || ""}
                      placeholder="0"
                      onChange={(e) => setEditingMaterial({ 
                        ...editingMaterial, 
                        corte: { fisico: parseInt(e.target.value) || 0, magico: 0 } 
                      })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500/50 transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5 ml-1">Impacto</label>
                    <input
                      type="number"
                      value={editingMaterial.impacto?.fisico || ""}
                      placeholder="0"
                      onChange={(e) => setEditingMaterial({ 
                        ...editingMaterial, 
                        impacto: { fisico: parseInt(e.target.value) || 0, magico: 0 } 
                      })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500/50 transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5 ml-1">Perfuração</label>
                    <input
                      type="number"
                      value={editingMaterial.perfuracao?.fisico || ""}
                      placeholder="0"
                      onChange={(e) => setEditingMaterial({ 
                        ...editingMaterial, 
                        perfuracao: { fisico: parseInt(e.target.value) || 0, magico: 0 } 
                      })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500/50 transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5 ml-1">Resistência</label>
                    <input
                      type="number"
                      value={editingMaterial.resistencia?.fisico || ""}
                      placeholder="0"
                      onChange={(e) => setEditingMaterial({ 
                        ...editingMaterial, 
                        resistencia: { fisico: parseInt(e.target.value) || 0, magico: 0 } 
                      })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500/50 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5 ml-1">Durabilidade (ex: 5 ou 1/3)</label>
                    <input
                      type="text"
                      value={editingMaterial.durabilidade ?? ""}
                      onChange={(e) => setEditingMaterial({ ...editingMaterial, durabilidade: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500/50 transition-all font-mono"
                    />
                  </div>
                  <div className="flex gap-4 items-end pb-3">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={editingMaterial.isPesado || false}
                        onChange={(e) => setEditingMaterial({ ...editingMaterial, isPesado: e.target.checked, isLeve: false })}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded border ${editingMaterial.isPesado ? 'bg-amber-600 border-amber-600' : 'border-zinc-700 bg-zinc-950'} flex items-center justify-center transition-all`}>
                        {editingMaterial.isPesado && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                      </div>
                      <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors">Pesado</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={editingMaterial.isLeve || false}
                        onChange={(e) => setEditingMaterial({ ...editingMaterial, isLeve: e.target.checked, isPesado: false })}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded border ${editingMaterial.isLeve ? 'bg-amber-600 border-amber-600' : 'border-zinc-700 bg-zinc-950'} flex items-center justify-center transition-all`}>
                        {editingMaterial.isLeve && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                      </div>
                      <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors">Leve</span>
                    </label>
                  </div>
                </div>

                <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={editingMaterial.ignorarNoGerador || false}
                      onChange={(e) => setEditingMaterial({ ...editingMaterial, ignorarNoGerador: e.target.checked })}
                      className="sr-only"
                    />
                    <div className={`w-6 h-6 rounded-lg border ${editingMaterial.ignorarNoGerador ? 'bg-red-600 border-red-600' : 'border-zinc-700 bg-zinc-950'} flex items-center justify-center transition-all`}>
                      {editingMaterial.ignorarNoGerador && <CheckSquare className="w-4 h-4 text-white" />}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-zinc-200 group-hover:text-white transition-colors block leading-tight">Ignorar no Gerador</span>
                      <span className="text-[10px] text-zinc-500 uppercase">O material não será usado para criar equipamentos de inimigos</span>
                    </div>
                  </label>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5 ml-1">Aparência</label>
                  <input
                    type="text"
                    value={editingMaterial.aparencia ?? ""}
                    onChange={(e) => setEditingMaterial({ ...editingMaterial, aparencia: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500/50 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5 ml-1">Efeitos (Separe por vírgula)</label>
                  <textarea
                    value={editingMaterial.efeitos?.join(", ") ?? ""}
                    onChange={(e) => setEditingMaterial({ 
                      ...editingMaterial, 
                      efeitos: e.target.value.split(",").map(s => s.trim()).filter(s => s !== "") 
                    })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500/50 transition-all min-h-[80px]"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex gap-3">
                <button
                  onClick={() => setEditingMaterial(null)}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white font-bold rounded-xl transition-all"
                >
                  CANCELAR
                </button>
                <button
                  onClick={handleSave}
                  className="flex-3 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  SALVAR MATERIAL
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
