import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  Plus,
  Trash2,
  Save,
  Download,
  Upload,
  Copy,
  ChevronDown,
  ChevronUp,
  Shield,
  Sword,
  Backpack,
  BookOpen,
  Activity,
  Coins,
  User,
  MapPin,
  Thermometer,
  Utensils,
  Droplets,
  Battery,
  Weight,
  Package,
  Gem,
  Zap,
  MoreVertical,
  Flame,
  Skull,
  Biohazard,
  Bone,
  RotateCw,
  X,
  Droplet,
  FileText,
  Dices,
  History,
  Minus,
  Image,
  TrendingUp,
  Target,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { jsPDF } from "jspdf";
import { diceBase64 } from "./diceIcons";
import { GoogleDriveSync } from "./components/GoogleDriveSync";

import { Character, AppState, ArmorPiece } from "./types";
import {
  Stats,
  PROFICIENCIES,
  calculateProficiencyBonus,
} from "./rules/proficiencyRules";
import {
  getVidaMaxima,
  getManaMaxima,
  getCargaMaxima,
  getDeslocamentoBase,
} from "./rules/statusRules";
import {
  Item,
  calculateInventoryTotals,
  getLoadPenalties,
} from "./rules/inventoryRules";
import {
  Weapon,
  Catalyst,
  getStatBonus,
  calculateWeaponDamageBonus,
} from "./rules/combatRules";
import {
  Knowledge,
  getXpToNextLevel,
  INITIAL_KNOWLEDGES,
} from "./rules/knowledgeRules";
import { getSurvivalPenalties } from "./rules/survivalRules";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const STORAGE_KEY = "rpg_system_x_chars";

const generateId = () => {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (e) {}
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

const createEmptyCharacter = (): Character => ({
  id: generateId(),
  nome: "Novo Personagem",
  etnia: "",
  dinheiro: { C: 0, B: 0, P: 0, O: 0 },
  vidaAtual: 0,
  manaAtual: 0,
  fome: 100,
  sede: 100,
  cansaco: 8,
  defesa: { Cabeça: 0, Torso: 0, Braços: 0, Pernas: 0 },
  clima: 0,
  stats: {
    CON: 0,
    RES: 0,
    ADP: 0,
    MEN: 0,
    APR: 0,
    FOR: 0,
    DEX: 0,
    INT: 0,
    RIT: 0,
  },
  statsXP: {
    CON: 0,
    RES: 0,
    ADP: 0,
    MEN: 0,
    APR: 0,
    FOR: 0,
    DEX: 0,
    INT: 0,
    RIT: 0,
  },
  bonusProficiencias: {},
  joias: [],
  imagem: "",
  armas: [],
  catalisadores: [],
  habilidades: [],
  magias: [],
  armaduras: [],
  acessorios: [],
  compartimentos: [
    { id: generateId(), nome: "Mochila de Viagem", volumeMax: 30, itens: [] },
    { id: generateId(), nome: "Bolsa de Cinto", volumeMax: 3, itens: [] },
  ],
  conhecimentos: INITIAL_KNOWLEDGES.map((name) => ({
    name,
    nivel: 0,
    xp: 0,
    limite: 5,
  })),
  escalas: [],
  efeitosNegativos: [],
  anotacoes: [{ id: generateId(), titulo: "Anotações Gerais", conteudo: "" }],
  dadosCustomizados: [],
  imagens: [],
});

const NEGATIVE_EFFECTS = [
  {
    id: "ossos_quebrados",
    name: "Ossos quebrados",
    icon: Bone,
    color: "text-zinc-400",
    info: "Ponto fraco\n+3 dano extra\nImobilizado",
  },
  {
    id: "sangramento",
    name: "Sangramento",
    icon: Droplet,
    color: "text-red-500",
    info: "Ponto fraco\nDano continuo",
  },
  {
    id: "hemorragia",
    name: "Hemorragia",
    icon: Droplets,
    color: "text-red-600",
    info: "Ponto fraco\n-⅓ Deslocamento, esquiva e acurácia\n-2 Defesa com armas",
  },
  {
    id: "envenenamento",
    name: "Envenenamento",
    icon: Biohazard,
    color: "text-emerald-500",
    info: "Dano continuo",
  },
  {
    id: "putrefacao",
    name: "Putrefação",
    icon: Skull,
    color: "text-zinc-600",
    info: "Ponto fraco\n-1 em todas as proficiências",
  },
  {
    id: "queimadura",
    name: "Queimadura",
    icon: Flame,
    color: "text-orange-500",
    info: "Ponto fraco\n+2 de dano",
  },
  {
    id: "tontura",
    name: "Tontura",
    icon: RotateCw,
    color: "text-amber-400",
    info: "Ponto fraco\nRedução de acerto e esquiva a 0 por 2 turnos\n-⅔ de deslocamento por 2 turnos\nProficiências e testes tem desvantagem de -2 por 2 turnos",
  },
];

const HIT_LOCATIONS = [
  "Braço Esquerdo",
  "Braço Direito",
  "Perna Esquerda",
  "Perna Direita",
  "Tronco",
  "Cabeça",
];

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration for clima object and general robustness
        if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray(parsed.characters)
        ) {
          parsed.characters = parsed.characters.map((char: any) => ({
            ...char,
            clima: typeof char.clima === "object" ? 0 : char.clima || 0,
            escalas: char.escalas || [],
            catalisadores: char.catalisadores || [],
            bonusProficiencias: char.bonusProficiencias || {},
            magias: (char.magias || []).map((m: any) => ({
              ...m,
              tipo: m.tipo === "ataque" ? "Ataque" : m.tipo,
            })),
          }));
          return parsed;
        }
      } catch (e) {
        console.error("Error loading characters", e);
      }
    }
    const initialChar = createEmptyCharacter();
    return { characters: [initialChar], activeCharacterId: initialChar.id };
  });

  const [clipboard, setClipboard] = useState<{
    type: "Arma" | "Catalisador" | "Armadura" | "Item" | "Magia" | "Habilidade";
    data: any;
  } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [vitaisTab, setVitaisTab] = useState<"status" | "efeitos">("status");
  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success" | "info";
  } | null>(null);
  const [activePage, setActivePage] = useState<
    "sheet" | "notes" | "dice" | "gallery"
  >("sheet");
  const [openLevelSelectorId, setOpenLevelSelectorId] = useState<string | null>(
    null,
  );
  const [diceTab, setDiceTab] = useState<"mesa" | "historico">("mesa");
  const [diceQuantity, setDiceQuantity] = useState(1);
  const [diceBonus, setDiceBonus] = useState(0);
  const [diceHistory, setDiceHistory] = useState<
    { id: string; result: number; formula: string; timestamp: number }[]
  >([]);
  const [lastRoll, setLastRoll] = useState<{
    result: number;
    formula: string;
    rolls: number[];
    bonus: number;
    isCombat?: boolean;
    hitResult?: number;
    dmgResult?: number;
    hitRolls?: number[];
    dmgRolls?: number[];
    hitBonus?: number;
    dmgBonus?: number;
    armaNome?: string;
    dmgFormula?: string;
    hitFormula?: string;
    hitLocation?: string;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const rollDice = (
    sides: number,
    quantity: number,
    bonus: number,
    label?: string,
  ) => {
    if (label === "Fome e Sede") {
      const hungerProfBase = calculateProficiencyBonus(
        activeChar.stats,
        "Fome",
        ["RES", "ADP"],
        activeChar.fome,
        activeChar.sede,
        activeChar.cansaco,
        activeChar.clima,
        climateProficiency,
        activeChar.bonusProficiencias?.["Fome"] || 0,
      );

      const hungerProf = activeChar.fome >= 50 ? hungerProfBase : 0;

      const hungerRoll = Math.floor(Math.random() * activeChar.fome) + 1;
      const thirstRoll = Math.floor(Math.random() * activeChar.sede) + 1;

      const totalHunger = hungerRoll + hungerProf;
      const finalHunger =
        totalHunger > activeChar.fome ? activeChar.fome : totalHunger;

      updateChar({
        fome: finalHunger,
        sede: thirstRoll,
      });

      const formula = `1d${activeChar.fome}${hungerProf > 0 ? ` + ${hungerProf}` : ""} (Fome) & 1d${activeChar.sede} (Sede)`;
      const finalResult = finalHunger + thirstRoll;

      setDiceHistory((prev) =>
        [
          {
            id: generateId(),
            result: finalResult,
            formula: `Fome: ${hungerRoll}${hungerProf > 0 ? ` + ${hungerProf} = ${finalHunger}` : ""}, Sede: ${thirstRoll}`,
            timestamp: Date.now(),
          },
          ...prev,
        ].slice(0, 50),
      );

      setLastRoll({
        result: finalResult,
        formula,
        rolls: [hungerRoll, thirstRoll],
        bonus: hungerProf,
      });
      return;
    }

    if (label === "Cansaço") {
      const roll = Math.floor(Math.random() * activeChar.cansaco) + 1;
      updateChar({ cansaco: roll });

      setDiceHistory((prev) =>
        [
          {
            id: generateId(),
            result: roll,
            formula: `Cansaço: ${roll} (1d${activeChar.cansaco})`,
            timestamp: Date.now(),
          },
          ...prev,
        ].slice(0, 50),
      );

      setLastRoll({
        result: roll,
        formula: `1d${activeChar.cansaco} (Cansaço)`,
        rolls: [roll],
        bonus: 0,
      });
      return;
    }

    const rolls: number[] = [];
    let total = 0;
    for (let i = 0; i < quantity; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      rolls.push(roll);
      total += roll;
    }
    const finalResult = total + bonus;
    const formula = `${quantity}d${sides}${bonus !== 0 ? (bonus > 0 ? ` + ${bonus}` : ` - ${Math.abs(bonus)}`) : ""}${label ? ` (${label})` : ""}`;

    setDiceHistory((prev) =>
      [
        {
          id: generateId(),
          result: finalResult,
          formula,
          timestamp: Date.now(),
        },
        ...prev,
      ].slice(0, 50),
    );

    setLastRoll({ result: finalResult, formula, rolls, bonus });
  };

  const rollCombat = (arma: any, bonusManual: number) => {
    // 1. Calculate Hit Bonus (Acurácia + Arma.acerto)
    const acuraciaBonus = calculateProficiencyBonus(
      activeChar.stats,
      "Acurácia",
      ["FOR", "DEX"],
      activeChar.fome,
      activeChar.sede,
      activeChar.cansaco,
      activeChar.clima,
      climateProficiency,
      activeChar.bonusProficiencias?.["Acurácia"] || 0,
    );
    const totalHitBonus =
      (acuraciaBonus || 0) + (arma.acerto || 0) + (bonusManual || 0);

    // 2. Roll Hit (3d8)
    const hitRolls: number[] = [];
    let hitTotal = 0;
    for (let i = 0; i < 3; i++) {
      const r = Math.floor(Math.random() * 8) + 1;
      hitRolls.push(r);
      hitTotal += r;
    }
    const finalHit = hitTotal + totalHitBonus;
    const hitFormula = `3d8${totalHitBonus !== 0 ? (totalHitBonus > 0 ? "+" : "") + totalHitBonus : ""}`;

    // 3. Calculate Damage Bonus (Scaling + Manual)
    const statMap: Record<string, keyof Stats> = {
      Força: "FOR",
      Destreza: "DEX",
      Inteligência: "INT",
      Ritual: "RIT",
    };
    const statKey = statMap[arma.atributoBase || "Força"] || "FOR";
    const statValue = activeChar.stats[statKey] || 0;
    const scalingBonus =
      calculateWeaponDamageBonus(arma as any, statValue) || 0;
    const totalDmgBonus = scalingBonus + (bonusManual || 0);

    // 4. Roll Damage
    const danoStr = (arma.dano || "1d6").toLowerCase().replace(/\s+/g, "");
    const match = danoStr.match(/^(\d*)d(\d+)([+-]\d+)?$/);
    let dmgTotal = 0;
    let dmgRolls: number[] = [];
    let dmgFullFormula = "";

    if (match) {
      const qty = parseInt(match[1]) || 1;
      const sides = parseInt(match[2]);
      const extra = parseInt(match[3]) || 0;
      for (let i = 0; i < qty; i++) {
        const r = Math.floor(Math.random() * sides) + 1;
        dmgRolls.push(r);
        dmgTotal += r;
      }
      const finalExtra = totalDmgBonus + extra;
      dmgTotal += finalExtra;
      dmgFullFormula = `${qty}d${sides}${finalExtra !== 0 ? (finalExtra > 0 ? "+" : "") + finalExtra : ""}`;
    } else {
      const fixedDano = parseInt(danoStr) || 0;
      dmgTotal = fixedDano + totalDmgBonus;
      dmgFullFormula = `${fixedDano}${totalDmgBonus !== 0 ? (totalDmgBonus > 0 ? "+" : "") + totalDmgBonus : ""}`;
    }

    // 4.5. Roll Hit Location (1d6)
    const locationIdx = Math.floor(Math.random() * 6);
    const locationName = HIT_LOCATIONS[locationIdx];

    // 5. Update History & Last Roll
    const combinedFormula = `${arma.nome}: ACERTO ${finalHit} | LOCAL: ${locationName} | DANO ${dmgTotal}`;
    const detailedFormula = `${arma.nome}: Acerto ${finalHit} (${hitFormula}) | Local: ${locationName} | Dano ${dmgTotal} (${dmgFullFormula})`;

    setDiceHistory((prev) =>
      [
        {
          id: generateId(),
          result: finalHit, // Use Hit as the primary number for the History icon
          formula: detailedFormula,
          timestamp: Date.now(),
        },
        ...prev,
      ].slice(0, 50),
    );

    setLastRoll({
      result: finalHit,
      formula: combinedFormula,
      rolls: [...hitRolls],
      bonus: totalHitBonus,
      isCombat: true,
      hitResult: finalHit,
      dmgResult: dmgTotal,
      hitRolls: hitRolls,
      dmgRolls: dmgRolls,
      hitBonus: totalHitBonus,
      dmgBonus: totalDmgBonus,
      armaNome: arma.nome,
      hitFormula: hitFormula,
      dmgFormula: dmgFullFormula,
      hitLocation: locationName,
    });

    // Also show toast with complete result
    // setToast({ message: combinedFormula, type: 'info' });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const copyToClipboard = (
    type: "Arma" | "Catalisador" | "Armadura" | "Item" | "Magia" | "Habilidade",
    data: any,
  ) => {
    const dataWithTipo = { ...data, id: generateId() };
    if (type === "Arma") dataWithTipo.tipo = "Arma";
    if (type === "Catalisador") dataWithTipo.tipo = "Catalisador";
    if (type === "Armadura") dataWithTipo.tipo = "Armadura";
    setClipboard({ type, data: dataWithTipo });
  };

  const activeChar = useMemo(() => {
    if (state.characters.length === 0) return createEmptyCharacter();
    return (
      state.characters.find((c) => c.id === state.activeCharacterId) ||
      state.characters[0]
    );
  }, [state]);

  const climateProficiency = useMemo(() => {
    if (!activeChar) return 0;
    return calculateProficiencyBonus(
      activeChar.stats,
      "Clima",
      ["ADP"],
      activeChar.fome,
      activeChar.sede,
      undefined,
      undefined,
      undefined,
      activeChar.bonusProficiencias?.["Clima"] || 0,
    );
  }, [
    activeChar?.stats,
    activeChar?.fome,
    activeChar?.sede,
    activeChar?.bonusProficiencias?.["Clima"],
  ]);

  const climateEffects = useMemo(() => {
    if (!activeChar) return [];
    const diff = Math.abs(activeChar.clima || 0) - climateProficiency;
    const effects: string[] = [];

    if (diff >= 2) {
      effects.push(
        "-1 em proficiências que usem inteligência, aprendizado e ritual. -5 em mentalidade.",
      );
    }
    if (diff >= 4) {
      effects.push(
        "-1 em proficiências que usem força, destreza, resistência, adaptabilidade e constituição.",
      );
    }
    if (diff >= 6) {
      const condition =
        (activeChar.clima || 0) < 0 ? "Hipotermia" : "Desidratação";
      effects.push(
        `${condition}: ⅓ a mais de dano de ataques, 1/2 do deslocamento, 1/2 resistência a efeitos de dano, ataques Críticos com 18 no d20.`,
      );
    }
    return effects;
  }, [activeChar?.clima, climateProficiency]);

  const fatigueEffects = useMemo(() => {
    if (!activeChar) return [];
    const fatigue = activeChar.cansaco ?? 8;
    const effects: string[] = [];

    if (fatigue <= 5) {
      effects.push("Levemente cansado: não pode treinar nem estudar.");
    }
    if (fatigue <= 3) {
      effects.push("Cansado: -1 em todas as proficiências.");
    }
    if (fatigue === 0) {
      effects.push(
        "Muito cansado: role um d100 puro a cada hora, abaixo de 30 irá desmaiar.",
      );
    }
    return effects;
  }, [activeChar?.cansaco]);

  // Auto-save
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const updateChar = useCallback((updates: Partial<Character>) => {
    setState((prev) => ({
      ...prev,
      characters: prev.characters.map((c) =>
        c.id === prev.activeCharacterId ? { ...c, ...updates } : c,
      ),
    }));
  }, []);

  const showToast = useCallback(
    (message: string, type: "error" | "success" | "info" = "info") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 1500);
    },
    [],
  );

  // Derived Values
  const stats = activeChar?.stats || createEmptyCharacter().stats;
  const vidaMax = getVidaMaxima(stats.CON);
  const manaMax = getManaMaxima(stats.APR);
  const cargaMax = getCargaMaxima(stats.RES);
  const deslocamentoBase = getDeslocamentoBase(
    stats.DEX,
    activeChar.fome,
    activeChar.sede,
    activeChar.clima,
    climateProficiency,
  );

  const compartimentos = activeChar?.compartimentos || [];
  const armas = activeChar?.armas || [];
  const catalisadores = activeChar?.catalisadores || [];
  const armaduras = activeChar?.armaduras || [];
  const acessorios = activeChar?.acessorios || [];

  const invTotals = calculateInventoryTotals(compartimentos);
  const weaponPeso = armas.reduce((acc, w) => acc + (w.peso || 0), 0);
  const catalystPeso = catalisadores.reduce((acc, c) => acc + (c.peso || 0), 0);
  const armorPeso = armaduras.reduce((acc, a) => acc + (a.peso || 0), 0);
  const accessoryPeso = acessorios.reduce((acc, a) => acc + (a.peso || 0), 0);
  const pesoTotal =
    invTotals.peso + weaponPeso + catalystPeso + armorPeso + accessoryPeso;

  const penalties = getLoadPenalties(pesoTotal, cargaMax);
  const survivalPenalties = getSurvivalPenalties(
    activeChar.fome,
    activeChar.sede,
  );
  const deslocamentoFinal = Math.max(
    0,
    Math.floor(deslocamentoBase * penalties.deslocamentoMult) +
      survivalPenalties.movement,
  );

  const exportJSON = () => {
    try {
      const jsonString = JSON.stringify(activeChar, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safeName = (activeChar.nome || "personagem")
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      link.download = `${safeName}.json`;
      link.style.display = "none";
      document.body.appendChild(link);

      // Some mobile browsers need a slight delay or direct click
      setTimeout(() => {
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
      }, 0);
    } catch (err) {
      console.error("Erro ao exportar JSON:", err);
      // Fallback: show in a prompt or alert if possible (though limited in iframe)
      alert("Houve um erro ao exportar. Tente abrir o app em uma nova aba.");
    }
  };

  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const char = JSON.parse(event.target?.result as string);
        char.id = generateId(); // New ID for safety
        setState((prev) => ({
          characters: [...prev.characters, char],
          activeCharacterId: char.id,
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
      doc.text(`${key}: ${val}`, 10, y + 10 + i * 7);
    });

    doc.save(`${activeChar.nome}.pdf`);
  };

  const duplicateChar = () => {
    const newChar = {
      ...activeChar,
      id: generateId(),
      nome: `${activeChar.nome} (Cópia)`,
    };
    setState((prev) => ({
      characters: [...prev.characters, newChar],
      activeCharacterId: newChar.id,
    }));
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteChar = () => {
    if (state.characters.length <= 1) return;
    setState((prev) => {
      const remaining = prev.characters.filter(
        (c) => c.id !== prev.activeCharacterId,
      );
      return {
        characters: remaining,
        activeCharacterId: remaining[0].id,
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
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 font-sans selection:bg-amber-500/30 overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-zinc-950/50 p-1.5 rounded-xl border border-zinc-800">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setActivePage("sheet")}
              className={cn(
                "p-2 sm:p-4 rounded-xl transition-all",
                activePage === "sheet"
                  ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
              title="Ficha do Personagem"
            >
              <User size={28} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setActivePage("dice")}
              className={cn(
                "p-2 sm:p-4 rounded-xl transition-all",
                activePage === "dice"
                  ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
              title="Rolagem de Dados"
            >
              <Dices size={28} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setActivePage("notes")}
              className={cn(
                "p-2 sm:p-4 rounded-xl transition-all",
                activePage === "notes"
                  ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
              title="Anotações"
            >
              <FileText size={28} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setActivePage("gallery")}
              className={cn(
                "p-2 sm:p-4 rounded-xl transition-all",
                activePage === "gallery"
                  ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
              title="Galeria de Imagens"
            >
              <Image size={28} />
            </motion.button>
          </div>
        </div>

        <div className="flex items-center gap-2 relative" ref={menuRef}>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-10 h-10 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-full transition-all border border-zinc-700 shadow-lg"
          >
            <MoreVertical size={20} className="text-amber-500" />
          </motion.button>

          <div
            className={cn(
              "absolute right-0 top-full mt-2 w-72 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl transition-all duration-200 z-[60] p-2 space-y-1 max-h-[80vh] overflow-y-auto custom-scrollbar",
              isMenuOpen
                ? "opacity-100 visible translate-y-0"
                : "opacity-0 invisible -translate-y-2 pointer-events-none",
            )}
          >
            <div className="px-3 py-2 border-b border-zinc-800 mb-1">
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                Escolha de Ficha
              </label>
              <select
                value={state.activeCharacterId || ""}
                onChange={(e) => {
                  setState((prev) => ({
                    ...prev,
                    activeCharacterId: e.target.value,
                  }));
                  setIsMenuOpen(false);
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 truncate"
              >
                {state.characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const nc = createEmptyCharacter();
                setState((prev) => ({
                  characters: [...prev.characters, nc],
                  activeCharacterId: nc.id,
                }));
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium text-zinc-300"
            >
              <Plus size={18} className="text-amber-500" /> Adicionar Nova Ficha
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                duplicateChar();
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium text-zinc-300"
            >
              <Copy size={18} className="text-amber-500" /> Copiar Ficha
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                exportJSON();
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium text-zinc-300"
            >
              <Download size={18} className="text-amber-500" /> Exportar JSON
            </motion.button>

            <GoogleDriveSync
              appState={state}
              onStateUpdate={setState}
              variant="menu"
            />

            <label className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium text-zinc-300 cursor-pointer">
              <Upload size={18} className="text-amber-500" /> Importar JSON
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  importJSON(e);
                  setIsMenuOpen(false);
                }}
                accept=".json"
              />
            </label>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                exportPDF();
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium text-zinc-300"
            >
              <Activity size={18} className="text-amber-500" /> Exportar PDF
            </motion.button>

            <div className="pt-1 border-t border-zinc-800 mt-1">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setShowDeleteConfirm(true);
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-red-500/10 rounded-lg transition-colors text-sm font-medium text-red-400"
              >
                <Trash2 size={18} /> Excluir Ficha
              </motion.button>
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
                <p className="text-zinc-400 text-sm mb-6">
                  Esta ação não pode ser desfeita. Tem certeza que deseja
                  excluir "{activeChar.nome}"?
                </p>
                <div className="flex gap-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm font-medium"
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={deleteChar}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors text-sm font-medium"
                  >
                    Excluir
                  </motion.button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </header>

      <main key={activeChar.id} className="max-w-7xl mx-auto p-4 md:p-6 pb-20">
        {activePage === "sheet" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Basic Info & Stats */}
            <div className="lg:col-span-4 space-y-6">
              <Section title="Personagem" icon={<User size={18} />} collapsible>
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-4 mb-4">
                    <div className="w-32 h-32 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex items-center justify-center relative group">
                      {activeChar.imagem ? (
                        <img
                          src={activeChar.imagem}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User size={48} className="text-zinc-700" />
                      )}
                      <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                        <Upload size={24} className="text-white" />
                        <input
                          type="file"
                          className="hidden"
                          onChange={handleImageUpload}
                          accept="image/*"
                        />
                      </label>
                    </div>
                    {activeChar.imagem && (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => updateChar({ imagem: "" })}
                        className="text-[10px] text-red-400 hover:text-red-300 uppercase font-bold"
                      >
                        Remover Imagem
                      </motion.button>
                    )}
                  </div>

                  <Input
                    label="Nome"
                    value={activeChar?.nome || ""}
                    onChange={(v) => updateChar({ nome: v })}
                  />
                  <Input
                    label="Etnia/Cultura"
                    value={activeChar?.etnia || ""}
                    onChange={(v) => updateChar({ etnia: v })}
                  />

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      Dinheiro
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(["C", "B", "P", "O"] as const).map((coin) => (
                        <div
                          key={coin}
                          className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded p-2"
                        >
                          <span className="text-xs font-bold text-amber-500">
                            {coin}
                          </span>
                          <NumericInput
                            value={activeChar.dinheiro?.[coin] || 0}
                            onChange={(v) =>
                              updateChar({
                                dinheiro: {
                                  ...(activeChar.dinheiro || {
                                    C: 0,
                                    B: 0,
                                    P: 0,
                                    O: 0,
                                  }),
                                  [coin]: v,
                                },
                              })
                            }
                            className="flex-1"
                            size="sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1">
                    <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">
                      Deslocamento
                    </label>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-amber-400 font-bold">
                      {deslocamentoFinal}m
                    </div>
                  </div>
                </div>
              </Section>

              <Section
                title="Vitais"
                icon={<Activity size={18} />}
                collapsible
                defaultCollapsed={false}
              >
                <div className="flex gap-2 mb-4 p-1 bg-zinc-950/50 rounded-lg border border-zinc-800">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setVitaisTab("status")}
                    className={cn(
                      "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                      vitaisTab === "status"
                        ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20"
                        : "text-zinc-500 hover:text-zinc-300",
                    )}
                  >
                    Status
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setVitaisTab("efeitos")}
                    className={cn(
                      "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                      vitaisTab === "efeitos"
                        ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20"
                        : "text-zinc-500 hover:text-zinc-300",
                    )}
                  >
                    Efeitos Negativos
                  </motion.button>
                </div>

                {vitaisTab === "status" ? (
                  <div className="space-y-4">
                    <ProgressBar
                      label="Vida"
                      current={activeChar?.vidaAtual || 0}
                      max={vidaMax}
                      color="bg-red-500"
                      onChange={(v) => updateChar({ vidaAtual: v })}
                    />
                    <ProgressBar
                      label="Mana"
                      current={activeChar?.manaAtual || 0}
                      max={manaMax}
                      color="bg-blue-500"
                      onChange={(v) => updateChar({ manaAtual: v })}
                    />
                    <div className="grid grid-cols-3 gap-3">
                      <MiniBar
                        label="Fome"
                        value={activeChar?.fome || 0}
                        color="bg-orange-500"
                        onChange={(v) => updateChar({ fome: v })}
                      />
                      <MiniBar
                        label="Sede"
                        value={activeChar?.sede || 0}
                        color="bg-cyan-500"
                        onChange={(v) => updateChar({ sede: v })}
                      />
                      <MiniBar
                        label="Cansaço"
                        value={activeChar?.cansaco || 0}
                        max={8}
                        color="bg-purple-500"
                        onChange={(v) => updateChar({ cansaco: v })}
                      />
                    </div>

                    {fatigueEffects.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {fatigueEffects.map((effect, idx) => (
                          <div
                            key={idx}
                            className="text-[9px] leading-tight text-purple-400 bg-purple-400/10 p-1.5 rounded border border-purple-400/20 flex flex-col gap-1.5"
                          >
                            <div className="flex gap-1.5 items-start">
                              <Battery size={10} className="shrink-0 mt-0.5" />
                              <span>{effect}</span>
                            </div>
                            {activeChar.cansaco === 0 &&
                              effect.includes("d100") && (
                                <motion.button
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() =>
                                    rollDice(100, 1, 0, "Teste de Desmaio")
                                  }
                                  className="self-start px-2 py-0.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded text-[8px] font-bold uppercase transition-colors"
                                >
                                  Rolar d100
                                </motion.button>
                              )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-2">
                      <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase mb-1">
                        <span>Clima</span>
                        <span
                          className={cn(
                            activeChar.clima > 0
                              ? "text-orange-400"
                              : activeChar.clima < 0
                                ? "text-blue-400"
                                : "text-zinc-400",
                          )}
                        >
                          {typeof activeChar.clima === "number"
                            ? activeChar.clima > 0
                              ? `+${activeChar.clima}`
                              : activeChar.clima
                            : 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() =>
                            updateChar({
                              clima: Math.max(-10, (activeChar.clima || 0) - 1),
                            })
                          }
                          className="p-2 hover:bg-zinc-800 rounded text-blue-400 transition-colors"
                        >
                          <Minus size={18} />
                        </motion.button>
                        <div className="relative flex-1 h-1.5 flex items-center">
                          <input
                            type="range"
                            min="-10"
                            max="10"
                            step="1"
                            value={activeChar.clima || 0}
                            onChange={(e) =>
                              updateChar({ clima: parseInt(e.target.value) })
                            }
                            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-white"
                            style={{
                              background: `linear-gradient(to right, #3b82f6 0%, #27272a 50%, #ef4444 100%)`,
                            }}
                          />
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() =>
                            updateChar({
                              clima: Math.min(10, (activeChar.clima || 0) + 1),
                            })
                          }
                          className="p-2 hover:bg-zinc-800 rounded text-red-400 transition-colors"
                        >
                          <Plus size={18} />
                        </motion.button>
                      </div>
                      <div className="flex justify-between text-[8px] text-zinc-600 mt-1 px-8">
                        <span>FRIO (-10)</span>
                        <span>NORMAL (0)</span>
                        <span>CALOR (+10)</span>
                      </div>

                      {climateEffects.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {climateEffects.map((effect, idx) => (
                            <div
                              key={idx}
                              className="text-[9px] leading-tight text-red-400 bg-red-400/10 p-1.5 rounded border border-red-400/20 flex gap-1.5 items-start"
                            >
                              <Activity size={10} className="shrink-0 mt-0.5" />
                              <span>{effect}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-zinc-800">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-500 uppercase font-bold tracking-tighter">
                          Carga Total
                        </span>
                        <span
                          className={cn(
                            pesoTotal > cargaMax
                              ? "text-red-400"
                              : "text-zinc-300",
                          )}
                        >
                          {pesoTotal.toFixed(1)} / {cargaMax} kg
                        </span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all duration-500",
                            pesoTotal > cargaMax
                              ? "bg-red-500"
                              : "bg-amber-500",
                          )}
                          style={{
                            width: `${Math.min(100, (pesoTotal / cargaMax) * 100)}%`,
                          }}
                        />
                      </div>

                      {penalties.acertoPenalty !== 0 && (
                        <div className="mt-2 bg-red-500/10 border border-red-500/20 p-2 rounded text-[10px] text-red-400 flex items-center gap-2">
                          <Zap size={12} />
                          PENALIDADE CARGA: {
                            penalties.acertoPenalty
                          } Acerto, {penalties.mentalidadePenalty} Mentalidade
                        </div>
                      )}

                      {survivalPenalties.effects.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {survivalPenalties.effects.map((eff, i) => (
                            <div
                              key={i}
                              className="bg-red-500/10 border border-red-500/20 p-2 rounded text-[10px] text-red-400 flex items-center gap-2"
                            >
                              <Activity size={12} />
                              {eff.name.toUpperCase()}: {eff.info}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      {NEGATIVE_EFFECTS.map((effect) => {
                        const isActive = (
                          activeChar.efeitosNegativos || []
                        ).includes(effect.id);
                        return (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            key={effect.id}
                            onClick={() => {
                              const current = activeChar.efeitosNegativos || [];
                              if (isActive) {
                                updateChar({
                                  efeitosNegativos: current.filter(
                                    (id) => id !== effect.id,
                                  ),
                                });
                              } else {
                                updateChar({
                                  efeitosNegativos: [...current, effect.id],
                                });
                              }
                            }}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-lg border transition-all text-left",
                              isActive
                                ? "bg-zinc-800 border-amber-500/50 text-amber-500"
                                : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700",
                            )}
                          >
                            <effect.icon
                              size={16}
                              className={
                                isActive ? effect.color : "text-zinc-600"
                              }
                            />
                            <span className="text-[10px] font-bold uppercase truncate">
                              {effect.name}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeChar.efeitosNegativos &&
                  activeChar.efeitosNegativos.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-zinc-800 space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {activeChar.efeitosNegativos.map((id) => {
                          const effect = NEGATIVE_EFFECTS.find(
                            (e) => e.id === id,
                          );
                          if (!effect) return null;
                          return (
                            <div key={id} className="group relative">
                              <div
                                className={cn(
                                  "p-2 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center gap-2",
                                  effect.color,
                                )}
                              >
                                <effect.icon size={18} />
                                <motion.button
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() =>
                                    updateChar({
                                      efeitosNegativos:
                                        activeChar.efeitosNegativos.filter(
                                          (eid) => eid !== id,
                                        ),
                                    })
                                  }
                                  className="p-0.5 hover:bg-zinc-800 rounded text-zinc-500"
                                >
                                  <X size={12} />
                                </motion.button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="space-y-2">
                        {activeChar.efeitosNegativos.map((id) => {
                          const effect = NEGATIVE_EFFECTS.find(
                            (e) => e.id === id,
                          );
                          if (!effect || !effect.info) return null;
                          return (
                            <div
                              key={`info-${id}`}
                              className="bg-red-500/5 border border-red-500/10 p-3 rounded-lg"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <effect.icon
                                  size={14}
                                  className={effect.color}
                                />
                                <span className="text-sm font-bold uppercase text-zinc-300">
                                  {effect.name}
                                </span>
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

              <Section
                title="Bônus de Dano"
                icon={<Sword size={18} />}
                collapsible
                defaultCollapsed={true}
              >
                <div className="grid grid-cols-2 gap-3">
                  {["FOR", "DEX", "INT", "RIT"].map((stat) => (
                    <div
                      key={stat}
                      className="flex justify-between items-center bg-zinc-900/50 p-2 rounded border border-zinc-800"
                    >
                      <span className="text-xs text-zinc-400">{stat}</span>
                      <span className="font-bold text-amber-500">
                        +{getStatBonus(stats[stat as keyof Stats])}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>

              <Section
                title="Defesa por Membro"
                icon={<Shield size={18} />}
                collapsible
                defaultCollapsed={true}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(activeChar.defesa).map(([part, val]) => (
                    <div
                      key={part}
                      className="bg-zinc-900 border border-zinc-800 p-2 rounded flex justify-between items-center"
                    >
                      <span className="text-xs text-zinc-400">{part}</span>
                      <NumericInput
                        value={val as number}
                        onChange={(v) =>
                          updateChar({
                            defesa: { ...activeChar.defesa, [part]: v },
                          })
                        }
                        className="w-28"
                        size="sm"
                      />
                    </div>
                  ))}
                </div>
              </Section>

              <Section
                title="Status"
                icon={<Zap size={18} />}
                collapsible
                defaultCollapsed={true}
              >
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(stats) as (keyof Stats)[]).map((stat) => {
                    const statVal = stats[stat];
                    const xpLimit = 5 + Math.floor(statVal / 15) * 5;
                    const currentXP = activeChar?.statsXP?.[stat] || 0;

                    return (
                      <div
                        key={stat}
                        className="bg-zinc-900 border border-zinc-800 p-2 rounded-lg text-center group relative"
                      >
                        <div className="text-[10px] text-zinc-500 font-bold mb-1">
                          {stat}
                        </div>
                        <NumericInput
                          value={statVal}
                          onChange={(v) =>
                            updateChar({ stats: { ...stats, [stat]: v } })
                          }
                          className="w-full"
                          size="lg"
                        />
                        <div className="flex flex-col items-center mt-2">
                          <span className="text-[9px] text-zinc-600 font-bold uppercase mb-1">
                            XP ({currentXP}/{xpLimit})
                          </span>
                          <div className="flex items-center gap-2 w-full">
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                const newVal = Math.max(0, currentXP - 1);
                                updateChar({
                                  statsXP: {
                                    ...(activeChar?.statsXP ||
                                      createEmptyCharacter().statsXP),
                                    [stat]: newVal,
                                  },
                                });
                              }}
                              className="flex-1 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 transition-colors flex justify-center"
                            >
                              <Minus size={14} />
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                const newVal = currentXP + 1;
                                if (newVal >= xpLimit) {
                                  updateChar({
                                    stats: { ...stats, [stat]: statVal + 1 },
                                    statsXP: {
                                      ...(activeChar?.statsXP ||
                                        createEmptyCharacter().statsXP),
                                      [stat]: 0,
                                    },
                                  });
                                } else {
                                  updateChar({
                                    statsXP: {
                                      ...(activeChar?.statsXP ||
                                        createEmptyCharacter().statsXP),
                                      [stat]: newVal,
                                    },
                                  });
                                }
                              }}
                              className="flex-1 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 transition-colors flex justify-center"
                            >
                              <Plus size={14} />
                            </motion.button>
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
              <Section
                title="Proficiências"
                icon={<Shield size={18} />}
                collapsible
                defaultCollapsed={true}
              >
                <div className="grid grid-cols-1 gap-1">
                  {PROFICIENCIES.map((prof) => {
                    const bonus = calculateProficiencyBonus(
                      stats,
                      prof.name,
                      prof.stats as (keyof Stats)[],
                      activeChar.fome,
                      activeChar.sede,
                      activeChar.cansaco,
                      activeChar.clima,
                      climateProficiency,
                      activeChar.bonusProficiencias?.[prof.name] || 0,
                    );
                    const manualBonus =
                      activeChar.bonusProficiencias?.[prof.name] || 0;
                    const totalBonus = bonus;

                    return (
                      <div
                        key={prof.name}
                        className="flex justify-between items-center p-2 hover:bg-zinc-800/50 rounded transition-colors border-b border-zinc-800/50 last:border-0 gap-4"
                      >
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-sm font-medium truncate">
                            {prof.name}
                          </span>
                          <span className="text-[10px] text-zinc-500 uppercase truncate">
                            {prof.stats.join(" + ")}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center">
                            <span className="text-[8px] font-bold text-zinc-600 uppercase mb-0.5">
                              Bônus
                            </span>
                            <NumericInput
                              value={manualBonus}
                              onChange={(v) => {
                                const newBonuses = {
                                  ...(activeChar.bonusProficiencias || {}),
                                  [prof.name]: v,
                                };
                                updateChar({ bonusProficiencias: newBonuses });
                              }}
                              className="w-12 h-7"
                              size="sm"
                            />
                          </div>
                          <div
                            className={cn(
                              "w-8 h-8 flex items-center justify-center rounded-full border text-sm font-bold shrink-0",
                              totalBonus > 0
                                ? "border-amber-500 text-amber-500 bg-amber-500/10"
                                : "border-zinc-700 text-zinc-500",
                            )}
                          >
                            +{totalBonus}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            </div>

            {/* Right Column: Knowledge & Equipment */}
            <div className="lg:col-span-4 space-y-6">
              <Section
                title="Equipamentos"
                icon={<Package size={18} />}
                collapsible
                defaultCollapsed={true}
              >
                <div className="space-y-6">
                  {/* Armas Section */}
                  <SubSection
                    title="Armas"
                    icon={<Sword size={14} />}
                    defaultCollapsed={true}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-[10px] font-bold text-zinc-500 uppercase">
                        Armas
                      </h4>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() =>
                          updateChar({
                            armas: [
                              ...(activeChar?.armas || []),
                              {
                                id: generateId(),
                                nome: "Nova Arma",
                                dano: "0",
                                acerto: 0,
                                tipo: "Arma",
                                escala: "0",
                                atributoBase: "Força",
                                peso: 0,
                                volume: 0,
                                durabilidade: 0,
                                maxDurabilidade: 0,
                                corte: 0,
                                impacto: 0,
                                perfuracao: 0,
                                resistencia: 0,
                              },
                            ],
                          })
                        }
                        className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                      >
                        <Plus size={16} />
                      </motion.button>
                    </div>

                    {clipboard &&
                      (clipboard.type === "Arma" ||
                        (clipboard.type === "Item" &&
                          clipboard.data.tipo === "Arma")) && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            updateChar({
                              armas: [
                                ...(activeChar?.armas || []),
                                { ...clipboard.data, id: generateId() },
                              ],
                            });
                            setClipboard(null);
                          }}
                          className="w-full py-2 mb-2 bg-emerald-500/10 border border-dashed border-emerald-500/50 rounded text-[10px] font-bold uppercase text-emerald-500 hover:bg-emerald-500/20 transition-all"
                        >
                          Colar Arma
                        </motion.button>
                      )}
                    <div className="space-y-3">
                      {armas.map((w, idx) => (
                        <div
                          key={w.id}
                          className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs relative group space-y-2"
                        >
                          <div className="flex justify-between items-center">
                            <input
                              value={w.nome}
                              onChange={(e) => {
                                const newArmas = [...armas];
                                newArmas[idx].nome = e.target.value;
                                updateChar({ armas: newArmas });
                              }}
                              className="bg-transparent font-bold focus:outline-none flex-1 min-w-0 text-amber-500"
                            />
                            <div className="flex items-center gap-2">
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => copyToClipboard("Arma", w)}
                                className="text-zinc-500 hover:text-zinc-300 p-1"
                                title="Copiar Arma"
                              >
                                <Copy size={20} />
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() =>
                                  updateChar({
                                    armas: armas.filter((a) => a.id !== w.id),
                                  })
                                }
                                className="text-red-500 hover:text-red-400 p-1"
                              >
                                <Trash2 size={20} />
                              </motion.button>
                            </div>
                          </div>

                          <WeaponProperties
                            item={w}
                            onChange={(updates) => {
                              const na = [...armas];
                              na[idx] = { ...na[idx], ...updates };
                              updateChar({ armas: na });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </SubSection>

                  {/* Catalisadores Section */}
                  <SubSection
                    title="Catalisadores"
                    icon={<Zap size={14} />}
                    defaultCollapsed={true}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-[10px] font-bold text-zinc-500 uppercase">
                        Catalisadores
                      </h4>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() =>
                          updateChar({
                            catalisadores: [
                              ...(activeChar?.catalisadores || []),
                              {
                                id: generateId(),
                                nome: "Novo Catalisador",
                                tipo: "Catalisador",
                                escala: "0",
                                atributoBase: "Inteligência",
                                peso: 0,
                                volume: 0,
                                durabilidade: 0,
                                maxDurabilidade: 0,
                                feitico: 0,
                                elemental: 0,
                                magiaNegra: 0,
                                potencial: 0,
                              },
                            ],
                          })
                        }
                        className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                      >
                        <Plus size={16} />
                      </motion.button>
                    </div>

                    {clipboard &&
                      (clipboard.type === "Catalisador" ||
                        (clipboard.type === "Item" &&
                          clipboard.data.tipo === "Catalisador")) && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            updateChar({
                              catalisadores: [
                                ...(activeChar?.catalisadores || []),
                                { ...clipboard.data, id: generateId() },
                              ],
                            });
                            setClipboard(null);
                          }}
                          className="w-full py-2 mb-2 bg-emerald-500/10 border border-dashed border-emerald-500/50 rounded text-[10px] font-bold uppercase text-emerald-500 hover:bg-emerald-500/20 transition-all"
                        >
                          Colar Catalisador
                        </motion.button>
                      )}
                    <div className="space-y-3">
                      {catalisadores.map((c, idx) => (
                        <div
                          key={c.id}
                          className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs relative group space-y-2"
                        >
                          <div className="flex justify-between items-center">
                            <input
                              value={c.nome}
                              onChange={(e) => {
                                const newCats = [...catalisadores];
                                newCats[idx].nome = e.target.value;
                                updateChar({ catalisadores: newCats });
                              }}
                              className="bg-transparent font-bold focus:outline-none flex-1 min-w-0 text-amber-500"
                            />
                            <div className="flex items-center gap-2">
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() =>
                                  copyToClipboard("Catalisador", c)
                                }
                                className="text-zinc-500 hover:text-zinc-300 p-1"
                                title="Copiar Catalisador"
                              >
                                <Copy size={20} />
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() =>
                                  updateChar({
                                    catalisadores: catalisadores.filter(
                                      (cat) => cat.id !== c.id,
                                    ),
                                  })
                                }
                                className="text-red-500 hover:text-red-400 p-1"
                              >
                                <Trash2 size={20} />
                              </motion.button>
                            </div>
                          </div>

                          <CatalystProperties
                            item={c}
                            onChange={(updates) => {
                              const na = [...catalisadores];
                              na[idx] = { ...na[idx], ...updates };
                              updateChar({ catalisadores: na });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </SubSection>

                  {/* Armaduras Section */}
                  <SubSection
                    title="Armaduras"
                    icon={<Shield size={14} />}
                    defaultCollapsed={true}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-[10px] font-bold text-zinc-500 uppercase">
                        Armaduras
                      </h4>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() =>
                          updateChar({
                            armaduras: [
                              ...(activeChar?.armaduras || []),
                              {
                                id: generateId(),
                                nome: "Nova Armadura",
                                tipo: "Armadura",
                                corte: 0,
                                impacto: 0,
                                perfuracao: 0,
                                durabilidade: 0,
                                peso: 0,
                                volume: 0,
                                reducaoDano: 0,
                                efeito: "",
                              },
                            ],
                          })
                        }
                        className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                      >
                        <Plus size={16} />
                      </motion.button>
                    </div>

                    {clipboard &&
                      (clipboard.type === "Armadura" ||
                        (clipboard.type === "Item" &&
                          clipboard.data.tipo === "Armadura")) && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            updateChar({
                              armaduras: [
                                ...(activeChar?.armaduras || []),
                                { ...clipboard.data, id: generateId() },
                              ],
                            });
                            setClipboard(null);
                          }}
                          className="w-full py-2 mb-2 bg-emerald-500/10 border border-dashed border-emerald-500/50 rounded text-[10px] font-bold uppercase text-emerald-500 hover:bg-emerald-500/20 transition-all"
                        >
                          Colar Armadura
                        </motion.button>
                      )}
                    <div className="space-y-3">
                      {(activeChar?.armaduras || []).map((a, idx) => (
                        <div
                          key={a.id}
                          className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs relative group space-y-2"
                        >
                          <div className="flex justify-between items-center">
                            <input
                              value={a.nome}
                              onChange={(e) => {
                                const newArms = [
                                  ...(activeChar?.armaduras || []),
                                ];
                                newArms[idx].nome = e.target.value;
                                updateChar({ armaduras: newArms });
                              }}
                              className="bg-transparent font-bold focus:outline-none flex-1 min-w-0 text-amber-500"
                            />
                            <div className="flex items-center gap-2">
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => copyToClipboard("Armadura", a)}
                                className="text-zinc-500 hover:text-zinc-300 p-1"
                                title="Copiar Armadura"
                              >
                                <Copy size={20} />
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() =>
                                  updateChar({
                                    armaduras: (
                                      activeChar?.armaduras || []
                                    ).filter((arm) => arm.id !== a.id),
                                  })
                                }
                                className="text-red-500 hover:text-red-400 p-1"
                              >
                                <Trash2 size={20} />
                              </motion.button>
                            </div>
                          </div>

                          <ArmorProperties
                            item={a}
                            onChange={(updates) => {
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
                  <SubSection
                    title="Acessórios"
                    icon={<Gem size={14} />}
                    defaultCollapsed={true}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-[10px] font-bold text-zinc-500 uppercase">
                        Acessórios
                      </h4>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() =>
                          updateChar({
                            acessorios: [
                              ...(activeChar?.acessorios || []),
                              {
                                id: generateId(),
                                nome: "Novo Acessório",
                                tipo: "Armadura",
                                corte: 0,
                                impacto: 0,
                                perfuracao: 0,
                                durabilidade: 0,
                                peso: 0,
                                volume: 0,
                                reducaoDano: 0,
                                efeito: "",
                              },
                            ],
                          })
                        }
                        className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                      >
                        <Plus size={16} />
                      </motion.button>
                    </div>

                    {clipboard &&
                      (clipboard.type === "Armadura" ||
                        (clipboard.type === "Item" &&
                          clipboard.data.tipo === "Armadura")) && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            updateChar({
                              acessorios: [
                                ...(activeChar?.acessorios || []),
                                { ...clipboard.data, id: generateId() },
                              ],
                            });
                            setClipboard(null);
                          }}
                          className="w-full py-2 mb-2 bg-emerald-500/10 border border-dashed border-emerald-500/50 rounded text-[10px] font-bold uppercase text-emerald-500 hover:bg-emerald-500/20 transition-all"
                        >
                          Colar Acessório
                        </motion.button>
                      )}
                    <div className="space-y-3">
                      {(activeChar?.acessorios || []).map((a, idx) => (
                        <div
                          key={a.id}
                          className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs relative group space-y-2"
                        >
                          <div className="flex justify-between items-center">
                            <input
                              value={a.nome}
                              onChange={(e) => {
                                const newAccs = [
                                  ...(activeChar?.acessorios || []),
                                ];
                                newAccs[idx].nome = e.target.value;
                                updateChar({ acessorios: newAccs });
                              }}
                              className="bg-transparent font-bold focus:outline-none flex-1 min-w-0 text-amber-500"
                            />
                            <div className="flex items-center gap-2">
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => copyToClipboard("Armadura", a)}
                                className="text-zinc-500 hover:text-zinc-300 p-1"
                                title="Copiar Acessório"
                              >
                                <Copy size={20} />
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() =>
                                  updateChar({
                                    acessorios: (
                                      activeChar?.acessorios || []
                                    ).filter((acc) => acc.id !== a.id),
                                  })
                                }
                                className="text-red-500 hover:text-red-400 p-1"
                              >
                                <Trash2 size={20} />
                              </motion.button>
                            </div>
                          </div>

                          <ArmorProperties
                            item={a}
                            onChange={(updates) => {
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
              <Section
                title="Compartimentos"
                icon={<Backpack size={18} />}
                collapsible
                defaultCollapsed
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase">
                      Compartimentos
                    </h4>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() =>
                        updateChar({
                          compartimentos: [
                            ...(activeChar?.compartimentos || []),
                            {
                              id: generateId(),
                              nome: "Novo Compartimento",
                              volumeMax: 0,
                              itens: [],
                            },
                          ],
                        })
                      }
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                    >
                      <Plus size={16} />
                    </motion.button>
                  </div>

                  <div className="space-y-4">
                    {compartimentos.map((comp, cIdx) => {
                      const compVolume = (comp.itens || []).reduce(
                        (acc, i) => acc + (i.volume || 0) * (i.quantidade || 0),
                        0,
                      );
                      return (
                        <div
                          key={comp.id}
                          className="bg-zinc-900/50 rounded-lg border border-zinc-800 overflow-hidden"
                        >
                          <div className="bg-zinc-800/50 px-3 py-2 flex items-center border-b border-zinc-800 gap-2">
                            <Package
                              size={14}
                              className="text-amber-500 shrink-0"
                            />
                            <input
                              value={comp.nome}
                              onChange={(e) => {
                                const nc = [...compartimentos];
                                nc[cIdx].nome = e.target.value;
                                updateChar({ compartimentos: nc });
                              }}
                              className="bg-transparent text-sm font-bold focus:outline-none flex-1 min-w-0 text-amber-500"
                            />
                            <div className="flex items-center gap-2 shrink-0 ml-auto">
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">
                                  Vol Máx
                                </span>
                                <NumericInput
                                  value={comp.volumeMax}
                                  onChange={(v) => {
                                    const nc = [...compartimentos];
                                    nc[cIdx].volumeMax = v;
                                    updateChar({ compartimentos: nc });
                                  }}
                                  className="w-16"
                                  size="sm"
                                />
                              </div>
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() =>
                                  updateChar({
                                    compartimentos: compartimentos.filter(
                                      (c) => c.id !== comp.id,
                                    ),
                                  })
                                }
                                className="text-red-500 hover:text-red-400 p-1"
                              >
                                <Trash2 size={18} />
                              </motion.button>
                            </div>
                          </div>
                          <div className="p-2 space-y-2">
                            <div className="flex justify-between text-xs mb-1 font-bold px-1">
                              <span className="text-zinc-500 uppercase">
                                VOLUME OCUPADO
                              </span>
                              <span
                                className={cn(
                                  compVolume > comp.volumeMax
                                    ? "text-red-400"
                                    : "text-zinc-400",
                                )}
                              >
                                {compVolume.toFixed(1)} / {comp.volumeMax}
                              </span>
                            </div>

                            <div className="flex gap-2">
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                  const nc = [...compartimentos];
                                  nc[cIdx].itens.push({
                                    id: generateId(),
                                    nome: "Novo Item",
                                    peso: 0,
                                    volume: 0,
                                    quantidade: 0,
                                    tipo: "Geral",
                                    durabilidade: 0,
                                    maxDurabilidade: 0,
                                    descricao: "",
                                  });
                                  updateChar({ compartimentos: nc });
                                }}
                                className="flex-1 py-1.5 border border-dashed border-zinc-700 rounded text-[9px] font-bold uppercase text-zinc-500 hover:border-amber-500/50 hover:text-amber-500 transition-all px-1"
                              >
                                + Item
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                  const nc = [...compartimentos];
                                  nc[cIdx].itens.push({
                                    id: generateId(),
                                    nome: "Nova Arma",
                                    peso: 0,
                                    volume: 0,
                                    quantidade: 0,
                                    tipo: "Arma",
                                    durabilidade: 0,
                                    maxDurabilidade: 0,
                                    descricao: "",
                                    dano: "0",
                                    acerto: 0,
                                    escala: "0",
                                    atributoBase: "Força",
                                    corte: 0,
                                    impacto: 0,
                                    perfuracao: 0,
                                    resistencia: 0,
                                  });
                                  updateChar({ compartimentos: nc });
                                }}
                                className="flex-1 py-1.5 border border-dashed border-zinc-700 rounded text-[9px] font-bold uppercase text-zinc-500 hover:border-amber-500/50 hover:text-amber-500 transition-all px-1"
                              >
                                + Arma
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                  const nc = [...compartimentos];
                                  nc[cIdx].itens.push({
                                    id: generateId(),
                                    nome: "Novo Catalisador",
                                    peso: 0,
                                    volume: 0,
                                    quantidade: 0,
                                    tipo: "Catalisador",
                                    durabilidade: 0,
                                    maxDurabilidade: 0,
                                    descricao: "",
                                    escala: "0",
                                    atributoBase: "Inteligência",
                                    feitico: 0,
                                    elemental: 0,
                                    magiaNegra: 0,
                                    potencial: 0,
                                  });
                                  updateChar({ compartimentos: nc });
                                }}
                                className="flex-1 py-1.5 border border-dashed border-zinc-700 rounded text-[9px] font-bold uppercase text-zinc-500 hover:border-amber-500/50 hover:text-amber-500 transition-all px-1"
                              >
                                + Cat
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                  const nc = [...compartimentos];
                                  nc[cIdx].itens.push({
                                    id: generateId(),
                                    nome: "Nova Armadura",
                                    peso: 0,
                                    volume: 0,
                                    quantidade: 0,
                                    tipo: "Armadura",
                                    durabilidade: 0,
                                    maxDurabilidade: 0,
                                    descricao: "",
                                    corte: 0,
                                    impacto: 0,
                                    perfuracao: 0,
                                    reducaoDano: 0,
                                    efeito: "",
                                  });
                                  updateChar({ compartimentos: nc });
                                }}
                                className="flex-1 py-1.5 border border-dashed border-zinc-700 rounded text-[9px] font-bold uppercase text-zinc-500 hover:border-amber-500/50 hover:text-amber-500 transition-all px-1"
                              >
                                + Armad
                              </motion.button>
                            </div>

                            {clipboard && (
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                  const nc = [...compartimentos];
                                  nc[cIdx].itens.push({
                                    ...clipboard.data,
                                    id: generateId(),
                                  });
                                  updateChar({ compartimentos: nc });
                                  setClipboard(null);
                                }}
                                className="w-full py-1.5 bg-emerald-500/10 border border-dashed border-emerald-500/50 rounded text-[9px] font-bold uppercase text-emerald-500 hover:bg-emerald-500/20 transition-all"
                              >
                                Colar {clipboard.type}
                              </motion.button>
                            )}

                            <div className="space-y-2">
                              <SubSection
                                title="Armas"
                                icon={<Sword size={14} />}
                                defaultCollapsed={true}
                              >
                                {(comp.itens || []).map((item, iIdx) =>
                                  item.tipo === "Arma" ? (
                                    <div
                                      key={item.id}
                                      className="bg-zinc-900 p-2 rounded border border-zinc-800 group relative space-y-2"
                                    >
                                      <div className="flex justify-between items-center mb-1">
                                        <input
                                          value={item.nome}
                                          onChange={(e) => {
                                            const nc = [...compartimentos];
                                            nc[cIdx].itens[iIdx].nome =
                                              e.target.value;
                                            updateChar({ compartimentos: nc });
                                          }}
                                          className="bg-transparent text-sm font-bold focus:outline-none flex-1 text-zinc-100"
                                        />
                                        <div className="flex items-center gap-2">
                                          <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() =>
                                              copyToClipboard(
                                                item.tipo === "Arma"
                                                  ? "Arma"
                                                  : item.tipo === "Armadura"
                                                    ? "Armadura"
                                                    : "Item",
                                                item,
                                              )
                                            }
                                            className="text-zinc-500 hover:text-zinc-300 p-1"
                                            title="Copiar Item"
                                          >
                                            <Copy size={20} />
                                          </motion.button>
                                          <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => {
                                              const nc = [...compartimentos];
                                              nc[cIdx].itens = nc[
                                                cIdx
                                              ].itens.filter(
                                                (it) => it.id !== item.id,
                                              );
                                              updateChar({
                                                compartimentos: nc,
                                              });
                                            }}
                                            className="text-red-500 transition-opacity p-1"
                                          >
                                            <Trash2 size={20} />
                                          </motion.button>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-4 gap-2">
                                        <MiniInput
                                          label="Qtd"
                                          type="number"
                                          value={item.quantidade}
                                          onChange={(v) => {
                                            const nc = [...compartimentos];
                                            nc[cIdx].itens[iIdx].quantidade =
                                              parseInt(v) || 1;
                                            updateChar({ compartimentos: nc });
                                          }}
                                        />
                                        <div className="flex flex-col">
                                          <span className="text-[10px] text-zinc-600 uppercase tracking-tighter font-bold">
                                            Total
                                          </span>
                                          <span className="text-xs font-bold text-zinc-400">
                                            {(
                                              item.peso * item.quantidade
                                            ).toFixed(1)}
                                            kg
                                          </span>
                                        </div>
                                      </div>

                                      <WeaponProperties
                                        item={item}
                                        onChange={(updates) => {
                                          const nc = [...compartimentos];
                                          nc[cIdx].itens[iIdx] = {
                                            ...nc[cIdx].itens[iIdx],
                                            ...updates,
                                          };
                                          updateChar({ compartimentos: nc });
                                        }}
                                      />
                                    </div>
                                  ) : null,
                                )}
                              </SubSection>

                              <SubSection
                                title="Catalisadores"
                                icon={<Zap size={14} />}
                                defaultCollapsed={true}
                              >
                                {(comp.itens || []).map((item, iIdx) =>
                                  item.tipo === "Catalisador" ? (
                                    <div
                                      key={item.id}
                                      className="bg-zinc-900 p-2 rounded border border-zinc-800 group relative space-y-2"
                                    >
                                      <div className="flex justify-between items-center mb-1">
                                        <input
                                          value={item.nome}
                                          onChange={(e) => {
                                            const nc = [...compartimentos];
                                            nc[cIdx].itens[iIdx].nome =
                                              e.target.value;
                                            updateChar({ compartimentos: nc });
                                          }}
                                          className="bg-transparent text-sm font-bold focus:outline-none flex-1 text-zinc-100"
                                        />
                                        <div className="flex items-center gap-2">
                                          <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() =>
                                              copyToClipboard(
                                                item.tipo === "Arma"
                                                  ? "Arma"
                                                  : item.tipo === "Catalisador"
                                                    ? "Catalisador"
                                                    : item.tipo === "Armadura"
                                                      ? "Armadura"
                                                      : "Item",
                                                item,
                                              )
                                            }
                                            className="text-zinc-500 hover:text-zinc-300 p-1"
                                            title="Copiar Item"
                                          >
                                            <Copy size={20} />
                                          </motion.button>
                                          <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => {
                                              const nc = [...compartimentos];
                                              nc[cIdx].itens = nc[
                                                cIdx
                                              ].itens.filter(
                                                (it) => it.id !== item.id,
                                              );
                                              updateChar({
                                                compartimentos: nc,
                                              });
                                            }}
                                            className="text-red-500 transition-opacity p-1"
                                          >
                                            <Trash2 size={20} />
                                          </motion.button>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-4 gap-2">
                                        <MiniInput
                                          label="Qtd"
                                          type="number"
                                          value={item.quantidade}
                                          onChange={(v) => {
                                            const nc = [...compartimentos];
                                            nc[cIdx].itens[iIdx].quantidade =
                                              parseInt(v) || 1;
                                            updateChar({ compartimentos: nc });
                                          }}
                                        />
                                        <div className="flex flex-col">
                                          <span className="text-[10px] text-zinc-600 uppercase tracking-tighter font-bold">
                                            Total
                                          </span>
                                          <span className="text-xs font-bold text-zinc-400">
                                            {(
                                              item.peso * item.quantidade
                                            ).toFixed(1)}
                                            kg
                                          </span>
                                        </div>
                                      </div>

                                      <CatalystProperties
                                        item={item}
                                        onChange={(updates) => {
                                          const nc = [...compartimentos];
                                          nc[cIdx].itens[iIdx] = {
                                            ...nc[cIdx].itens[iIdx],
                                            ...updates,
                                          };
                                          updateChar({ compartimentos: nc });
                                        }}
                                      />
                                    </div>
                                  ) : null,
                                )}
                              </SubSection>

                              <SubSection
                                title="Armaduras"
                                icon={<Shield size={14} />}
                                defaultCollapsed={true}
                              >
                                {(comp.itens || []).map((item, iIdx) =>
                                  item.tipo === "Armadura" ? (
                                    <div
                                      key={item.id}
                                      className="bg-zinc-900 p-2 rounded border border-zinc-800 group relative space-y-2"
                                    >
                                      <div className="flex justify-between items-center mb-1">
                                        <input
                                          value={item.nome}
                                          onChange={(e) => {
                                            const nc = [...compartimentos];
                                            nc[cIdx].itens[iIdx].nome =
                                              e.target.value;
                                            updateChar({ compartimentos: nc });
                                          }}
                                          className="bg-transparent text-sm font-bold focus:outline-none flex-1 text-zinc-100"
                                        />
                                        <div className="flex items-center gap-2">
                                          <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() =>
                                              copyToClipboard(
                                                item.tipo === "Arma"
                                                  ? "Arma"
                                                  : item.tipo === "Catalisador"
                                                    ? "Catalisador"
                                                    : item.tipo === "Armadura"
                                                      ? "Armadura"
                                                      : "Item",
                                                item,
                                              )
                                            }
                                            className="text-zinc-500 hover:text-zinc-300 p-1"
                                            title="Copiar Item"
                                          >
                                            <Copy size={20} />
                                          </motion.button>
                                          <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => {
                                              const nc = [...compartimentos];
                                              nc[cIdx].itens = nc[
                                                cIdx
                                              ].itens.filter(
                                                (it) => it.id !== item.id,
                                              );
                                              updateChar({
                                                compartimentos: nc,
                                              });
                                            }}
                                            className="text-red-500 transition-opacity p-1"
                                          >
                                            <Trash2 size={20} />
                                          </motion.button>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-4 gap-2">
                                        <MiniInput
                                          label="Qtd"
                                          type="number"
                                          value={item.quantidade}
                                          onChange={(v) => {
                                            const nc = [...compartimentos];
                                            nc[cIdx].itens[iIdx].quantidade =
                                              parseInt(v) || 1;
                                            updateChar({ compartimentos: nc });
                                          }}
                                        />
                                        <div className="flex flex-col">
                                          <span className="text-[10px] text-zinc-600 uppercase tracking-tighter font-bold">
                                            Total
                                          </span>
                                          <span className="text-xs font-bold text-zinc-400">
                                            {(
                                              item.peso * item.quantidade
                                            ).toFixed(1)}
                                            kg
                                          </span>
                                        </div>
                                      </div>

                                      <ArmorProperties
                                        item={item}
                                        onChange={(updates) => {
                                          const nc = [...compartimentos];
                                          nc[cIdx].itens[iIdx] = {
                                            ...nc[cIdx].itens[iIdx],
                                            ...updates,
                                          };
                                          updateChar({ compartimentos: nc });
                                        }}
                                      />
                                    </div>
                                  ) : null,
                                )}
                              </SubSection>

                              <SubSection
                                title="Itens"
                                icon={<Package size={14} />}
                                defaultCollapsed={true}
                              >
                                {(comp.itens || []).map((item, iIdx) =>
                                  item.tipo !== "Arma" &&
                                  item.tipo !== "Armadura" &&
                                  item.tipo !== "Catalisador" ? (
                                    <div
                                      key={item.id}
                                      className="bg-zinc-900 p-2 rounded border border-zinc-800 group relative space-y-2"
                                    >
                                      <div className="flex justify-between items-center mb-1">
                                        <input
                                          value={item.nome}
                                          onChange={(e) => {
                                            const nc = [...compartimentos];
                                            nc[cIdx].itens[iIdx].nome =
                                              e.target.value;
                                            updateChar({ compartimentos: nc });
                                          }}
                                          className="bg-transparent text-sm font-bold focus:outline-none flex-1 text-zinc-100"
                                        />
                                        <div className="flex items-center gap-2">
                                          <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() =>
                                              copyToClipboard(
                                                item.tipo === "Arma"
                                                  ? "Arma"
                                                  : item.tipo === "Armadura"
                                                    ? "Armadura"
                                                    : "Item",
                                                item,
                                              )
                                            }
                                            className="text-zinc-500 hover:text-zinc-300 p-1"
                                            title="Copiar Item"
                                          >
                                            <Copy size={20} />
                                          </motion.button>
                                          <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => {
                                              const nc = [...compartimentos];
                                              nc[cIdx].itens = nc[
                                                cIdx
                                              ].itens.filter(
                                                (it) => it.id !== item.id,
                                              );
                                              updateChar({
                                                compartimentos: nc,
                                              });
                                            }}
                                            className="text-red-500 transition-opacity p-1"
                                          >
                                            <Trash2 size={20} />
                                          </motion.button>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-4 gap-2">
                                        <MiniInput
                                          label="Qtd"
                                          type="number"
                                          value={item.quantidade}
                                          onChange={(v) => {
                                            const nc = [...compartimentos];
                                            nc[cIdx].itens[iIdx].quantidade =
                                              parseInt(v) || 1;
                                            updateChar({ compartimentos: nc });
                                          }}
                                        />
                                        <MiniInput
                                          label="Kg"
                                          type="number"
                                          value={item.peso}
                                          onChange={(v) => {
                                            const nc = [...compartimentos];
                                            nc[cIdx].itens[iIdx].peso =
                                              parseFloat(v) || 0;
                                            updateChar({ compartimentos: nc });
                                          }}
                                        />
                                        <MiniInput
                                          label="Vol"
                                          type="number"
                                          value={item.volume}
                                          onChange={(v) => {
                                            const nc = [...compartimentos];
                                            nc[cIdx].itens[iIdx].volume =
                                              parseFloat(v) || 0;
                                            updateChar({ compartimentos: nc });
                                          }}
                                        />
                                        <div className="flex flex-col">
                                          <span className="text-[10px] text-zinc-600 uppercase tracking-tighter font-bold">
                                            Total
                                          </span>
                                          <span className="text-xs font-bold text-zinc-400">
                                            {(
                                              item.peso * item.quantidade
                                            ).toFixed(1)}
                                            kg
                                          </span>
                                        </div>
                                      </div>

                                      <TextArea
                                        label="Descrição"
                                        value={item.descricao || ""}
                                        onChange={(v) => {
                                          const nc = [...compartimentos];
                                          nc[cIdx].itens[iIdx].descricao = v;
                                          updateChar({ compartimentos: nc });
                                        }}
                                      />
                                    </div>
                                  ) : null,
                                )}
                              </SubSection>
                            </div>
                            {clipboard && (
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                  const nc = [...compartimentos];
                                  nc[cIdx].itens.push({
                                    ...clipboard.data,
                                    id: generateId(),
                                  });
                                  updateChar({ compartimentos: nc });
                                  setClipboard(null);
                                }}
                                className="w-full py-2 bg-emerald-500/10 border border-dashed border-emerald-500/50 rounded text-[10px] font-bold uppercase text-emerald-500 hover:bg-emerald-500/20 transition-all"
                              >
                                Colar {clipboard.type}
                              </motion.button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Section>

              <Section
                title="Magias"
                icon={<Zap size={18} />}
                collapsible
                defaultCollapsed
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase">
                      Magias
                    </h4>
                    <div className="flex items-center gap-2">
                      {clipboard?.type === "Magia" && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            updateChar({
                              magias: [
                                ...(activeChar?.magias || []),
                                { ...clipboard.data, id: generateId() },
                              ],
                            });
                            setClipboard(null);
                          }}
                          className="text-emerald-500 hover:text-emerald-400 flex items-center gap-1 text-[10px] font-bold uppercase"
                        >
                          <Plus size={12} /> Colar
                        </motion.button>
                      )}
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() =>
                          updateChar({
                            magias: [
                              ...(activeChar?.magias || []),
                              {
                                id: generateId(),
                                nome: "Nova Magia",
                                escola: "Feitiço",
                                tipo: "Ataque",
                                escala: "0",
                                efeito: "",
                                dano: "0",
                                mana: 0,
                                acerto: 0,
                              },
                            ],
                          })
                        }
                        className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                      >
                        <Plus size={16} />
                      </motion.button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {(activeChar?.magias || []).map((m, idx) => (
                      <div
                        key={m.id}
                        className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs relative group space-y-2"
                      >
                        <div className="flex justify-between items-center">
                          <input
                            value={m.nome}
                            onChange={(e) => {
                              const newMags = [...(activeChar?.magias || [])];
                              newMags[idx].nome = e.target.value;
                              updateChar({ magias: newMags });
                            }}
                            className="bg-transparent font-bold focus:outline-none flex-1 min-w-0 text-amber-500"
                          />
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() =>
                              updateChar({
                                magias: (activeChar?.magias || []).filter(
                                  (mag) => mag.id !== m.id,
                                ),
                              })
                            }
                            className="text-red-500 hover:text-red-400 p-1"
                          >
                            <Trash2 size={20} />
                          </motion.button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter mb-0.5 truncate">
                              Escola
                            </span>
                            <select
                              value={m.escola || "Feitiço"}
                              onChange={(e) => {
                                const na = [...(activeChar?.magias || [])];
                                na[idx].escola = e.target.value;
                                updateChar({ magias: na });
                              }}
                              className="bg-black/40 border border-zinc-700/50 rounded px-2 py-0.5 text-xs text-zinc-300 font-bold focus:outline-none focus:border-amber-500/50"
                            >
                              <option value="Feitiço">Feitiço</option>
                              <option value="elemental">Elemental</option>
                              <option value="magia negra">Magia Negra</option>
                            </select>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter mb-0.5 truncate">
                              Tipo
                            </span>
                            <select
                              value={m.tipo || "Ataque"}
                              onChange={(e) => {
                                const na = [...(activeChar?.magias || [])];
                                na[idx].tipo = e.target.value as any;
                                updateChar({ magias: na });
                              }}
                              className="bg-black/40 border border-zinc-700/50 rounded px-2 py-0.5 text-xs text-zinc-300 font-bold focus:outline-none focus:border-amber-500/50"
                            >
                              <option value="Ataque">Ataque</option>
                              <option value="Efeito">Efeito</option>
                              <option value="Utilidade">Utilidade</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <MiniInput
                            label="Dano"
                            value={m.dano}
                            onChange={(v) => {
                              const na = [...(activeChar?.magias || [])];
                              na[idx].dano = v;
                              updateChar({ magias: na });
                            }}
                            disabled={m.tipo === "Utilidade"}
                          />
                          <MiniInput
                            label="Acerto"
                            value={m.acerto}
                            type="number"
                            onChange={(v) => {
                              const na = [...(activeChar?.magias || [])];
                              na[idx].acerto = parseInt(v) || 0;
                              updateChar({ magias: na });
                            }}
                            disabled={m.tipo === "Utilidade"}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <MiniInput
                            label="Mana"
                            value={m.mana}
                            type="number"
                            onChange={(v) => {
                              const na = [...(activeChar?.magias || [])];
                              na[idx].mana = parseInt(v) || 0;
                              updateChar({ magias: na });
                            }}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter mb-0.5 truncate">
                              Escala
                            </span>
                            <select
                              value={m.escala || "0"}
                              onChange={(e) => {
                                const na = [...(activeChar?.magias || [])];
                                na[idx].escala = e.target.value as any;
                                updateChar({ magias: na });
                              }}
                              className="bg-black/40 border border-zinc-700/50 rounded px-2 py-0.5 text-xs text-zinc-300 font-bold focus:outline-none focus:border-amber-500/50"
                            >
                              <option value="0">0</option>
                              <option value="D">D</option>
                              <option value="C">C</option>
                              <option value="B">B</option>
                              <option value="A">A</option>
                            </select>
                          </div>
                        </div>

                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            const currentMana = activeChar.manaAtual || 0;
                            const cost = m.mana || 0;
                            if (currentMana < cost) {
                              showToast("Mana insuficiente", "error");
                              return;
                            }
                            // Handle rolls based on type
                            if (m.tipo === "Ataque") {
                              // 1. Calculate Hit Bonus (Acurácia)
                              const acuraciaBonus = calculateProficiencyBonus(
                                activeChar.stats,
                                "Acurácia",
                                ["FOR", "DEX"],
                                activeChar.fome,
                                activeChar.sede,
                                activeChar.cansaco,
                                activeChar.clima,
                                climateProficiency,
                                activeChar.bonusProficiencias?.["Acurácia"] ||
                                  0,
                              );
                              const totalHitBonus = acuraciaBonus || 0;

                              // 2. Roll Hit (3d8)
                              const hitRolls: number[] = [];
                              let hitTotal = 0;
                              for (let i = 0; i < 3; i++) {
                                const r = Math.floor(Math.random() * 8) + 1;
                                hitRolls.push(r);
                                hitTotal += r;
                              }
                              const finalHit = hitTotal + totalHitBonus;
                              const hitFormula = `3d8${totalHitBonus !== 0 ? (totalHitBonus > 0 ? "+" : "") + totalHitBonus : ""}`;

                              // 3. Calculate Scaling Damage Bonus
                              const scalingBonus = calculateWeaponDamageBonus(
                                m as any,
                                activeChar.stats.INT,
                              );

                              // 4. Roll Damage
                              const danoStr = (m.dano || "1d6")
                                .toLowerCase()
                                .replace(/\s+/g, "");
                              const match = danoStr.match(
                                /^(\d*)d(\d+)([+-]\d+)?$/,
                              );
                              let dmgTotal = 0;
                              let dmgRolls: number[] = [];
                              let dmgFullFormula = "";

                              if (match) {
                                const qty = parseInt(match[1]) || 1;
                                const sides = parseInt(match[2]);
                                const extra = parseInt(match[3]) || 0;
                                for (let i = 0; i < qty; i++) {
                                  const r =
                                    Math.floor(Math.random() * sides) + 1;
                                  dmgRolls.push(r);
                                  dmgTotal += r;
                                }
                                const finalExtra = scalingBonus + extra;
                                dmgTotal += finalExtra;
                                dmgFullFormula = `${qty}d${sides}${finalExtra !== 0 ? (finalExtra > 0 ? "+" : "") + finalExtra : ""}`;
                              } else {
                                const fixedDano = parseInt(danoStr) || 0;
                                dmgTotal = fixedDano + scalingBonus;
                                dmgFullFormula = `${fixedDano}${scalingBonus !== 0 ? (scalingBonus > 0 ? "+" : "") + scalingBonus : ""}`;
                              }

                              // 4.5. Roll Hit Location (1d6)
                              const locationIdx = Math.floor(Math.random() * 6);
                              const locationName = HIT_LOCATIONS[locationIdx];

                              // 5. Update History & Last Roll
                              const combinedFormula = `${m.nome}: ACERTO ${finalHit} (Dificuldade: ${m.acerto || 0}) | LOCAL: ${locationName} | DANO ${dmgTotal}`;
                              const detailedFormula = `${m.nome}: Acerto ${finalHit} (Rolado: ${hitFormula} | Mín: ${m.acerto || 0}) | Local: ${locationName} | Dano ${dmgTotal} (${dmgFullFormula})`;

                              setDiceHistory((prev) =>
                                [
                                  {
                                    id: generateId(),
                                    result: finalHit,
                                    formula: detailedFormula,
                                    timestamp: Date.now(),
                                  },
                                  ...prev,
                                ].slice(0, 50),
                              );

                              setLastRoll({
                                result: finalHit,
                                formula: combinedFormula,
                                rolls: [...hitRolls],
                                bonus: totalHitBonus,
                                isCombat: true,
                                hitResult: finalHit,
                                dmgResult: dmgTotal,
                                hitRolls: hitRolls,
                                dmgRolls: dmgRolls,
                                hitBonus: totalHitBonus,
                                dmgBonus: scalingBonus,
                                armaNome: m.nome,
                                hitFormula: hitFormula,
                                dmgFormula: dmgFullFormula,
                                hitLocation: locationName,
                              });
                            } else if (m.tipo === "Efeito") {
                              const acuraciaBonus = calculateProficiencyBonus(
                                activeChar.stats,
                                "Acurácia",
                                ["FOR", "DEX"],
                                activeChar.fome,
                                activeChar.sede,
                                activeChar.cansaco,
                                activeChar.clima,
                                climateProficiency,
                                activeChar.bonusProficiencias?.["Acurácia"] ||
                                  0,
                              );
                              const totalHitBonus = acuraciaBonus || 0;

                              const hitRolls: number[] = [];
                              let hitTotal = 0;
                              for (let i = 0; i < 3; i++) {
                                const r = Math.floor(Math.random() * 8) + 1;
                                hitRolls.push(r);
                                hitTotal += r;
                              }
                              const finalHit = hitTotal + totalHitBonus;
                              const hitFormula = `3d8${totalHitBonus !== 0 ? (totalHitBonus > 0 ? "+" : "") + totalHitBonus : ""}`;

                              // 4.5. Roll Hit Location (1d6)
                              const locationIdx = Math.floor(Math.random() * 6);
                              const locationName = HIT_LOCATIONS[locationIdx];

                              setDiceHistory((prev) =>
                                [
                                  {
                                    id: generateId(),
                                    result: finalHit,
                                    formula: `${m.nome}: Acerto ${finalHit} (Rolado: ${hitFormula} | Mín: ${m.acerto || 0}) | Local: ${locationName}`,
                                    timestamp: Date.now(),
                                  },
                                  ...prev,
                                ].slice(0, 50),
                              );

                              setLastRoll({
                                result: finalHit,
                                formula: `${m.nome}: ACERTO ${finalHit} (Dificuldade: ${m.acerto || 0}) | LOCAL: ${locationName}`,
                                rolls: [...hitRolls],
                                bonus: totalHitBonus,
                                isCombat: true,
                                hitResult: finalHit,
                                hitRolls: hitRolls,
                                hitBonus: totalHitBonus,
                                armaNome: m.nome,
                                hitFormula: hitFormula,
                                hitLocation: locationName,
                              });
                            }

                            updateChar({
                              manaAtual: Math.max(0, currentMana - cost),
                            });
                          }}
                          className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded font-bold uppercase text-[10px] transition-all flex items-center justify-center gap-2"
                        >
                          <Zap size={12} /> Usar Magia
                        </motion.button>

                        <TextArea
                          label="Efeito"
                          value={m.efeito}
                          onChange={(v) => {
                            const na = [...(activeChar?.magias || [])];
                            na[idx].efeito = v;
                            updateChar({ magias: na });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </Section>

              <Section
                title="Habilidades"
                icon={<Activity size={18} />}
                collapsible
                defaultCollapsed
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase">
                      Habilidades
                    </h4>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() =>
                        updateChar({
                          habilidades: [
                            ...(activeChar?.habilidades || []),
                            {
                              id: generateId(),
                              nome: "Nova Habilidade",
                              efeito: "",
                            },
                          ],
                        })
                      }
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                    >
                      <Plus size={16} />
                    </motion.button>
                  </div>
                  <div className="space-y-3">
                    {(activeChar?.habilidades || []).map((h, idx) => (
                      <div
                        key={h.id}
                        className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs relative group space-y-2"
                      >
                        <div className="flex justify-between items-center">
                          <input
                            value={h.nome}
                            onChange={(e) => {
                              const newHabs = [
                                ...(activeChar?.habilidades || []),
                              ];
                              newHabs[idx].nome = e.target.value;
                              updateChar({ habilidades: newHabs });
                            }}
                            className="bg-transparent font-bold focus:outline-none flex-1 min-w-0 text-amber-500"
                          />
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() =>
                              updateChar({
                                habilidades: (
                                  activeChar?.habilidades || []
                                ).filter((hab) => hab.id !== h.id),
                              })
                            }
                            className="text-red-500 hover:text-red-400 p-1"
                          >
                            <Trash2 size={20} />
                          </motion.button>
                        </div>

                        <TextArea
                          label="Efeito"
                          value={h.efeito}
                          onChange={(v) => {
                            const na = [...(activeChar?.habilidades || [])];
                            na[idx].efeito = v;
                            updateChar({ habilidades: na });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </Section>
              <Section
                title="Conhecimentos"
                icon={<BookOpen size={18} />}
                collapsible
                defaultCollapsed
              >
                <div className="space-y-3">
                  {(activeChar?.conhecimentos || []).map((k, idx) => {
                    const isMaxLevel = k.nivel >= 5;
                    return (
                      <div
                        key={k.name}
                        className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50 space-y-2"
                      >
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-sm font-bold uppercase tracking-widest text-zinc-300 truncate safe-lock">
                            {k.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-500 font-bold">
                              NÍVEL
                            </span>
                            <NumericInput
                              value={k.nivel}
                              onChange={(v) => {
                                const newKs = [
                                  ...(activeChar?.conhecimentos || []),
                                ];
                                newKs[idx].nivel = Math.min(5, v);
                                updateChar({ conhecimentos: newKs });
                              }}
                              className="w-20"
                              size="sm"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/50">
                            <div
                              className={cn(
                                "h-full transition-all shadow-[0_0_10px_rgba(245,158,11,0.3)]",
                                isMaxLevel
                                  ? "bg-emerald-500 shadow-emerald-500/30"
                                  : "bg-amber-500",
                              )}
                              style={{
                                width: `${isMaxLevel ? 100 : (k.xp / getXpToNextLevel(k.nivel)) * 100}%`,
                              }}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            {!isMaxLevel && (
                              <>
                                <motion.button
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => {
                                    const newKs = [
                                      ...(activeChar?.conhecimentos || []),
                                    ];
                                    newKs[idx].xp = Math.max(0, k.xp - 1);
                                    updateChar({ conhecimentos: newKs });
                                  }}
                                  className="w-6 h-6 flex items-center justify-center bg-zinc-800 rounded text-zinc-400 hover:text-white"
                                >
                                  <Minus size={12} />
                                </motion.button>
                                <NumericInput
                                  value={k.xp}
                                  onChange={(v) => {
                                    const nextXp = getXpToNextLevel(k.nivel);
                                    let updatedK = { ...k, xp: v };
                                    if (v >= nextXp) {
                                      updatedK.nivel = Math.min(
                                        5,
                                        updatedK.nivel + 1,
                                      );
                                      updatedK.xp = 0;
                                    }
                                    const newKs = [
                                      ...(activeChar?.conhecimentos || []),
                                    ];
                                    newKs[idx] = updatedK;
                                    updateChar({ conhecimentos: newKs });
                                  }}
                                  className="w-16"
                                  size="sm"
                                />
                                <motion.button
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => {
                                    const nextXp = getXpToNextLevel(k.nivel);
                                    let updatedK = { ...k, xp: k.xp + 1 };
                                    if (updatedK.xp >= nextXp) {
                                      updatedK.nivel = Math.min(
                                        5,
                                        updatedK.nivel + 1,
                                      );
                                      updatedK.xp = 0;
                                    }
                                    const newKs = [
                                      ...(activeChar?.conhecimentos || []),
                                    ];
                                    newKs[idx] = updatedK;
                                    updateChar({ conhecimentos: newKs });
                                  }}
                                  className="w-6 h-6 flex items-center justify-center bg-zinc-800 rounded text-zinc-400 hover:text-white"
                                >
                                  <Plus size={12} />
                                </motion.button>
                                <span className="text-sm text-zinc-500 font-bold">
                                  / {getXpToNextLevel(k.nivel)}
                                </span>
                              </>
                            )}
                            {isMaxLevel && (
                              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                Máximo
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>

              <Section
                title="Escalas"
                icon={<TrendingUp size={18} />}
                collapsible
                defaultCollapsed
              >
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        const newEscalas = [
                          ...(activeChar.escalas || []),
                          {
                            id: generateId(),
                            nome: "Nova Escala",
                            nivel: 0,
                            xp: 0,
                            bonus: "Força",
                          },
                        ];
                        updateChar({ escalas: newEscalas });
                      }}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded-lg font-bold text-xs uppercase"
                    >
                      <Plus size={14} /> Adicionar Escala
                    </motion.button>
                  </div>

                  <div className="space-y-3">
                    {(activeChar.escalas || []).map((s, idx) => {
                      const levelLetter =
                        s.nivel === 0
                          ? "0"
                          : s.nivel === 1
                            ? "D"
                            : s.nivel === 2
                              ? "C"
                              : s.nivel === 3
                                ? "B"
                                : "A";
                      const isMaxLevel = s.nivel >= 4;
                      const isSelectorOpen = openLevelSelectorId === s.id;
                      return (
                        <div
                          key={s.id}
                          className={cn(
                            "bg-zinc-900/50 p-4 rounded-lg border transition-all space-y-4",
                            isSelectorOpen
                              ? "z-[100] relative scale-[1.02] shadow-2xl border-amber-500 ring-1 ring-amber-500/20 bg-zinc-900"
                              : "border-zinc-800/50",
                          )}
                        >
                          {/* Top Row: Name and Delete */}
                          <div className="flex justify-between items-center gap-2">
                            <input
                              value={s.nome}
                              onChange={(e) => {
                                const newEscalas = [
                                  ...(activeChar.escalas || []),
                                ];
                                newEscalas[idx].nome = e.target.value;
                                updateChar({ escalas: newEscalas });
                              }}
                              className="bg-transparent font-bold uppercase tracking-widest text-zinc-300 focus:outline-none flex-1 min-w-0 border-b border-transparent focus:border-amber-500/30 text-sm"
                            />
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                const newEscalas = (
                                  activeChar.escalas || []
                                ).filter((item) => item.id !== s.id);
                                updateChar({ escalas: newEscalas });
                              }}
                              className="text-red-500 hover:text-red-400 transition-colors p-1"
                            >
                              <Trash2 size={20} />
                            </motion.button>
                          </div>

                          {/* Middle Row: Bonus and Level Selection */}
                          <div className="flex flex-wrap items-center gap-6">
                            <div className="flex flex-col gap-1 min-w-[120px]">
                              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                Atributo Bônus
                              </span>
                              <select
                                value={s.bonus || "Força"}
                                onChange={(e) => {
                                  const newEscalas = [
                                    ...(activeChar.escalas || []),
                                  ];
                                  newEscalas[idx].bonus = e.target.value;
                                  updateChar({ escalas: newEscalas });
                                }}
                                className="bg-black/60 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-amber-500 font-bold focus:outline-none focus:border-amber-500/50 ring-offset-black"
                              >
                                <option value="Força">Força</option>
                                <option value="Destreza">Destreza</option>
                                <option value="Inteligência">
                                  Inteligência
                                </option>
                                <option value="Ritual">Ritual</option>
                              </select>
                            </div>

                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                Nível de Escala
                              </span>
                              <div className="relative">
                                <motion.button
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() =>
                                    setOpenLevelSelectorId(
                                      isSelectorOpen ? null : s.id,
                                    )
                                  }
                                  className={cn(
                                    "w-10 h-10 flex items-center justify-center bg-zinc-950 border rounded-lg font-black text-xl transition-all",
                                    isSelectorOpen
                                      ? "border-amber-500 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.4)]"
                                      : "border-zinc-700/50 text-amber-500/80 hover:border-amber-500/50",
                                  )}
                                >
                                  {levelLetter}
                                </motion.button>

                                <AnimatePresence>
                                  {openLevelSelectorId === s.id && (
                                    <>
                                      <div
                                        className="fixed inset-0 z-[100] cursor-default bg-transparent"
                                        onClick={() =>
                                          setOpenLevelSelectorId(null)
                                        }
                                      />
                                      <motion.div
                                        initial={{
                                          opacity: 0,
                                          scale: 0.9,
                                          y: 10,
                                        }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                        className="absolute bottom-full left-0 mb-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] p-1 z-[110] flex flex-col gap-1 min-w-[60px]"
                                      >
                                        {["0", "D", "C", "B", "A"].map(
                                          (letter, lIdx) => (
                                            <button
                                              key={letter}
                                              onClick={() => {
                                                const newEscalas = [
                                                  ...(activeChar.escalas || []),
                                                ];
                                                newEscalas[idx].nivel = lIdx;
                                                updateChar({
                                                  escalas: newEscalas,
                                                });
                                                setOpenLevelSelectorId(null);
                                              }}
                                              className={cn(
                                                "w-full py-2 px-3 rounded-lg font-black text-lg transition-colors text-center",
                                                s.nivel === lIdx
                                                  ? "bg-amber-500 text-zinc-950"
                                                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white",
                                              )}
                                            >
                                              {letter}
                                            </button>
                                          ),
                                        )}
                                      </motion.div>
                                    </>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          </div>

                          {/* Bottom Row: XP Progress */}

                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/50">
                              <div
                                className={cn(
                                  "h-full transition-all shadow-[0_0_10px_rgba(245,158,11,0.3)]",
                                  isMaxLevel
                                    ? "bg-emerald-500 shadow-emerald-500/30"
                                    : "bg-amber-500",
                                )}
                                style={{
                                  width: `${isMaxLevel ? 100 : (s.xp / getXpToNextLevel(s.nivel)) * 100}%`,
                                }}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              {!isMaxLevel && (
                                <>
                                  <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                      const newEscalas = [
                                        ...(activeChar.escalas || []),
                                      ];
                                      newEscalas[idx].xp = Math.max(
                                        0,
                                        s.xp - 1,
                                      );
                                      updateChar({ escalas: newEscalas });
                                    }}
                                    className="w-6 h-6 flex items-center justify-center bg-zinc-800 rounded text-zinc-400 hover:text-white"
                                  >
                                    <Minus size={12} />
                                  </motion.button>
                                  <NumericInput
                                    value={s.xp}
                                    onChange={(v) => {
                                      const nextXp = getXpToNextLevel(s.nivel);
                                      let updatedS = { ...s, xp: v };
                                      if (v >= nextXp) {
                                        updatedS.nivel = Math.min(
                                          4,
                                          updatedS.nivel + 1,
                                        );
                                        updatedS.xp =
                                          updatedS.nivel === 4 ? 0 : 0;
                                      }
                                      const newEscalas = [
                                        ...(activeChar.escalas || []),
                                      ];
                                      newEscalas[idx] = updatedS;
                                      updateChar({ escalas: newEscalas });
                                    }}
                                    className="w-16"
                                    size="sm"
                                  />
                                  <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                      const nextXp = getXpToNextLevel(s.nivel);
                                      let updatedS = { ...s, xp: s.xp + 1 };
                                      if (updatedS.xp >= nextXp) {
                                        updatedS.nivel = Math.min(
                                          4,
                                          updatedS.nivel + 1,
                                        );
                                        updatedS.xp = 0;
                                      }
                                      const newEscalas = [
                                        ...(activeChar.escalas || []),
                                      ];
                                      newEscalas[idx] = updatedS;
                                      updateChar({ escalas: newEscalas });
                                    }}
                                    className="w-6 h-6 flex items-center justify-center bg-zinc-800 rounded text-zinc-400 hover:text-white"
                                  >
                                    <Plus size={12} />
                                  </motion.button>
                                  <span className="text-xs text-zinc-500 font-bold">
                                    / {getXpToNextLevel(s.nivel)}
                                  </span>
                                </>
                              )}
                              {isMaxLevel && (
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                  Máximo
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Section>
            </div>
          </div>
        ) : activePage === "dice" ? (
          <div className="flex flex-col h-full max-w-4xl mx-auto bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl">
            {/* Tabs Header */}
            <div className="flex border-b border-zinc-800 bg-zinc-900/50">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setDiceTab("mesa")}
                className={cn(
                  "flex-1 py-4 text-sm font-bold uppercase tracking-widest transition-all relative",
                  diceTab === "mesa"
                    ? "text-amber-500"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                Mesa
                {diceTab === "mesa" && (
                  <motion.div
                    layoutId="diceTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500"
                  />
                )}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setDiceTab("historico")}
                className={cn(
                  "flex-1 py-4 text-sm font-bold uppercase tracking-widest transition-all relative",
                  diceTab === "historico"
                    ? "text-amber-500"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                Histórico
                {diceTab === "historico" && (
                  <motion.div
                    layoutId="diceTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500"
                  />
                )}
              </motion.button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
              {diceTab === "mesa" ? (
                <div className="space-y-8 pb-24">
                  {/* Armas do Personagem */}
                  <SubSection
                    title="Combate (Acerto & Dano)"
                    icon={<Sword size={14} />}
                    defaultCollapsed={true}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                      {(activeChar.armas || []).map((arma, aIdx) => {
                        const statMap: Record<string, keyof Stats> = {
                          Força: "FOR",
                          Destreza: "DEX",
                          Inteligência: "INT",
                          Ritual: "RIT",
                        };
                        const statKey = statMap[arma.atributoBase || "Força"];
                        const statValue = activeChar.stats[statKey] || 0;
                        const scalingBonus = calculateWeaponDamageBonus(
                          arma as any,
                          statValue,
                        );

                        return (
                          <motion.button
                            key={`${arma.id}-${aIdx}`}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => rollCombat(arma, diceBonus)}
                            className="flex flex-col gap-3 p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl hover:border-amber-500/30 transition-all text-left relative group overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity">
                              <Sword size={24} className="text-amber-500" />
                            </div>

                            <div className="flex flex-col">
                              <span className="text-xs font-black text-amber-500 uppercase tracking-tighter truncate pr-8">
                                {arma.nome}
                              </span>
                              <span className="text-[9px] text-zinc-500 font-bold uppercase">
                                Escala {arma.escala || "0"} •{" "}
                                {arma.atributoBase}
                              </span>
                            </div>

                            <div className="pt-2 border-t border-zinc-800/50">
                              <span className="text-[10px] font-black text-amber-500/80 uppercase tracking-widest flex items-center gap-1">
                                Rolar Combate <Plus size={10} />
                              </span>
                            </div>
                          </motion.button>
                        );
                      })}
                      {!activeChar.armas?.length && (
                        <div className="col-span-full py-4 text-center text-zinc-600 text-[10px] font-bold uppercase italic border border-dashed border-zinc-800 rounded-xl">
                          Nenhuma arma equipada na aba de equipamentos
                        </div>
                      )}
                    </div>
                  </SubSection>

                  {/* Dice Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                    {[
                      { sides: 4, img: "d4.png" },
                      { sides: 6, img: "d6.png" },
                      { sides: 8, img: "d8.png" },
                      { sides: 10, img: "d10.png" },
                      { sides: 12, img: "d12.png" },
                      { sides: 20, img: "d20.png" },
                      { sides: 100, img: "d100.png" },
                    ].map((dice) => (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        key={`d${dice.sides}`}
                        onClick={() =>
                          rollDice(dice.sides, diceQuantity, diceBonus)
                        }
                        className="flex flex-col items-center group"
                      >
                        <div className="w-20 h-20 mb-3 flex items-center justify-center relative bg-zinc-900/50 border border-zinc-800 rounded-2xl group-hover:border-amber-500/50 transition-all shadow-lg group-active:scale-95">
                          <DiceImage
                            sides={dice.sides}
                            fileName={dice.img}
                            className="w-12 h-12 object-contain group-hover:scale-110 transition-transform"
                          />
                        </div>
                        <span className="text-xs font-black text-zinc-400 uppercase tracking-tighter">
                          d{dice.sides}
                        </span>
                      </motion.button>
                    ))}

                    {/* Special 3d8 Preset */}
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        const acuraciaBonus = calculateProficiencyBonus(
                          activeChar.stats,
                          "Acurácia",
                          ["FOR", "DEX"],
                          activeChar.fome,
                          activeChar.sede,
                          activeChar.cansaco,
                          activeChar.clima,
                          climateProficiency,
                          activeChar.bonusProficiencias?.["Acurácia"] || 0,
                        );
                        rollDice(8, 3, diceBonus + acuraciaBonus, "3d8");
                      }}
                      className="flex flex-col items-center group"
                    >
                      <div className="w-20 h-20 mb-3 flex items-center justify-center relative bg-zinc-900/50 border border-zinc-800 rounded-2xl group-hover:border-amber-500/50 transition-all shadow-lg group-active:scale-95">
                        <DiceImage
                          sides={8}
                          fileName="3d8.png"
                          className="w-12 h-12 object-contain group-hover:scale-110 transition-transform"
                        />
                        <div className="absolute -top-1 -right-1 bg-amber-500 text-zinc-950 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
                          3d8
                        </div>
                      </div>
                      <span className="text-xs font-black text-zinc-400 uppercase tracking-tighter">
                        3d8
                      </span>
                    </motion.button>

                    {/* Fome e Sede Roll */}
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => rollDice(0, 0, 0, "Fome e Sede")}
                      className="flex flex-col items-center group"
                    >
                      <div className="w-20 h-20 mb-3 flex items-center justify-center relative bg-zinc-900/50 border border-zinc-800 rounded-2xl group-hover:border-amber-500/50 transition-all shadow-lg group-active:scale-95">
                        <div className="flex gap-1">
                          <Utensils size={20} className="text-amber-500" />
                          <Droplets size={20} className="text-blue-500" />
                        </div>
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
                          SURV
                        </div>
                      </div>
                      <span className="text-xs font-black text-zinc-400 uppercase tracking-tighter">
                        Fome & Sede
                      </span>
                    </motion.button>

                    {/* Cansaço Roll */}
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => rollDice(0, 0, 0, "Cansaço")}
                      className="flex flex-col items-center group"
                    >
                      <div className="w-20 h-20 mb-3 flex items-center justify-center relative bg-zinc-900/50 border border-zinc-800 rounded-2xl group-hover:border-amber-500/50 transition-all shadow-lg group-active:scale-95">
                        <Battery size={24} className="text-yellow-500" />
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
                          SURV
                        </div>
                      </div>
                      <span className="text-xs font-black text-zinc-400 uppercase tracking-tighter">
                        Cansaço
                      </span>
                    </motion.button>
                  </div>

                  {/* Controls Bar - Moved below dice grid */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center justify-center gap-8">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                        Quantidade
                      </span>
                      <div className="flex items-center gap-3">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() =>
                            setDiceQuantity(Math.max(1, diceQuantity - 1))
                          }
                          className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400 hover:text-white active:scale-90 transition-all"
                        >
                          <Minus size={16} />
                        </motion.button>
                        <span className="text-xl font-black text-amber-500 min-w-[2ch] text-center">
                          {diceQuantity}
                        </span>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() =>
                            setDiceQuantity(Math.min(99, diceQuantity + 1))
                          }
                          className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400 hover:text-white active:scale-90 transition-all"
                        >
                          <Plus size={16} />
                        </motion.button>
                      </div>
                    </div>

                    <div className="w-px h-8 bg-zinc-800" />

                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                        Bônus
                      </span>
                      <div className="flex items-center gap-3">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setDiceBonus(diceBonus - 1)}
                          className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400 hover:text-white active:scale-90 transition-all"
                        >
                          <Minus size={16} />
                        </motion.button>
                        <span className="text-xl font-black text-amber-500 min-w-[3ch] text-center">
                          {diceBonus > 0 ? "+" : ""}
                          {diceBonus}
                        </span>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setDiceBonus(diceBonus + 1)}
                          className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded-full text-zinc-400 hover:text-white active:scale-90 transition-all"
                        >
                          <Plus size={16} />
                        </motion.button>
                      </div>
                    </div>
                  </div>

                  {/* Custom Dice Section */}
                  {activeChar.dadosCustomizados &&
                    activeChar.dadosCustomizados.length > 0 && (
                      <SubSection
                        title="Dados Personalizados"
                        icon={<Dices size={14} />}
                        defaultCollapsed={false}
                      >
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
                          {activeChar.dadosCustomizados.map((dice) => (
                            <div key={dice.id} className="relative group">
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() =>
                                  rollDice(
                                    dice.lados,
                                    diceQuantity,
                                    diceBonus,
                                    dice.nome,
                                  )
                                }
                                className="w-full flex flex-col items-center justify-center p-4 bg-zinc-900/30 border border-zinc-800 rounded-xl hover:border-amber-500/30 transition-all"
                              >
                                <Dices
                                  size={24}
                                  className="text-amber-500/50 mb-2"
                                />
                                <span className="text-[10px] font-bold text-zinc-400 uppercase truncate w-full text-center">
                                  {dice.nome}
                                </span>
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() =>
                                  updateChar({
                                    dadosCustomizados:
                                      activeChar.dadosCustomizados.filter(
                                        (d) => d.id !== dice.id,
                                      ),
                                  })
                                }
                                className="absolute -top-1 -right-1 p-1 bg-zinc-950 border border-zinc-800 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 size={10} />
                              </motion.button>
                            </div>
                          ))}
                        </div>
                      </SubSection>
                    )}

                  {/* Create Custom Dice */}
                  <SubSection
                    title="Novo Dado"
                    icon={<Plus size={14} />}
                    defaultCollapsed={true}
                  >
                    <div className="bg-zinc-900/20 border border-zinc-800/50 rounded-xl p-4 mt-2">
                      <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[120px]">
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                            Lados
                          </label>
                          <input
                            type="number"
                            id="new-dice-sides-v2"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 transition-all text-amber-500 font-bold text-center"
                            defaultValue={20}
                          />
                        </div>
                        <div className="flex-1 min-w-[120px]">
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                            Nome (Opcional)
                          </label>
                          <input
                            type="text"
                            id="new-dice-name-v2"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 transition-all text-zinc-300"
                            placeholder="Ex: Dado de Sorte"
                          />
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            const sidesInput = document.getElementById(
                              "new-dice-sides-v2",
                            ) as HTMLInputElement;
                            const nameInput = document.getElementById(
                              "new-dice-name-v2",
                            ) as HTMLInputElement;
                            const sides = parseInt(sidesInput?.value) || 20;
                            const name = nameInput?.value || `d${sides}`;
                            updateChar({
                              dadosCustomizados: [
                                ...(activeChar.dadosCustomizados || []),
                                { id: generateId(), lados: sides, nome: name },
                              ],
                            });
                            if (nameInput) nameInput.value = "";
                          }}
                          className="h-10 px-4 bg-zinc-800 hover:bg-amber-500 text-zinc-400 hover:text-zinc-950 rounded-md transition-all flex items-center gap-2 font-bold text-xs uppercase"
                        >
                          <Plus size={16} /> Adicionar
                        </motion.button>
                      </div>
                    </div>
                  </SubSection>
                </div>
              ) : (
                <div className="space-y-4">
                  {diceHistory.length > 0 && (
                    <div className="flex justify-end">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setDiceHistory([])}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-[10px] font-bold uppercase transition-all"
                      >
                        <Trash2 size={14} /> Limpar Histórico
                      </motion.button>
                    </div>
                  )}
                  <div className="space-y-3">
                    {diceHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                        <History size={48} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium">
                          Nenhuma rolagem recente
                        </p>
                      </div>
                    ) : (
                      diceHistory.map((roll, idx) => (
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={roll.id}
                          className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-amber-500">
                              {roll.result}
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-zinc-300 uppercase">
                                {roll.formula}
                              </div>
                              <div className="text-[9px] text-zinc-600">
                                {new Date(roll.timestamp).toLocaleTimeString(
                                  [],
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Controls Bar - REMOVED (Moved to top) */}
          </div>
        ) : activePage === "notes" ? (
          <div className="space-y-6 max-w-4xl mx-auto">
            <GoogleDriveSync appState={state} onStateUpdate={setState} />
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-amber-500 flex items-center gap-2">
                <FileText size={24} /> Anotações
              </h2>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() =>
                  updateChar({
                    anotacoes: [
                      ...(activeChar.anotacoes || []),
                      {
                        id: generateId(),
                        titulo: "Nova Anotação",
                        conteudo: "",
                      },
                    ],
                  })
                }
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 rounded-lg font-bold transition-all shadow-lg shadow-amber-500/20"
              >
                <Plus size={18} /> Adicionar Aba
              </motion.button>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {(activeChar.anotacoes || []).map((note, idx) => (
                <div key={note.id}>
                  <Section
                    title={note.titulo || "Sem Título"}
                    icon={<FileText size={18} />}
                    collapsible
                  >
                    <div className="space-y-4">
                      <div className="flex justify-between items-center gap-4">
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                            Título da Aba
                          </label>
                          <input
                            value={note.titulo}
                            onChange={(e) => {
                              const newNotes = [...activeChar.anotacoes];
                              newNotes[idx].titulo = e.target.value;
                              updateChar({ anotacoes: newNotes });
                            }}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 transition-all text-amber-500 font-bold"
                            placeholder="Digite o título..."
                          />
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            const newNotes = activeChar.anotacoes.filter(
                              (n) => n.id !== note.id,
                            );
                            updateChar({ anotacoes: newNotes });
                          }}
                          className="mt-5 p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                          title="Excluir Aba"
                        >
                          <Trash2 size={20} />
                        </motion.button>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                          Conteúdo
                        </label>
                        <textarea
                          value={note.conteudo}
                          onChange={(e) => {
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
                  <p className="text-zinc-500">
                    Nenhuma aba de anotação criada.
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() =>
                      updateChar({
                        anotacoes: [
                          {
                            id: generateId(),
                            titulo: "Anotações Gerais",
                            conteudo: "",
                          },
                        ],
                      })
                    }
                    className="mt-4 text-amber-500 hover:text-amber-400 font-bold uppercase text-xs tracking-widest"
                  >
                    Criar Primeira Aba
                  </motion.button>
                </div>
              )}
            </div>
          </div>
        ) : activePage === "gallery" ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-amber-500 uppercase tracking-tighter">
                  Galeria de Imagens
                </h2>
                <label className="flex items-center gap-2 bg-amber-500 text-zinc-950 px-4 py-2 rounded-lg font-bold cursor-pointer hover:bg-amber-400 transition-colors">
                  <Plus size={20} />
                  <span>Adicionar Imagem</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const newImg = {
                            id: generateId(),
                            url: reader.result as string,
                            titulo: "Nova Imagem",
                          };
                          updateChar({
                            imagens: [...(activeChar.imagens || []), newImg],
                          });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(activeChar.imagens || []).map((img) => (
                  <div
                    key={img.id}
                    className="relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden aspect-square shadow-lg"
                  >
                    <img
                      src={img.url}
                      alt="Galeria"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        const newImgs = activeChar.imagens.filter(
                          (i) => i.id !== img.id,
                        );
                        updateChar({ imagens: newImgs });
                      }}
                      className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full shadow-lg transition-colors z-10"
                      title="Remover Imagem"
                    >
                      <Trash2 size={20} />
                    </motion.button>
                  </div>
                ))}
              </div>

              {(activeChar.imagens || []).length === 0 && (
                <div className="text-center py-20 bg-zinc-900/20 border border-dashed border-zinc-800 rounded-2xl">
                  <Image size={48} className="mx-auto text-zinc-800 mb-4" />
                  <p className="text-zinc-500">Nenhuma imagem na galeria.</p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </main>

      {lastRoll && (
        <div
          onClick={() => setLastRoll(null)}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] cursor-pointer p-4 backdrop-blur-sm"
        >
          <div
            className={cn(
              "bg-zinc-900 border-2 border-amber-500 rounded-3xl flex flex-col items-center pointer-events-auto shadow-2xl overflow-hidden",
              lastRoll.isCombat
                ? "max-w-md w-full"
                : "max-w-[280px] w-full p-8 gap-4",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {lastRoll.isCombat ? (
              <div className="w-full">
                {/* Combat Banner */}
                <div className="bg-amber-500 p-2 flex items-center justify-center gap-2">
                  <Sword size={16} className="text-zinc-950" />
                  <span className="text-xs font-black text-zinc-950 uppercase tracking-widest">
                    {lastRoll.armaNome}
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  {/* Results Row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col items-center bg-zinc-950/50 p-3 rounded-xl border border-zinc-800">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">
                        Acerto
                      </span>
                      <span className="text-3xl font-black text-amber-500">
                        {lastRoll.hitResult}
                      </span>
                      <span className="text-[8px] font-bold text-zinc-600 uppercase">
                        {lastRoll.hitFormula}
                      </span>
                    </div>
                    <div className="flex flex-col items-center bg-zinc-950/50 p-3 rounded-xl border border-zinc-800">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">
                        Dano
                      </span>
                      <span className="text-3xl font-black text-amber-500">
                        {lastRoll.dmgResult}
                      </span>
                      <span className="text-[8px] font-bold text-zinc-600 uppercase">
                        {lastRoll.dmgFormula}
                      </span>
                    </div>
                  </div>

                  {/* Hit Location Row */}
                  {lastRoll.hitLocation && (
                    <div className="bg-zinc-950/50 p-2.5 rounded-xl border border-amber-500/10 flex items-center justify-between px-4">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                          Localização do Acerto
                        </span>
                        <span className="text-sm font-black text-zinc-100 uppercase tracking-tight">
                          {lastRoll.hitLocation}
                        </span>
                      </div>
                      <div className="w-8 h-8 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/20">
                        <Target size={16} className="text-amber-500" />
                      </div>
                    </div>
                  )}

                  {/* Dice Results - Compact Side-by-Side */}
                  <div className="grid grid-cols-2 gap-6 bg-zinc-950/30 p-3 rounded-xl border border-zinc-800/50">
                    <div className="space-y-2">
                      <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block text-center">
                        Dados de Acerto
                      </span>
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {lastRoll.hitRolls?.map((roll, idx) => (
                          <div
                            key={idx}
                            className="w-7 h-7 bg-zinc-800 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-100 font-black text-[10px] shadow-inner"
                          >
                            {roll}
                          </div>
                        ))}
                        <div className="w-7 h-7 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-center text-amber-500 font-black text-[10px]">
                          {lastRoll.hitBonus! >= 0 ? "+" : ""}
                          {lastRoll.hitBonus}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 relative">
                      <div className="absolute left-[-12px] top-0 bottom-0 w-px bg-zinc-800" />
                      <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block text-center">
                        Dados de Dano
                      </span>
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {lastRoll.dmgRolls?.length === 0 ? (
                          <span className="text-[8px] font-bold text-zinc-600 uppercase italic mt-2">
                            Fixo
                          </span>
                        ) : (
                          lastRoll.dmgRolls?.map((roll, idx) => (
                            <div
                              key={idx}
                              className="w-7 h-7 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center text-zinc-300 font-bold text-[10px] shadow-inner"
                            >
                              {roll}
                            </div>
                          ))
                        )}
                        <div className="w-7 h-7 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-center text-amber-500 font-black text-[10px]">
                          {lastRoll.dmgBonus! >= 0 ? "+" : ""}
                          {lastRoll.dmgBonus}
                        </div>
                      </div>
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setLastRoll(null)}
                    className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-black text-[10px] uppercase tracking-widest rounded-lg transition-all border border-zinc-700/50"
                  >
                    Fechar Resultado
                  </motion.button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                    {lastRoll.formula}
                  </span>
                  <span className="text-6xl font-black text-amber-500">
                    {lastRoll.result}
                  </span>
                </div>

                {lastRoll.rolls.length > 1 && (
                  <div className="w-full space-y-2">
                    <div className="h-px bg-zinc-800 w-full" />
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {lastRoll.rolls.map((roll, idx) => (
                        <div
                          key={idx}
                          className="w-8 h-8 bg-zinc-800 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-300 font-bold text-xs"
                        >
                          {roll}
                        </div>
                      ))}
                      {lastRoll.bonus !== 0 && (
                        <div className="w-8 h-8 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-center text-amber-500 font-bold text-xs">
                          {lastRoll.bonus > 0
                            ? `+${lastRoll.bonus}`
                            : lastRoll.bonus}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-zinc-700/50 backdrop-blur-md bg-zinc-900/90 text-white"
          >
            {toast.type === "error" && (
              <Zap size={18} className="text-red-500" />
            )}
            {toast.type === "success" && (
              <RotateCw size={18} className="text-emerald-500 animate-spin" />
            )}
            {toast.type === "info" && (
              <Zap size={18} className="text-blue-500" />
            )}
            <span className="font-bold text-sm tracking-tight">
              {toast.message}
            </span>
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

function SubSection({
  title,
  icon,
  children,
  defaultCollapsed = true,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const hasChildren = React.Children.toArray(children).some(
    (child) => child !== null,
  );

  if (!hasChildren) return null;

  return (
    <div className="border border-zinc-800 rounded-lg bg-zinc-900/20">
      <div
        className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-zinc-800/30 transition-colors bg-zinc-800/20"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-amber-500 shrink-0">{icon}</span>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate safe-lock">
            {title}
          </h4>
        </div>
        {isCollapsed ? (
          <ChevronDown size={14} className="text-zinc-500" />
        ) : (
          <ChevronUp size={14} className="text-zinc-500" />
        )}
      </div>
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="!overflow-visible"
          >
            <div className="p-2 space-y-2 border-t border-zinc-800 !overflow-visible">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
  collapsible = false,
  defaultCollapsed = false,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  return (
    <div className="bg-zinc-900/30 border-y sm:border border-zinc-800 sm:rounded-xl -mx-4 sm:mx-0">
      <div
        className={cn(
          "px-4 py-3 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50",
          collapsible && "cursor-pointer hover:bg-zinc-800/50",
        )}
        onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-amber-500 shrink-0">{icon}</span>
          <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-300 truncate safe-lock">
            {title}
          </h3>
        </div>
        {collapsible &&
          (isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />)}
      </div>
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="!overflow-visible"
          >
            <div className="p-4 !overflow-visible">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
        {label}
      </label>
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={1}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 transition-all break-words whitespace-normal resize-none overflow-hidden min-h-[38px]"
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = "auto";
          target.style.height = `${target.scrollHeight}px`;
        }}
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
        {label}
      </label>
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 transition-all break-words whitespace-normal resize-none"
      />
    </div>
  );
}

function ProgressBar({
  label,
  current,
  max,
  color,
  onChange,
}: {
  label: string;
  current: number;
  max: number;
  color: string;
  onChange: (v: number) => void;
}) {
  const percent = Math.min(100, (current / max) * 100);
  const [innerValue, setInnerValue] = useState(current?.toString() ?? "");

  useEffect(() => {
    if (
      current !== undefined &&
      current !== null &&
      current.toString() !== innerValue
    ) {
      if (current === 0 && innerValue === "") return;
      setInnerValue(current.toString());
    }
  }, [current]);

  return (
    <div
      onDoubleClick={() => current < max && onChange(max)}
      className="space-y-1 cursor-pointer"
    >
      <div className="flex justify-between items-end mb-1.5">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest truncate">
          {label}
        </span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={innerValue}
            onDoubleClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              setInnerValue(e.target.value);
              onChange(parseInt(e.target.value) || 0);
            }}
            className="w-12 bg-transparent text-right font-bold text-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span
            className="text-xs text-zinc-600"
            onDoubleClick={(e) => e.stopPropagation()}
          >
            / {max}
          </span>
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

function MiniBar({
  label,
  value,
  max = 100,
  color,
  onChange,
}: {
  label: string;
  value: number;
  max?: number;
  color: string;
  onChange: (v: number) => void;
}) {
  const percent = Math.min(100, (value / max) * 100);
  const [innerValue, setInnerValue] = useState(value?.toString() ?? "");

  useEffect(() => {
    if (
      value !== undefined &&
      value !== null &&
      value.toString() !== innerValue
    ) {
      if (value === 0 && innerValue === "") return;
      setInnerValue(value.toString());
    }
  }, [value]);

  return (
    <div
      onDoubleClick={() => value < max && onChange(max)}
      className="bg-zinc-900/50 border border-zinc-800 p-2 rounded-lg cursor-pointer"
    >
      <div className="text-[9px] text-zinc-500 font-bold uppercase mb-1">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={innerValue}
          onDoubleClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            setInnerValue(e.target.value);
            onChange(parseInt(e.target.value) || 0);
          }}
          className="w-10 bg-transparent text-xs font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      <div className="h-1 bg-zinc-800 rounded-full mt-1 overflow-hidden">
        <div className={cn("h-full", color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function WeaponProperties({
  item,
  onChange,
}: {
  item: any;
  onChange: (updates: any) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <MiniInput
          label="Dano"
          value={item.dano || "0"}
          onChange={(v) => onChange({ dano: v })}
        />
        <MiniInput
          label="Acerto"
          value={item.acerto || 0}
          type="number"
          onChange={(v) => onChange({ acerto: parseInt(v) || 0 })}
        />
      </div>

      <div className="bg-zinc-950/30 p-2 rounded-lg border border-zinc-800/50 space-y-2">
        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
          Escala
        </span>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-zinc-600 font-bold uppercase">
              Nível
            </span>
            <select
              value={item.escala || "0"}
              onChange={(e) => onChange({ escala: e.target.value })}
              className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-amber-500 font-bold focus:outline-none focus:border-amber-500/50"
            >
              <option value="0">0</option>
              <option value="D">D</option>
              <option value="C">C</option>
              <option value="B">B</option>
              <option value="A">A</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-zinc-600 font-bold uppercase">
              Bônus
            </span>
            <select
              value={item.atributoBase || "Força"}
              onChange={(e) => onChange({ atributoBase: e.target.value })}
              className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-amber-500 font-bold focus:outline-none focus:border-amber-500/50"
            >
              <option value="Força">Força</option>
              <option value="Destreza">Destreza</option>
              <option value="Inteligência">Inteligência</option>
              <option value="Ritual">Ritual</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MiniInput
          label="Corte"
          value={item.corte || 0}
          type="number"
          onChange={(v) => onChange({ corte: parseInt(v) || 0 })}
        />
        <MiniInput
          label="Impacto"
          value={item.impacto || 0}
          type="number"
          onChange={(v) => onChange({ impacto: parseInt(v) || 0 })}
        />
        <MiniInput
          label="Perf."
          value={item.perfuracao || 0}
          type="number"
          onChange={(v) => onChange({ perfuracao: parseInt(v) || 0 })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniInput
          label="Resist."
          value={item.resistencia || 0}
          type="number"
          onChange={(v) => onChange({ resistencia: parseInt(v) || 0 })}
        />
        <MiniInput
          label="Durab."
          value={item.durabilidade || 0}
          type="number"
          onChange={(v) => onChange({ durabilidade: parseInt(v) || 0 })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniInput
          label="Peso"
          value={item.peso || 0}
          type="number"
          onChange={(v) => onChange({ peso: parseFloat(v) || 0 })}
        />
        <MiniInput
          label="Vol"
          value={item.volume || 0}
          type="number"
          onChange={(v) => onChange({ volume: parseFloat(v) || 0 })}
        />
      </div>
      <TextArea
        label="Descrição"
        value={item.descricao || item.efeito || ""}
        onChange={(v) => onChange({ descricao: v, efeito: v })}
      />
    </div>
  );
}

function CatalystProperties({
  item,
  onChange,
}: {
  item: any;
  onChange: (updates: any) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-zinc-950/30 p-2 rounded-lg border border-zinc-800/50 space-y-2">
        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
          Escala
        </span>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-zinc-600 font-bold uppercase">
              Nível
            </span>
            <select
              value={item.escala || "0"}
              onChange={(e) => onChange({ escala: e.target.value })}
              className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-amber-500 font-bold focus:outline-none focus:border-amber-500/50"
            >
              <option value="0">0</option>
              <option value="D">D</option>
              <option value="C">C</option>
              <option value="B">B</option>
              <option value="A">A</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-zinc-600 font-bold uppercase">
              Bônus
            </span>
            <div className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-amber-500 font-bold">
              Inteligência
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MiniInput
          label="Feitiço"
          value={item.feitico || 0}
          type="number"
          onChange={(v) => onChange({ feitico: parseInt(v) || 0 })}
        />
        <MiniInput
          label="Elemental"
          value={item.elemental || 0}
          type="number"
          onChange={(v) => onChange({ elemental: parseInt(v) || 0 })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniInput
          label="Magia Negra"
          value={item.magiaNegra || 0}
          type="number"
          onChange={(v) => onChange({ magiaNegra: parseInt(v) || 0 })}
        />
        <MiniInput
          label="Potencial"
          value={item.potencial || 0}
          type="number"
          onChange={(v) => onChange({ potencial: parseInt(v) || 0 })}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MiniInput
          label="Durab."
          value={item.durabilidade || 0}
          type="number"
          onChange={(v) => onChange({ durabilidade: parseInt(v) || 0 })}
        />
        <MiniInput
          label="Peso"
          value={item.peso || 0}
          type="number"
          onChange={(v) => onChange({ peso: parseFloat(v) || 0 })}
        />
        <MiniInput
          label="Vol"
          value={item.volume || 0}
          type="number"
          onChange={(v) => onChange({ volume: parseFloat(v) || 0 })}
        />
      </div>
      <TextArea
        label="Descrição"
        value={item.descricao || item.efeito || ""}
        onChange={(v) => onChange({ descricao: v, efeito: v })}
      />
    </div>
  );
}

function ArmorProperties({
  item,
  onChange,
}: {
  item: any;
  onChange: (updates: any) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <MiniInput
          label="Corte"
          value={item.corte || 0}
          type="number"
          onChange={(v) => onChange({ corte: parseInt(v) || 0 })}
        />
        <MiniInput
          label="Impacto"
          value={item.impacto || 0}
          type="number"
          onChange={(v) => onChange({ impacto: parseInt(v) || 0 })}
        />
        <MiniInput
          label="Perf."
          value={item.perfuracao || 0}
          type="number"
          onChange={(v) => onChange({ perfuracao: parseInt(v) || 0 })}
        />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <MiniInput
          label="Durab."
          value={item.durabilidade || 0}
          type="number"
          onChange={(v) => onChange({ durabilidade: parseInt(v) || 0 })}
        />
        <MiniInput
          label="Peso"
          value={item.peso || 0}
          type="number"
          onChange={(v) => onChange({ peso: parseFloat(v) || 0 })}
        />
        <MiniInput
          label="Vol"
          value={item.volume || 0}
          type="number"
          onChange={(v) => onChange({ volume: parseFloat(v) || 0 })}
        />
        <MiniInput
          label="Redução de Dano"
          value={item.reducaoDano || 0}
          type="number"
          onChange={(v) => onChange({ reducaoDano: parseInt(v) || 0 })}
        />
      </div>
      <TextArea
        label="Descrição"
        value={item.descricao || item.efeito || ""}
        onChange={(v) => onChange({ descricao: v, efeito: v })}
      />
    </div>
  );
}

function DiceImage({
  sides,
  fileName,
  className,
}: {
  sides: number;
  fileName?: string;
  className?: string;
}) {
  const [error, setError] = useState(false);

  const src = useMemo(() => {
    if (!fileName) return null;
    // Remove leading slash if present
    const cleanName = fileName.startsWith("/")
      ? fileName.substring(1)
      : fileName;
    return diceBase64[cleanName] || null;
  }, [fileName]);

  if (src && !error) {
    return (
      <div
        className={cn("relative flex items-center justify-center", className)}
      >
        <img
          src={src}
          alt={`d${sides}`}
          className="w-full h-full object-contain filter invert brightness-[2] contrast-125"
          referrerPolicy="no-referrer"
          onError={() => setError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-amber-500/10 rounded-lg border border-amber-500/20",
        className,
      )}
    >
      <span className="text-amber-500 font-black text-xl">D{sides}</span>
    </div>
  );
}

function NumericInput({
  label,
  value,
  onChange,
  className,
  min,
  max,
  size = "md",
}: {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  className?: string;
  min?: number;
  max?: number;
  size?: "sm" | "md" | "lg";
}) {
  const [innerValue, setInnerValue] = useState(value?.toString() ?? "");

  useEffect(() => {
    if (
      value !== undefined &&
      value !== null &&
      value.toString() !== innerValue
    ) {
      if (value === 0 && innerValue === "") return;
      setInnerValue(value.toString());
    }
  }, [value]);

  return (
    <div className={cn("flex flex-col min-w-0", className)}>
      {label && (
        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 truncate">
          {label}
        </label>
      )}
      <input
        type="text"
        inputMode="numeric"
        value={innerValue}
        onChange={(e) => {
          const val = e.target.value
            .replace(/[^0-9.,-]/g, "")
            .replace(",", ".");
          setInnerValue(val);
          onChange(parseFloat(val) || 0);
        }}
        className={cn(
          "bg-black/40 border border-zinc-700/50 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 transition-all text-amber-400 font-bold text-center w-full min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-inner",
          size === "sm" && "py-1 px-1 text-sm",
          size === "md" && "py-2 px-2 text-base",
          size === "lg" && "py-3 px-1 text-3xl",
        )}
      />
    </div>
  );
}

function MiniInput({
  label,
  value,
  type = "text",
  onChange,
  disabled,
}: {
  label: string;
  value: any;
  type?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [innerValue, setInnerValue] = useState(value?.toString() ?? "");

  useEffect(() => {
    if (
      value !== undefined &&
      value !== null &&
      value.toString() !== innerValue
    ) {
      if (value === 0 && innerValue === "") return;
      setInnerValue(value.toString());
    }
  }, [value]);

  return (
    <div
      className={cn(
        "flex flex-col min-w-0 transition-opacity",
        disabled && "opacity-40 grayscale pointer-events-none",
      )}
    >
      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter mb-0.5 truncate">
        {label}
      </span>
      {type === "text" ? (
        <textarea
          value={innerValue}
          disabled={disabled}
          onChange={(e) => {
            setInnerValue(e.target.value);
            onChange(e.target.value);
          }}
          rows={1}
          className="bg-transparent text-sm font-bold focus:outline-none border-b border-zinc-800 focus:border-amber-500/50 break-words whitespace-normal resize-none overflow-hidden min-h-[20px] w-full"
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "auto";
            target.style.height = `${target.scrollHeight}px`;
          }}
        />
      ) : (
        <input
          type="text"
          inputMode="numeric"
          value={innerValue}
          disabled={disabled}
          onChange={(e) => {
            const val = e.target.value
              .replace(/[^0-9.,-]/g, "")
              .replace(",", ".");
            setInnerValue(val);
            onChange(val);
          }}
          className="bg-transparent text-sm font-bold focus:outline-none border-b border-zinc-800 focus:border-amber-500/50 w-full min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      )}
    </div>
  );
}
