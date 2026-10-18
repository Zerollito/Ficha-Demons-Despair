import React, { useState, useRef, useMemo } from "react";
import { 
  Plus, 
  Trash2, 
  Search, 
  ChevronRight, 
  Heart, 
  FileText, 
  Download, 
  Upload, 
  Target, 
  Shield, 
  Send, 
  PawPrint, 
  Compass, 
  Users, 
  X,
  Swords
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Character, TocaCreature, TableToken } from "../types";
import { createEmptyCreature } from "../lib/character";
import { generateId } from "../lib/random";
import { addToken } from "../services/vttService";
import { CatalystProperties } from "./ui/CatalystProperties";
import { AmmunitionProperties } from "./ui/AmmunitionProperties";

// Re-export properties for backwards compatibility
export { CatalystProperties, AmmunitionProperties };

interface TocaManagerProps {
  activeChar: Character;
  updateChar: (fnOrUpdates: any, characterId?: string) => void;
  onEditCreatureSheet: (creatureId: string) => void;
  showToast?: (message: string, type?: "success" | "error" | "info") => void;
  characters?: Character[];
  activeCampaignId?: string | null;
  cutItem?: any;
  setCutItem?: (item: any) => void;
}

export const TocaManager: React.FC<TocaManagerProps> = React.memo(({
  activeChar,
  updateChar,
  onEditCreatureSheet,
  showToast,
  characters = [],
  activeCampaignId
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendingCreature, setSendingCreature] = useState<TocaCreature | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const creatures: TocaCreature[] = useMemo(() => {
    return activeChar?.tocaCreatures || [];
  }, [activeChar?.tocaCreatures]);

  const filteredCreatures = useMemo(() => {
    return creatures.filter(c => 
      (c.name || (c as any).nome || "Sem Nome").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [creatures, searchTerm]);

  // Handle creating a new creature with the unified structure and empty compartments
  const handleCreate = () => {
    const newCreatureChar = createEmptyCreature(false);
    const newCreature: TocaCreature = {
      ...newCreatureChar,
      id: generateId(),
      name: "Novo Companheiro",
      maxHp: 15,
      hpAtual: 15,
      esquiva: 0,
      acuracia: 0,
      deslocamento: "5 metros",
      bonus: "",
      ataque: {
        corte: 0,
        perfuracao: 0,
        impacto: 0,
        resistencia: 0,
        feitico: 0,
        elemental: 0,
        magiaNegra: 0,
        potencial: 0,
      },
      defesa: {
        corte: 0,
        perfuracao: 0,
        impacto: 0,
        feitico: 0,
        elemental: 0,
        magiaNegra: 0,
      },
      acoes: [],
      compartimentos: [], // Vazio por padrão
      fome: 100,
      sede: 100,
      clima: 0,
      carga: 0,
    };

    const updatedList = [...creatures, newCreature];
    updateChar({ tocaCreatures: updatedList });

    if (showToast) {
      showToast("Companheiro criado com sucesso!", "success");
    }

    // Immediately open sheet for editing
    onEditCreatureSheet(newCreature.id);
  };

  // Handle deleting a creature
  const handleDelete = (id: string) => {
    const updated = creatures.filter(c => c.id !== id);
    updateChar({ tocaCreatures: updated });
    setDeletingId(null);
    if (showToast) {
      showToast("Companheiro removido da Toca.", "info");
    }
  };

  // Export single creature JSON
  const exportCreatureJSON = (creature: TocaCreature) => {
    try {
      const jsonString = JSON.stringify(creature, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safeName = (creature.name || "companheiro").toLowerCase().replace(/[^a-z0-9]/g, "_");
      link.download = `companheiro_${safeName}.json`;
      link.style.display = "none";
      document.body.appendChild(link);
      setTimeout(() => {
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
      }, 0);
    } catch (err) {
      console.error("Erro ao exportar JSON:", err);
      setError("Erro ao exportar criatura.");
    }
  };

  // Export all creatures of active character
  const exportAllCreaturesJSON = () => {
    if (creatures.length === 0) {
      if (showToast) showToast("Nenhum companheiro para exportar!", "error");
      return;
    }
    try {
      const jsonString = JSON.stringify(creatures, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `toca_${(activeChar?.nome || "personagem").toLowerCase().replace(/\s+/g, "_")}.json`;
      link.style.display = "none";
      document.body.appendChild(link);
      setTimeout(() => {
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
      }, 0);
    } catch (err) {
      console.error("Erro ao exportar companheiros:", err);
      setError("Erro ao exportar lista da Toca.");
    }
  };

  // Import creatures from JSON
  const importCreaturesJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rawResult = event.target?.result as string;
        const json = JSON.parse(rawResult);

        let list: any[] = [];
        if (Array.isArray(json)) {
          list = json;
        } else if (json.tocaCreatures && Array.isArray(json.tocaCreatures)) {
          list = json.tocaCreatures;
        } else if (json.name || json.nome) {
          list = [json];
        } else {
          throw new Error("Formato de arquivo JSON não reconhecido.");
        }

        if (list.length === 0) {
          throw new Error("Nenhum companheiro encontrado no arquivo.");
        }

        const sanitizedList: TocaCreature[] = list.map(item => {
          const empty = createEmptyCreature(false);
          return {
            ...empty,
            ...item,
            id: generateId(),
            name: item.name || item.nome || "Companheiro Importado",
            imageUrl: item.imageUrl || item.imagem || "",
            maxHp: Number(item.maxHp) || 15,
            hpAtual: item.hpAtual !== undefined ? Number(item.hpAtual) : (Number(item.maxHp) || 15),
            esquiva: Number(item.esquiva) || 0,
            acuracia: Number(item.acuracia) || 0,
            deslocamento: item.deslocamento || "5 metros",
            compartimentos: Array.isArray(item.compartimentos) ? item.compartimentos : [],
            acoes: Array.isArray(item.acoes) ? item.acoes : [],
            ataque: item.ataque || {
              corte: 0, perfuracao: 0, impacto: 0, resistencia: 0,
              feitico: 0, elemental: 0, magiaNegra: 0, potencial: 0
            },
            defesa: item.defesa || {
              corte: 0, perfuracao: 0, impacto: 0,
              feitico: 0, elemental: 0, magiaNegra: 0
            }
          };
        });

        const newAll = [...creatures, ...sanitizedList];
        updateChar({ tocaCreatures: newAll });

        if (showToast) {
          showToast(sanitizedList.length === 1 ? "Companheiro importado!" : `${sanitizedList.length} companheiros importados!`, "success");
        }
      } catch (err: any) {
        console.error("Erro ao importar JSON:", err);
        setError(err.message || "Erro ao importar arquivo.");
      } finally {
        if (e.target) {
          e.target.value = "";
        }
      }
    };
    reader.readAsText(file);
  };

  // Send creature token to VTT Table
  const handleSendToMesa = async (creature: TocaCreature) => {
    try {
      const campaignId = activeCampaignId || activeChar.campaignId || "default";
      const token: TableToken = {
        id: generateId(),
        name: creature.name || "Companheiro",
        characterId: creature.id,
        x: 200,
        y: 200,
        size: creature.size || 1,
        color: "#f59e0b",
        imageUrl: creature.imageUrl || "",
        type: "creature",
        hp: Number(creature.hpAtual !== undefined ? creature.hpAtual : creature.maxHp) || 15,
        maxHp: Number(creature.maxHp) || 15,
        deslocamento: parseInt(creature.deslocamento) || 5,
        stats: {
          acuracia: Number(creature.acuracia) || 0,
          esquiva: Number(creature.esquiva) || 0,
          ataque: {
            corte: Number(creature.ataque?.corte) || 0,
            perfuracao: Number(creature.ataque?.perfuracao) || 0,
            impacto: Number(creature.ataque?.impacto) || 0,
            resistencia: Number(creature.ataque?.resistencia) || 0,
            feitico: Number(creature.ataque?.feitico) || 0,
            elemental: Number(creature.ataque?.elemental) || 0,
            magiaNegra: Number(creature.ataque?.magiaNegra) || 0,
            potencial: Number(creature.ataque?.potencial) || 0,
          },
          defesa: {
            corte: Number(creature.defesa?.corte) || 0,
            perfuracao: Number(creature.defesa?.perfuracao) || 0,
            impacto: Number(creature.defesa?.impacto) || 0,
            feitico: Number(creature.defesa?.feitico) || 0,
            elemental: Number(creature.defesa?.elemental) || 0,
            magiaNegra: Number(creature.defesa?.magiaNegra) || 0,
          }
        }
      };

      await addToken(campaignId, token);
      if (showToast) {
        showToast(`Token de "${creature.name}" enviado para a Mesa!`, "success");
      }
    } catch (err) {
      console.error("Erro ao enviar para mesa:", err);
      if (showToast) {
        showToast("Erro ao enviar criatura para a mesa.", "error");
      }
    }
  };

  // Send creature to another character sheet
  const handleSendToCharacter = (targetCharacterId: string) => {
    if (!sendingCreature) return;
    const targetChar = characters.find(c => c.id === targetCharacterId);
    if (!targetChar) return;

    const clonedCreature: TocaCreature = {
      ...sendingCreature,
      id: generateId()
    };

    const targetToca = [...(targetChar.tocaCreatures || []), clonedCreature];
    updateChar({ tocaCreatures: targetToca }, targetCharacterId);

    if (showToast) {
      showToast(`"${sendingCreature.name}" copiado para a ficha de ${targetChar.nome}!`, "success");
    }
    setSendingCreature(null);
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Top Header & Search Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
        <div className="relative w-full md:max-w-xl flex-1 md:flex-shrink-0 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar animal ou demônio na toca..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-base text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={exportAllCreaturesJSON}
            className="flex items-center gap-2 bg-zinc-800 text-amber-500 px-3 py-2 rounded-xl font-bold uppercase tracking-widest text-[10px] border border-zinc-700 hover:bg-zinc-700 transition-colors"
            title="Exportar Todos os Companheiros em JSON"
          >
            <Download size={16} /> Exportar JSON
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-zinc-800 text-amber-500 px-3 py-2 rounded-xl font-bold uppercase tracking-widest text-[10px] border border-zinc-700 hover:bg-zinc-700 transition-colors"
            title="Importar Companheiros de um arquivo JSON"
          >
            <Upload size={16} /> Importar JSON
          </motion.button>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={importCreaturesJSON} 
            accept=".json" 
            className="hidden" 
          />

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleCreate}
            className="flex items-center gap-2 bg-amber-500 text-zinc-950 px-3 py-2 rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-amber-500/20"
          >
            <Plus size={18} /> Novo Companheiro
          </motion.button>
        </div>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-2 rounded-xl text-xs font-bold text-center"
        >
          {error}
        </motion.div>
      )}

      {/* Grid of Creatures */}
      {filteredCreatures.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
          {filteredCreatures.map(creature => {
            const currentHp = creature.hpAtual !== undefined ? creature.hpAtual : creature.maxHp;
            return (
              <motion.div
                key={creature.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-4 relative group"
              >
                {/* Header Info */}
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-xl bg-zinc-800 overflow-hidden flex-shrink-0 border border-zinc-700">
                    {creature.imageUrl ? (
                      <img 
                        src={creature.imageUrl.startsWith("http") || creature.imageUrl.startsWith("/") ? creature.imageUrl : `/${creature.imageUrl}`} 
                        alt={creature.name} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600">
                        <PawPrint size={36} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-zinc-100 truncate text-lg uppercase tracking-tight flex-1" title={creature.name}>
                        {creature.name}
                      </h3>
                      <button 
                        onClick={() => exportCreatureJSON(creature)}
                        className="p-1.5 bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-amber-500 rounded-lg transition-all flex-shrink-0 border border-zinc-700/50"
                        title="Exportar esta criatura em JSON"
                      >
                        <Download size={14} />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-1">
                      <div className="flex items-center gap-1 text-red-500 text-[10px] font-bold bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                        <Heart size={10} /> {currentHp}/{creature.maxHp} HP
                      </div>
                      <div className="flex items-center gap-1 text-amber-500 text-[10px] font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        <Target size={10} /> {creature.acuracia} ACC
                      </div>
                      <div className="flex items-center gap-1 text-blue-400 text-[10px] font-bold bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                        <Shield size={10} /> {creature.esquiva} ESQ
                      </div>
                    </div>
                  </div>
                </div>

                {/* Combat Níveis Table (Matching Bestiary) */}
                <div className="bg-zinc-950/40 border border-zinc-800/50 rounded-xl p-2.5 text-[10px] space-y-1 font-sans">
                  <div className="grid grid-cols-3 gap-1 font-black uppercase text-zinc-500 text-[8px] tracking-wider pb-1 border-b border-zinc-800/80">
                    <span>Atributo</span>
                    <span className="text-center text-red-400">Ataque</span>
                    <span className="text-center text-blue-400">Defesa</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 items-center">
                    <span className="font-bold text-zinc-400">Corte</span>
                    <span className="text-center font-mono text-zinc-200">{creature.ataque?.corte ?? 0}</span>
                    <span className="text-center font-mono text-zinc-200">{creature.defesa?.corte ?? 0}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 items-center">
                    <span className="font-bold text-zinc-400">Perfuração</span>
                    <span className="text-center font-mono text-zinc-200">{creature.ataque?.perfuracao ?? 0}</span>
                    <span className="text-center font-mono text-zinc-200">{creature.defesa?.perfuracao ?? 0}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 items-center">
                    <span className="font-bold text-zinc-400">Impacto</span>
                    <span className="text-center font-mono text-zinc-200">{creature.ataque?.impacto ?? 0}</span>
                    <span className="text-center font-mono text-zinc-200">{creature.defesa?.impacto ?? 0}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 items-center">
                    <span className="font-bold text-zinc-400">Feitiço</span>
                    <span className="text-center font-mono text-zinc-200">{creature.ataque?.feitico ?? 0}</span>
                    <span className="text-center font-mono text-zinc-200">{creature.defesa?.feitico ?? 0}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 items-center">
                    <span className="font-bold text-zinc-400">Elemental</span>
                    <span className="text-center font-mono text-zinc-200">{creature.ataque?.elemental ?? 0}</span>
                    <span className="text-center font-mono text-zinc-200">{creature.defesa?.elemental ?? 0}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 items-center">
                    <span className="font-bold text-zinc-400">Magia Negra</span>
                    <span className="text-center font-mono text-zinc-200">{creature.ataque?.magiaNegra ?? 0}</span>
                    <span className="text-center font-mono text-zinc-200">{creature.defesa?.magiaNegra ?? 0}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 items-center pt-1 border-t border-zinc-800/50 text-[9px]">
                    <span className="font-black text-amber-500 uppercase">Res/Pot</span>
                    <span className="text-center font-mono text-amber-400">{creature.ataque?.resistencia ?? 0} / {creature.ataque?.potencial ?? 0}</span>
                    <span className="text-center text-zinc-500">-</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 mt-auto pt-2 border-t border-zinc-800/60">
                  {deletingId === creature.id ? (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleDelete(creature.id)}
                        className="flex-1 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-red-600/20"
                      >
                        Confirmar Exclusão
                      </button>
                      <button 
                        onClick={() => setDeletingId(null)}
                        className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-xl text-[10px] font-black uppercase hover:text-white"
                      >
                        Sair
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => onEditCreatureSheet(creature.id)}
                          className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20"
                          title="Abrir a ficha completa do animal/demônio"
                        >
                          <FileText size={14} /> Ficha Completa
                        </button>

                        <button 
                          onClick={() => setDeletingId(creature.id)}
                          className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-red-500/10 flex items-center justify-center"
                          title="Excluir da Toca"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleSendToMesa(creature)}
                          className="py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 border border-zinc-700/60"
                          title="Enviar token para o tabuleiro VTT"
                        >
                          <Compass size={12} /> Enviar p/ Mesa
                        </button>
                        <button
                          onClick={() => setSendingCreature(creature)}
                          className="py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 border border-zinc-700/60"
                          title="Enviar ou copiar para outra ficha"
                        >
                          <Users size={12} /> Enviar p/ Ficha
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/20 border-2 border-dashed border-zinc-800 rounded-3xl text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-4">
            <PawPrint size={32} />
          </div>
          <h3 className="text-lg font-bold text-zinc-200 uppercase tracking-tight mb-1">
            {searchTerm ? "Nenhum resultado encontrado" : "Nenhum animal ou demônio cadastrado"}
          </h3>
          <p className="text-zinc-500 text-xs max-w-sm mb-6 leading-relaxed">
            {searchTerm 
              ? "Tente buscar por outro termo ou limpe o campo de busca." 
              : "Cadastre companheiros, montarias ou invocações para ter acesso à ficha de combate completa, inventário e controle no VTT."}
          </p>
          {!searchTerm && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleCreate}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              <Plus size={16} /> Criar Primeiro Companheiro
            </motion.button>
          )}
        </div>
      )}

      {/* Modal: Enviar para Ficha */}
      <AnimatePresence>
        {sendingCreature && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl"
            >
              <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <PawPrint size={18} className="text-amber-500" />
                  <h3 className="font-bold text-sm text-zinc-100 uppercase tracking-wider">
                    Enviar para outra Ficha
                  </h3>
                </div>
                <button 
                  onClick={() => setSendingCreature(null)}
                  className="text-zinc-500 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-zinc-400">
                Escolha o personagem que receberá uma cópia de <strong>{sendingCreature.name}</strong> em sua Toca:
              </p>

              <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar">
                {characters.map(char => (
                  <button
                    key={char.id}
                    onClick={() => handleSendToCharacter(char.id)}
                    className="w-full p-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800/80 flex items-center justify-between text-left transition-colors group"
                  >
                    <div>
                      <div className="font-bold text-xs text-zinc-200 group-hover:text-amber-400">
                        {char.nome}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {char.etnia || "Sem Etnia"} · {(char.tocaCreatures || []).length} companheiro(s)
                      </div>
                    </div>
                    <Send size={14} className="text-zinc-600 group-hover:text-amber-500 transition-colors" />
                  </button>
                ))}
              </div>

              <div className="flex justify-end pt-2 border-t border-zinc-800">
                <button
                  onClick={() => setSendingCreature(null)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold uppercase"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});
