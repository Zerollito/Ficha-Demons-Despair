import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Plus, 
  Trash2, 
  Skull, 
  Search,
  ChevronRight,
  Shield,
  Heart,
  FileText,
  Download,
  Upload,
  Target
} from "lucide-react";
import { motion } from "motion/react";
import { BestiaryMonster } from "../types";
import { 
  saveMonsterToBestiary, 
  deleteMonsterFromBestiary, 
  subscribeToBestiary,
  saveMonstersBatch
} from "../services/bestiaryService";
import { DEFAULT_MONSTERS } from "../constants/defaultMonsters";
import { auth, isFirebaseQuotaExceeded } from "../lib/supabase";
import { generateId } from "../lib/random";

const normalizeMonsterName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[.\s_-]+/g, "") // remove periods, spaces, underscores, hyphens
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove accents
};

interface BestiaryProps {
  onMonsterSelect?: (monster: BestiaryMonster) => void;
  isSelectionMode?: boolean;
  onEditMonsterSheet?: (monsterId: string) => void;
}

const sanitizeMonster = (m: any): Partial<BestiaryMonster> => {
  return {
    name: m.name || "Criatura Sem Nome",
    imageUrl: m.imageUrl || "",
    maxHp: m.maxHp !== undefined ? m.maxHp : 10,
    size: m.size || 1,
    esquiva: m.esquiva !== undefined ? m.esquiva : 0,
    acuracia: m.acuracia !== undefined ? m.acuracia : 0,
    deslocamento: m.deslocamento || "5 metros",
    bonus: m.bonus || "",
    ataque: {
      corte: m.ataque?.corte !== undefined ? m.ataque.corte : 0,
      perfuracao: m.ataque?.perfuracao !== undefined ? m.ataque.perfuracao : 0,
      impacto: m.ataque?.impacto !== undefined ? m.ataque.impacto : 0,
      resistencia: m.ataque?.resistencia !== undefined ? m.ataque.resistencia : 0,
      feitico: m.ataque?.feitico !== undefined ? m.ataque.feitico : 0,
      elemental: m.ataque?.elemental !== undefined ? m.ataque.elemental : 0,
      magiaNegra: m.ataque?.magiaNegra !== undefined ? m.ataque.magiaNegra : 0,
      potencial: m.ataque?.potencial !== undefined ? m.ataque.potencial : 0,
    },
    defesa: {
      corte: m.defesa?.corte !== undefined ? m.defesa.corte : 0,
      perfuracao: m.defesa?.perfuracao !== undefined ? m.defesa.perfuracao : 0,
      impacto: m.defesa?.impacto !== undefined ? m.defesa.impacto : 0,
      feitico: m.defesa?.feitico !== undefined ? m.defesa.feitico : 0,
      elemental: m.defesa?.elemental !== undefined ? m.defesa.elemental : 0,
      magiaNegra: m.defesa?.magiaNegra !== undefined ? m.defesa.magiaNegra : 0,
    },
    local: m.local || "",
    personalidade: m.personalidade || "",
    gostaNaoGosta: m.gostaNaoGosta || "",
    partesUteis: m.partesUteis || "",
    informacoes: m.informacoes || "",
    habitos: m.habitos || "",
    acoes: Array.isArray(m.acoes) ? m.acoes : [],
  };
};

export const Bestiary: React.FC<BestiaryProps> = React.memo(({ onMonsterSelect, isSelectionMode = false, onEditMonsterSheet }) => {
  const [monsters, setMonsters] = useState<BestiaryMonster[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasSeededRef = useRef(false);
  const hasCompletedMigrationRef = useRef(false);

  useEffect(() => {
    if (!auth.currentUser?.uid) {
      setMonsters([]);
      return;
    }
    const unsubscribe = subscribeToBestiary(auth.currentUser.uid, (monstersData) => {
      setMonsters(monstersData);
      
      // If quota is exceeded, do not attempt auto-migrations or seeding to prevent looping/spamming requests
      if (isFirebaseQuotaExceeded()) {
        return;
      }
      
      // Auto-migration: If monsters exist, ensure they are exactly the standard ones (no duplicates, correct names)
      if (monstersData.length > 0 && auth.currentUser && !hasCompletedMigrationRef.current) {
        hasCompletedMigrationRef.current = true;
        (async () => {
          let updatedAny = false;
          
          // First, clean up duplicates and normalize names of any matching standard monsters
          const seenNames = new Set<string>();
          for (const m of monstersData) {
            const normM = normalizeMonsterName(m.name || "");
            const defaultMatch = DEFAULT_MONSTERS.find(dm => normalizeMonsterName(dm.name) === normM);
            
            if (defaultMatch) {
              // Normalize its name to the standard spelling if there is a slight mismatch (e.g. trailing period)
              if (m.name !== defaultMatch.name) {
                console.log(`Auto-correcting monster name from "${m.name}" to "${defaultMatch.name}"`);
                m.name = defaultMatch.name;
                await saveMonsterToBestiary(m);
                updatedAny = true;
              }

              const normMatchName = defaultMatch.name.toLowerCase().trim();
              if (seenNames.has(normMatchName)) {
                console.log(`Auto-deleting duplicate standard monster: ${m.name} (${m.id})`);
                await deleteMonsterFromBestiary(m.id);
                updatedAny = true;
                continue;
              }
              seenNames.add(normMatchName);
            }
          }

          // Fetch standard monsters to verify stats and image URLs
          const currentMonsters = monstersData.filter(m => 
            DEFAULT_MONSTERS.some(dm => normalizeMonsterName(dm.name) === normalizeMonsterName(m.name))
          );

          // Deep comparison to avoid unneeded updates (and order/key variations in JSON parsing)
          const isAtaqueEqual = (atk1: any, atk2: any) => {
            if (!atk1 || !atk2) return false;
            const keys = ['corte', 'perfuracao', 'impacto', 'resistencia', 'feitico', 'elemental', 'magiaNegra', 'potencial'];
            return keys.every(k => Number(atk1[k] || 0) === Number(atk2[k] || 0));
          };

          const isDefesaEqual = (def1: any, def2: any) => {
            if (!def1 || !def2) return false;
            const keys = ['corte', 'perfuracao', 'impacto', 'feitico', 'elemental', 'magiaNegra'];
            return keys.every(k => Number(def1[k] || 0) === Number(def2[k] || 0));
          };

          const isAcoesEqual = (ac1: any[], ac2: any[]) => {
            if (!ac1 || !ac2) return false;
            if (ac1.length !== ac2.length) return false;
            return ac1.every((a, idx) => {
              const b = ac2[idx];
              if (!b) return false;
              return a.name === b.name && 
                     a.type === b.type && 
                     a.categoria === b.categoria && 
                     Number(a.acerto || 0) === Number(b.acerto || 0) && 
                     a.dano === b.dano && 
                     a.description === b.description;
            });
          };

          for (const m of currentMonsters) {
            const defaultMatch = DEFAULT_MONSTERS.find(dm => normalizeMonsterName(dm.name) === normalizeMonsterName(m.name));
            if (defaultMatch) {
              const needsImageUpdate = !m.imageUrl || m.imageUrl !== defaultMatch.imageUrl;
              const needsHpUpdate = m.maxHp !== defaultMatch.maxHp;
              const needsDeslocamentoUpdate = m.deslocamento !== defaultMatch.deslocamento;
              const needsAtaqueUpdate = !isAtaqueEqual(m.ataque, defaultMatch.ataque);
              const needsDefesaUpdate = !isDefesaEqual(m.defesa, defaultMatch.defesa);
              const needsAcoesUpdate = !isAcoesEqual(m.acoes || [], defaultMatch.acoes || []);

              if (needsImageUpdate || needsHpUpdate || needsDeslocamentoUpdate || needsAtaqueUpdate || needsDefesaUpdate || needsAcoesUpdate) {
                console.log(`Auto-updating stats for default monster: ${m.name}`);
                await saveMonsterToBestiary({
                  ...m,
                  imageUrl: defaultMatch.imageUrl,
                  maxHp: defaultMatch.maxHp,
                  deslocamento: defaultMatch.deslocamento,
                  esquiva: defaultMatch.esquiva,
                  acuracia: defaultMatch.acuracia,
                  bonus: defaultMatch.bonus,
                  ataque: defaultMatch.ataque,
                  defesa: defaultMatch.defesa,
                  acoes: defaultMatch.acoes,
                  local: m.local || defaultMatch.local,
                  personalidade: m.personalidade || defaultMatch.personalidade,
                  partesUteis: m.partesUteis || defaultMatch.partesUteis,
                  informacoes: m.informacoes || defaultMatch.informacoes,
                  gostaNaoGosta: m.gostaNaoGosta || defaultMatch.gostaNaoGosta,
                  habitos: m.habitos || defaultMatch.habitos
                });
                updatedAny = true;
              }
            }
          }

          // Check for any default monsters that are completely missing from the user's bestiary and add them
          const missingDefaults = DEFAULT_MONSTERS.filter(dm => 
            !currentMonsters.some(m => normalizeMonsterName(m.name) === normalizeMonsterName(dm.name))
          );
          if (missingDefaults.length > 0) {
            console.log(`Auto-seeding ${missingDefaults.length} missing default monsters`);
            const monstersToSeed = missingDefaults.map(monster => ({
              ...monster,
              id: generateId(),
              masterId: auth.currentUser!.uid
            } as BestiaryMonster));
            await saveMonstersBatch(monstersToSeed);
            updatedAny = true;
          }

          if (updatedAny) {
            console.log("Migration complete: Monster images and stats updated.");
          }
        })();
      }

      // Auto-seed if empty and user is logged in
      if (monstersData.length === 0 && auth.currentUser && !hasSeededRef.current) {
        hasSeededRef.current = true;
        (async () => {
          const monstersToSeed = DEFAULT_MONSTERS.map(monster => ({
            ...monster,
            id: generateId(),
            masterId: auth.currentUser!.uid
          } as BestiaryMonster));
          await saveMonstersBatch(monstersToSeed);
        })();
      }
    });
    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  const getInitialMonster = (): BestiaryMonster => ({
    id: generateId(),
    name: "Novo Monstro",
    maxHp: 20,
    size: 1,
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

  const handleCreate = async () => {
    try {
      const newMonster = getInitialMonster();
      newMonster.masterId = auth.currentUser?.uid || "";
      await saveMonsterToBestiary(newMonster);
      if (onEditMonsterSheet) {
        onEditMonsterSheet(newMonster.id);
      }
    } catch (err) {
      console.error("Erro ao criar novo demônio:", err);
      setError("Falha ao criar novo demônio.");
    }
  };

  const seedDefaults = async () => {
    if (!auth.currentUser) return;
    
    // First, delete duplicate standard monsters using name normalization
    const seenNames = new Set<string>();
    for (const m of monsters) {
      const normM = normalizeMonsterName(m.name || "");
      const isStandard = DEFAULT_MONSTERS.some(dm => normalizeMonsterName(dm.name) === normM);
      if (isStandard) {
        const normNameKey = normM;
        if (seenNames.has(normNameKey)) {
          await deleteMonsterFromBestiary(m.id);
        } else {
          seenNames.add(normNameKey);
        }
      }
    }

    // Now seed/update the standard ones
    for (const monster of DEFAULT_MONSTERS) {
      const existing = monsters.find(m => normalizeMonsterName(m.name) === normalizeMonsterName(monster.name));
      if (existing) {
        // Overwrite existing monster with updated base stats while maintaining its original ID and masterId
        await saveMonsterToBestiary({
          ...existing,
          ...monster,
          id: existing.id,
          masterId: existing.masterId
        } as BestiaryMonster);
      } else {
        await saveMonsterToBestiary({
          ...monster,
          id: generateId(),
          masterId: auth.currentUser.uid
        } as BestiaryMonster);
      }
    }
    alert("Monstros base sincronizados e atualizados com sucesso!");
  };

  const handleDelete = async (id: string) => {
    console.log("Iniciando exclusão do monstro:", id);
    try {
      await deleteMonsterFromBestiary(id);
      console.log("Exclusão concluída com sucesso");
      setDeletingId(null);
    } catch (err: any) {
      console.error("Erro na exclusão:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes("permission-denied")) {
        setError("Você não tem permissão para excluir este monstro.");
      } else {
        setError("Erro ao excluir monstro. Tente novamente.");
      }
      setTimeout(() => setError(null), 5000);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportMonsterJSON = (monster: BestiaryMonster) => {
    try {
      const jsonString = JSON.stringify(monster, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safeName = (monster.name || "criatura")
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      link.download = `criatura_${safeName}.json`;
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
      console.error("Erro ao exportar JSON da criatura:", err);
      setError("Erro ao exportar criatura.");
    }
  };

  const exportAllMonstersJSON = () => {
    if (uniqueMonsters.length === 0) {
      alert("Nenhuma criatura para exportar!");
      return;
    }
    try {
      const jsonString = JSON.stringify(uniqueMonsters, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bestiario_completo.json`;
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
      console.error("Erro ao exportar bestiário completo:", err);
      setError("Erro ao exportar bestiário.");
    }
  };

  const importMonstersJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rawResult = event.target?.result as string;
        const json = JSON.parse(rawResult);
        
        let monstersToImport: any[] = [];
        if (Array.isArray(json)) {
          monstersToImport = json;
        } else if (json.monsters && Array.isArray(json.monsters)) {
          monstersToImport = json.monsters;
        } else if (json.name) {
          monstersToImport = [json];
        } else {
          throw new Error("Formato de arquivo não reconhecido.");
        }

        if (monstersToImport.length === 0) {
          throw new Error("Nenhuma criatura encontrada no arquivo.");
        }

        const currentUserId = auth.currentUser?.uid || "";
        const savedList: BestiaryMonster[] = [];

        for (const m of monstersToImport) {
          const sanitized = sanitizeMonster(m);
          const finalMonster: BestiaryMonster = {
            ...sanitized,
            id: generateId(), // New ID to prevent collision
            masterId: currentUserId
          } as BestiaryMonster;
          
          await saveMonsterToBestiary(finalMonster);
          savedList.push(finalMonster);
        }

        alert(savedList.length === 1 ? "Criatura importada com sucesso!" : `${savedList.length} criaturas importadas com sucesso!`);
      } catch (err: any) {
        console.error("Erro ao importar JSON do bestiário:", err);
        setError(err.message || "Erro ao importar criaturas.");
      } finally {
        if (e.target) {
          e.target.value = "";
        }
      }
    };
    reader.readAsText(file);
  };

  const uniqueMonsters = useMemo(() => {
    const unique: BestiaryMonster[] = [];
    const seen = new Set<string>();
    for (const m of monsters) {
      const nameKey = (m.name || "").toLowerCase().trim();
      if (!seen.has(nameKey)) {
        seen.add(nameKey);
        unique.push(m);
      }
    }
    return unique;
  }, [monsters]);

  const filteredMonsters = uniqueMonsters.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
        <div className="relative w-full md:max-w-xl flex-1 md:flex-shrink-0 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar demônio no bestiário..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-base text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>
        {!isSelectionMode && (
          <div className="flex flex-wrap items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={seedDefaults}
              className="flex items-center gap-2 bg-zinc-800 text-zinc-300 px-3 py-2 rounded-xl font-bold uppercase tracking-widest text-[10px] border border-zinc-700 hover:bg-zinc-700 transition-colors"
              title="Importar Monstros do Sistema"
            >
              <Download size={16} /> Importar Base
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={exportAllMonstersJSON}
              className="flex items-center gap-2 bg-zinc-800 text-amber-500 px-3 py-2 rounded-xl font-bold uppercase tracking-widest text-[10px] border border-zinc-700 hover:bg-zinc-700 transition-colors"
              title="Exportar Todas as Criaturas em JSON"
            >
              <Download size={16} /> Exportar JSON
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-zinc-800 text-amber-500 px-3 py-2 rounded-xl font-bold uppercase tracking-widest text-[10px] border border-zinc-700 hover:bg-zinc-700 transition-colors"
              title="Importar Criaturas de um arquivo JSON"
            >
              <Upload size={16} /> Importar JSON
            </motion.button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={importMonstersJSON} 
              accept=".json" 
              className="hidden" 
            />
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleCreate}
              className="flex items-center gap-2 bg-amber-500 text-zinc-950 px-3 py-2 rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-amber-500/20"
            >
              <Plus size={18} /> Novo Demônio
            </motion.button>
          </div>
        )}
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
                  <img 
                    src={monster.imageUrl.startsWith('http') || monster.imageUrl.startsWith('/') ? monster.imageUrl : `/${monster.imageUrl}`} 
                    alt={monster.name} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600">
                    <Skull size={40} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-zinc-100 truncate text-lg uppercase tracking-tight flex-1" title={monster.name}>
                    {monster.name}
                  </h3>
                  <button 
                    onClick={() => exportMonsterJSON(monster)}
                    className="p-1.5 bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-amber-500 rounded-lg transition-all flex-shrink-0 border border-zinc-700/50"
                    title="Exportar esta criatura em JSON"
                  >
                    <Download size={14} />
                  </button>
                </div>
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

            <div className="bg-zinc-950/40 border border-zinc-800/50 rounded-xl p-2.5 text-[10px] space-y-1 font-sans">
              <div className="grid grid-cols-3 gap-1 font-black uppercase text-zinc-500 text-[8px] tracking-wider pb-1 border-b border-zinc-800/80">
                <span>Atributo</span>
                <span className="text-center text-red-400">Ataque</span>
                <span className="text-center text-blue-400">Defesa</span>
              </div>
              <div className="grid grid-cols-3 gap-1 items-center">
                <span className="font-bold text-zinc-400">Corte</span>
                <span className="text-center font-mono text-zinc-200">{monster.ataque?.corte ?? 0}</span>
                <span className="text-center font-mono text-zinc-200">{monster.defesa?.corte ?? 0}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 items-center">
                <span className="font-bold text-zinc-400">Perfuração</span>
                <span className="text-center font-mono text-zinc-200">{monster.ataque?.perfuracao ?? 0}</span>
                <span className="text-center font-mono text-zinc-200">{monster.defesa?.perfuracao ?? 0}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 items-center">
                <span className="font-bold text-zinc-400">Impacto</span>
                <span className="text-center font-mono text-zinc-200">{monster.ataque?.impacto ?? 0}</span>
                <span className="text-center font-mono text-zinc-200">{monster.defesa?.impacto ?? 0}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 items-center">
                <span className="font-bold text-zinc-400">Feitiço</span>
                <span className="text-center font-mono text-zinc-200">{monster.ataque?.feitico ?? 0}</span>
                <span className="text-center font-mono text-zinc-200">{monster.defesa?.feitico ?? 0}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 items-center">
                <span className="font-bold text-zinc-400">Elemental</span>
                <span className="text-center font-mono text-zinc-200">{monster.ataque?.elemental ?? 0}</span>
                <span className="text-center font-mono text-zinc-200">{monster.defesa?.elemental ?? 0}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 items-center">
                <span className="font-bold text-zinc-400">Magia Negra</span>
                <span className="text-center font-mono text-zinc-200">{monster.ataque?.magiaNegra ?? 0}</span>
                <span className="text-center font-mono text-zinc-200">{monster.defesa?.magiaNegra ?? 0}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 items-center pt-1 border-t border-zinc-800/50 text-[9px]">
                <span className="font-black text-amber-500 uppercase">Res/Pot</span>
                <span className="text-center font-mono text-amber-400">{monster.ataque?.resistencia ?? 0} / {monster.ataque?.potencial ?? 0}</span>
                <span className="text-center text-zinc-500">-</span>
              </div>
            </div>

            {isSelectionMode ? (
              <div className="flex gap-2 mt-auto">
                <button
                  onClick={() => onMonsterSelect?.(monster)}
                  className="flex-1 py-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-amber-500 hover:text-zinc-950 transition-all flex items-center justify-center gap-2"
                >
                  Invocação <ChevronRight size={14} />
                </button>
                <button 
                  onClick={() => exportMonsterJSON(monster)}
                  className="p-3 bg-zinc-850 hover:bg-amber-500 hover:text-zinc-950 text-amber-500 rounded-xl transition-all border border-zinc-800 flex items-center justify-center"
                  title="Exportar esta criatura em JSON"
                >
                  <Download size={16} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2 mt-auto">
                {deletingId === monster.id ? (
                  <div className="flex-1 flex gap-2">
                    <button 
                      onClick={() => {
                        console.log("Confirmou exclusão de:", monster.id);
                        handleDelete(monster.id);
                      }}
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
                  <>
                    {onEditMonsterSheet && (
                      <button 
                        onClick={() => onEditMonsterSheet(monster.id)}
                        className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-bold uppercase transition-all text-white flex items-center justify-center gap-1"
                        title="Ver e editar ficha de jogo completa do demônio"
                      >
                        <FileText size={14} /> Ficha Completa
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        console.log("Clicou no lixo para:", monster.id);
                        setDeletingId(monster.id);
                      }}
                      className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-red-500/10 flex items-center justify-center"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
});
