import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { createPortal } from "react-dom";
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
  User as UserIcon,
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
  CheckSquare,
  Square,
  Droplet,
  FileText,
  Dices,
  History,
  Minus,
  Image,
  TrendingUp,
  Target,
  Maximize,
  RefreshCw as RefreshCwIcon,
  Library,
  Calendar,
  Clock,
  Sun,
  Cloud,
  Wind,
  Snowflake,
  Hammer,
  Menu,
  Disc,
  Scissors,
  Sparkles,
  PawPrint,
  ExternalLink,
  LogOut,
  Wand2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { jsPDF } from "jspdf";
import { DiceImage } from "./components/ui/DiceImage";
import { diceBase64 } from "./diceIcons";
import { auth, loginWithGoogle, logout as firebaseLogout, handleRedirectResult, clearFirestoreCache, isFirebaseQuotaExceeded, onAuthStateChanged } from "./lib/supabase";
import type { FirebaseUserLike as User } from "./lib/supabase";
import { subscribeToUserCharacters, saveCharacterToFirestore, deleteCharacterFromFirestore } from "./services/characterService";
import { 
  createCampaign, 
  subscribeToMasterCampaigns, 
  subscribeToCampaignsByIds,
  joinCampaign, 
  subscribeToCampaignCharacters,
  deleteCampaign 
} from "./services/campaignService";
import { 
  subscribeToTokens, 
  subscribeToTableConfig, 
  addToken, 
  removeToken, 
  updateTableConfig,
  updateTokenPosition 
} from "./services/vttService";

import { randomInt, randomElement, generateId, secureRandom } from './lib/random';
import { Character, AppState, ArmorPiece, Campaign, TableToken, TableConfig, BestiaryMonster, NegativeEffect, CalendarEvent, Spell } from "./types";
import { VTTBoard } from "./components/VTTBoard";
import { Bestiary } from "./components/Bestiary";
import { TocaManager } from "./components/TocaManager";
import { MaterialManagement } from "./components/MaterialManagement";
import { OracleTab } from "./components/OracleTab";
import { ItemLibrary } from "./components/ItemLibrary";
import { SpellLibrary } from "./components/SpellLibrary";
import { subscribeToMaterials, saveMaterial, deleteMaterial } from "./services/materialService";
import { subscribeToBestiary, saveMonsterToBestiary } from "./services/bestiaryService";
import { MaterialData } from "./data/materials";
import { DEFAULT_MONSTERS } from "./constants/defaultMonsters";
import { compressImageDataUrl } from "./lib/imageUtils";
import {
  Stats,
  PROFICIENCIES,
  calculateProficiencyBonus,
} from "./rules/proficiencyRules";
import {
  getVidaMaxima,
  getManaMaxima,
  getSanidadeMaxima,
  getCargaMaxima,
  getDeslocamentoBase,
} from "./rules/statusRules";
import { getSeason, getSeasonIcon, formatTime, formatDate, getDaysInMonth, generateWeather, getMoonPhase } from "./rules/timeRules";
import {
  Item,
  calculateInventoryTotals,
  getLoadPenalties,
  getItemPeso,
  getItemVolume,
  getArmorWeight,
  getArmorVolume,
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

// Using generateId from lib/random

// Utility for parsing and rolling complex dice formulas like 1d20+2d12+5
const parseAndRollDice = (formula: string) => {
  // Normalize formula: lowercase, remove spaces, keep minuses as +- for simple splitting
  const danoStr = (formula || "1d6").toString().toLowerCase().replace(/\s+/g, "").replace(/-/g, "+-");
  const parts = danoStr.split('+').filter(p => p.length > 0);
  
  let total = 0;
  let rolls: number[] = [];
  const formulaSegments: string[] = [];
  let flatBonus = 0;

  parts.forEach(part => {
    // Match something like "2d12" or "d20" or "1d6"
    // Also handles the negative sign from our earlier replace
    const isNegative = part.startsWith('-');
    const cleanPart = isNegative ? part.substring(1) : part;
    
    if (cleanPart.includes('d')) {
      const [dNumStr, dSidesStr] = cleanPart.split('d');
      const dNum = Math.min(20, parseInt(dNumStr) || 1);
      const dSides = parseInt(dSidesStr) || 6;
      
      let partTotal = 0;
      const partRolls: number[] = [];
      for (let i = 0; i < dNum; i++) {
        const r = randomInt(1, dSides);
        partRolls.push(r);
        partTotal += r;
      }
      
      if (isNegative) {
        total -= partTotal;
        rolls.push(...partRolls.map(r => -r));
        formulaSegments.push(`-${dNum}d${dSides} (${partRolls.map(r => -r).join('+')})`);
      } else {
        total += partTotal;
        rolls.push(...partRolls);
        formulaSegments.push(`${dNum}d${dSides} (${partRolls.join('+')})`);
      }
    } else {
      const val = parseInt(part) || 0;
      total += val;
      flatBonus += val;
      if (val !== 0) {
        formulaSegments.push(val > 0 ? `+${val}` : `${val}`);
      }
    }
  });

  // Clean formula segments (remove leading + if it's the first element)
  if (formulaSegments.length > 0 && formulaSegments[0].startsWith('+')) {
    formulaSegments[0] = formulaSegments[0].substring(1);
  }

  return { 
    total, 
    rolls, 
    fullFormula: formulaSegments.join(' '),
    flatBonus 
  };
};

const createEmptyCharacter = (): Character => ({
  id: generateId(),
  userId: "",
  nome: "Novo Personagem",
  etnia: "",
  dinheiro: { C: 0, B: 0, P: 0, O: 0 },
  vidaAtual: 0,
  manaAtual: 0,
  sanidadeAtual: 0,
  fome: 100,
  sede: 100,
  cansaco: 8,
  defesa: { "Cabeça": 0, "Tronco": 0, "Braço Esquerdo": 0, "Braço Direito": 0, "Pernas": 0 },
  clima: 0,
  stats: {
    CON: 0, RES: 0, ADP: 0, MEN: 0, APR: 0, FOR: 0, DEX: 0, INT: 0, RIT: 0
  },
  statsXP: {
    CON: 0, RES: 0, ADP: 0, MEN: 0, APR: 0, FOR: 0, DEX: 0, INT: 0, RIT: 0
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
    { id: generateId(), nome: "Mochila de Viagem", volumeMax: 50, itens: [], externo: false },
    { id: generateId(), nome: "Bolsa de Cinto", volumeMax: 0, itens: [], externo: false },
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
  itens: [],
});

// Static default for sanitization (to avoid generating new IDs every time getSyncJson runs)
const getGhostTemplate = (): Character => ({
  id: "template",
  nome: "Novo Personagem",
  etnia: "",
  dinheiro: { C: 0, B: 0, P: 0, O: 0 },
  vidaAtual: 0,
  manaAtual: 0,
  sanidadeAtual: 0,
  fome: 100,
  sede: 100,
  cansaco: 8,
  defesa: { "Cabeça": 0, "Tronco": 0, "Braço Esquerdo": 0, "Braço Direito": 0, "Pernas": 0 },
  clima: 0,
  stats: { CON: 0, RES: 0, ADP: 0, MEN: 0, APR: 0, FOR: 0, DEX: 0, INT: 0, RIT: 0 },
  statsXP: { CON: 0, RES: 0, ADP: 0, MEN: 0, APR: 0, FOR: 0, DEX: 0, INT: 0, RIT: 0 },
  bonusProficiencias: {},
  joias: [],
  imagem: "",
  armas: [],
  catalisadores: [],
  habilidades: [],
  magias: [],
  armaduras: [],
  acessorios: [],
  compartimentos: [],
  conhecimentos: INITIAL_KNOWLEDGES.map((name) => ({
    name,
    nivel: 0,
    xp: 0,
    limite: 5,
  })),
  escalas: [],
  efeitosNegativos: [],
  anotacoes: [],
  dadosCustomizados: [],
  imagens: [],
  itens: [],
  userId: "",
});

const MenuButton = ({ active, onClick, icon, label, color }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, color: string }) => {
  const colors: Record<string, string> = {
    amber: active ? "bg-amber-500 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
    purple: active ? "bg-purple-600 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
    blue: active ? "bg-blue-600 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
    red: active ? "bg-red-600 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
    orange: active ? "bg-orange-600 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
  };

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all w-full text-left font-bold text-xs",
        colors[color] || colors.amber
      )}
    >
      <div className={cn(
        "w-7 h-7 flex items-center justify-center rounded-md bg-zinc-950/20 shadow-inner shrink-0",
        active && "bg-white/10"
      )}>
        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 15 }) : icon}
      </div>
      <span>{label}</span>
      {active && <div className="ml-auto w-1 h-1 rounded-full bg-current opacity-60" />}
    </motion.button>
  );
};

const sanitizeCharacter = (char: any): Character => {
  if (!char || typeof char !== "object") return createEmptyCharacter();
  
  const def = getGhostTemplate();
  const ensureArray = (arr: any) => Array.isArray(arr) ? arr : [];

  return {
    ...def,
    ...char,
    dinheiro: { ...def.dinheiro, ...(char.dinheiro || {}) },
    defesa: (() => {
      const d = char.defesa || {};
      return {
        "Cabeça": d["Cabeça"] ?? d.Cabeça ?? 0,
        "Tronco": d["Tronco"] ?? d.Torso ?? 0,
        "Braço Esquerdo": d["Braço Esquerdo"] ?? d.Braços ?? 0,
        "Braço Direito": d["Braço Direito"] ?? d.Braços ?? 0,
        "Pernas": d["Pernas"] ?? d.Pernas ?? 0,
      };
    })(),
    stats: { ...def.stats, ...(char.stats || {}) },
    statsXP: { ...def.statsXP, ...(char.statsXP || {}) },
    bonusProficiencias: char.bonusProficiencias || {},
    compartimentos: ensureArray(char.compartimentos || []).map((comp: any) => ({
      ...comp,
      itens: ensureArray(comp.itens || [])
    })),
    conhecimentos: ensureArray(char.conhecimentos || def.conhecimentos),
    anotacoes: ensureArray(char.anotacoes || []),
    magias: ensureArray(char.magias || []).map((m: any) => ({
      ...m,
      tipo: m.tipo === "ataque" ? "Ataque" : (m.tipo || "Ataque"),
      estagio: m.estagio || 0,
    })),
    armas: ensureArray(char.armas || []),
    catalisadores: ensureArray(char.catalisadores || []),
    habilidades: ensureArray(char.habilidades || []),
    armaduras: ensureArray(char.armaduras || []),
    acessorios: ensureArray(char.acessorios || []),
    escalas: ensureArray(char.escalas || []),
    dadosCustomizados: ensureArray(char.dadosCustomizados || []),
    imagens: ensureArray(char.imagens || []),
    itens: ensureArray(char.itens || []),
    efeitosNegativos: ensureArray(char.efeitosNegativos || []),
    clima: typeof char.clima === "object" ? 0 : char.clima || 0,
  };
};

const getSyncJson = (char: Character) => {
  const cleaned = sanitizeCharacter(char);
  const { updatedAt, ...rest } = cleaned as any;
  
  const sortObject = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sortObject);
    return Object.keys(obj).sort().reduce((acc: any, key) => {
      acc[key] = sortObject(obj[key]);
      return acc;
    }, {});
  };
  
  return JSON.stringify(sortObject(rest));
};

const NEGATIVE_EFFECTS = [
  {
    id: "ossos_quebrados",
    name: "Ossos Quebrados",
    icon: Bone,
    color: "text-zinc-400",
    info: "Ponto fraco +3 dano extra\nImobilizado",
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

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-zinc-900 border border-red-500/30 rounded-2xl p-8 space-y-6">
            <Skull className="w-16 h-16 text-red-500 mx-auto" />
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white uppercase tracking-tighter">Anomalia Planar</h2>
              <p className="text-zinc-400 text-sm">O sistema encontrou um erro crítico e precisou ser interrompido para sua segurança.</p>
            </div>
            <div className="bg-black/40 rounded-lg p-4 text-left overflow-auto max-h-40 custom-scrollbar">
              <code className="text-red-400 text-xs break-all">{this.state.error?.message}</code>
            </div>
            <div className="flex flex-col gap-3 pt-2">
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-all"
              >
                Tentar Recarregar
              </button>
              <button 
                onClick={() => {
                  if (confirm("Isso apagará suas fichas locais. Tem certeza?")) {
                    localStorage.removeItem(STORAGE_KEY);
                    window.location.reload();
                  }
                }}
                className="w-full py-3 border border-red-500/30 text-red-500 hover:bg-red-500/10 font-bold rounded-xl transition-all text-xs uppercase"
              >
                Resetar Cache Local
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default AppWrapper;

function App() {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.characters)) {
          parsed.characters = parsed.characters.map(sanitizeCharacter);
          // Initialize dirtyCharacterIds if missing
          if (!parsed.dirtyCharacterIds) {
            parsed.dirtyCharacterIds = [];
          }
          return parsed;
        }
      } catch (e) {
        console.error("Erro ao carregar do localStorage", e);
      }
    }
    const initialChar = createEmptyCharacter();
    return { 
      characters: [initialChar], 
      activeCharacterId: initialChar.id,
      dirtyCharacterIds: [],
      activeCampaignId: null
    };
  });

  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(() => (state as any).activeCampaignId || null);

  const [isLoadingSync, setIsLoadingSync] = useState(true);

  const [isQuotaExceeded, setIsQuotaExceeded] = useState(() => isFirebaseQuotaExceeded());

  useEffect(() => {
    setState(prev => {
      if ((prev as any).activeCampaignId === activeCampaignId) return prev;
      return { ...prev, activeCampaignId };
    });
  }, [activeCampaignId]);

  const [cutItem, setCutItem] = useState<{ item: any; charId: string; sourceId: string; type: 'inventory' | 'weapon' | 'catalyst' | 'armor' | 'accessory'; companionId?: string } | null>(null);
  const [pendingCutAction, setPendingCutAction] = useState<{ type: 'inventory' | 'weapon' | 'catalyst' | 'armor' | 'accessory'; charId: string; sourceId: string; item: any } | null>(null);

  const [multiClipboard, setMultiClipboard] = useState<{
    type: "Arma" | "Catalisador" | "Armadura" | "Acessório" | "Item" | "Magia" | "Habilidade";
    data: any;
  }[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success" | "info";
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: "error" | "success" | "info" = "info") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    },
    [],
  );
  const [activePage, setActivePage] = useState<
    "sheet" | "notes" | "dice" | "gallery" | "master" | "table" | "bestiary" | "library" | "materials" | "oracle" | "toca" | "items" | "spells"
  >("sheet");
  const [customMaterials, setCustomMaterials] = useState<MaterialData[]>([]);
  const [masterCampaigns, setMasterCampaigns] = useState<Campaign[]>([]);
  const [joinedCampaigns, setJoinedCampaigns] = useState<Campaign[]>([]);
  const [isCampaignsLoaded, setIsCampaignsLoaded] = useState(false);
  const campaigns = useMemo(() => {
    const combined = [...masterCampaigns, ...joinedCampaigns];
    const seen = new Set();
    return combined.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [masterCampaigns, joinedCampaigns]);
  const orphanedCampaignIds = useMemo(() => {
    if (isLoadingSync) return [];
    const allCampaignIds = new Set(campaigns.map(c => c.id));
    const idsInChars = Array.from(new Set(state.characters.map(c => c.campaignId).filter(id => !!id)));
    return idsInChars.filter(id => !allCampaignIds.has(id));
  }, [state.characters, campaigns, isLoadingSync]);
  const [campaignCharacters, setCampaignCharacters] = useState<Character[]>([]);
  const [tokens, setTokens] = useState<TableToken[]>([]);
  const [tableConfig, setTableConfig] = useState<TableConfig>({ gridSize: 50, showGrid: true, masterFog: false });
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [newCampaignName, setNewCampaignName] = useState("");
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
  const [charIdToDelete, setCharIdToDelete] = useState<string | null>(null);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    // Check if inside an iframe
    const isIframe = window.self !== window.top;
    if (isIframe) {
      showToast("Abra o app em uma nova aba para poder instalá-lo!", "error");
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        showToast("No iOS: Toque em Compartilhar e 'Seguir para Tela de Início'", "info");
      } else {
        showToast("Use o menu do navegador e selecione 'Instalar Aplicativo'", "info");
      }
    }
    setIsMenuOpen(false);
  };

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? window.navigator.onLine : true);

  // Monitorar conexão
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Bloqueio de gestos do navegador para evitar pull-to-refresh e pinch-zoom
  useEffect(() => {
    if (activePage === "table") {
      // Bloqueio via CSS no body
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehaviorY = 'none';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.documentElement.style.overscrollBehaviorY = 'none';
      document.documentElement.classList.add('vtt-active');

      // Desabilitar zoom via meta tag
      const viewport = document.querySelector('meta[name=viewport]');
      const originalViewport = viewport?.getAttribute('content') || '';
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      }

      const preventDefault = (e: any) => {
        // Bloqueia gestos do navegador
        if (e.cancelable) {
          // Bloqueia wheel zoom (ctrl + wheel)
          if (e.type === 'wheel' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            return;
          }
          // No activePage "table", queremos impedir pull-to-refresh global, 
          // mas permitimos que os eventos cheguem aos elementos.
          // O VTTBoard já trata o preventDefault dele.
        }
      };

      const blockSafariZoom = (e: any) => {
        if (e.cancelable) e.preventDefault();
      };

      window.addEventListener('wheel', preventDefault, { passive: false });
      window.addEventListener('gesturestart', blockSafariZoom, { passive: false });
      window.addEventListener('gesturechange', blockSafariZoom, { passive: false });

      return () => {
        document.body.style.overflow = '';
        document.body.style.overscrollBehaviorY = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
        document.documentElement.style.overscrollBehaviorY = '';
        document.documentElement.classList.remove('vtt-active');
        if (viewport) viewport.setAttribute('content', originalViewport);
        window.removeEventListener('wheel', preventDefault);
        window.removeEventListener('gesturestart', blockSafariZoom);
        window.removeEventListener('gesturechange', blockSafariZoom);
      };
    }
  }, [activePage]);

  // Firebase Auth Effect
  useEffect(() => {
    console.log("Iniciando listener de autenticação...");
    
    let isSubscribed = true;

    // Verificar se voltamos de um redirect de login
    const checkRedirect = async () => {
      const redirectedUser = await handleRedirectResult();
      if (redirectedUser && isSubscribed) {
        console.log("Usuário recuperado do redirect:", redirectedUser.email);
        setUser(redirectedUser);
        setAuthLoading(false);
      }
    };
    
    checkRedirect();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!isSubscribed) return;
      
      console.log("Estado de autenticação alterado:", currentUser ? `Usuário: ${currentUser.email}` : "Nenhum usuário");
      setUser(currentUser);
      setAuthLoading(false);
      setAuthError(null);
    }, (error: any) => {
      if (!isSubscribed) return;
      console.error("Erro no listener de autenticação:", error);
      
      // Se for apenas erro de rede, não bloqueamos o app, mas avisamos que está offline
      if (error.code === 'auth/network-request-failed') {
        console.warn("Falha de rede na autenticação. O app funcionará em modo offline.");
        setAuthLoading(false);
      } else {
        setAuthError(error.message);
        setAuthLoading(false);
      }
    });

    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, []);

  // Firebase Sync Effect
  useEffect(() => {
    if (!user?.uid) {
      setIsLoadingSync(false);
      return;
    }
    
    console.log("🔥 [Sync] Iniciando assinatura de personagens para:", user.uid);
    setIsLoadingSync(true);
    lastSyncedRef.current = {}; // Limpa cache ao trocar de usuário

    const unsubscribe = subscribeToUserCharacters(user.uid, user.email || "", (fireChars, metadata) => {
      console.log(`📡 [Sync] ${fireChars.length} personagens carregados (${metadata.fromCache ? 'Cache' : 'Servidor'}). Pendentes: ${metadata.hasPendingWrites}`);
      
      // Só paramos o loading principal quando recebemos dados do servidor (ou se o cache estiver vazio e carregado)
      if (!metadata.fromCache) {
        setIsLoadingSync(false);
      }

      // Clean up deletedCharsRef for IDs that are truly gone from the server
      const fireCharIds = new Set(fireChars.map(fc => fc.id));
      deletedCharsRef.current.forEach(id => {
        if (!fireCharIds.has(id)) {
          deletedCharsRef.current.delete(id);
        }
      });

      // Sanitize characters from Firestore and exclude those deleted locally
      const sanitizedFireChars = fireChars
        .filter(fc => !deletedCharsRef.current.has(fc.id))
        .map(fc => ({ ...sanitizeCharacter(fc), isRemoteSynced: true }));

      setState(prev => {
        const dirtyIds = new Set(prev.dirtyCharacterIds || []);
        
        console.log(`🔍 [Sync] Merge: Local=${prev.characters.length}, Remote=${sanitizedFireChars.length}, PendingWrites=${metadata.hasPendingWrites}, Dirty=${Array.from(dirtyIds).join(', ')}`);
        
        // Map Firestore characters to our state
        const mergedCharacters = sanitizedFireChars.map(fChar => {
          const charJson = getSyncJson(fChar);
          const localMatch = prev.characters.find(lc => lc.id === fChar.id);
          
          // Migração: Se a ficha vinda do servidor tem o email correto mas o UID está faltando ou é diferente do atual,
          // vamos marcar como dirty para forçar a atualização com o UID correto do usuário logado.
          const needsMigration = fChar.userEmail === user.email && (!fChar.userId || fChar.userId !== user.uid);
          
          if (needsMigration && !dirtyIds.has(fChar.id)) {
            console.log(`🔄 [Sync] Migrando ${fChar.nome} para o UID ${user.uid} (vincular por email)`);
            dirtyIds.add(fChar.id);
          }

          if (localMatch) {
            const localJson = getSyncJson(localMatch);
            
            // Se a ficha local é exatamente igual à do servidor ou não está "suja" (dirty), usamos a do servidor
            if (localJson === charJson || !dirtyIds.has(localMatch.id)) {
              if (localJson === charJson && dirtyIds.has(localMatch.id) && !metadata.hasPendingWrites) {
                console.log(`✅ [Sync] Dados coincidem para ${fChar.nome}. Limpando flag dirty.`);
                dirtyIds.delete(localMatch.id);
              }
              lastSyncedRef.current[fChar.id] = charJson;
              return { ...fChar, isRemoteSynced: true };
            } else {
              // Se a local está suja (tem alteração não salva), preservamos a local por enquanto
              console.log(`⚠️ [Sync] Preservando alteração local de ${fChar.nome}`);
              return { ...localMatch, isRemoteSynced: true };
            }
          }
          
          // Nova ficha vinda do servidor
          lastSyncedRef.current[fChar.id] = charJson;
          return { ...fChar, isRemoteSynced: true };
        });

        // Adicionar fichas que só existem localmente (novas criadas off-line ou em processamento)
        const localOnly = prev.characters.filter(lc => {
          const isRemote = sanitizedFireChars.some(fc => fc.id === lc.id);
          const isOwn = lc.userId === user.uid || (lc.userEmail && lc.userEmail === user.email);

          // Se não é nossa ficha (por exemplo, pertence a outro jogador ou é uma criatura na campanha),
          // não devemos aplicar a lógica de remoção/sincronização de ficha própria privada.
          if (!isOwn) {
            return !isRemote && !deletedCharsRef.current.has(lc.id);
          }

          // Se lastSyncedRef ou lc.isRemoteSynced tem ela, ela já foi pro servidor alguma vez.
          const wasPreviouslySynced = lc.isRemoteSynced || !!lastSyncedRef.current[lc.id];
          const isDeletedLocally = deletedCharsRef.current.has(lc.id);
          
          // Se não está no servidor agora, mas sabemos que já esteve (e não fomos nós que apagamos agora localmente)
          // Então ela foi apagada remotamente em outro dispositivo/aba ou pelo próprio usuário.
          if (!isRemote && wasPreviouslySynced && !isDeletedLocally) {
             console.log(`🗑️ [Sync] Removendo ficha ${lc.nome} (deletada remotamente)`);
             delete lastSyncedRef.current[lc.id];
             return false;
          }
          
          return !isRemote && !isDeletedLocally;
        });

        // Se estamos logados, queremos que as fichas locais (novas e nunca sincronizadas) subam para o servidor
        localOnly.forEach(lc => {
          const isOwn = lc.userId === user.uid || (lc.userEmail && lc.userEmail === user.email) || (!lc.userId && !lc.userEmail);
          if (!isOwn) return; // Não tenta subir fichas de outros usuários

          const wasPreviouslySynced = lc.isRemoteSynced || !!lastSyncedRef.current[lc.id];
          if (!wasPreviouslySynced && !dirtyIds.has(lc.id)) {
            console.log(`📡 [Sync] Agendando upload de ficha local nova: ${lc.nome}`);
            dirtyIds.add(lc.id);
          }
        });
        
        const finalCharacters = [...mergedCharacters, ...localOnly];
        
        return {
          ...prev,
          characters: finalCharacters,
          activeCharacterId: prev.activeCharacterId || (finalCharacters.length > 0 ? finalCharacters[0].id : ""),
          dirtyCharacterIds: Array.from(dirtyIds)
        };
      });
    });

    return () => {
      console.log("Limpando assinaturas de personagens...");
      unsubscribe();
    };
  }, [user?.uid]);

  // Listen to custom "firebase-quota-exceeded" event
  useEffect(() => {
    let lastToastTime = 0;
    const handleFirebaseQuotaExceeded = () => {
      setIsQuotaExceeded(true);
      const now = Date.now();
      // Throttle to avoid showing multiple toasts for simultaneous background writes
      if (now - lastToastTime > 60000) {
        lastToastTime = now;
        showToast(
          "⚠️ O limite diário de gravação do banco de dados (Firebase) foi atingido. Suas fichas continuarão sendo salvas localmente neste navegador de forma segura!",
          "info"
        );
      }
    };

    window.addEventListener("firebase-quota-exceeded", handleFirebaseQuotaExceeded);
    return () => {
      window.removeEventListener("firebase-quota-exceeded", handleFirebaseQuotaExceeded);
    };
  }, [showToast]);

  // Subscribe to Materials
  useEffect(() => {
    if (!user?.uid) {
      setCustomMaterials([]);
      return;
    }
    
    const unsubscribe = subscribeToMaterials(user.uid, (mats) => {
      setCustomMaterials(mats);
    });
    
    return () => unsubscribe();
  }, [user?.uid]);

  // Master Campaigns Effect
  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeToMasterCampaigns((camps) => {
      setMasterCampaigns(camps);
      setIsCampaignsLoaded(true);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // Player Joined Campaigns Effect - Memoized sorted string key to prevent constant database resubscriptions on every character state edit
  const joinedCampaignIdsKey = useMemo(() => {
    const ids = Array.from(new Set(state.characters.map(c => c.campaignId).filter(id => !!id)));
    return ids.sort().join(',');
  }, [state.characters]);

  useEffect(() => {
    if (!user || !joinedCampaignIdsKey) {
      setJoinedCampaigns([]);
      return;
    }
    const ids = joinedCampaignIdsKey.split(',').filter(Boolean);
    console.log(`📡 [Sync] Assinando campanhas participadas: ${ids.join(', ')}`);
    const unsubscribe = subscribeToCampaignsByIds(ids, (camps) => {
      setJoinedCampaigns(camps);
    });
    return () => {
      console.log(`🔌 [Sync] Cancelando assinatura de campanhas participadas`);
      unsubscribe();
    };
  }, [user, joinedCampaignIdsKey]);

  // Validate activeCampaignId against current campaigns to auto-deselect if deleted/invalid
  useEffect(() => {
    if (user?.uid && activeCampaignId && !isLoadingSync && isCampaignsLoaded) {
      const exists = campaigns.some(c => c.id === activeCampaignId);
      if (!exists) {
        console.log("🧹 Clearing stale/orphan activeCampaignId because it does not exist in campaigns:", activeCampaignId);
        setActiveCampaignIdWithSync(null);
      }
    }
  }, [campaigns, activeCampaignId, user?.uid, isLoadingSync, isCampaignsLoaded]);

  // Campaign Characters & Tokens Effect
  useEffect(() => {
    if (!activeCampaignId) {
        setCampaignCharacters([]);
        setTokens([]);
        setTableConfig({ gridSize: 50, showGrid: true, masterFog: false });
        return;
    }
    
    console.log(`[Campaign] Entering campaign: ${activeCampaignId}`);
    
    const unsubChars = subscribeToCampaignCharacters(activeCampaignId, (chars) => {
      console.log(`[Campaign] Loaded ${chars.length} characters for campaign ${activeCampaignId}`);
      if (chars.length > 0) {
        console.log(`[Campaign] Sample IDs: ${chars.slice(0, 3).map(c => c.id).join(', ')}`);
      }
      const sanitizedChars = chars
        .filter(c => !deletedCharsRef.current.has(c.id))
        .map(c => sanitizeCharacter(c));
      setCampaignCharacters(sanitizedChars);
    });
    
    const unsubTokens = subscribeToTokens(activeCampaignId, (tks) => {
      console.log(`[Campaign] Loaded ${tks.length} tokens for campaign ${activeCampaignId}`);
      setTokens(tks);
    });

    const unsubConfig = subscribeToTableConfig(activeCampaignId, (cfg) => {
      console.log(`[Campaign] Table config update:`, cfg);
      setTableConfig(cfg);
    });

    return () => {
      console.log(`[Campaign] Leaving campaign: ${activeCampaignId}`);
      unsubChars();
      unsubTokens();
      unsubConfig();
    };
  }, [activeCampaignId]);

  // Sync campaign characters into state.characters
  useEffect(() => {
    if (!activeCampaignId || !user?.uid || campaignCharacters.length === 0) return;
    
    setState(prev => {
      let hasChanges = false;
      const dirtyIds = new Set(prev.dirtyCharacterIds || []);
      const currentIds = new Set(prev.characters.map(c => c.id));
      
      const updatedStateChars = prev.characters.map(lc => {
        const remoteMatch = campaignCharacters.find(rc => rc.id === lc.id);
        
        if (remoteMatch && !dirtyIds.has(lc.id)) {
          const localJson = getSyncJson(lc);
          const remoteJson = getSyncJson(remoteMatch);

          if (localJson !== remoteJson) {
            hasChanges = true;
            return remoteMatch;
          }
        }
        return lc;
      });

      const newFromCampaign = campaignCharacters.filter(rc => !currentIds.has(rc.id) && !deletedCharsRef.current.has(rc.id));
      if (newFromCampaign.length > 0) {
        hasChanges = true;
        updatedStateChars.push(...newFromCampaign);
      }
      
      if (!hasChanges) return prev;
      return { ...prev, characters: updatedStateChars };
    });
  }, [campaignCharacters, activeCampaignId, user?.uid]);

  const [tocaEditingCreatureId, setTocaEditingCreatureId] = useState<string | null>(null);
  const [bestiaryEditingMonsterId, setBestiaryEditingMonsterId] = useState<string | null>(null);
  const [bestiaryMonsters, setBestiaryMonsters] = useState<BestiaryMonster[]>([]);
  const [isVttSheetOpen, setIsVttSheetOpen] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setBestiaryMonsters([]);
      return;
    }
    const unsub = subscribeToBestiary(user.uid, (data) => {
      setBestiaryMonsters(data);
    });
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    setTocaEditingCreatureId(null);
    setBestiaryEditingMonsterId(null);
  }, [state.activeCharacterId]);

  const menuRef = useRef<HTMLDivElement>(null);
  const sideMenuRef = useRef<HTMLDivElement>(null);
  const deletedCharsRef = useRef<Set<string>>(new Set());

  const activeChar = useMemo(() => {
    if (tocaEditingCreatureId) {
      for (const parent of state.characters) {
        const found = (parent.tocaCreatures || []).find(tc => tc.id === tocaEditingCreatureId);
        if (found) {
          const empty = createEmptyCharacter();
          const f = found as any;
          return {
            ...empty,
            ...f,
            nome: f.nome || f.name || "Criatura da Toca",
            imagem: f.imagem || f.imageUrl || "",
            vidaAtual: f.vidaAtual !== undefined ? f.vidaAtual : (f.hpAtual !== undefined ? f.hpAtual : (Number(f.maxHp) || 15)),
          } as unknown as Character;
        }
      }
    }
    if (bestiaryEditingMonsterId) {
      const found = bestiaryMonsters.find(m => m.id === bestiaryEditingMonsterId);
      if (found) {
        const empty = createEmptyCharacter();
        const f = found as any;
        return {
          ...empty,
          ...f,
          nome: f.name || f.nome || "Demônio do Bestiário",
          imagem: f.imageUrl || f.imagem || "",
          vidaAtual: f.vidaAtual !== undefined ? f.vidaAtual : (f.hpAtual !== undefined ? f.hpAtual : (Number(f.maxHp) || 20)),
        } as unknown as Character;
      }
    }
    const char = state.characters.find((c) => c.id === state.activeCharacterId);
    if (char) return char;
    if (state.characters.length > 0) return state.characters[0];
    return null;
  }, [state, tocaEditingCreatureId, bestiaryEditingMonsterId, bestiaryMonsters]);

  // Ensure there is at least one character
  useEffect(() => {
    if (state.characters.length === 0 && !authLoading && !isLoadingSync) {
      const newChar = createEmptyCharacter();
      if (user) {
        newChar.userId = user.uid;
        newChar.userEmail = user.email || "";
      }
      setState(prev => ({
        ...prev,
        characters: [newChar],
        activeCharacterId: newChar.id
      }));
    }
  }, [state.characters.length, authLoading, isLoadingSync]);

  const [vitaisTab, setVitaisTab] = useState<"status" | "efeitos">("status");
  const [openLevelSelectorId, setOpenLevelSelectorId] = useState<string | null>(
    null,
  );
  const [diceTab, setDiceTab] = useState<"mesa" | "historico">("mesa");
  const [diceQuantity, setDiceQuantity] = useState(1);
  const [diceBonus, setDiceBonus] = useState(0);
  const [diceHistory, setDiceHistory] = useState<
    {
      id: string;
      result: number;
      formula: string;
      timestamp: number;
      rolls?: number[];
      bonus?: number;
      isCombat?: boolean;
      hitSucceeded?: boolean;
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
    }[]
  >([]);

  // Debounced sync to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, 1000);
    return () => clearTimeout(timer);
  }, [state]);

  const [lastRoll, setLastRoll] = useState<{
    result: number;
    formula: string;
    rolls: number[];
    bonus: number;
    sides?: number;
    isCombat?: boolean;
    hitSucceeded?: boolean;
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
    defenseRolls?: number[];
    defenseResult?: number;
    combatNote?: string;
  } | null>(null);

  const getDetailedCombatTitle = useCallback((roll: any) => {
    if (!roll || !roll.isCombat) return "";
    
    if (roll.detailedTitle) return roll.detailedTitle;

    // If it has combatStatus, use it
    if (roll.combatStatus) {
      if (roll.combatStatus === 'miss') return "Errou o Golpe";
      if (roll.combatStatus === 'armor_blocked') return "Armadura defendeu";
      if (roll.combatStatus === 'weapon_blocked') return "Arma defendeu totalmente";
      if (roll.combatStatus === 'weapon_blocked_half_damage') return "Arma defendeu mas recebeu dano";
      if (roll.combatStatus === 'shield_blocked') return "Escudo defendeu totalmente";
      if (roll.combatStatus === 'shield_blocked_half_damage') return "Escudo defendeu mas recebeu dano";
      if (roll.combatStatus === 'hit_with_effect') {
        return roll.effectType ? `Acerto (com efeito de "${roll.effectType}")` : "Acerto (com efeito)";
      }
      if (roll.combatStatus === 'hit_resisted_effect') return "Acerto (Resistiu ao efeito)";
      return "Acerto";
    }

    // Fallback using text parsing from notes/formulas
    if (roll.hitSucceeded === false) {
      const note = (roll.combatNote || "").toLowerCase();
      if (note.includes("bloqueio por nível") || note.includes("bloqueado por nível") || note.includes("armadura")) {
        return "Armadura defendeu";
      }
      if (note.includes("bloqueado por escudo")) {
        return "Escudo defendeu totalmente";
      }
      if (note.includes("bloqueado com arma")) {
        return "Arma defendeu totalmente";
      }
      return "Errou o Golpe";
    }

    const note = (roll.combatNote || "").toLowerCase();
    if (note.includes("escudo sobrepujado") || note.includes("escudo defendeu mas recebeu dano")) {
      return "Escudo defendeu mas recebeu dano";
    }
    if (note.includes("defesa falhou por nível") || note.includes("recebe meio dano") || note.includes("arma defendeu mas recebeu dano")) {
      return "Arma defendeu mas recebeu dano";
    }
    if (note.includes("novo efeito:") || note.includes("membro arrancado") || note.includes("hemorragia fatal")) {
      const match = (roll.combatNote || "").match(/Novo Efeito:\s*([^\]]+)/i);
      const effectName = match ? match[1].trim() : "";
      return effectName ? `Acerto (com efeito de "${effectName}")` : "Acerto (com efeito)";
    }
    if (note.includes("resistiu")) {
      return "Acerto (Resistiu ao efeito)";
    }

    return "Acerto";
  }, []);

  const handleRollResult = useCallback((res: any) => {
    setLastRoll(res);
    setDiceHistory((prev) =>
      [
        {
          id: generateId(),
          timestamp: Date.now(),
          ...res,
        },
        ...prev,
      ].slice(0, 50),
    );

    if (activeCampaignId && res) {
      updateTableConfig(activeCampaignId, {
        lastCombatRoll: {
          ...res,
          rollId: generateId(),
          timestamp: Date.now()
        }
      });
    }
  }, [activeCampaignId]);

  // Sincronizar ataques e defesas do VTT em tempo real para todos na mesa
  const lastRollIdRef = useRef<string | null>(null);
  const isFirstCombatRollRef = useRef(true);

  useEffect(() => {
    lastRollIdRef.current = null;
    isFirstCombatRollRef.current = true;
  }, [activeCampaignId]);

  useEffect(() => {
    if (tableConfig.lastCombatRoll) {
      const roll = tableConfig.lastCombatRoll;
      if (roll.rollId && roll.rollId !== lastRollIdRef.current) {
        lastRollIdRef.current = roll.rollId;
        
        // Only pop up if it is not the first load, AND the roll is extremely recent (e.g., within 20 seconds)
        // to prevent old attacks popping up when entering/re-entering campaigns.
        const isRecent = roll.timestamp ? (Math.abs(Date.now() - roll.timestamp) < 20000) : false;
        const shouldPopup = !isFirstCombatRollRef.current && isRecent;
        isFirstCombatRollRef.current = false;

        if (shouldPopup) {
          setLastRoll(roll);
        }

        setDiceHistory((prev) => {
          if (prev.some(h => h.id === roll.rollId || (h.timestamp === roll.timestamp && (h as any).attackerName === roll.attackerName))) {
            return prev;
          }
          return [
            {
              id: roll.rollId || generateId(),
              timestamp: roll.timestamp || Date.now(),
              ...roll,
            },
            ...prev,
          ].slice(0, 50);
        });
      }
    }
  }, [tableConfig.lastCombatRoll]);

  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(null);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDesc, setNewEventDesc] = useState("");

  const [localHour, setLocalHour] = useState<string>("");
  const [localMinute, setLocalMinute] = useState<string>("");
  const [localDay, setLocalDay] = useState<string>("");
  const [localYear, setLocalYear] = useState<string>("");

  useEffect(() => {
    if (tableConfig.time) {
      setLocalHour(tableConfig.time.hour.toString());
      setLocalMinute(tableConfig.time.minute.toString().padStart(2, '0'));
    }
    if (tableConfig.date) {
      setLocalDay(tableConfig.date.day.toString());
      setLocalYear(tableConfig.date.year.toString());
    }
  }, [tableConfig.time?.hour, tableConfig.time?.minute, tableConfig.date?.day, tableConfig.date?.year]);

  const setActiveCampaignIdWithSync = (id: string | null) => {
      setActiveCampaignId(id);
      setState(prev => ({ ...prev, activeCampaignId: id }));
    };

  // Sync activeCampaignId with active character's campaignId to allow real-time campaign configuration (clock, weather, tokens) updates for players
  useEffect(() => {
    if (activeChar?.campaignId) {
      if (activeCampaignId !== activeChar.campaignId) {
        console.log(`[Campaign Sync] Automatically switching activeCampaignId to ${activeChar.campaignId} to match active character ${activeChar.nome}`);
        setActiveCampaignIdWithSync(activeChar.campaignId);
      }
    } else if (activeCampaignId && !masterCampaigns.some(c => c.id === activeCampaignId)) {
      // If the active character has no campaignId, and we are not the master of the current active campaign,
      // then we shouldn't be in an active campaign. Clear it.
      console.log(`[Campaign Sync] Clearing activeCampaignId because active character has no campaign and user is not GM of campaign`);
      setActiveCampaignIdWithSync(null);
    }
  }, [activeChar?.campaignId, activeCampaignId, masterCampaigns]);

  const advanceTime = useCallback(async (minutes: number) => {
    if (!activeCampaignId) {
      console.warn("advanceTime: No activeCampaignId");
      return;
    }

    console.log(`advanceTime: Advancing by ${minutes} minutes. Current:`, tableConfig.time, tableConfig.date);

    try {
      const current = tableConfig.time || { hour: 0, minute: 0 };
      const currentDate = tableConfig.date || { day: 1, month: 1, year: 2024 };

      let newMinute = current.minute + minutes;
      let newHour = current.hour + Math.floor(newMinute / 60);
      newMinute %= 60;

      let newDay = currentDate.day + Math.floor(newHour / 24);
      newHour %= 24;

      let newMonth = currentDate.month;
      let newYear = currentDate.year;

      let dIM = getDaysInMonth(newMonth, newYear);
      while (newDay > dIM) {
        newDay -= dIM;
        newMonth++;
        if (newMonth > 12) {
          newMonth = 1;
          newYear++;
        }
        dIM = getDaysInMonth(newMonth, newYear);
      }

      const season = getSeason(newMonth);
      const newWeather = (newDay !== currentDate.day || (minutes >= 1440)) 
        ? generateWeather(season) 
        : tableConfig.weather;

      await updateTableConfig(activeCampaignId, {
        time: { hour: newHour, minute: newMinute },
        date: { day: newDay, month: newMonth, year: newYear },
        weather: newWeather
      });
      showToast(minutes >= 1440 ? "+1 Dia" : `+${minutes}m`, "success");
    } catch (err: any) {
      console.error("Erro ao avançar tempo:", err);
      showToast("Falha na sincronização", "error");
    }
  }, [activeCampaignId, tableConfig.time, tableConfig.date, tableConfig.weather, showToast]);

  const forceCloudSync = useCallback(async () => {
    if (!user) {
      showToast("Você precisa estar logado para sincronizar.", "error");
      return;
    }
    
    showToast("Forçando sincronização com a nuvem...", "info");
    try {
      console.log("🔄 [Manual Sync] Iniciando upload forçado das fichas permitidas.");
      
      const isMasterOfCampaign = activeCampaignId && campaigns.some(c => c.id === activeCampaignId && c.masterId === user.uid);

      // 1. Filtrar e fazer upload apenas das fichas que pertencem a nós ou que somos o mestre da campanha ativa
      const allowedCharacters = state.characters.filter(char => {
        const isOwn = char.userId === user.uid || (char.userEmail && char.userEmail === user.email) || (!char.userId && !char.userEmail);
        const isCampaignNPC = isMasterOfCampaign && char.campaignId === activeCampaignId;
        return isOwn || isCampaignNPC;
      });

      const uploadPromises = allowedCharacters.map(char => {
        const charToSave = { 
          ...char, 
          // Preserve ownership if it exists, otherwise claim it
          userId: char.userId || user.uid, 
          userEmail: char.userEmail || user.email || ""
        };
        return saveCharacterToFirestore(charToSave);
      });
      
      await Promise.all(uploadPromises);
      
      // 2. Limpar flag de dirty e recarregar cache
      const updatedCache: Record<string, string> = {};
      state.characters.forEach(c => {
        updatedCache[c.id] = getSyncJson(c);
      });
      lastSyncedRef.current = updatedCache;
      
      setState(prev => ({ ...prev, dirtyCharacterIds: [] }));
      
      showToast("Tudo sincronizado! Suas outras sessões devem atualizar agora.", "success");
    } catch (error) {
      console.error("❌ [Manual Sync] Erro:", error);
      showToast("Falha ao sincronizar algumas fichas.", "error");
    }
  }, [user, state.characters, showToast, activeCampaignId, campaigns]);

  const rollDice = (
    sides: number,
    quantity: number,
    bonus: number,
    label?: string,
  ) => {
    if (!activeChar) return;
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
      const hungerBonusTemp = activeChar.bonusFomeProximaRolagem || 0;

      let hungerRoll = randomInt(1, activeChar.fome || 1);
      if (activeChar.fome < 20) hungerRoll -= 5;
      
      let thirstRoll = randomInt(1, activeChar.sede || 1);
      if (activeChar.sede < 20) thirstRoll -= 5;

      const totalHunger = hungerRoll + hungerProf + hungerBonusTemp;
      const finalHunger =
        totalHunger > activeChar.fome ? activeChar.fome : totalHunger;

      console.log("Fome e Sede roll:", { hungerRoll, thirstRoll, finalHunger, hungerBonusTemp });

      updateChar(c => ({
        fome: finalHunger,
        sede: thirstRoll,
        bonusFomeProximaRolagem: 0,
      }));

      const formula = `1d${activeChar.fome}${hungerProf > 0 ? ` + ${hungerProf}` : ""}${hungerBonusTemp !== 0 ? ` + ${hungerBonusTemp} (Bônus)` : ""} (Fome) & 1d${activeChar.sede} (Sede)`;
      const finalResult = finalHunger + thirstRoll;

      setDiceHistory((prev) =>
        [
          {
            id: generateId(),
            result: finalResult,
            formula: `Fome: ${hungerRoll}${hungerProf > 0 ? ` + ${hungerProf}` : ""}${hungerBonusTemp !== 0 ? ` + ${hungerBonusTemp} (Bônus)` : ""} = ${finalHunger}, Sede: ${thirstRoll}`,
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
        sides: 10, // Default to d10 for hunger if mixed
      });
      return;
    }

    if (label === "Cansaço") {
      let roll = randomInt(1, activeChar.cansaco || 1);
      if (activeChar.cansaco < 3) roll -= 1;
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
        sides: activeChar.cansaco,
      });
      return;
    }

    const rolls: number[] = [];
    let total = 0;
    for (let i = 0; i < quantity; i++) {
      const roll = randomInt(1, sides);
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

    setLastRoll({ result: finalResult, formula, rolls, bonus, sides });
  };

  const rollSpell = (spell: any, bonusManual: number) => {
    if (!activeChar) return;
    
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
      activeChar.bonusProficiencias?.["Acurácia"] || 0,
    );
    const totalHitBonus = (acuraciaBonus || 0) + (bonusManual || 0);

    // 2. Roll Hit (3d8)
    const hitRolls: number[] = [];
    let hitTotal = 0;
    for (let i = 0; i < 3; i++) {
      const r = randomInt(1, 8);
      hitRolls.push(r);
      hitTotal += r;
    }
    const finalHit = hitTotal + totalHitBonus;
    const hitFormula = `3d8${totalHitBonus !== 0 ? (totalHitBonus > 0 ? "+" : "") + totalHitBonus : ""}`;

    // 3. Calculate Damage Bonus from Catalyst
    const catalyst = activeChar.catalisadores?.[0];
    const catalystBonus = catalyst ? (calculateWeaponDamageBonus(catalyst as any, activeChar.stats.INT) || 0) : 0;
    const totalDmgBonus = catalystBonus + (bonusManual || 0);

    // 4. Roll Damage
    const rollData = parseAndRollDice(spell.dano || "1d6");
    const finalDmgTotal = rollData.total + totalDmgBonus;
    let finalDmgFormula = rollData.fullFormula;
    if (totalDmgBonus !== 0) {
      finalDmgFormula += ` ${totalDmgBonus > 0 ? '+' : ''}${totalDmgBonus}`;
    }

    // 5. Roll Hit Location
    const locationIdx = randomInt(0, 5);
    const locationName = HIT_LOCATIONS[locationIdx];

    // 6. Handle result
    handleRollResult({
      isCombat: true,
      hitSucceeded: true,
      armaNome: spell.nome,
      hitResult: finalHit,
      hitRolls: hitRolls,
      hitFormula: hitFormula,
      hitBonus: totalHitBonus,
      dmgResult: finalDmgTotal,
      dmgFormula: finalDmgFormula,
      dmgRolls: rollData.rolls,
      dmgBonus: totalDmgBonus + rollData.flatBonus,
      hitLocation: locationName,
    });

    // 7. Consume Mana
    if (activeChar.manaAtual >= (spell.mana || 0)) {
      updateChar({ manaAtual: activeChar.manaAtual - (spell.mana || 0) });
    } else {
      showToast("Mana insuficiente para rolar esta magia!", "error");
    }
  };

  const rollCombat = (arma: any, bonusManual: number) => {
    if (!activeChar) return;

    const nameLower = (arma.nome || "").toLowerCase();
    const isThrowable = nameLower.includes('arremesso') || nameLower.includes('shuriken');

    if (isThrowable && arma.quantidade !== undefined && arma.quantidade <= 0) {
      showToast(`Você não possui mais unidades de "${arma.nome}"!`, "error");
      return;
    }

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
      activeChar.bonusProficiencias?.["Acurácia"] || 0,
    );
    const totalHitBonus =
      (acuraciaBonus || 0) + (bonusManual || 0);

    // 2. Roll Hit (3d8)
    const hitRolls: number[] = [];
    let hitTotal = 0;
    for (let i = 0; i < 3; i++) {
      const r = randomInt(1, 8);
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

    // 4. Roll Damage using the robust utility
    let bulletDano = "1d6";
    if (arma.categoria === 'Arma de Fogo') {
      if (arma.magazineAmmo && arma.magazineAmmo.length > 0) {
        bulletDano = arma.magazineAmmo[0].dano || "1d6";
      } else {
        const loadedBullet = (activeChar.compartimentos || [])
          .filter((c: any) => !c.externo)
          .flatMap((c: any) => (c.itens || []))
          .find((i: any) => i.id === arma.bulletId);
        if (loadedBullet && loadedBullet.dano) {
          bulletDano = loadedBullet.dano;
        } 
      }
    }
    const rollData = parseAndRollDice(arma.categoria === 'Arma de Fogo' ? bulletDano : (arma.dano || "1d6"));
    
    // Add the scaling/manual bonus to the total
    const finalDmgTotal = rollData.total + totalDmgBonus;
    let finalDmgFormula = rollData.fullFormula;
    if (totalDmgBonus !== 0) {
      finalDmgFormula += ` ${totalDmgBonus > 0 ? '+' : ''}${totalDmgBonus}`;
    }

    // 4.5. Roll Hit Location (1d6)
    const locationIdx = randomInt(0, 5);
    const locationName = HIT_LOCATIONS[locationIdx];

    // 5. Update via handleRollResult
    handleRollResult({
      isCombat: true,
      hitSucceeded: true,
      armaNome: arma.nome,
      hitResult: finalHit,
      hitRolls: hitRolls,
      hitFormula: hitFormula,
      hitBonus: totalHitBonus,
      dmgResult: finalDmgTotal,
      dmgFormula: finalDmgFormula,
      dmgRolls: rollData.rolls,
      dmgBonus: totalDmgBonus + rollData.flatBonus,
      hitLocation: locationName,
    });

    if (isThrowable) {
      updateChar((c) => {
        const newArmas = c.armas.map((w) => {
          if (w.id === arma.id) {
            return {
              ...w,
              quantidade: Math.max(0, (w.quantidade || 1) - 1),
            };
          }
          return w;
        });
        return { armas: newArmas };
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (sideMenuRef.current && !sideMenuRef.current.contains(event.target as Node)) {
        setIsSideMenuOpen(false);
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
    type: "Arma" | "Catalisador" | "Armadura" | "Acessório" | "Item" | "Magia" | "Habilidade",
    data: any,
  ) => {
    let resolvedType = type;
    const dataWithTipo = { ...data, id: generateId() };

    // Automatically infer more specific clipboard type if it is "Item" but has specific tipo meta
    if (resolvedType === "Item" && dataWithTipo.tipo) {
      const t = dataWithTipo.tipo;
      if (t === "Arma") resolvedType = "Arma";
      else if (t === "Catalisador") resolvedType = "Catalisador";
      else if (t === "Armadura") resolvedType = "Armadura";
      else if (t === "Acessório" || t === "Acessórios") resolvedType = "Acessório";
    }

    if (resolvedType === "Arma") dataWithTipo.tipo = "Arma";
    if (resolvedType === "Catalisador") dataWithTipo.tipo = "Catalisador";
    if (resolvedType === "Armadura") dataWithTipo.tipo = "Armadura";
    if (resolvedType === "Acessório") dataWithTipo.tipo = "Acessório";

    setMultiClipboard([{ type: resolvedType, data: dataWithTipo }]);
    setCutItem(null);
    showToast(`${resolvedType} copiado(a)!`, "success");
  };

  const executeClipboardCut = (
    type: 'inventory' | 'weapon' | 'catalyst' | 'armor' | 'accessory',
    charId: string,
    sourceId: string,
    item: any
  ) => {
    setCutItem({ item, charId, sourceId, type });

    // Also place it in the multiClipboard to allow pasting into equipment slots!
    let clipboardType: "Arma" | "Catalisador" | "Armadura" | "Acessório" | "Item" = "Item";
    if (type === 'weapon') clipboardType = "Arma";
    else if (type === 'catalyst') clipboardType = "Catalisador";
    else if (type === 'armor') clipboardType = "Armadura";
    else if (type === 'accessory') clipboardType = "Acessório";
    else if (type === 'inventory') {
      const t = item.tipo;
      if (t === "Arma") clipboardType = "Arma";
      else if (t === "Catalisador") clipboardType = "Catalisador";
      else if (t === "Armadura") clipboardType = "Armadura";
      else if (t === "Acessório" || t === "Acessórios") clipboardType = "Acessório";
    }

    setMultiClipboard([{ type: clipboardType, data: { ...item } }]);
    showToast(`Item "${item.nome}" recortado!`, "info");
  };

  const handleCutItem = (
    type: 'inventory' | 'weapon' | 'catalyst' | 'armor' | 'accessory',
    charId: string,
    sourceId: string,
    item: any
  ) => {
    setPendingCutAction({ type, charId, sourceId, item });
  };

  const getCreaturePesoTotal = (creature: any) => {
    const armasPeso = (creature.armas || []).reduce((acc: number, w: any) => acc + (w.peso || 0), 0);
    const catalisadoresPeso = (creature.catalisadores || []).reduce((acc: number, c: any) => acc + (c.peso || 0), 0);
    const armadurasPeso = (creature.armaduras || []).reduce((acc: number, a: any) => acc + getArmorWeight(a), 0);
    const acessoriosPeso = (creature.acessorios || []).reduce((acc: number, a: any) => acc + (a.peso || 0), 0);
    
    let compPeso = 0;
    (creature.compartimentos || []).forEach((comp: any) => {
      (comp.itens || []).forEach((item: any) => {
        if (!comp.externo) {
          compPeso += getItemPeso(item) * (item.quantidade !== undefined ? item.quantidade : 1);
        }
      });
    });
    
    return armasPeso + catalisadoresPeso + armadurasPeso + acessoriosPeso + compPeso;
  };

  const handleQuickMoveToCharacterCompartment = (targetCompId: string) => {
    if (!pendingCutAction) return;
    const { type, sourceId, item } = pendingCutAction;
    
    updateChar(char => {
      let armas = [...(char.armas || [])];
      let catalisadores = [...(char.catalisadores || [])];
      let armaduras = [...(char.armaduras || [])];
      let acessorios = [...(char.acessorios || [])];
      let compartimentos = [...(char.compartimentos || [])];
      let itensGeral = [...(char.itens || [])];
      
      // 1. Remove from source
      if (type === 'weapon') {
        armas = armas.filter(w => w.id !== item.id);
      } else if (type === 'catalyst') {
        catalisadores = catalisadores.filter(c => c.id !== item.id);
      } else if (type === 'armor') {
        armaduras = armaduras.filter(a => a.id !== item.id);
      } else if (type === 'accessory') {
        acessorios = acessorios.filter(a => a.id !== item.id);
      } else if (type === 'inventory') {
        compartimentos = compartimentos.map(c => {
          if (c.id === sourceId) {
            return { ...c, itens: (c.itens || []).filter(it => it.id !== item.id) };
          }
          return c;
        });
      }
      
      // 2. Add to target compartment
      const mappedItem = {
        ...item,
        tipo: type === 'weapon' ? 'Arma' 
              : type === 'catalyst' ? 'Catalisador' 
              : type === 'armor' ? 'Armadura' 
              : type === 'accessory' ? 'Acessório' 
              : (item.tipo || 'Item')
      };
      
      compartimentos = compartimentos.map(c => {
        if (c.id === targetCompId) {
          return { ...c, itens: [...(c.itens || []), mappedItem] };
        }
        return c;
      });
      
      return {
        armas,
        catalisadores,
        armaduras,
        acessorios,
        compartimentos,
        itens: itensGeral
      };
    });
    
    showToast(`"${item.nome}" movido para mochila!`, "success");
    setPendingCutAction(null);
  };

  const handleQuickMoveToCompanion = (companionId: string) => {
    if (!pendingCutAction) return;
    const { type, sourceId, item } = pendingCutAction;
    
    updateChar(char => {
      let armas = [...(char.armas || [])];
      let catalisadores = [...(char.catalisadores || [])];
      let armaduras = [...(char.armaduras || [])];
      let acessorios = [...(char.acessorios || [])];
      let compartimentos = [...(char.compartimentos || [])];
      let tocaCreatures = [...(char.tocaCreatures || [])];
      
      // 1. Remove from source
      if (type === 'weapon') {
        armas = armas.filter(w => w.id !== item.id);
      } else if (type === 'catalyst') {
        catalisadores = catalisadores.filter(c => c.id !== item.id);
      } else if (type === 'armor') {
        armaduras = armaduras.filter(a => a.id !== item.id);
      } else if (type === 'accessory') {
        acessorios = acessorios.filter(a => a.id !== item.id);
      } else if (type === 'inventory') {
        compartimentos = compartimentos.map(c => {
          if (c.id === sourceId) {
            return { ...c, itens: (c.itens || []).filter(it => it.id !== item.id) };
          }
          return c;
        });
      }
      
      // 2. Add to companion
      const mappedItem = {
        ...item,
        quantidade: item.quantidade !== undefined ? (Number(item.quantidade) || 1) : 1,
        tipo: type === 'weapon' ? 'Arma' 
              : type === 'catalyst' ? 'Catalisador' 
              : type === 'armor' ? 'Armadura' 
              : type === 'accessory' ? 'Acessório' 
              : (item.tipo || 'Item')
      };
      
      tocaCreatures = tocaCreatures.map(creature => {
        if (creature.id === companionId) {
          const helperComps = [...(creature.compartimentos || [])];
          if (helperComps.length === 0) {
            helperComps.push({
              id: generateId(),
              nome: "Bolsa de Carga",
              volumeMax: 30,
              itens: []
            });
          }
          
          helperComps[0] = {
            ...helperComps[0],
            itens: [...(helperComps[0].itens || []), mappedItem]
          };
          
          return {
            ...creature,
            compartimentos: helperComps
          };
        }
        return creature;
      });
      
      return {
        armas,
        catalisadores,
        armaduras,
        acessorios,
        compartimentos,
        tocaCreatures
      };
    });
    
    showToast(`"${item.nome}" enviado ao companheiro!`, "success");
    setPendingCutAction(null);
  };

  const handlePasteItemToCompartment = async (targetCharId: string, targetCompId: string) => {
    if (!cutItem) return;

    // Use updateChar to handle logic safely
    updateChar(char => {
      if (char.id !== targetCharId) return {}; // Safety check if activeChar is not target

      const isSameChar = cutItem.charId === targetCharId;
      const charUpdates: any = {};

      if (isSameChar) {
        // Remove from source within the same character
        if (cutItem.type === 'weapon') {
          charUpdates.armas = (char.armas || []).filter(w => w.id !== cutItem.item.id);
        } else if (cutItem.type === 'catalyst') {
          charUpdates.catalisadores = (char.catalisadores || []).filter(c => c.id !== cutItem.item.id);
        } else if (cutItem.type === 'armor') {
          charUpdates.armaduras = (char.armaduras || []).filter(a => a.id !== cutItem.item.id);
        } else if (cutItem.type === 'accessory') {
          charUpdates.acessorios = (char.acessorios || []).filter(a => a.id !== cutItem.item.id);
        } else {
          charUpdates.compartimentos = (char.compartimentos || []).map(c => ({
            ...c,
            itens: (c.itens || []).filter(it => it.id !== cutItem.item.id)
          }));
        }

        // Add to target compartment
        const pastedItem = {
          ...cutItem.item,
          quantidade: cutItem.item.quantidade !== undefined ? (Number(cutItem.item.quantidade) || 1) : 1,
          tipo: cutItem.type === 'weapon' ? 'Arma' 
                : cutItem.type === 'catalyst' ? 'Catalisador' 
                : cutItem.type === 'armor' ? 'Armadura' 
                : cutItem.type === 'accessory' ? 'Acessório' 
                : (cutItem.item.tipo || 'Item')
        };

        const currentComps = charUpdates.compartimentos || char.compartimentos || [];
        charUpdates.compartimentos = currentComps.map((c: any) => 
          c.id === targetCompId ? { ...c, itens: [...(c.itens || []), pastedItem] } : c
        );
      } else {
        // Different character logic
        const pastedItem = {
          ...cutItem.item,
          quantidade: cutItem.item.quantidade !== undefined ? (Number(cutItem.item.quantidade) || 1) : 1,
          tipo: cutItem.type === 'weapon' ? 'Arma' 
                : cutItem.type === 'catalyst' ? 'Catalisador' 
                : cutItem.type === 'armor' ? 'Armadura' 
                : cutItem.type === 'accessory' ? 'Acessório' 
                : (cutItem.item.tipo || 'Item')
        };
        const targetComps = (char.compartimentos || []).map(c => 
          c.id === targetCompId ? { ...c, itens: [...(c.itens || []), pastedItem] } : c
        );
        return { compartimentos: targetComps };
      }

      return charUpdates;
    });

    // If it was from another character, we need to remove it from there
    if (cutItem.charId !== targetCharId) {
       const sourceChar = campaignCharacters.find(c => c.id === cutItem.charId);
       if (sourceChar) {
          const updates: any = {};
          if (cutItem.type === 'weapon') {
            updates.armas = (sourceChar.armas || []).filter(w => w.id !== cutItem.item.id);
          } else if (cutItem.type === 'catalyst') {
            updates.catalisadores = (sourceChar.catalisadores || []).filter(c => c.id !== cutItem.item.id);
          } else if (cutItem.type === 'armor') {
            updates.armaduras = (sourceChar.armaduras || []).filter(a => a.id !== cutItem.item.id);
          } else if (cutItem.type === 'accessory') {
            updates.acessorios = (sourceChar.acessorios || []).filter(a => a.id !== cutItem.item.id);
          } else {
            updates.compartimentos = (sourceChar.compartimentos || []).map(c => ({
              ...c,
              itens: (c.itens || []).filter(it => it.id !== cutItem.item.id)
            }));
          }
          await saveCharacterToFirestore({ ...sourceChar, ...updates });
       }
    }

    setCutItem(null);
    showToast("Item movido com sucesso!", "success");
  };

  const handleSendToCompanion = (companionId: string) => {
    if (!cutItem) return;

    const mappedItem = {
      ...cutItem.item,
      quantidade: cutItem.item.quantidade !== undefined ? (Number(cutItem.item.quantidade) || 1) : 1,
      tipo: cutItem.type === 'weapon' ? 'Arma' 
            : cutItem.type === 'catalyst' ? 'Catalisador' 
            : cutItem.type === 'armor' ? 'Armadura' 
            : cutItem.type === 'accessory' ? 'Acessório' 
            : (cutItem.item.tipo || 'Item')
    };

    updateChar(char => {
      let armas = [...(char.armas || [])];
      let catalisadores = [...(char.catalisadores || [])];
      let armaduras = [...(char.armaduras || [])];
      let acessorios = [...(char.acessorios || [])];
      let compartimentos = [...(char.compartimentos || [])];
      let tocaCreatures = [...(char.tocaCreatures || [])];

      // 1. Remove from source
      if (cutItem.type === 'weapon') {
        armas = armas.filter(w => w.id !== cutItem.item.id);
      } else if (cutItem.type === 'catalyst') {
        catalisadores = catalisadores.filter(c => c.id !== cutItem.item.id);
      } else if (cutItem.type === 'armor') {
        armaduras = armaduras.filter(a => a.id !== cutItem.item.id);
      } else if (cutItem.type === 'accessory') {
        acessorios = acessorios.filter(a => a.id !== cutItem.item.id);
      } else if (cutItem.type === 'inventory') {
        compartimentos = compartimentos.map(c => {
          if (c.id === cutItem.sourceId) {
            return { ...c, itens: (c.itens || []).filter(it => it.id !== cutItem.item.id) };
          }
          return c;
        });
      }

      // 2. Add as item in first compartment of the selected creature companion
      tocaCreatures = tocaCreatures.map(creature => {
        if (creature.id === companionId) {
          const companionComps = [...(creature.compartimentos || [])];
          if (companionComps.length === 0) {
            companionComps.push({
              id: generateId(),
              nome: "Bolsa Principal",
              volumeMax: 50,
              itens: []
            });
          }
          companionComps[0] = {
            ...companionComps[0],
            itens: [...(companionComps[0].itens || []), mappedItem]
          };
          return {
            ...creature,
            compartimentos: companionComps
          };
        }
        return creature;
      });

      return {
        armas,
        catalisadores,
        armaduras,
        acessorios,
        compartimentos,
        tocaCreatures
      };
    });

    setCutItem(null);
    showToast(`"${mappedItem.nome}" enviado ao companheiro!`, "success");
  };

  const handleSendToMochila = () => {
    if (!cutItem || !cutItem.companionId) return;

    const mappedItem = {
      ...cutItem.item,
      quantidade: cutItem.item.quantidade !== undefined ? (Number(cutItem.item.quantidade) || 1) : 1,
      tipo: cutItem.type === 'weapon' ? 'Arma' 
            : cutItem.type === 'catalyst' ? 'Catalisador' 
            : cutItem.type === 'armor' ? 'Armadura' 
            : cutItem.type === 'accessory' ? 'Acessório' 
            : (cutItem.item.tipo || 'Item')
    };

    updateChar(char => {
      let compartimentos = [...(char.compartimentos || [])];
      let tocaCreatures = [...(char.tocaCreatures || [])];

      // Remove from companion source
      tocaCreatures = tocaCreatures.map(creature => {
        if (creature.id === cutItem.companionId) {
          let cArmas = [...(creature.armas || [])];
          let cCatalisadores = [...(creature.catalisadores || [])];
          let cArmaduras = [...(creature.armaduras || [])];
          let cAcessorios = [...(creature.acessorios || [])];
          let cComps = [...(creature.compartimentos || [])];

          if (cutItem.type === 'weapon') {
            cArmas = cArmas.filter(w => w.id !== cutItem.item.id);
          } else if (cutItem.type === 'catalyst') {
            cCatalisadores = cCatalisadores.filter(c => c.id !== cutItem.item.id);
          } else if (cutItem.type === 'armor') {
            cArmaduras = cArmaduras.filter(a => a.id !== cutItem.item.id);
          } else if (cutItem.type === 'accessory') {
            cAcessorios = cAcessorios.filter(a => a.id !== cutItem.item.id);
          } else {
            cComps = cComps.map(c => {
              if (c.id === cutItem.sourceId) {
                return { ...c, itens: (c.itens || []).filter(it => it.id !== cutItem.item.id) };
              }
              return c;
            });
          }

          return {
            ...creature,
            armas: cArmas,
            catalisadores: cCatalisadores,
            armaduras: cArmaduras,
            acessorios: cAcessorios,
            compartimentos: cComps
          };
        }
        return creature;
      });

      // Add to character's first compartment
      if (compartimentos.length === 0) {
        compartimentos.push({
          id: generateId(),
          nome: "Mochila Principal",
          volumeMax: 50,
          itens: []
        });
      }
      compartimentos[0] = {
        ...compartimentos[0],
        itens: [...(compartimentos[0].itens || []), mappedItem]
      };

      return {
        tocaCreatures,
        compartimentos
      };
    });

    setCutItem(null);
    showToast(`"${mappedItem.nome}" mandado de volta à mochila!`, "success");
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (!selectionMode) {
      setSelectedItems(new Set());
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copySelected = (char: Character) => {
    const items: { type: any; data: any }[] = [];

    char.armas.forEach((i) => {
      if (selectedItems.has(i.id)) items.push({ type: "Arma", data: { ...i } });
    });
    char.armaduras.forEach((i) => {
      if (selectedItems.has(i.id))
        items.push({ type: "Armadura", data: { ...i } });
    });
    if (char.acessorios) {
      char.acessorios.forEach((i) => {
        if (selectedItems.has(i.id))
          items.push({ type: "Acessório", data: { ...i } });
      });
    }
    char.catalisadores.forEach((i) => {
      if (selectedItems.has(i.id))
        items.push({ type: "Catalisador", data: { ...i } });
    });
    char.compartimentos?.forEach((c) => {
      c.itens.forEach((i) => {
        if (selectedItems.has(i.id))
          items.push({ type: i.tipo || "Item", data: { ...i } });
      });
    });

    if (items.length > 0) {
      setMultiClipboard(
        items.map((it) => ({ ...it, data: { ...it.data, id: generateId() } })),
      );
      showToast(`${items.length} itens copiados!`, "success");
      setSelectionMode(false);
      setSelectedItems(new Set());
    } else {
      showToast("Nenhum item selecionado!", "info");
    }
  };

  const handlePasteSelected = async () => {
    if (multiClipboard.length === 0) return;

    updateChar((c) => {
      let newArmas = [...(c.armas || [])];
      let newArmaduras = [...(c.armaduras || [])];
      let newAcessorios = [...(c.acessorios || [])];
      let newCatalisadores = [...(c.catalisadores || [])];
      const newMagias = [...(c.magias || [])];
      const newHabilidades = [...(c.habilidades || [])];
      let newItensGeral = [...(c.itens || [])];
      let newCompartimentos = [...(c.compartimentos || [])];

      multiClipboard.forEach((item) => {
        const data = { ...item.data, id: generateId() };
        let targetType = item.type;

        if (item.type === "Item" && data.tipo) {
          if (data.tipo === "Arma") targetType = "Arma";
          else if (data.tipo === "Catalisador") targetType = "Catalisador";
          else if (data.tipo === "Armadura") targetType = "Armadura";
          else if (data.tipo === "Acessório" || data.tipo === "Acessorios") targetType = "Acessório";
        }

        if (targetType === "Arma") newArmas.push(data);
        else if (targetType === "Armadura") newArmaduras.push(data);
        else if (targetType === "Acessório") newAcessorios.push(data);
        else if (targetType === "Catalisador") newCatalisadores.push(data);
        else if (targetType === "Magia") newMagias.push(data);
        else if (targetType === "Habilidade") newHabilidades.push(data);
        else newItensGeral.push(data);
      });

      // Cleanup source item in current character if we are removing a cutItem
      if (cutItem && cutItem.charId === c.id) {
        if (cutItem.type === 'weapon') {
          newArmas = newArmas.filter(w => w.id !== cutItem.item.id);
        } else if (cutItem.type === 'catalyst') {
          newCatalisadores = newCatalisadores.filter(ct => ct.id !== cutItem.item.id);
        } else if (cutItem.type === 'armor') {
          newArmaduras = newArmaduras.filter(a => a.id !== cutItem.item.id);
        } else if (cutItem.type === 'accessory') {
          newAcessorios = newAcessorios.filter(ac => ac.id !== cutItem.item.id);
        } else if (cutItem.type === 'inventory') {
          newCompartimentos = newCompartimentos.map(comp => ({
            ...comp,
            itens: (comp.itens || []).filter(it => it.id !== cutItem.item.id)
          }));
        }
      }

      return {
        armas: newArmas,
        armaduras: newArmaduras,
        acessorios: newAcessorios,
        catalisadores: newCatalisadores,
        magias: newMagias,
        habilidades: newHabilidades,
        itens: newItensGeral,
        compartimentos: newCompartimentos,
      };
    });

    // Handle cross-character cut cleanup
    if (cutItem && cutItem.charId !== activeChar?.id) {
      const sourceChar = campaignCharacters.find(ch => ch.id === cutItem.charId);
      if (sourceChar) {
         const updates: any = {};
         if (cutItem.type === 'weapon') {
           updates.armas = (sourceChar.armas || []).filter(w => w.id !== cutItem.item.id);
         } else if (cutItem.type === 'catalyst') {
           updates.catalisadores = (sourceChar.catalisadores || []).filter(ct => ct.id !== cutItem.item.id);
         } else if (cutItem.type === 'armor') {
           updates.armaduras = (sourceChar.armaduras || []).filter(a => a.id !== cutItem.item.id);
         } else if (cutItem.type === 'accessory') {
           updates.acessorios = (sourceChar.acessorios || []).filter(ac => ac.id !== cutItem.item.id);
         } else if (cutItem.type === 'inventory') {
           updates.compartimentos = (sourceChar.compartimentos || []).map(comp => ({
             ...comp,
             itens: (comp.itens || []).filter(it => it.id !== cutItem.item.id)
           }));
         }
         await saveCharacterToFirestore({ ...sourceChar, ...updates });
      }
    }

    showToast(`${multiClipboard.length} itens colados com sucesso!`, "success");
    setMultiClipboard([]);
    setCutItem(null); // Clear cut item state
  };

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

  // Auto-save removed - handled by debounced effect above

  const updateChar = useCallback((updatesOrFn: Partial<Character> | ((c: Character) => Partial<Character>), characterId?: string) => {
    setState(prev => {
      const characters = [...prev.characters];
      
      if (tocaEditingCreatureId) {
        const parentIndex = characters.findIndex(c => (c.tocaCreatures || []).some(tc => tc.id === tocaEditingCreatureId));
        if (parentIndex !== -1) {
          const parentChar = characters[parentIndex];
          const companionIndex = (parentChar.tocaCreatures || []).findIndex(tc => tc.id === tocaEditingCreatureId);
          if (companionIndex !== -1) {
            const companion = parentChar.tocaCreatures![companionIndex];
            const empty = createEmptyCharacter();
            const comp = companion as any;
            const mockChar = {
              ...empty,
              ...comp,
              nome: comp.nome || comp.name || "Criatura da Toca",
              imagem: comp.imagem || comp.imageUrl || "",
              vidaAtual: comp.vidaAtual !== undefined ? comp.vidaAtual : (comp.hpAtual !== undefined ? comp.hpAtual : (Number(comp.maxHp) || 15)),
            } as unknown as Character;

            const updates = typeof updatesOrFn === 'function' ? updatesOrFn(mockChar) : updatesOrFn;
            
            const finalCompanion = {
              ...companion,
              ...updates,
            } as any;
            if (updates.nome !== undefined) finalCompanion.name = updates.nome;
            if (updates.imagem !== undefined) finalCompanion.imageUrl = updates.imagem;
            if (updates.vidaAtual !== undefined) {
              finalCompanion.hpAtual = updates.vidaAtual;
            }
            
            const updatedToca = [...parentChar.tocaCreatures!];
            updatedToca[companionIndex] = finalCompanion;
            
            const updatedParent = {
              ...parentChar,
              tocaCreatures: updatedToca as any
            };
            characters[parentIndex] = updatedParent;
            
            return {
              ...prev,
              characters,
              dirtyCharacterIds: Array.from(new Set([...(prev.dirtyCharacterIds || []), parentChar.id]))
            };
          }
        }
      }

      if (bestiaryEditingMonsterId) {
        const foundIndex = bestiaryMonsters.findIndex(m => m.id === bestiaryEditingMonsterId);
        if (foundIndex !== -1) {
          const monster = bestiaryMonsters[foundIndex];
          const empty = createEmptyCharacter();
          const f = monster as any;
          const mockChar = {
            ...empty,
            ...f,
            nome: f.name || f.nome || "Demônio do Bestiário",
            imagem: f.imageUrl || f.imagem || "",
            vidaAtual: f.vidaAtual !== undefined ? f.vidaAtual : (f.hpAtual !== undefined ? f.hpAtual : (Number(f.maxHp) || 20)),
          } as unknown as Character;

          const updates = typeof updatesOrFn === 'function' ? updatesOrFn(mockChar) : updatesOrFn;

          const finalMonster = {
            ...monster,
            ...updates,
          } as any;

          if (updates.nome !== undefined) finalMonster.name = updates.nome;
          if (updates.imagem !== undefined) finalMonster.imageUrl = updates.imagem;
          if (updates.vidaAtual !== undefined) {
            finalMonster.vidaAtual = updates.vidaAtual;
            finalMonster.hpAtual = updates.vidaAtual;
          }

          saveMonsterToBestiary(finalMonster).catch(err => console.error("Error updating bestiary monster:", err));
        }
        return prev;
      }

      const targetId = characterId || prev.activeCharacterId;
      const charIndex = characters.findIndex(c => c.id === targetId);
      
      if (charIndex === -1) {
        // Se pediu um ID específico mas não achamos, não fazemos nada para evitar resetar a ficha errada
        if (characterId) {
          console.warn(`updateChar: Personagem com ID ${characterId} não encontrado.`);
          return prev;
        }

        // Se ainda estiver carregando do Firestore, não criamos ficha vazia para não sobrescrever
        if (isLoadingSync) {
          console.log("updateChar: Ignorando criação pois sincronização ainda está ativa.");
          return prev;
        }

        // Se não houver personagens e não pediu ID específico, criamos um novo
        if (characters.length === 0) {
          const newChar = createEmptyCharacter();
          const updates = typeof updatesOrFn === 'function' ? updatesOrFn(newChar) : updatesOrFn;
          const updatedChar = { ...newChar, ...updates, userId: user?.uid || "" };
          
          console.log("updateChar: criando novo personagem pois não havia nenhum");
          return {
            ...prev,
            characters: [updatedChar],
            activeCharacterId: updatedChar.id,
            dirtyCharacterIds: Array.from(new Set([...(prev.dirtyCharacterIds || []), updatedChar.id]))
          };
        }

        // Se houver personagens mas o ID ativo não foi encontrado, evitamos o default para o index 0
        // para não sobrescrever dados de outro personagem por engano.
        console.warn(`updateChar: Personagem ativo ${targetId} não encontrado no estado local.`);
        return prev;
      }

      const charToUpdate = characters[charIndex];
      const updates = typeof updatesOrFn === 'function' ? updatesOrFn(charToUpdate) : updatesOrFn;
      
      // Auto-assign userId if logged in and missing - Use a local check for the user to avoid stale closure
      // but we need to know the current user. Since this is a callback, 
      // we should ideally have user in dependencies or use auth.currentUser
      const currentUser = auth.currentUser;
      const uidFromUpdates = (updates as any).userId;
      if (currentUser && !charToUpdate.userId && !uidFromUpdates) {
        (updates as any).userId = currentUser.uid;
        (updates as any).userEmail = currentUser.email || "";
      }

      const hasChanges = Object.entries(updates).some(([key, value]) => {
        return JSON.stringify(charToUpdate[key as keyof Character]) !== JSON.stringify(value);
      });

      if (!hasChanges) return prev;

      const updatedChar = { ...charToUpdate, ...updates };
      characters[charIndex] = updatedChar;

      console.log(`updateChar: atualizando personagem ${updatedChar.nome}`);
      
      return {
        ...prev,
        characters,
        dirtyCharacterIds: Array.from(new Set([...(prev.dirtyCharacterIds || []), updatedChar.id]))
      };
    });
  }, [tocaEditingCreatureId, bestiaryEditingMonsterId, bestiaryMonsters]); // auth.currentUser is imported from lib/firebase so it's always fresh enough

  const handleAddItemToCharacterCompartment = useCallback((characterId: string, compartmentId: string, item: Item) => {
    updateChar(char => {
      const comps = char.compartimentos || [];
      const compIdx = comps.findIndex(c => c.id === compartmentId);
      if (compIdx === -1) return {};
      
      const targetComp = comps[compIdx];
      const newItens = [
        ...(targetComp.itens || []),
        {
          ...item,
          id: generateId()
        }
      ];
      
      return {
        compartimentos: comps.map((c, i) => i === compIdx ? { ...c, itens: newItens } : c)
      };
    }, characterId);
  }, [updateChar]);

  const handleAddSpellToCharacter = useCallback((characterId: string, spell: Spell) => {
    updateChar(char => {
      const currentMagias = char.magias || [];
      const newMagias = [
        ...currentMagias,
        {
          ...spell,
          id: generateId()
        }
      ];
      return {
        magias: newMagias
      };
    }, characterId);
  }, [updateChar]);

  // Sync with Firestore Refs
  const lastSyncedRef = useRef<Record<string, string>>({}); // id -> JSON string
  const syncTimersRef = useRef<Record<string, NodeJS.Timeout>>({});

  const handleAddCharacter = useCallback((newChar: Character) => {
    setState(prev => {
      return {
        ...prev,
        characters: [...prev.characters, newChar],
      };
    });

    // Save/Sync immediately with Firestore to prevent any timing issues with VTT Board tokens
    try {
      const charJson = getSyncJson(newChar);
      lastSyncedRef.current[newChar.id] = charJson;
      saveCharacterToFirestore(newChar).then(() => {
        console.log(`✅ [AddCharacter] Ficha ${newChar.nome} enviada imediatamente para Firestore.`);
      }).catch(err => {
        console.error(`❌ [AddCharacter] Erro ao salvar ficha imediatamente:`, err);
      });
    } catch (err) {
      console.error(`[AddCharacter] Erro ao processar/guardar ficha imediatamente:`, err);
    }

    showToast(`Ficha ${newChar.nome} criada com sucesso!`, "success");
  }, [showToast]);

  useEffect(() => {
    if (!user) {
      // Clear all timers if no user
      Object.entries(syncTimersRef.current).forEach(([_, t]) => clearTimeout(t));
      syncTimersRef.current = {};
      return;
    }
    
    if (isFirebaseQuotaExceeded()) {
      console.log("📡 [Sincronização Nuvem] Pausada temporariamente devido ao limite de cota de escrita diária excedido no Firebase. Suas fichas continuarão salvando localmente (LocalStorage) e serão enviadas para a nuvem assim que a cota for restaurada/redefinida.");
      return;
    }

    const dirtyIds = new Set(state.dirtyCharacterIds || []);
    const characters = state.characters;
    
    characters.forEach(char => {
      if (dirtyIds.has(char.id)) {
        const isMasterOfCharCampaign = char.campaignId && campaigns.some(c => c.id === char.campaignId && c.masterId === user.uid);
        const isOwn = char.userId === user.uid || (char.userEmail && char.userEmail === user.email) || (!char.userId && !char.userEmail) || isMasterOfCharCampaign;
        
        if (!isOwn) {
          // Se não é nossa ficha (e.g. criatura do mestre na campanha ou ficha de outro jogador),
          // limpamos do dirty pois não temos permissão e nem responsabilidade de sincronizá-la aqui.
          setState(prev => {
            const currentDirty = prev.dirtyCharacterIds || [];
            if (!currentDirty.includes(char.id)) return prev;
            return { ...prev, dirtyCharacterIds: currentDirty.filter(id => id !== char.id) };
          });
          return;
        }

        const charJson = getSyncJson(char);
        
        if (lastSyncedRef.current[char.id] === charJson) {
           // Se já coincide com o que sabemos que foi enviado ou recebido, removemos o dirty flag
           setState(prev => {
             const currentDirty = prev.dirtyCharacterIds || [];
             if (!currentDirty.includes(char.id)) return prev;
             return { ...prev, dirtyCharacterIds: currentDirty.filter(id => id !== char.id) };
           });
        } else {
          // Debounce: limpa timer anterior se existir
          if (syncTimersRef.current[char.id]) {
            clearTimeout(syncTimersRef.current[char.id]);
          }

          // Novo timer para sincronizar este personagem específico
          syncTimersRef.current[char.id] = setTimeout(async () => {
            if (deletedCharsRef.current.has(char.id)) {
              console.log(`🛑 [Sync] Abortando upload de ${char.nome} porque já foi marcado como deletado.`);
              delete syncTimersRef.current[char.id];
              return;
            }
            try {
              console.log(`📡 [Sync] Enviando ${char.nome} para nuvem...`);
              await saveCharacterToFirestore(char);
              lastSyncedRef.current[char.id] = charJson;
              
              // Sucesso: remove dirty flag
              setState(prev => {
                const currentDirty = prev.dirtyCharacterIds || [];
                if (!currentDirty.includes(char.id)) return prev;
                return { ...prev, dirtyCharacterIds: currentDirty.filter(id => id !== char.id) };
              });
            } catch (err) {
              console.error(`❌ [Sync] Erro ao sincronizar ${char.nome}:`, err);
            } finally {
              delete syncTimersRef.current[char.id];
            }
          }, 1500); // 1.5s delay
        }
      }
    });

    // Limpeza de IDs orfãos no dirtyCharacterIds e cancelamento de timers de fichas removidas
    const missingCharacterIds = (state.dirtyCharacterIds || []).filter(id => 
      !characters.some(c => c.id === id)
    );
    
    if (missingCharacterIds.length > 0) {
      console.log(`🧹 [Sync] Limpando dados de fichas removidas: ${missingCharacterIds.join(', ')}`);
      missingCharacterIds.forEach(id => {
        if (syncTimersRef.current[id]) {
          console.log(`🛑 [Sync] Cancelando upload pendente da ficha ${id} (removida)`);
          clearTimeout(syncTimersRef.current[id]);
          delete syncTimersRef.current[id];
        }
      });
      
      setState(prev => ({
        ...prev,
        dirtyCharacterIds: (prev.dirtyCharacterIds || []).filter(id => !missingCharacterIds.includes(id))
      }));
    }
  }, [state.characters, state.dirtyCharacterIds, user, campaigns]);

  // Global cleanup for unmount
  useEffect(() => {
    return () => {
      Object.entries(syncTimersRef.current).forEach(([_, t]) => clearTimeout(t));
    };
  }, []);

  // Sync userEmail if missing
  useEffect(() => {
    if (user && activeChar && !activeChar.userEmail && activeChar.userId === user.uid) {
      // Usar a flag silent ou verificar antes de disparar
      const email = user.email || "";
      if (activeChar.userEmail !== email) {
        console.log("Auto-sync: Atualizando email do usuário na ficha.");
        updateChar({ userEmail: email });
      }
    }
  }, [user?.email, activeChar?.id, activeChar?.userEmail, activeChar?.userId, updateChar]);

  const allAvailableCharacters = useMemo(() => {
    const map = new Map<string, Character>();
    // Prioritize campaign characters (remote) over local characters
    [...state.characters, ...campaignCharacters].forEach(c => {
      if (c && c.id) map.set(c.id, c);
    });
    return Array.from(map.values());
  }, [campaignCharacters, state.characters]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [globalConfirm, setGlobalConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Helper to parse creature/monster stats from their bonus, hp, esquiva, acuracia
  const parseMonsterStats = useCallback((bonusStr: string | undefined, maxHp: number, esquiva: number, acuracia: number) => {
    const stats = { CON: 0, RES: 0, ADP: 0, MEN: 0, APR: 0, FOR: 0, DEX: 0, INT: 0, RIT: 0 };
    
    // Base stats on Max HP (CON)
    const conVal = Math.max(0, Math.floor((maxHp - 15) / 5));
    stats.CON = conVal;
    stats.RES = Math.max(0, Math.floor((maxHp - 15) / 10)); // approximate resistance

    // Set DEX based on esquiva or acuracia
    stats.DEX = Math.max(Number(esquiva) || 0, Number(acuracia) || 0) * 2;

    if (bonusStr) {
      const regex = /([+-]?\d+)\s+([A-Za-zÇçÁáÉéÍíÓóÚúâêîôûãõ]+)/g;
      let match;
      while ((match = regex.exec(bonusStr)) !== null) {
        const val = parseInt(match[1]);
        const name = match[2].toLowerCase();
        if (name.includes("for") || name.includes("força")) {
          stats.FOR = val;
        } else if (name.includes("dex") || name.includes("destreza") || name.includes("agilidade")) {
          stats.DEX = val;
        } else if (name.includes("int") || name.includes("inteligência") || name.includes("conhecimento")) {
          stats.INT = val;
        } else if (name.includes("rit") || name.includes("ritual") || name.includes("magia")) {
          stats.RIT = val;
        } else if (name.includes("con") || name.includes("constituição") || name.includes("vida")) {
          stats.CON = val;
        } else if (name.includes("res") || name.includes("resistência") || name.includes("defesa")) {
          stats.RES = val;
        } else if (name.includes("men") || name.includes("mental") || name.includes("sanidade")) {
          stats.MEN = val;
        } else if (name.includes("apr") || name.includes("aprendizado")) {
          stats.APR = val;
        } else if (name.includes("adp") || name.includes("adaptação") || name.includes("clima")) {
          stats.ADP = val;
        }
      }
    }
    return stats;
  }, []);

  const isCreatureMode = tocaEditingCreatureId !== null || bestiaryEditingMonsterId !== null;

  // Derived Values - Moved up before early returns to fix Rules of Hooks
  const { stats, vidaMax, manaMax, sanidadeMax, cargaMax, deslocamentoBase } = useMemo(() => {
    let s = activeChar?.stats || createEmptyCharacter().stats;
    let vMax = getVidaMaxima(s.CON);

    if (activeChar && isCreatureMode) {
      const maxHpNum = Number((activeChar as any).maxHp) || Number((activeChar as any).vidaMaxima) || 15;
      const esq = Number((activeChar as any).esquiva) || 0;
      const acur = Number((activeChar as any).acuracia) || 0;
      const parsedStats = parseMonsterStats((activeChar as any).bonus, maxHpNum, esq, acur);
      
      // Merge parsedStats into stats
      s = { ...s, ...parsedStats };
      vMax = maxHpNum;
    }

    const bonusCarga = activeChar?.bonusCarga || 0;
    return {
      stats: s,
      vidaMax: vMax,
      manaMax: getManaMaxima(s.APR),
      sanidadeMax: getSanidadeMaxima(s.MEN),
      cargaMax: getCargaMaxima(s.RES) + (bonusCarga * 10),
      deslocamentoBase: activeChar ? getDeslocamentoBase(
        s.DEX,
        activeChar.efeitosNegativos || [],
        activeChar.fome ?? 100,
        activeChar.sede ?? 100,
        activeChar.clima,
        climateProficiency
      ) : 0
    };
  }, [activeChar, isCreatureMode, climateProficiency, parseMonsterStats]);

  const compartimentos = activeChar?.compartimentos || [];
  const armas = activeChar?.armas || [];
  const catalisadores = activeChar?.catalisadores || [];
  const armaduras = activeChar?.armaduras || [];
  const acessorios = activeChar?.acessorios || [];

  const { pesoTotal, penalties, survivalPenalties, deslocamentoFinal } = useMemo(() => {
    const invTotals = calculateInventoryTotals(compartimentos);
    const weaponPeso = armas.reduce((acc, w) => acc + (w.peso || 0), 0);
    const catalystPeso = catalisadores.reduce((acc, c) => acc + (c.peso || 0), 0);
    const armorPeso = armaduras.reduce((acc, a) => acc + getArmorWeight(a), 0);
    const accessoryPeso = acessorios.reduce((acc, a) => acc + (a.peso || 0), 0);
    const total = invTotals.peso + weaponPeso + catalystPeso + armorPeso + accessoryPeso;
    
    const p = getLoadPenalties(total, cargaMax);
    const s = getSurvivalPenalties(activeChar?.fome ?? 100, activeChar?.sede ?? 100);
    const d = Math.max(
      0,
      Math.floor(deslocamentoBase * p.deslocamentoMult) + s.movement,
    );

    return { pesoTotal: total, penalties: p, survivalPenalties: s, deslocamentoFinal: d };
  }, [compartimentos, armas, catalisadores, armaduras, acessorios, cargaMax, deslocamentoBase, activeChar?.fome, activeChar?.sede]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="relative mb-8">
          <div className="w-20 h-20 border-4 border-amber-500/10 border-t-amber-500 rounded-full animate-spin"></div>
          <Skull className="absolute inset-x-0 inset-y-0 m-auto w-8 h-8 text-amber-500 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2 uppercase tracking-widest">Iniciando Sistema</h2>
        <p className="text-zinc-500 text-sm max-w-xs animate-pulse">
          Estamos sintonizando as energias do plano astral. Por favor, aguarde...
        </p>
        
        <button 
          onClick={() => setAuthLoading(false)}
          className="mt-8 text-[10px] text-zinc-700 hover:text-zinc-500 uppercase font-black tracking-widest transition-colors"
        >
          Pular Carregamento
        </button>
      </div>
    );
  }

  if (authError) {
    const isIframe = window.top !== window.self;
    const isMissingState = authError.includes('missing initial state');
    
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-red-500/50 rounded-2xl p-8 text-center space-y-4">
          <Skull className="w-12 h-12 text-red-500 mx-auto" />
          <h1 className="text-xl font-bold text-white uppercase tracking-tighter">Sincronização Interrompida</h1>
          
          <div className="text-zinc-400 text-sm leading-relaxed space-y-2">
            <p>
              {isMissingState 
                ? "O navegador do seu dispositivo bloqueou a conexão segura com o Google para proteger seus dados."
                : authError}
            </p>
            {isMissingState && (
              <p className="text-zinc-500 text-xs italic">
                Isso é comum em aplicativos "Webview". Tente habilitar "Cookies de Terceiros" nas configurações do seu navegador padrão.
              </p>
            )}
          </div>
          
          {isIframe && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-amber-200 text-xs text-left mb-4">
              <p className="font-bold mb-1 italic">Nota do Sistema:</p>
              Você está acessando através de um quadro (Iframe). Clique no ícone superior de "Abrir em nova Janela" para resolver conflitos de login.
            </div>
          )}

          <div className="flex flex-col gap-2 pt-4">
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-zinc-100 text-zinc-900 hover:bg-white rounded-xl transition-colors font-bold uppercase tracking-widest text-xs"
            >
              Recarregar Aplicativo
            </button>
            
            <button 
              onClick={() => {
                auth.signOut().then(() => {
                  window.location.reload();
                });
              }}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors font-medium text-xs"
            >
              Limpar Sessão e Tentar Novamente
            </button>

            <button 
              onClick={() => {
                setAuthError(null);
                setAuthLoading(false);
              }}
              className="w-full py-2 text-zinc-600 hover:text-zinc-400 text-[10px] uppercase font-black tracking-widest"
            >
              Ignorar e usar Offline
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeChar) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

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
      showToast("Erro ao exportar. Tente abrir em nova aba.", "error");
    }
  };

  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawResult = event.target?.result as string;
        const json = JSON.parse(rawResult);
        
        let charsToImport: any[] = [];
        
        if (Array.isArray(json)) {
          // If it's an array, assume it's an array of characters
          charsToImport = json;
        } else if (json.characters && Array.isArray(json.characters)) {
          // If it's a full state object
          charsToImport = json.characters;
        } else if (json.nome || json.id) {
          // If it's a single character object
          charsToImport = [json];
        } else {
          throw new Error("Formato de arquivo não reconhecido.");
        }

        const sanitizedChars = charsToImport.map(c => {
          const sanitized = sanitizeCharacter(c);
          sanitized.id = generateId(); // New ID for safety
          
          // Assign ownership to the importing user
          if (user) {
            sanitized.userId = user.uid;
            sanitized.userEmail = user.email || "";
          }
          
          return sanitized;
        });

        if (sanitizedChars.length === 0) {
          throw new Error("Nenhum personagem encontrado no arquivo.");
        }

        setState((prev) => ({
          ...prev,
          characters: [...prev.characters, ...sanitizedChars],
          activeCharacterId: sanitizedChars[sanitizedChars.length - 1].id,
          dirtyCharacterIds: Array.from(new Set([...(prev.dirtyCharacterIds || []), ...sanitizedChars.map(c => c.id)]))
        }));
        
        if (user) {
          sanitizedChars.forEach(c => {
            saveCharacterToFirestore(c);
            lastSyncedRef.current[c.id] = JSON.stringify(c);
          });
        }
        
        showToast(sanitizedChars.length === 1 ? "Ficha importada com sucesso!" : `${sanitizedChars.length} fichas importadas com sucesso!`, "success");
      } catch (err: any) {
        console.error("Erro ao importar JSON:", err);
        showToast(err.message || "Erro ao importar ficha.", "error");
      } finally {
        // Reset the input value so the same file can be selected again
        e.target.value = "";
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
      ...prev,
      characters: [...prev.characters, newChar],
      activeCharacterId: newChar.id,
    }));
    
    // Sync to Firestore if logged in
    if (user) {
      saveCharacterToFirestore(newChar);
    }
  };

  const deleteChar = () => {
    if (state.characters.length <= 1) return;
    const idToDelete = state.activeCharacterId;
    
    if (idToDelete) {
      deletedCharsRef.current.add(idToDelete);
      const charToDelete = state.characters.find(c => c.id === idToDelete);
      const campaignId = charToDelete?.campaignId;
      if (campaignId) {
        try {
          const storedKey = `campaign_characters_${campaignId}`;
          const stored = localStorage.getItem(storedKey);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              const filtered = parsed.filter((c: any) => c.id !== idToDelete);
              localStorage.setItem(storedKey, JSON.stringify(filtered));
            }
          }
        } catch (e) {
          console.error("Error cleaning up deleted char from campaign cache:", e);
        }
      }
      // Cancel any pending sync timers before deleting to prevent race condition uploads
      if (syncTimersRef.current[idToDelete]) {
        console.log(`🛑 [deleteChar] Cancelando upload pendente do personagem de ID ${idToDelete} antes da remoção`);
        clearTimeout(syncTimersRef.current[idToDelete]);
        delete syncTimersRef.current[idToDelete];
      }
    }

    setState((prev) => {
      const remaining = prev.characters.filter(
        (c) => c.id !== idToDelete,
      );
      const newActiveId = remaining.length > 0 ? remaining[0].id : null;
      const newDirtyIds = (prev.dirtyCharacterIds || []).filter(id => id !== idToDelete);
      
      return {
        ...prev,
        characters: remaining,
        activeCharacterId: newActiveId,
        dirtyCharacterIds: newDirtyIds
      };
    });
    
    // Sync to Firestore if logged in
    if (user && idToDelete) {
      deleteCharacterFromFirestore(idToDelete);
    }
    
    setShowDeleteConfirm(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const result = event.target?.result as string;
        const compressed = await compressImageDataUrl(result, 512, 0.7);
        updateChar({ imagem: compressed });
      } catch (error) {
        console.error("Erro ao comprimir imagem:", error);
        updateChar({ imagem: event.target?.result as string });
      }
    };
    reader.readAsDataURL(file);
  };

  console.log("Renderizando App. User:", user?.email, "Chars:", state.characters.length);

  const isFullScreenPage = activePage === "table" || activePage === "dice" || activePage === "master";

  return (
    <div className={cn(
      "w-full bg-zinc-950 text-zinc-100 font-sans selection:bg-amber-500/30 flex flex-col",
      activePage === "table" ? "h-screen fixed inset-0 overflow-hidden touch-none" :
      isFullScreenPage ? "h-screen overflow-hidden" : "min-h-screen overflow-x-hidden"
    )}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative" ref={sideMenuRef}>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsSideMenuOpen(!isSideMenuOpen)}
              className={cn(
                "w-10 h-10 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-full transition-all border border-zinc-700 shadow-lg",
                isSideMenuOpen && "border-amber-500 shadow-amber-500/10"
              )}
            >
              <Menu size={20} className={isSideMenuOpen ? "text-amber-500" : "text-zinc-400"} />
            </motion.button>

            {/* Side Navigation Menu (Retractable) */}
            <AnimatePresence>
              {isSideMenuOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsSideMenuOpen(false)}
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[55] lg:hidden"
                  />
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    className="absolute left-0 top-full mt-3 w-60 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-2 z-[60] space-y-1 max-h-[calc(100vh-100px)] overflow-y-auto scrollbar-none"
                  >
                    <div className="px-2 pb-2 mb-2 border-b border-zinc-800/50 flex items-center justify-between">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Navegação</span>
                      <span className="text-[9px] font-black text-zinc-600 uppercase tracking-tighter opacity-50">v16.4</span>
                    </div>

                    <div className="grid grid-cols-1 gap-1">
                      <MenuButton 
                        active={activePage === "library"} 
                        onClick={() => { setActivePage("library"); setIsSideMenuOpen(false); }}
                        icon={<Library size={20} />}
                        label="Biblioteca"
                        color="amber"
                      />
                      <MenuButton 
                        active={activePage === "sheet"} 
                        onClick={() => { setActivePage("sheet"); setIsSideMenuOpen(false); }}
                        icon={<UserIcon size={20} />}
                        label="Ficha"
                        color="amber"
                      />
                      <MenuButton 
                        active={activePage === "dice"} 
                        onClick={() => { setActivePage("dice"); setIsSideMenuOpen(false); }}
                        icon={<Dices size={20} />}
                        label="Dados"
                        color="amber"
                      />
                      <MenuButton 
                        active={activePage === "notes"} 
                        onClick={() => { setActivePage("notes"); setIsSideMenuOpen(false); }}
                        icon={<FileText size={20} />}
                        label="Notas"
                        color="amber"
                      />
                      <MenuButton 
                        active={activePage === "gallery"} 
                        onClick={() => { setActivePage("gallery"); setIsSideMenuOpen(false); }}
                        icon={<Image size={20} />}
                        label="Galeria"
                        color="amber"
                      />
                      <MenuButton 
                        active={activePage === "toca"} 
                        onClick={() => { setActivePage("toca"); setIsSideMenuOpen(false); }}
                        icon={<PawPrint size={20} />}
                        label="Toca"
                        color="amber"
                      />
                      <MenuButton 
                        active={activePage === "items"} 
                        onClick={() => { setActivePage("items"); setIsSideMenuOpen(false); }}
                        icon={<Package size={20} />}
                        label="Itens"
                        color="amber"
                      />
                      <MenuButton 
                        active={activePage === "spells"} 
                        onClick={() => { setActivePage("spells"); setIsSideMenuOpen(false); }}
                        icon={<Wand2 size={20} />}
                        label="Magias"
                        color="amber"
                      />
                      
                      <div className="my-1 border-t border-zinc-800/50" />
                      
                      <MenuButton 
                        active={activePage === "master"} 
                        onClick={() => { setActivePage("master"); setIsSideMenuOpen(false); }}
                        icon={<Shield size={20} />}
                        label="Mestre"
                        color="purple"
                      />

                      {campaigns.some(c => c.masterId === user?.uid) && (
                        <>
                          <MenuButton 
                            active={activePage === "bestiary"} 
                            onClick={() => { setActivePage("bestiary"); setIsSideMenuOpen(false); }}
                            icon={<Skull size={20} />}
                            label="Bestiário"
                            color="red"
                          />
                          <MenuButton 
                            active={activePage === "materials"} 
                            onClick={() => { setActivePage("materials"); setIsSideMenuOpen(false); }}
                            icon={<Hammer size={20} />}
                            label="Materiais"
                            color="orange"
                          />
                        </>
                      )}

                      {activeCampaignId && (
                        <MenuButton 
                          active={activePage === "table"} 
                          onClick={() => { setActivePage("table"); setIsSideMenuOpen(false); }}
                          icon={<Maximize size={20} />}
                          label="Mesa de Jogo"
                          color="blue"
                        />
                      )}

                      <div className="my-1 border-t border-zinc-800/20" />

                      <MenuButton 
                        active={activePage === "oracle"} 
                        onClick={() => { setActivePage("oracle"); setIsSideMenuOpen(false); }}
                        icon={<Sparkles size={20} className="text-amber-500" />}
                        label="Oráculo"
                        color="amber"
                      />
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Version Badge - Always visible on top bar */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950/50 border border-zinc-800/80 rounded-xl">
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none">Demons Despair</span>
            <div className="w-[1px] h-3 bg-zinc-800" />
            <span className="text-[10px] font-black text-zinc-400 font-mono leading-none">v18.2</span>
          </div>

          {/* Quick Active Page Status - desktop only */}
          <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-zinc-950/50 border border-zinc-800 rounded-2xl min-w-[140px]">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest leading-none">Página Atual</span>
                <span className="text-[9px] font-bold text-zinc-800 uppercase tracking-tighter mt-0.5">v18.2</span>
              </div>
              <div className="flex items-center gap-2 ml-1">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  activePage === "master" ? "bg-purple-500" :
                  activePage === "table" ? "bg-blue-500" :
                  activePage === "bestiary" ? "bg-red-500" : "bg-amber-500"
                )} />
                <span className="text-sm font-bold text-white capitalize">{activePage}</span>
              </div>
          </div>
        </div>

        <div className="flex items-center gap-2 relative" ref={menuRef}>
          {/* Real-time Game Clock (Global) */}
          {activeCampaignId && (
            <div className="hidden md:flex items-center gap-4 px-4 py-2 bg-zinc-950/95 border border-zinc-800/80 rounded-2xl mr-4 shadow-2xl backdrop-blur-md">
              {/* Season & Weather */}
              <div className="flex items-center gap-2 border-r border-zinc-800/60 pr-3">
                <div 
                  className="w-8 h-8 bg-zinc-900/50 rounded-lg flex items-center justify-center text-lg border border-zinc-800/50 shadow-inner cursor-help"
                  title={`Estação: ${getSeason(tableConfig.date?.month || 1)}`}
                >
                  {getSeasonIcon(getSeason(tableConfig.date?.month || 1))}
                </div>
                <div 
                  className="w-8 h-8 bg-zinc-900/50 rounded-lg flex items-center justify-center text-lg border border-zinc-800/50 shadow-inner cursor-help"
                  title={`Clima Atual: ${tableConfig.weather || "Céu limpo"}`}
                >
                  {(() => {
                    const w = tableConfig.weather || "Céu limpo";
                    const h = tableConfig.time?.hour ?? 0;
                    const isNight = h >= 18 || h < 6;
                    if (w === 'Céu limpo') return isNight ? '🌌' : '☀️';
                    if (w === 'Céu nublado') return '☁️';
                    if (w === 'Chuvoso') return '🌧️';
                    if (w === 'Onda de calor') return '🔥';
                    return '❄️';
                  })()}
                </div>
              </div>

              {/* Time and Date */}
              <div className="flex flex-col items-end border-r border-zinc-800/60 pr-3">
                <span className="text-sm font-black text-amber-500 font-mono tracking-tighter flex items-center gap-1">
                  <span className="text-zinc-500 text-[9px] uppercase font-black tracking-wider mr-0.5">Hora:</span>
                  {formatTime(tableConfig.time?.hour ?? 0, tableConfig.time?.minute ?? 0)}
                </span>
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                  {formatDate(tableConfig.date?.day || 1, tableConfig.date?.month || 1, tableConfig.date?.year || 2024)}
                </span>
              </div>

              {/* Moon Phase */}
              {(() => {
                const moon = getMoonPhase(tableConfig.date?.day || 1);
                return (
                  <div className="flex items-center gap-2 cursor-help select-none" title={`${moon.name}: ${moon.description}`}>
                    <span className="text-lg leading-none">{moon.icon}</span>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest leading-none">Lua</span>
                      <span className="text-[10px] font-bold text-zinc-300 whitespace-nowrap mt-0.5">{moon.name}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Character Sync Indicator */}
          {user && (
            <div className="flex items-center gap-1">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={forceCloudSync}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-lg border transition-all",
                  state.dirtyCharacterIds.length > 0 
                    ? "bg-blue-500 border-blue-400 text-black shadow-[0_0_15px_rgba(59,130,246,0.4)]" 
                    : "bg-zinc-800/50 border-zinc-700/50 text-zinc-500 hover:text-amber-500 hover:border-amber-500/30"
                )}
                title={state.dirtyCharacterIds.length > 0 ? "Sincronizando..." : "Sincronizar"}
              >
                <RefreshCwIcon className={cn("w-4 h-4", state.dirtyCharacterIds.length > 0 && "animate-spin")} />
              </motion.button>
              
              {state.dirtyCharacterIds.length > 0 && (
                <button
                  onClick={() => {
                    setGlobalConfirm({
                      title: "Limpar Cache de Sincronização",
                      message: "Isso irá limpar o cache local e forçar o carregamento total do servidor. Dados não sincronizados serão perdidos. Prosseguir?",
                      onConfirm: () => {
                        clearFirestoreCache();
                        setGlobalConfirm(null);
                      }
                    });
                  }}
                  className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-colors"
                  title="Resetar cache de sincronização (Use se estiver travado)"
                >
                  <Skull className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Firebase Auth Indicator */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileTap={{ scale: 0.95 }}
            onClick={async () => {
              if (user) {
                firebaseLogout();
              } else {
                try {
                  await loginWithGoogle();
                } catch (error: any) {
                  showToast("Erro ao iniciar login.", "error");
                  console.error("Login Error:", error);
                }
              }
            }}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg border transition-all",
              user 
                ? (isOnline ? "bg-amber-500/10 border-amber-500/30" : "bg-red-500/10 border-red-500/30")
                : "bg-zinc-800 border-zinc-700"
            )}
            title={user ? (isOnline ? `Conectado: ${user.email} (Clique para Sair)` : "Você está offline") : "Entrar com Firebase"}
          >
            <div className={cn(
              "w-2.5 h-2.5 rounded-full",
              user ? (isOnline ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500") : "bg-zinc-600"
            )} />
          </motion.button>

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
                Troca Rápida
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
                // Clear dirty flags and force refresh from firestore by clearing lastSynced
                lastSyncedRef.current = {};
                setState(prev => ({ ...prev, dirtyCharacterIds: [] }));
                window.location.reload();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium text-zinc-300"
            >
              <RefreshCwIcon size={18} className="text-blue-500" /> Forçar Sincronização
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const nc = createEmptyCharacter();
                setState((prev) => ({
                  characters: [...prev.characters, nc],
                  activeCharacterId: nc.id,
                }));
                if (user) {
                  saveCharacterToFirestore(nc);
                }
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
          {globalConfirm && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-zinc-950 border border-zinc-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl space-y-4 font-sans"
              >
                <h3 className="font-black text-sm uppercase text-amber-500 flex items-center gap-1.5 border-b border-zinc-800/60 pb-2">
                  {globalConfirm.title}
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed font-semibold">
                  {globalConfirm.message}
                </p>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setGlobalConfirm(null)}
                    className="px-3.5 py-2 bg-zinc-900 border border-zinc-805 hover:bg-zinc-850 rounded-xl text-[10px] font-black uppercase tracking-wider text-zinc-400 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => globalConfirm.onConfirm()}
                    className="px-4 py-2 bg-red-650 hover:bg-red-650/85 rounded-xl text-[10px] font-black uppercase tracking-wider text-white transition-all cursor-pointer shadow-lg shadow-red-950/20"
                  >
                    Confirmar
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {showDeleteConfirm && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl max-w-sm w-full shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
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

          {activeChar && pendingCutAction && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-md w-full shadow-2xl relative"
              >
                <button
                  type="button"
                  onClick={() => setPendingCutAction(null)}
                  className="absolute top-4 right-4 text-zinc-500 hover:text-white"
                >
                  <X size={18} />
                </button>
                
                <h3 className="text-base font-black uppercase text-amber-500 flex items-center gap-2 mb-2">
                  <Scissors size={18} />
                  Mover Item: {pendingCutAction.item.nome}
                </h3>
                
                <p className="text-xs text-zinc-400 mb-6 font-medium leading-relaxed">
                  Escolha o destino deste item. Você pode enviá-lo diretamente para a bolsa de um companheiro na Toca, para uma mochila (compartimento) do seu personagem, ou apenas recortá-lo para colar manualmente.
                </p>
                
                <div className="space-y-4">
                  {/* Mandar para Mochila do Personagem */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">🧳 Suas Mochilas / Compartimentos</span>
                    {activeChar.compartimentos && activeChar.compartimentos.length > 0 ? (
                      <div className="grid grid-cols-1 gap-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                        {activeChar.compartimentos.map(comp => (
                          <button
                            key={comp.id}
                            type="button"
                            onClick={() => {
                              handleQuickMoveToCharacterCompartment(comp.id);
                            }}
                            className="w-full text-left text-xs bg-zinc-950/60 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 px-3 py-2 rounded-xl text-zinc-100 font-bold transition-all flex items-center justify-between cursor-pointer"
                          >
                            <span>{comp.nome}</span>
                            <span className="text-[9px] text-zinc-500 font-mono">{(calculateInventoryTotals([comp]).peso / 10).toFixed(1)} kg</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-zinc-500 italic pl-1">Nenhum compartimento encontrado no personagem.</p>
                    )}
                  </div>
                  
                  {/* Mandar para Companheiro */}
                  <div className="space-y-2 pt-2 border-t border-zinc-800/60">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">🐾 Companheiros na Toca</span>
                    {activeChar.tocaCreatures && activeChar.tocaCreatures.length > 0 ? (
                      <div className="grid grid-cols-1 gap-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                        {activeChar.tocaCreatures.map(creature => (
                          <button
                            key={creature.id}
                            type="button"
                            onClick={() => {
                              handleQuickMoveToCompanion(creature.id);
                            }}
                            className="w-full text-left text-xs bg-zinc-950/60 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 px-3 py-2 rounded-xl text-zinc-100 font-bold transition-all flex items-center justify-between cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              {creature.imageUrl ? (
                                <img src={creature.imageUrl} alt="" className="w-5 h-5 rounded object-cover border border-zinc-800" referrerPolicy="no-referrer" />
                              ) : (
                                <PawPrint size={14} className="text-amber-500/85" />
                              )}
                              <span>{creature.name}</span>
                            </span>
                            <span className="text-[9px] text-zinc-500 font-mono">
                              {(getCreaturePesoTotal(creature) / 10).toFixed(1)} / {(creature.carga / 10).toFixed(1)} kg
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-zinc-500 italic pl-1">Nenhum companheiro registrado na Toca.</p>
                    )}
                  </div>
                  
                  {/* Outras Ações */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-800/60">
                    <button
                      type="button"
                      onClick={() => {
                        executeClipboardCut(pendingCutAction.type, pendingCutAction.charId, pendingCutAction.sourceId, pendingCutAction.item);
                        setPendingCutAction(null);
                      }}
                      className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-xl text-xs font-black uppercase tracking-wider text-center transition-all cursor-pointer"
                    >
                      📋 Apenas Recortar
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setPendingCutAction(null)}
                      className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-750 rounded-xl text-xs font-bold text-zinc-400 text-center transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </header>

      {isQuotaExceeded && (
        <div className="bg-amber-950/20 border-b border-amber-800/30 px-4 py-3 text-amber-200">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs md:text-sm">
            <div className="flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5">⚠️</span>
              <div>
                <p className="font-black uppercase tracking-wider text-amber-500 font-sans text-[10px] mb-0.5">Limite de Banco de Dados Excedido</p>
                <p className="text-zinc-300 font-medium">
                  A cota gratuita diária de gravação foi atingida no Firebase. Suas fichas e progresso continuarão sendo guardados localmente com segurança até que o limite seja liberado!
                </p>
              </div>
            </div>
            <a 
              href="https://console.firebase.google.com/project/gen-lang-client-0677748971/firestore/databases/ai-studio-1a82e7bc-e41e-43fa-8f91-4d5fb7def03d/data?openUpgradeDialog=true"
              target="_blank" 
              rel="noopener noreferrer"
              className="whitespace-nowrap px-3 py-1.5 bg-amber-550 hover:bg-amber-600 text-black font-black uppercase tracking-wider rounded-lg transition-all shadow-[0_0_10px_rgba(245,158,11,0.15)] flex items-center gap-1 cursor-pointer text-[9px] md:text-xxs-tight"
            >
              Fazer Upgrade / Liberar Banco <ExternalLink size={12} className="inline ml-1" />
            </a>
          </div>
        </div>
      )}

      <main key={activeChar.id} className={cn(
        "flex-1 overscroll-none flex flex-col min-h-0",
        activePage === "table" || activePage === "dice" || activePage === "master"
          ? "flex-1 h-0 min-h-0 w-full overflow-hidden p-0"
          : "max-w-7xl mx-auto w-full p-4 md:p-6 pb-20 overflow-y-auto custom-scrollbar"
      )}>
        {(() => {
          const renderSheetContent = () => (
            <div className="max-w-4xl mx-auto w-full space-y-8 flex flex-col">
            {tocaEditingCreatureId && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <PawPrint className="text-amber-500 shrink-0" size={20} />
                  <div>
                    <p className="text-sm font-bold text-amber-500">Editando Ficha da Criatura</p>
                    <p className="text-xs text-zinc-400">
                      Você está editando a ficha completa de <strong>{activeChar?.nome}</strong>, companheiro/montaria da Toca.
                    </p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setTocaEditingCreatureId(null);
                    setActivePage("toca");
                  }}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20"
                >
                  Voltar para a Toca
                </motion.button>
              </div>
            )}
            {bestiaryEditingMonsterId && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <Skull className="text-purple-500 shrink-0" size={20} />
                  <div>
                    <p className="text-sm font-bold text-purple-500">Editando Ficha do Demônio</p>
                    <p className="text-xs text-zinc-400">
                      Você está editando a ficha de jogo completa de <strong>{activeChar?.nome}</strong> do Bestiário.
                    </p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setBestiaryEditingMonsterId(null);
                    setActivePage("bestiary");
                  }}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-purple-600/20"
                >
                  Voltar para o Bestiário
                </motion.button>
              </div>
            )}
            {/* All Sections Stacking Vertically */}
            <Section title="Personagem" icon={<UserIcon size={18} />} collapsible defaultCollapsed={false}>
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-2 mb-4">
                    <div className="w-32 h-32 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex items-center justify-center relative group">
                      {activeChar.imagem ? (
                        <img
                          src={activeChar.imagem}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <UserIcon size={48} className="text-zinc-700" />
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
                    {activeChar.userEmail && (
                      <div className="flex flex-col items-center">
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Dono</p>
                        <p className="text-sm text-amber-500/80 font-medium">{activeChar.userEmail}</p>
                      </div>
                    )}
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

                <div className="space-y-4">
                  {(activeChar.efeitosNegativos?.filter(e => e.isUnusable).length || 0) > 0 && (
                    <div className="bg-red-600/10 border border-red-500/30 p-2 rounded-xl space-y-1">
                      <div className="flex items-center gap-2 text-red-500">
                        <Skull size={14} className="animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">MEMBROS INUTILIZADOS</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {activeChar.efeitosNegativos?.filter(e => e.isUnusable).map(e => (
                          <span key={e.id} className="text-[8px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded uppercase">{e.location}</span>
                        ))}
                      </div>
                      <p className="text-[9px] text-zinc-500 leading-tight italic">Estes membros não podem ser utilizados e não são contabilizados na rolagem de acerto inimiga.</p>
                    </div>
                  )}

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
                      <ProgressBar
                        label="Sanidade"
                        current={activeChar?.sanidadeAtual || 0}
                        max={sanidadeMax}
                        color="bg-emerald-500"
                        onChange={(v) => updateChar({ sanidadeAtual: v })}
                      />
                      <div className="grid grid-cols-3 gap-3">
                        <MiniBar
                          label="Fome"
                          value={activeChar?.fome || 0}
                          color="bg-orange-500"
                          onChange={(v) => updateChar({ fome: v })}
                          extra={
                            <div className="flex items-center gap-1 bg-zinc-950/60 px-1 py-0.5 rounded border border-zinc-805/50" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[8px] text-orange-400 font-bold font-mono">Bônus:</span>
                              <input
                                type="number"
                                placeholder="+0"
                                value={activeChar?.bonusFomeProximaRolagem === undefined || activeChar?.bonusFomeProximaRolagem === 0 ? "" : activeChar.bonusFomeProximaRolagem}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  updateChar({ bonusFomeProximaRolagem: isNaN(val) ? undefined : val });
                                }}
                                className="w-8 text-[9px] bg-transparent text-center font-bold font-mono text-zinc-100 focus:outline-none focus:ring-0 p-0 border-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </div>
                          }
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
                            <div key={idx} className="text-[9px] leading-tight text-purple-400 bg-purple-400/10 p-1.5 rounded border border-purple-400/20 flex flex-col gap-1.5">
                              <div className="flex gap-1.5 items-start">
                                <Battery size={10} className="shrink-0 mt-0.5" />
                                <span>{effect}</span>
                              </div>
                              {activeChar.cansaco === 0 && effect.includes("d100") && (
                                <motion.button whileTap={{ scale: 0.95 }} onClick={() => rollDice(100, 1, 0, "Teste de Desmaio")} className="self-start px-2 py-0.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded text-[8px] font-bold uppercase transition-colors">
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
                          <span className={cn(activeChar.clima > 0 ? "text-orange-400" : activeChar.clima < 0 ? "text-blue-400" : "text-zinc-400")}>
                            {typeof activeChar.clima === "number" ? activeChar.clima > 0 ? `+${activeChar.clima}` : activeChar.clima : 0}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <motion.button whileTap={{ scale: 0.95 }} onClick={() => updateChar({ clima: Math.max(-10, (activeChar.clima || 0) - 1) })} className="p-2 hover:bg-zinc-800 rounded text-blue-400 transition-colors">
                            <Minus size={18} />
                          </motion.button>
                          <div className="relative flex-1 h-1.5 flex items-center">
                            <input type="range" min="-10" max="10" step="1" value={activeChar.clima || 0} onChange={(e) => updateChar({ clima: parseInt(e.target.value) })} className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-white" style={{ background: `linear-gradient(to right, #3b82f6 0%, #27272a 50%, #ef4444 100%)` }} />
                          </div>
                          <motion.button whileTap={{ scale: 0.95 }} onClick={() => updateChar({ clima: Math.min(10, (activeChar.clima || 0) + 1) })} className="p-2 hover:bg-zinc-800 rounded text-red-400 transition-colors">
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
                              <div key={idx} className="text-[9px] leading-tight text-red-400 bg-red-400/10 p-1.5 rounded border border-red-400/20 flex gap-1.5 items-start">
                                <Activity size={10} className="shrink-0 mt-0.5" />
                                <span>{effect}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-zinc-800">
                        <div className="flex justify-between items-center text-xs mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-zinc-500 uppercase font-bold tracking-tighter">Carga Total</span>
                            <div className="flex items-center gap-1" title="Bônus de Carga (kg)">
                              <span className="text-[10px] text-zinc-500 font-medium">Bônus:</span>
                              <input
                                type="number"
                                value={activeChar.bonusCarga || ""}
                                placeholder="0"
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  updateChar({ bonusCarga: val });
                                }}
                                className="w-10 text-center text-[10px] bg-zinc-900 border border-zinc-800 rounded font-medium text-amber-500 py-0.5 focus:outline-none focus:border-amber-400"
                              />
                              <span className="text-[9px] text-zinc-600">kg</span>
                            </div>
                          </div>
                          <span className={cn(pesoTotal > cargaMax ? "text-red-400" : "text-zinc-300", "font-mono")}>
                            {(pesoTotal / 10).toFixed(2)} / {(cargaMax / 10).toFixed(1)} kg
                          </span>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div className={cn("h-full transition-all duration-500", pesoTotal > cargaMax ? "bg-red-500" : "bg-amber-500")} style={{ width: `${Math.min(100, (pesoTotal / cargaMax) * 100)}%` }} />
                        </div>
                        {penalties.acertoPenalty !== 0 && (
                          <div className="mt-2 bg-red-500/10 border border-red-500/20 p-2 rounded text-[10px] text-red-400 flex items-center gap-2">
                            <Zap size={12} />
                            PENALIDADE CARGA: {penalties.acertoPenalty} Acerto, {penalties.mentalidadePenalty} Mentalidade
                          </div>
                        )}
                        {survivalPenalties.effects.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {survivalPenalties.effects.map((eff, i) => (
                              <div key={i} className="bg-red-500/10 border border-red-500/20 p-2 rounded text-[10px] text-red-400 flex items-center gap-2">
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
                      <div className="grid grid-cols-2 gap-2 mb-6">
                        {NEGATIVE_EFFECTS.map((effect) => {
                          const activeEffects = activeChar.efeitosNegativos || [];
                          const isActive = activeEffects.some(e => e.type === effect.name);
                          return (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              key={effect.id}
                              onClick={() => {
                                if (isActive) {
                                  updateChar({ efeitosNegativos: activeEffects.filter(e => e.type !== effect.name) });
                                } else {
                                  const newEffect: NegativeEffect = {
                                    id: generateId(),
                                    type: effect.name as any,
                                    location: 'Tronco',
                                    stacks: 1,
                                    daysRemaining: effect.id === 'ossos_quebrados' ? 4 : (effect.id === 'sangramento' ? 2 : 3),
                                    treated: false,
                                    depth: 1
                                  };
                                  updateChar({ efeitosNegativos: [...activeEffects, newEffect] });
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded-lg border transition-all text-left",
                                isActive ? "bg-zinc-800 border-amber-500/50 text-amber-500" : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700",
                              )}
                            >
                              <effect.icon size={16} className={isActive ? effect.color : "text-zinc-600"} />
                              <span className="text-[10px] font-bold uppercase truncate">{effect.name}</span>
                            </motion.button>
                          );
                        })}
                      </div>

                      <div className="pt-4 border-t border-zinc-800">
                        {activeChar.efeitosNegativos && activeChar.efeitosNegativos.length > 0 ? (
                          <div className="space-y-3">
                            {activeChar.efeitosNegativos.map((eff) => {
                              const config = NEGATIVE_EFFECTS.find(e => e.name === eff.type) || NEGATIVE_EFFECTS[0];
                              return (
                                <div key={eff.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                                  <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/30">
                                    <div className="flex items-center gap-2">
                                      <config.icon size={16} className={config.color} />
                                      <span className="text-xs font-black uppercase text-zinc-200">{eff.type}</span>
                                      <span className="text-[9px] font-bold bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500 border border-zinc-700 uppercase">{eff.location}</span>
                                      {eff.isUnusable && (
                                        <span className="text-[8px] font-black bg-red-600/20 text-red-500 px-1.5 py-0.5 rounded border border-red-500/30 animate-pulse">INUTILIZADO</span>
                                      )}
                                    </div>
                                    <motion.button
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => {
                                        updateChar({ efeitosNegativos: activeChar.efeitosNegativos?.filter(e => e.id !== eff.id) });
                                      }}
                                      className="text-zinc-500 hover:text-red-400 p-1"
                                    >
                                      <Trash2 size={14} />
                                    </motion.button>
                                  </div>
                                  <div className="p-3 space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                       <div className="space-y-1">
                                          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">Localização</span>
                                          <select 
                                            value={eff.location}
                                            onChange={(e) => {
                                              updateChar({
                                                efeitosNegativos: activeChar.efeitosNegativos?.map(ex => 
                                                  ex.id === eff.id ? { ...ex, location: e.target.value as any } : ex
                                                )
                                              });
                                            }}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-[10px] text-zinc-300 outline-none"
                                          >
                                            {['Cabeça', 'Tronco', 'Braço Direito', 'Braço Esquerdo', 'Perna Direita', 'Perna Esquerda'].map(loc => (
                                              <option key={loc} value={loc}>{loc}</option>
                                            ))}
                                          </select>
                                       </div>
                                       <div className="space-y-1">
                                          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">Status</span>
                                          <div className="flex items-center gap-2 mt-1">
                                             <button 
                                              onClick={() => {
                                                updateChar({
                                                  efeitosNegativos: activeChar.efeitosNegativos?.map(ex => 
                                                    ex.id === eff.id ? { ...ex, treated: !ex.treated } : ex
                                                  )
                                                });
                                              }}
                                              className={cn(
                                                "flex-1 py-1 rounded text-[8px] font-black uppercase transition-all",
                                                eff.treated ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30" : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                                              )}
                                             >
                                               {eff.treated ? 'Tratado' : 'Não Tratado'}
                                             </button>
                                             <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5">
                                                <Calendar size={10} className="text-zinc-500" />
                                                <span className="text-[9px] font-bold text-zinc-300">{eff.daysRemaining}d</span>
                                             </div>
                                          </div>
                                       </div>
                                    </div>
                                    {eff.type === 'Sangramento' && (
                                      <div className="bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.3)]" />
                                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-tighter">Nível/Dano</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          {[1, 2, 3].map(lvl => (
                                            <button
                                              key={lvl}
                                              onClick={() => {
                                                updateChar({ efeitosNegativos: activeChar.efeitosNegativos?.map(ex => ex.id === eff.id ? { ...ex, stacks: lvl } : ex) });
                                              }}
                                              className={cn(
                                                "w-5 h-5 rounded flex items-center justify-center text-[9px] font-black transition-all",
                                                eff.stacks === lvl ? "bg-red-600 text-white shadow-lg shadow-red-600/20" : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                                              )}
                                            >
                                              {lvl}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <div className="text-[9px] text-zinc-500 italic leading-tight whitespace-pre-line border-t border-zinc-800 pt-2">{config.info}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="py-8 text-center border-2 border-dashed border-zinc-900 rounded-2xl">
                            <Activity size={24} className="mx-auto text-zinc-800 mb-2" />
                            <p className="text-zinc-600 text-xs font-medium uppercase tracking-widest">Sem efeitos ativos</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
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
                  {["Cabeça", "Tronco", "Braço Esquerdo", "Braço Direito", "Pernas"].map((part) => {
                    const val = (activeChar.defesa as any)[part] || 0;
                    return (
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
                    );
                  })}
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
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="text-[10px] font-bold text-zinc-500 uppercase">
                        Armas
                      </h4>
                      <div className="flex items-center">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={toggleSelectionMode}
                          className={cn(
                            "p-1 rounded transition-all mr-2 flex items-center justify-center",
                            selectionMode
                              ? "bg-amber-500 text-zinc-950 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                              : "bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-800",
                          )}
                          title="Seleção Múltipla"
                        >
                          <CheckSquare size={14} />
                        </motion.button>
                        <div className="flex gap-1">
                          {([
                              { lab: "B", cat: "Arma Branca", icon: <Sword size={12}/> },
                              { lab: "F", cat: "Arma de Fogo", icon: <Zap size={12}/> },
                              { lab: "A", cat: "Arco", icon: <Target size={12}/> }
                            ]).map(opt => (
                              <motion.button
                                key={opt.cat}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                  updateChar((c) => ({
                                    armas: [
                                      ...(c.armas || []),
                                      {
                                        id: generateId(),
                                        nome: `Nova ${opt.cat}`,
                                        dano: "0",
                                        acerto: 0,
                                        tipo: "Arma",
                                        categoria: opt.cat as any,
                                        escala: "0",
                                        atributoBase: opt.cat === "Arma Branca" ? "Força" : "Destreza",
                                        peso: 0,
                                        volume: 0,
                                        durabilidade: 0,
                                        maxDurabilidade: 0,
                                        durabilidadeMaxUtil: 0,
                                        corte: 0,
                                        impacto: 0,
                                        perfuracao: 0,
                                        resistencia: 0,
                                        municaoTotal: opt.cat === "Arma de Fogo" ? 0 : undefined,
                                        municaoCarregada: opt.cat === "Arma de Fogo" ? 0 : undefined,
                                      },
                                    ],
                                  }));
                                }}
                                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1 rounded transition-colors flex items-center gap-1"
                                title={`Adicionar ${opt.cat}`}
                              >
                                {opt.icon}
                                <span className="text-[8px] font-bold">{opt.lab}</span>
                              </motion.button>
                            ))}
                        </div>
                      </div>
                    </div>

                    {multiClipboard.length > 0 &&
                      !selectionMode &&
                      multiClipboard.some(
                        (item) =>
                          item.type === "Arma" ||
                          (item.type === "Item" && item.data.tipo === "Arma"),
                      ) && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={handlePasteSelected}
                          className="w-full py-2 mb-2 bg-emerald-500/10 border border-dashed border-emerald-500/50 rounded text-[10px] font-bold uppercase text-emerald-500 hover:bg-emerald-500/20 transition-all"
                        >
                          Colar Armas ({multiClipboard.filter(it => it.type === "Arma" || (it.type === "Item" && it.data.tipo === "Arma")).length})
                        </motion.button>
                      )}
                    <div className="space-y-1.5">
                      {armas.map((w, idx) => (
                        <div
                          key={w.id}
                          className="bg-zinc-900 px-2 py-1.5 rounded-lg border border-zinc-800 text-xs relative group space-y-1.5"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center flex-1 min-w-0">
                              {selectionMode && (
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => toggleSelectItem(w.id)}
                                  className={cn(
                                    "p-1 rounded mr-2 transition-colors shrink-0",
                                    selectedItems.has(w.id)
                                      ? "bg-amber-500 text-zinc-950"
                                      : "bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-700",
                                  )}
                                >
                                  {selectedItems.has(w.id) ? (
                                    <CheckSquare size={12} />
                                  ) : (
                                    <Square size={12} />
                                  )}
                                </motion.button>
                              )}
                              <input
                                value={w.nome || ""}
                                onChange={(e) => {
                                  const newName = e.target.value;
                                  updateChar((c) => {
                                    const newArmas = [...c.armas];
                                    newArmas[idx] = {
                                      ...newArmas[idx],
                                      nome: newName,
                                    };
                                    return { armas: newArmas };
                                  });
                                }}
                                className="bg-transparent font-bold focus:outline-none flex-1 min-w-0 text-amber-500"
                              />
                              {w.quantidade !== undefined && (
                                <span className={cn(
                                  "text-[10px] px-1.5 rounded font-black ml-2 tabular-nums",
                                  w.quantidade <= 0 ? "bg-red-500/20 text-red-500" : "bg-amber-500/20 text-amber-500"
                                )}>
                                  {w.quantidade}x
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleCutItem('weapon', activeChar.id, 'equipment', w)}
                                className="text-zinc-500 hover:text-amber-500 p-1"
                                title="Recortar Arma"
                              >
                                <Scissors size={16} />
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => copyToClipboard("Arma", w)}
                                className="text-zinc-500 hover:text-zinc-300 p-1"
                                title="Copiar Arma"
                              >
                                <Copy size={16} />
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() =>
                                  updateChar(c => ({
                                    armas: c.armas.filter((a) => a.id !== w.id),
                                  }))
                                }
                                className="text-red-500 hover:text-red-400 p-1"
                              >
                                <Trash2 size={16} />
                              </motion.button>
                            </div>
                          </div>

                          <WeaponProperties
                            item={w}
                            character={activeChar}
                            updateCharacter={updateChar}
                            onChange={(updates) => {
                              updateChar(c => {
                                const na = [...c.armas];
                                const index = na.findIndex(item => item.id === w.id);
                                if (index !== -1) {
                                  na[index] = { ...na[index], ...updates };
                                }
                                return { armas: na };
                              });
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
                      <div className="flex items-center">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={toggleSelectionMode}
                          className={cn(
                            "p-1.5 rounded transition-all mr-2 flex items-center justify-center",
                            selectionMode
                              ? "bg-amber-500 text-zinc-950 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                              : "bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-800",
                          )}
                        >
                          <CheckSquare size={16} />
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            updateChar((c) => ({
                              catalisadores: [
                                ...(c.catalisadores || []),
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
                            }));
                          }}
                          className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                        >
                          <Plus size={16} />
                        </motion.button>
                      </div>
                    </div>

                    {multiClipboard.length > 0 &&
                      !selectionMode &&
                      multiClipboard.some(
                        (item) =>
                          item.type === "Catalisador" ||
                          (item.type === "Item" &&
                            item.data.tipo === "Catalisador"),
                      ) && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={handlePasteSelected}
                          className="w-full py-2 mb-2 bg-emerald-500/10 border border-dashed border-emerald-500/50 rounded text-[10px] font-bold uppercase text-emerald-500 hover:bg-emerald-500/20 transition-all"
                        >
                          Colar Catalisadores ({multiClipboard.filter(it => it.type === "Catalisador" || (it.type === "Item" && it.data.tipo === "Catalisador")).length})
                        </motion.button>
                      )}
                    <div className="space-y-3">
                      {catalisadores.map((c, idx) => (
                        <div
                          key={c.id}
                          className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs relative group space-y-2"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center flex-1 min-w-0">
                              {selectionMode && (
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => toggleSelectItem(c.id)}
                                  className={cn(
                                    "p-1 rounded mr-2 transition-colors shrink-0",
                                    selectedItems.has(c.id)
                                      ? "bg-amber-500 text-zinc-950"
                                      : "bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-700",
                                  )}
                                >
                                  {selectedItems.has(c.id) ? (
                                    <CheckSquare size={14} />
                                  ) : (
                                    <Square size={14} />
                                  )}
                                </motion.button>
                              )}
                              <input
                                value={c.nome || ""}
                                onChange={(e) => {
                                  const newName = e.target.value;
                                  updateChar((char) => {
                                    const newCats = [...char.catalisadores];
                                    newCats[idx] = {
                                      ...newCats[idx],
                                      nome: newName,
                                    };
                                    return { catalisadores: newCats };
                                  });
                                }}
                                className="bg-transparent font-bold focus:outline-none flex-1 min-w-0 text-amber-500"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleCutItem('catalyst', activeChar.id, 'equipment', c)}
                                className="text-zinc-500 hover:text-amber-500 p-1"
                                title="Recortar Catalisador"
                              >
                                <Scissors size={20} />
                              </motion.button>
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
                                  updateChar(c => ({
                                    catalisadores: c.catalisadores.filter(
                                      (cat) => cat.id !== c.id,
                                    ),
                                  }))
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
                              updateChar(prevChar => {
                                const na = [...prevChar.catalisadores];
                                const index = na.findIndex(item => item.id === c.id);
                                if (index !== -1) {
                                  na[index] = { ...na[index], ...updates };
                                }
                                return { catalisadores: na };
                              });
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
                      <div className="flex items-center">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={toggleSelectionMode}
                          className={cn(
                            "p-1.5 rounded transition-all mr-2 flex items-center justify-center",
                            selectionMode
                              ? "bg-amber-500 text-zinc-950 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                              : "bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-800",
                          )}
                          title="Seleção Múltipla"
                        >
                          <CheckSquare size={16} />
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            updateChar((c) => ({
                              armaduras: [
                                ...(c.armaduras || []),
                                {
                                  id: generateId(),
                                  nome: "Nova Armadura",
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
                            }));
                          }}
                          className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                        >
                          <Plus size={16} />
                        </motion.button>
                      </div>
                    </div>

                    {multiClipboard.length > 0 &&
                      !selectionMode &&
                      multiClipboard.some(
                        (item) =>
                          item.type === "Armadura" ||
                          (item.type === "Item" &&
                            item.data.tipo === "Armadura"),
                      ) && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={handlePasteSelected}
                          className="w-full py-2 mb-2 bg-emerald-500/10 border border-dashed border-emerald-500/50 rounded text-[10px] font-bold uppercase text-emerald-500 hover:bg-emerald-500/20 transition-all font-sans"
                        >
                          Colar Armaduras ({multiClipboard.filter(it => it.type === "Armadura" || (it.type === "Item" && it.data.tipo === "Armadura")).length})
                        </motion.button>
                      )}
                    <div className="space-y-3">
                      {(activeChar?.armaduras || []).map((a, idx) => (
                        <div
                          key={a.id}
                          className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs relative group space-y-2"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center flex-1 min-w-0">
                               {selectionMode && (
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => toggleSelectItem(a.id)}
                                  className={cn(
                                    "p-1 rounded mr-2 transition-colors shrink-0",
                                    selectedItems.has(a.id)
                                      ? "bg-amber-500 text-zinc-950"
                                      : "bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-700",
                                  )}
                                >
                                  {selectedItems.has(a.id) ? (
                                    <CheckSquare size={14} />
                                  ) : (
                                    <Square size={14} />
                                  )}
                                </motion.button>
                              )}
                              <input
                                value={a.nome || ""}
                                onChange={(e) => {
                                  const newName = e.target.value;
                                  updateChar((char) => {
                                    const newArms = [...(char.armaduras || [])];
                                    newArms[idx] = {
                                      ...newArms[idx],
                                      nome: newName,
                                    };
                                    return { armaduras: newArms };
                                  });
                                }}
                                className="bg-transparent font-bold focus:outline-none flex-1 min-w-0 text-amber-500"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleCutItem('armor', activeChar.id, 'equipment', a)}
                                className="text-zinc-500 hover:text-amber-500 p-1"
                                title="Recortar Armadura"
                              >
                                <Scissors size={20} />
                              </motion.button>
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
                                  updateChar(c => ({
                                    armaduras: (
                                      c.armaduras || []
                                    ).filter((arm) => arm.id !== a.id),
                                  }))
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
                              updateChar(prevChar => {
                                const na = [...(prevChar.armaduras || [])];
                                const index = na.findIndex(item => item.id === a.id);
                                if (index !== -1) {
                                  na[index] = { ...na[index], ...updates };
                                }
                                return { armaduras: na };
                              });
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
                      <div className="flex items-center">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={toggleSelectionMode}
                          className={cn(
                            "p-1.5 rounded transition-all mr-2 flex items-center justify-center",
                            selectionMode
                              ? "bg-amber-500 text-zinc-950 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                              : "bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-800",
                          )}
                          title="Seleção Múltipla"
                        >
                          <CheckSquare size={16} />
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            updateChar((c) => ({
                              acessorios: [
                                ...(c.acessorios || []),
                                {
                                  id: generateId(),
                                  nome: "Novo Acessório",
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
                            }));
                          }}
                          className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                        >
                          <Plus size={16} />
                        </motion.button>
                      </div>
                    </div>

                    {multiClipboard.length > 0 &&
                      !selectionMode &&
                      multiClipboard.some(
                        (item) =>
                          item.type === "Acessório" ||
                          item.type === "Armadura" ||
                          (item.type === "Item" &&
                            (item.data.tipo === "Armadura" || item.data.tipo === "Acessório" || item.data.tipo === "Acessórios")),
                      ) && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={handlePasteSelected}
                          className="w-full py-2 mb-2 bg-emerald-500/10 border border-dashed border-emerald-500/50 rounded text-[10px] font-bold uppercase text-emerald-500 hover:bg-emerald-500/20 transition-all font-sans"
                        >
                          Colar Acessórios ({multiClipboard.filter(it => it.type === "Acessório" || it.type === "Armadura" || (it.type === "Item" && (it.data.tipo === "Armadura" || it.data.tipo === "Acessório" || it.data.tipo === "Acessórios"))).length})
                        </motion.button>
                      )}
                    <div className="space-y-3">
                      {(activeChar?.acessorios || []).map((a, idx) => (
                        <div
                          key={a.id}
                          className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs relative group space-y-2"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center flex-1 min-w-0">
                               {selectionMode && (
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => toggleSelectItem(a.id)}
                                  className={cn(
                                    "p-1 rounded mr-2 transition-colors shrink-0",
                                    selectedItems.has(a.id)
                                      ? "bg-amber-500 text-zinc-950"
                                      : "bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-700",
                                  )}
                                >
                                  {selectedItems.has(a.id) ? (
                                    <CheckSquare size={14} />
                                  ) : (
                                    <Square size={14} />
                                  )}
                                </motion.button>
                              )}
                              <input
                                value={a.nome || ""}
                                onChange={(e) => {
                                  const newName = e.target.value;
                                  updateChar((char) => {
                                    const newAccs = [...(char.acessorios || [])];
                                    newAccs[idx] = {
                                      ...newAccs[idx],
                                      nome: newName,
                                    };
                                    return { acessorios: newAccs };
                                  });
                                }}
                                className="bg-transparent font-bold focus:outline-none flex-1 min-w-0 text-amber-500"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleCutItem('accessory', activeChar.id, 'equipment', a)}
                                className="text-zinc-500 hover:text-amber-500 p-1"
                                title="Recortar Acessório"
                              >
                                <Scissors size={20} />
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => copyToClipboard("Acessório", a)}
                                className="text-zinc-500 hover:text-zinc-300 p-1"
                                title="Copiar Acessório"
                              >
                                <Copy size={20} />
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() =>
                                  updateChar(c => ({
                                    acessorios: (
                                      c.acessorios || []
                                    ).filter((acc) => acc.id !== a.id),
                                  }))
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
                              updateChar(prevChar => {
                                const na = [...(prevChar.acessorios || [])];
                                const index = na.findIndex(item => item.id === a.id);
                                if (index !== -1) {
                                  na[index] = { ...na[index], ...updates };
                                }
                                return { acessorios: na };
                              });
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
                defaultCollapsed={true}
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase">
                      Compartimentos
                    </h4>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() =>
                        updateChar(c => ({
                          compartimentos: [
                            ...(c.compartimentos || []),
                            {
                              id: generateId(),
                              nome: "Novo Compartimento",
                              volumeMax: 0,
                              itens: [],
                              externo: false,
                            },
                          ],
                        }))
                      }
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                    >
                      <Plus size={16} />
                    </motion.button>
                  </div>

                  <div className="space-y-4">
                    {compartimentos.map((comp, cIdx) => {
                      const compVolume = (comp.itens || []).reduce(
                        (acc, i) => acc + (i.volume || 0) * (i.quantidade !== undefined ? i.quantidade : 1),
                        0,
                      );
                      return (
                        <div
                          key={comp.id}
                          className="bg-zinc-900/50 rounded-lg border border-zinc-800 overflow-hidden"
                        >
                          <div className="bg-zinc-800/80 px-3 py-2 border-b border-zinc-700/50 flex items-center gap-2">
                             <Package
                              size={14}
                              className="text-amber-500 shrink-0"
                            />
                            <div className="flex items-center flex-1 min-w-0">
                              {selectionMode && (
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  onClick={toggleSelectionMode}
                                  className={cn(
                                    "p-1 rounded mr-2 transition-colors shrink-0",
                                    "bg-amber-500 text-zinc-950 shadow-[0_0_10px_rgba(245,158,11,0.3)]",
                                  )}
                                >
                                  <CheckSquare size={14} />
                                </motion.button>
                              )}
                              {!selectionMode && (
                                 <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  onClick={toggleSelectionMode}
                                  className="p-1 rounded mr-2 transition-colors shrink-0 bg-zinc-900 border border-zinc-700 text-zinc-500 hover:text-zinc-300"
                                  title="Seleção Múltipla"
                                >
                                  <CheckSquare size={14} />
                                </motion.button>
                              )}
                              <input
                                value={comp.nome || ""}
                                onChange={(e) => {
                                  const newName = e.target.value;
                                  updateChar(char => ({
                                    compartimentos: (char.compartimentos || []).map((c) => 
                                      c.id === comp.id ? { ...c, nome: newName } : c
                                    )
                                  }));
                                }}
                                className="bg-transparent text-sm font-black focus:outline-none flex-1 min-w-0 text-amber-500 uppercase tracking-tight"
                                placeholder="Nome do Compartimento"
                              />
                            </div>
                          </div>

                          <div className="bg-zinc-900/30 px-3 py-1.5 flex items-center border-b border-zinc-800 gap-2 overflow-x-auto no-scrollbar">
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800/30 rounded border border-zinc-700/50 shrink-0">
                              <input
                                type="checkbox"
                                id={`externo-${comp.id}`}
                                checked={!!comp.externo}
                                onChange={(e) => {
                                  const isExt = e.target.checked;
                                  updateChar(char => ({
                                    compartimentos: (char.compartimentos || []).map((c) => 
                                      c.id === comp.id ? { ...c, externo: isExt } : c
                                    )
                                  }));
                                }}
                                className="w-3 h-3 accent-amber-500 rounded cursor-pointer"
                              />
                              <label 
                                htmlFor={`externo-${comp.id}`} 
                                className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter cursor-pointer"
                              >
                                Externo
                              </label>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">
                                  Volume Máx
                                </span>
                                <NumericInput
                                  value={comp.volumeMax}
                                  onChange={(v) => {
                                    updateChar(char => ({
                                      compartimentos: (char.compartimentos || []).map((c) => 
                                        c.id === comp.id ? { ...c, volumeMax: v } : c
                                      )
                                    }));
                                  }}
                                  className="w-14"
                                  size="sm"
                                />
                              </div>

                              <div className="h-4 w-px bg-zinc-800" />

                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">
                                  Total:
                                </span>
                                <span className={cn(
                                  "text-[10px] font-bold",
                                  compVolume > comp.volumeMax ? "text-red-400" : "text-amber-500/80"
                                )}>
                                  {compVolume.toFixed(1)}
                                </span>
                              </div>
                            </div>
                            
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() =>
                                updateChar(char => ({
                                  compartimentos: (char.compartimentos || []).filter(
                                    (c) => c.id !== comp.id,
                                  ),
                                }))
                              }
                              className="text-zinc-600 hover:text-red-500 transition-colors p-1 ml-auto"
                              title="Excluir Compartimento"
                            >
                              <Trash2 size={16} />
                            </motion.button>
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
                                  updateChar(char => {
                                    const comps = char.compartimentos || [];
                                    const targetComp = comps[cIdx];
                                    const newItens = [
                                      ...(targetComp.itens || []),
                                      {
                                        id: generateId(),
                                        nome: "Novo Item",
                                        peso: 0,
                                        volume: 0,
                                        quantidade: 1,
                                        tipo: "Geral",
                                        durabilidade: 0,
                                        maxDurabilidade: 0,
                                        descricao: "",
                                      }
                                    ];
                                    return {
                                      compartimentos: comps.map((c, i) => 
                                        i === cIdx ? { ...c, itens: newItens } : c
                                      )
                                    };
                                  });
                                }}
                                className="flex-1 py-1.5 border border-dashed border-zinc-700 rounded text-[9px] font-bold uppercase text-zinc-500 hover:border-amber-500/50 hover:text-amber-500 transition-all px-1"
                              >
                                + Item
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                  updateChar(char => {
                                    const comps = char.compartimentos || [];
                                    const targetComp = comps[cIdx];
                                    const newItens = [
                                      ...(targetComp.itens || []),
                                      {
                                        id: generateId(),
                                        nome: "Nova Arma",
                                        peso: 0,
                                        volume: 0,
                                        quantidade: 1,
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
                                      }
                                    ];
                                    return {
                                      compartimentos: comps.map((c, i) => 
                                        i === cIdx ? { ...c, itens: newItens } : c
                                      )
                                    };
                                  });
                                }}
                                className="flex-1 py-1.5 border border-dashed border-zinc-700 rounded text-[9px] font-bold uppercase text-zinc-500 hover:border-amber-500/50 hover:text-amber-500 transition-all px-1"
                              >
                                + Arma
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                  updateChar(char => {
                                    const comps = char.compartimentos || [];
                                    const targetComp = comps[cIdx];
                                    const newItens = [
                                      ...(targetComp.itens || []),
                                      {
                                        id: generateId(),
                                        nome: "Novo Catalisador",
                                        peso: 0,
                                        volume: 0,
                                        quantidade: 1,
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
                                      }
                                    ];
                                    return {
                                      compartimentos: comps.map((c, i) => 
                                        i === cIdx ? { ...c, itens: newItens } : c
                                      )
                                    };
                                  });
                                }}
                                className="flex-1 py-1.5 border border-dashed border-zinc-700 rounded text-[9px] font-bold uppercase text-zinc-500 hover:border-amber-500/50 hover:text-amber-500 transition-all px-1"
                              >
                                + Cat
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                  updateChar(char => {
                                    const comps = char.compartimentos || [];
                                    const targetComp = comps[cIdx];
                                    const newItens = [
                                      ...(targetComp.itens || []),
                                      {
                                        id: generateId(),
                                        nome: "Nova Armadura",
                                        peso: 0,
                                        volume: 0,
                                        quantidade: 1,
                                        tipo: "Armadura",
                                        durabilidade: 0,
                                        maxDurabilidade: 0,
                                        descricao: "",
                                        corte: 0,
                                        impacto: 0,
                                        perfuracao: 0,
                                        reducaoDano: 0,
                                        efeito: "",
                                      }
                                    ];
                                    return {
                                      compartimentos: comps.map((c, i) => 
                                        i === cIdx ? { ...c, itens: newItens } : c
                                      )
                                    };
                                  });
                                }}
                                className="flex-1 py-1.5 border border-dashed border-zinc-700 rounded text-[9px] font-bold uppercase text-zinc-500 hover:border-amber-500/50 hover:text-amber-500 transition-all px-1"
                              >
                                + Armad
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                  updateChar(char => {
                                    const comps = char.compartimentos || [];
                                    const targetComp = comps[cIdx];
                                    const newItens = [
                                      ...(targetComp.itens || []),
                                      {
                                        id: generateId(),
                                        nome: "Nova Munição",
                                        peso: 0,
                                        volume: 0,
                                        quantidade: 20,
                                        tipo: "Munição",
                                        durabilidade: 0,
                                        maxDurabilidade: 0,
                                        descricao: "",
                                        perfuracao: 0,
                                        impacto: 0,
                                        resistencia: 0,
                                        efeito: "",
                                      }
                                    ];
                                    return {
                                      compartimentos: comps.map((c, i) => 
                                        i === cIdx ? { ...c, itens: newItens } : c
                                      )
                                    };
                                  });
                                }}
                                className="flex-1 py-1.5 border border-dashed border-zinc-700 rounded text-[9px] font-bold uppercase text-zinc-500 hover:border-amber-500/50 hover:text-amber-500 transition-all px-1"
                              >
                                + Mun
                              </motion.button>
                            </div>

                            {(multiClipboard.length > 0 || cutItem) && (
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                  if (cutItem) {
                                    handlePasteItemToCompartment(activeChar.id, comp.id);
                                  } else {
                                    updateChar(char => {
                                      const comps = char.compartimentos || [];
                                      const targetComp = comps[cIdx];
                                      const pastedItens = multiClipboard.map(item => ({
                                        ...item.data,
                                        id: generateId(),
                                      }));
                                      const newItens = [
                                        ...(targetComp.itens || []),
                                        ...pastedItens,
                                      ];
                                      return {
                                        compartimentos: comps.map((c, i) => 
                                          i === cIdx ? { ...c, itens: newItens } : c
                                        )
                                      };
                                    });
                                    setMultiClipboard([]);
                                    showToast(`${multiClipboard.length} itens colados no compartimento!`, "success");
                                  }
                                }}
                                className="w-full py-1.5 bg-emerald-500/10 border border-dashed border-emerald-500/50 rounded text-[9px] font-bold uppercase text-emerald-500 hover:bg-emerald-500/20 transition-all font-sans"
                              >
                                {cutItem ? `Colar Item Recortado` : `Colar Itens (${multiClipboard.length})`}
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
                                        <div className="flex items-center flex-1 min-w-0">
                                          {selectionMode && (
                                            <motion.button
                                              whileTap={{ scale: 0.9 }}
                                              onClick={() => toggleSelectItem(item.id)}
                                              className={cn(
                                                "p-1 rounded mr-2 transition-colors shrink-0",
                                                selectedItems.has(item.id)
                                                  ? "bg-amber-500 text-zinc-950"
                                                  : "bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-700",
                                              )}
                                            >
                                              {selectedItems.has(item.id) ? (
                                                <CheckSquare size={14} />
                                              ) : (
                                                <Square size={14} />
                                              )}
                                            </motion.button>
                                          )}
                                          <input
                                            value={item.nome}
                                            onChange={(e) => {
                                              const newName = e.target.value; updateChar(char => ({ compartimentos: (char.compartimentos || []).map((c, i) => i === cIdx ? { ...c, itens: (c.itens || []).map((it, j) => j === iIdx ? { ...it, nome: newName } : it) } : c) }));
                                            }}
                                            className="bg-transparent text-sm font-bold focus:outline-none flex-1 text-zinc-100"
                                          />
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => handleCutItem('inventory', activeChar.id, comp.id, item)}
                                            className="text-zinc-500 hover:text-amber-500 p-1"
                                            title="Recortar Item"
                                          >
                                            <Scissors size={20} />
                                          </motion.button>
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
                                                      : (item.tipo === "Acessório" || item.tipo === "Acessórios")
                                                        ? "Acessório"
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
                                              { updateChar(char => ({ compartimentos: (char.compartimentos || []).map((c, i) => i === cIdx ? { ...c, itens: (c.itens || []).filter(it => it.id !== item.id) } : c) })); }
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
                                            const val = parseInt(v) || 1; updateChar(char => ({ compartimentos: (char.compartimentos || []).map((c, i) => i === cIdx ? { ...c, itens: (c.itens || []).map((it, j) => j === iIdx ? { ...it, quantidade: val } : it) } : c) }));
                                          }}
                                        />
                                        <div className="flex flex-col">
                                          <span className="text-[10px] text-zinc-600 uppercase tracking-tighter font-bold">
                                            Total
                                          </span>
                                          <span className="text-xs font-bold text-zinc-400">
                                            {(
                                              (getItemPeso(item) * item.quantidade) / 10
                                            ).toFixed(2)}
                                            kg
                                          </span>
                                        </div>
                                      </div>

                                      <WeaponProperties
                                        item={item}
                                        character={activeChar}
                                        updateCharacter={updateChar}
                                        onChange={(updates) => {
                                          updateChar(char => ({
                                            compartimentos: (char.compartimentos || []).map(c => 
                                              c.id === comp.id ? {
                                                ...c,
                                                itens: (c.itens || []).map(it => it.id === item.id ? { ...it, ...updates } : it)
                                              } : c
                                            )
                                          }));
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
                                        <div className="flex items-center flex-1 min-w-0">
                                          {selectionMode && (
                                            <motion.button
                                              whileTap={{ scale: 0.9 }}
                                              onClick={() => toggleSelectItem(item.id)}
                                              className={cn(
                                                "p-1 rounded mr-2 transition-colors shrink-0",
                                                selectedItems.has(item.id)
                                                  ? "bg-amber-500 text-zinc-950"
                                                  : "bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-700",
                                              )}
                                            >
                                              {selectedItems.has(item.id) ? (
                                                <CheckSquare size={14} />
                                              ) : (
                                                <Square size={14} />
                                              )}
                                            </motion.button>
                                          )}
                                          <input
                                            value={item.nome}
                                            onChange={(e) => {
                                              const newName = e.target.value; updateChar(char => ({ compartimentos: (char.compartimentos || []).map((c, i) => i === cIdx ? { ...c, itens: (c.itens || []).map((it, j) => j === iIdx ? { ...it, nome: newName } : it) } : c) }));
                                            }}
                                            className="bg-transparent text-sm font-bold focus:outline-none flex-1 text-zinc-100"
                                          />
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => handleCutItem('inventory', activeChar.id, comp.id, item)}
                                            className="text-zinc-500 hover:text-amber-500 p-1"
                                            title="Recortar Item"
                                          >
                                            <Scissors size={20} />
                                          </motion.button>
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
                                              { updateChar(char => ({ compartimentos: (char.compartimentos || []).map((c, i) => i === cIdx ? { ...c, itens: (c.itens || []).filter(it => it.id !== item.id) } : c) })); }
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
                                            const val = parseInt(v) || 1; updateChar(char => ({ compartimentos: (char.compartimentos || []).map((c, i) => i === cIdx ? { ...c, itens: (c.itens || []).map((it, j) => j === iIdx ? { ...it, quantidade: val } : it) } : c) }));
                                          }}
                                        />
                                        <div className="flex flex-col">
                                          <span className="text-[10px] text-zinc-600 uppercase tracking-tighter font-bold">
                                            Total
                                          </span>
                                          <span className="text-xs font-bold text-zinc-400">
                                            {(
                                              (getItemPeso(item) * item.quantidade) / 10
                                            ).toFixed(2)}
                                            kg
                                          </span>
                                        </div>
                                      </div>

                                      <CatalystProperties
                                        item={item}
                                        onChange={(updates) => {
                                          updateChar(char => ({
                                            compartimentos: (char.compartimentos || []).map(c => 
                                              c.id === comp.id ? {
                                                ...c,
                                                itens: (c.itens || []).map(it => it.id === item.id ? { ...it, ...updates } : it)
                                              } : c
                                            )
                                          }));
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
                                        <div className="flex items-center flex-1 min-w-0">
                                          {selectionMode && (
                                            <motion.button
                                              whileTap={{ scale: 0.9 }}
                                              onClick={() => toggleSelectItem(item.id)}
                                              className={cn(
                                                "p-1 rounded mr-2 transition-colors shrink-0",
                                                selectedItems.has(item.id)
                                                  ? "bg-amber-500 text-zinc-950"
                                                  : "bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-700",
                                              )}
                                            >
                                              {selectedItems.has(item.id) ? (
                                                <CheckSquare size={14} />
                                              ) : (
                                                <Square size={14} />
                                              )}
                                            </motion.button>
                                          )}
                                          <input
                                            value={item.nome}
                                            onChange={(e) => {
                                              const newName = e.target.value; updateChar(char => ({ compartimentos: (char.compartimentos || []).map((c, i) => i === cIdx ? { ...c, itens: (c.itens || []).map((it, j) => j === iIdx ? { ...it, nome: newName } : it) } : c) }));
                                            }}
                                            className="bg-transparent text-sm font-bold focus:outline-none flex-1 text-zinc-100"
                                          />
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => handleCutItem('inventory', activeChar.id, comp.id, item)}
                                            className="text-zinc-500 hover:text-amber-500 p-1"
                                            title="Recortar Item"
                                          >
                                            <Scissors size={20} />
                                          </motion.button>
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
                                              { updateChar(char => ({ compartimentos: (char.compartimentos || []).map((c, i) => i === cIdx ? { ...c, itens: (c.itens || []).filter(it => it.id !== item.id) } : c) })); }
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
                                            const val = parseInt(v) || 1; updateChar(char => ({ compartimentos: (char.compartimentos || []).map((c, i) => i === cIdx ? { ...c, itens: (c.itens || []).map((it, j) => j === iIdx ? { ...it, quantidade: val } : it) } : c) }));
                                          }}
                                        />
                                        <div className="flex flex-col">
                                          <span className="text-[10px] text-zinc-600 uppercase tracking-tighter font-bold">
                                            Total
                                          </span>
                                          <span className="text-xs font-bold text-zinc-400">
                                            {(
                                              (getItemPeso(item) * item.quantidade) / 10
                                            ).toFixed(2)}
                                            kg
                                          </span>
                                        </div>
                                      </div>

                                      <ArmorProperties
                                        item={item}
                                        onChange={(updates) => {
                                          updateChar(char => ({
                                            compartimentos: (char.compartimentos || []).map(c => 
                                              c.id === comp.id ? {
                                                ...c,
                                                itens: (c.itens || []).map(it => it.id === item.id ? { ...it, ...updates } : it)
                                              } : c
                                            )
                                          }));
                                        }}
                                      />
                                    </div>
                                  ) : null,
                                )}
                              </SubSection>

                              <SubSection
                                title="Munições"
                                icon={<Disc size={14} />}
                                defaultCollapsed={true}
                              >
                                {(comp.itens || []).map((item, iIdx) =>
                                  item.tipo === "Munição" ? (
                                    <div
                                      key={item.id}
                                      className="bg-zinc-900 p-2 rounded border border-zinc-800 group relative space-y-2"
                                    >
                                      <div className="flex justify-between items-center mb-1">
                                        <div className="flex items-center flex-1 min-w-0">
                                          {selectionMode && (
                                            <motion.button
                                              whileTap={{ scale: 0.9 }}
                                              onClick={() => toggleSelectItem(item.id)}
                                              className={cn(
                                                "p-1 rounded mr-2 transition-colors shrink-0",
                                                selectedItems.has(item.id)
                                                  ? "bg-amber-500 text-zinc-950"
                                                  : "bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-700",
                                              )}
                                            >
                                              {selectedItems.has(item.id) ? (
                                                <CheckSquare size={14} />
                                              ) : (
                                                <Square size={14} />
                                              )}
                                            </motion.button>
                                          )}
                                          <input
                                            value={item.nome}
                                            onChange={(e) => {
                                              const newName = e.target.value; updateChar(char => ({ compartimentos: (char.compartimentos || []).map((c, i) => i === cIdx ? { ...c, itens: (c.itens || []).map((it, j) => j === iIdx ? { ...it, nome: newName } : it) } : c) }));
                                            }}
                                            className="bg-transparent text-sm font-bold focus:outline-none flex-1 text-zinc-100"
                                          />
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => handleCutItem('inventory', activeChar.id, comp.id, item)}
                                            className="text-zinc-500 hover:text-amber-500 p-1"
                                            title="Recortar Item"
                                          >
                                            <Scissors size={20} />
                                          </motion.button>
                                          <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() =>
                                              copyToClipboard("Item", item)
                                            }
                                            className="text-zinc-500 hover:text-zinc-300 p-1"
                                            title="Copiar Item"
                                          >
                                            <Copy size={20} />
                                          </motion.button>
                                          <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => {
                                              { updateChar(char => ({ compartimentos: (char.compartimentos || []).map((c, i) => i === cIdx ? { ...c, itens: (c.itens || []).filter(it => it.id !== item.id) } : c) })); }
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
                                            const val = parseInt(v) || 1; updateChar(char => ({ compartimentos: (char.compartimentos || []).map((c, i) => i === cIdx ? { ...c, itens: (c.itens || []).map((it, j) => j === iIdx ? { ...it, quantidade: val } : it) } : c) }));
                                          }}
                                        />
                                        <div className="flex flex-col">
                                          <span className="text-[10px] text-zinc-600 uppercase tracking-tighter font-bold">
                                            Total
                                          </span>
                                          <span className="text-xs font-bold text-zinc-400">
                                            {(
                                              (getItemPeso(item) * item.quantidade) / 10
                                            ).toFixed(2)}
                                            kg
                                          </span>
                                        </div>
                                      </div>

                                      <AmmunitionProperties
                                        item={item}
                                        onChange={(updates) => {
                                          updateChar(char => ({
                                            compartimentos: (char.compartimentos || []).map(c => 
                                              c.id === comp.id ? {
                                                ...c,
                                                itens: (c.itens || []).map(it => it.id === item.id ? { ...it, ...updates } : it)
                                              } : c
                                            )
                                          }));
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
                                  item.tipo !== "Catalisador" &&
                                  item.tipo !== "Munição" ? (
                                    <div
                                      key={item.id}
                                      className="bg-zinc-900 p-2 rounded border border-zinc-800 group relative space-y-2"
                                    >
                                      <div className="flex justify-between items-center mb-1">
                                        <div className="flex items-center flex-1 min-w-0">
                                          {selectionMode && (
                                            <motion.button
                                              whileTap={{ scale: 0.9 }}
                                              onClick={() => toggleSelectItem(item.id)}
                                              className={cn(
                                                "p-1 rounded mr-2 transition-colors shrink-0",
                                                selectedItems.has(item.id)
                                                  ? "bg-amber-500 text-zinc-950"
                                                  : "bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-zinc-700",
                                              )}
                                            >
                                              {selectedItems.has(item.id) ? (
                                                <CheckSquare size={14} />
                                              ) : (
                                                <Square size={14} />
                                              )}
                                            </motion.button>
                                          )}
                                          <input
                                            value={item.nome}
                                            onChange={(e) => {
                                              const newName = e.target.value; updateChar(char => ({ compartimentos: (char.compartimentos || []).map((c, i) => i === cIdx ? { ...c, itens: (c.itens || []).map((it, j) => j === iIdx ? { ...it, nome: newName } : it) } : c) }));
                                            }}
                                            className="bg-transparent text-sm font-bold focus:outline-none flex-1 text-zinc-100"
                                          />
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => handleCutItem('inventory', activeChar.id, comp.id, item)}
                                            className="text-zinc-500 hover:text-amber-500 p-1"
                                            title="Recortar Item"
                                          >
                                            <Scissors size={20} />
                                          </motion.button>
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
                                              { updateChar(char => ({ compartimentos: (char.compartimentos || []).map((c, i) => i === cIdx ? { ...c, itens: (c.itens || []).filter(it => it.id !== item.id) } : c) })); }
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
                                            const val = parseInt(v) || 1; updateChar(char => ({ compartimentos: (char.compartimentos || []).map((c, i) => i === cIdx ? { ...c, itens: (c.itens || []).map((it, j) => j === iIdx ? { ...it, quantidade: val } : it) } : c) }));
                                          }}
                                        />
                                        <MiniInput
                                          label="Kg"
                                          type="number"
                                          value={item.peso ?? 0}
                                          onChange={(v) => {
                                            const val = parseFloat(v) || 0;
                                            updateChar(char => ({
                                              compartimentos: (char.compartimentos || []).map(c => 
                                                c.id === comp.id ? {
                                                  ...c,
                                                  itens: (c.itens || []).map(it => it.id === item.id ? { ...it, peso: val } : it)
                                                } : c
                                              )
                                            }));
                                          }}
                                        />
                                        <MiniInput
                                          label="Vol"
                                          type="number"
                                          value={item.volume ?? 0}
                                          onChange={(v) => {
                                            const val = parseFloat(v) || 0;
                                            updateChar(char => ({
                                              compartimentos: (char.compartimentos || []).map(c => 
                                                c.id === comp.id ? {
                                                  ...c,
                                                  itens: (c.itens || []).map(it => it.id === item.id ? { ...it, volume: val } : it)
                                                } : c
                                              )
                                            }));
                                          }}
                                        />
                                        <div className="flex flex-col">
                                          <span className="text-[10px] text-zinc-600 uppercase tracking-tighter font-bold">
                                            Total
                                          </span>
                                          <span className="text-xs font-bold text-zinc-400">
                                            {(
                                              (getItemPeso(item) * item.quantidade) / 10
                                            ).toFixed(2)}
                                            kg
                                          </span>
                                        </div>
                                      </div>

                                       {item.tipo === "Munição" && (
                                        <div className="grid grid-cols-3 gap-2">
                                          <MiniInput
                                            label="Perf"
                                            type="number"
                                            value={item.perfuracao ?? 0}
                                            onChange={(v) => {
                                              const val = parseInt(v) || 0;
                                              updateChar(char => ({
                                                compartimentos: (char.compartimentos || []).map(c => 
                                                  c.id === comp.id ? {
                                                    ...c,
                                                    itens: (c.itens || []).map(it => it.id === item.id ? { ...it, perfuracao: val } : it)
                                                  } : c
                                                )
                                              }));
                                            }}
                                          />
                                          <MiniInput
                                            label="Imp"
                                            type="number"
                                            value={item.impacto ?? 0}
                                            onChange={(v) => {
                                              const val = parseInt(v) || 0;
                                              updateChar(char => ({
                                                compartimentos: (char.compartimentos || []).map(c => 
                                                  c.id === comp.id ? {
                                                    ...c,
                                                    itens: (c.itens || []).map(it => it.id === item.id ? { ...it, impacto: val } : it)
                                                  } : c
                                                )
                                              }));
                                            }}
                                          />
                                          <MiniInput
                                            label="Res"
                                            type="number"
                                            value={item.resistencia ?? 0}
                                            onChange={(v) => {
                                              const val = parseInt(v) || 0;
                                              updateChar(char => ({
                                                compartimentos: (char.compartimentos || []).map(c => 
                                                  c.id === comp.id ? {
                                                    ...c,
                                                    itens: (c.itens || []).map(it => it.id === item.id ? { ...it, resistencia: val } : it)
                                                  } : c
                                                )
                                              }));
                                            }}
                                          />
                                        </div>
                                      )}

                                      <TextArea
                                        label="Descrição"
                                        value={item.descricao || ""}
                                        onChange={(v) => {
                                          updateChar(char => ({
                                            compartimentos: (char.compartimentos || []).map(c => 
                                              c.id === comp.id ? {
                                                ...c,
                                                itens: (c.itens || []).map(it => it.id === item.id ? { ...it, descricao: v } : it)
                                              } : c
                                            )
                                          }));
                                        }}
                                      />
                                    </div>
                                  ) : null,
                                )}
                              </SubSection>
                            </div>
                            {multiClipboard.length > 0 && (
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                  updateChar(char => {
                                    const comps = char.compartimentos || [];
                                    const targetComp = comps[cIdx];
                                    const pastedItens = multiClipboard.map(item => ({
                                      ...item.data,
                                      id: generateId(),
                                    }));
                                    const newItens = [
                                      ...(targetComp.itens || []),
                                      ...pastedItens,
                                    ];
                                    return {
                                      compartimentos: comps.map((c, i) => 
                                        i === cIdx ? { ...c, itens: newItens } : c
                                      )
                                    };
                                  });
                                  setMultiClipboard([]);
                                  showToast(`${multiClipboard.length} itens colados no compartimento!`, "success");
                                }}
                                className="w-full py-2 bg-emerald-500/10 border border-dashed border-emerald-500/50 rounded text-[10px] font-bold uppercase text-emerald-500 hover:bg-emerald-500/20 transition-all font-sans"
                              >
                                Colar Itens ({multiClipboard.length})
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
                      {multiClipboard.length > 0 &&
                        !selectionMode &&
                        multiClipboard.some((it) => it.type === "Magia") && (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={handlePasteSelected}
                            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all"
                          >
                            Colar Magias ({multiClipboard.filter(it => it.type === "Magia").length})
                          </motion.button>
                        )}
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          updateChar(c => ({
                            magias: [
                              ...(c.magias || []),
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
                          }));
                        }}
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
                          <div className="flex items-center flex-1 min-w-0">
                            <input
                              value={m.nome || ""}
                              onChange={(e) => {
                                const newMags = [...(activeChar?.magias || [])];
                                newMags[idx].nome = e.target.value;
                                updateChar({ magias: newMags });
                              }}
                              className="bg-transparent font-bold focus:outline-none flex-1 min-w-0 text-amber-500"
                            />
                          </div>
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
                                const val = e.target.value; updateChar(c => { const na = [...(c.magias || [])]; if (na[idx]) na[idx].escola = val; return { magias: na }; });
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
                                 const val = e.target.value; updateChar(c => { const na = [...(c.magias || [])]; if (na[idx]) na[idx].tipo = val as any; return { magias: na }; });
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
                              updateChar(c => { const na = [...(c.magias || [])]; if (na[idx]) na[idx].dano = v; return { magias: na }; });
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
                              updateChar(c => { const na = [...(c.magias || [])]; if (na[idx]) na[idx].acerto = parseInt(v) || 0; return { magias: na }; });
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
                              updateChar(c => { const na = [...(c.magias || [])]; if (na[idx]) na[idx].mana = parseInt(v) || 0; return { magias: na }; });
                            }}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter mb-0.5 truncate">
                              Escala
                            </span>
                            <select
                              value={m.escala || "0"}
                              onChange={(e) => {
                                const val = e.target.value; updateChar(c => { const na = [...(c.magias || [])]; if (na[idx]) na[idx].escala = val as any; return { magias: na }; });
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
                                const r = randomInt(1, 8);
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

                              // 4. Roll Damage using robust utility
                              const rollData = parseAndRollDice(m.dano || "1d6");
                              const finalDmgTotal = rollData.total + (scalingBonus || 0);
                              let finalDmgFormula = rollData.fullFormula;
                              if (scalingBonus) {
                                finalDmgFormula += ` ${scalingBonus > 0 ? '+' : ''}${scalingBonus}`;
                              }

                              // 4.5. Roll Hit Location (1d6)
                              const locationIdx = randomInt(0, 5);
                              const locationName = HIT_LOCATIONS[locationIdx];

                              // 5. Update via handleRollResult for consistency
                              handleRollResult({
                                isCombat: true,
                                hitSucceeded: true,
                                armaNome: m.nome,
                                hitResult: finalHit,
                                hitRolls: hitRolls,
                                hitFormula: hitFormula,
                                hitBonus: totalHitBonus,
                                dmgResult: finalDmgTotal,
                                dmgFormula: finalDmgFormula,
                                dmgRolls: rollData.rolls,
                                dmgBonus: (scalingBonus || 0) + rollData.flatBonus,
                                hitLocation: locationName,
                                result: finalHit,
                                formula: `${m.nome}: Acerto ${finalHit} | Dano ${finalDmgTotal}`
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
                                const r = randomInt(1, 8);
                                hitRolls.push(r);
                                hitTotal += r;
                              }
                              const finalHit = hitTotal + totalHitBonus;
                              const hitFormula = `3d8${totalHitBonus !== 0 ? (totalHitBonus > 0 ? "+" : "") + totalHitBonus : ""}`;

                              // 4.5. Roll Hit Location (1d6)
                              const locationIdx = randomInt(0, 5);
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
                            updateChar(c => { const na = [...(c.magias || [])]; if (na[idx]) na[idx].efeito = v; return { magias: na }; });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </Section>

              {!isCreatureMode && (
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
                      <div className="flex items-center">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() =>
                            updateChar((c) => ({
                              habilidades: [
                                ...(c.habilidades || []),
                                {
                                  id: generateId(),
                                  nome: "Nova Habilidade",
                                  efeito: "",
                                },
                              ],
                            }))
                          }
                          className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 p-1.5 rounded transition-colors"
                        >
                          <Plus size={16} />
                        </motion.button>
                      </div>
                    </div>

                    {multiClipboard.length > 0 &&
                      !selectionMode &&
                      multiClipboard.some((it) => it.type === "Habilidade") && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={handlePasteSelected}
                          className="w-full py-2 mb-2 bg-emerald-500/10 border border-dashed border-emerald-500/50 rounded text-[10px] font-bold uppercase text-emerald-500 hover:bg-emerald-500/20 transition-all font-sans"
                        >
                          Colar Habilidades ({multiClipboard.filter(it => it.type === "Habilidade").length})
                        </motion.button>
                      )}
                    <div className="space-y-3">
                      {(activeChar?.habilidades || []).map((h, idx) => (
                        <div
                          key={h.id}
                          className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs relative group space-y-2"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center flex-1 min-w-0">
                              <input
                                value={h.nome || ""}
                                onChange={(e) => {
                                  const newHabs = [
                                    ...(activeChar?.habilidades || []),
                                  ];
                                  newHabs[idx].nome = e.target.value;
                                  updateChar((char) => ({ habilidades: newHabs }));
                                }}
                                className="bg-transparent font-bold focus:outline-none flex-1 min-w-0 text-amber-500"
                              />
                            </div>
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
              )}
              {!isCreatureMode && (
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
                                  updateChar(c => ({ conhecimentos: newKs }));
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
                                      updateChar(c => ({ conhecimentos: newKs }));
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
              )}

              {!isCreatureMode && (
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
                                const newEscalas = (activeChar.escalas || []).map((item, i) => {
                                  if (i === idx) {
                                    return { ...item, nome: e.target.value };
                                  }
                                  return item;
                                });
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
                                  const newEscalas = (activeChar.escalas || []).map((item, i) => {
                                    if (i === idx) {
                                      return { ...item, bonus: e.target.value };
                                    }
                                    return item;
                                  });
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
                                                const newEscalas = (activeChar.escalas || []).map((item, i) => {
                                                  if (i === idx) {
                                                    return { ...item, nivel: lIdx };
                                                  }
                                                  return item;
                                                });
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
                                      const newEscalas = (activeChar.escalas || []).map((item, i) => {
                                        if (i === idx) {
                                          return { ...item, xp: Math.max(0, item.xp - 1) };
                                        }
                                        return item;
                                      });
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
                                        updatedS.xp = 0;
                                      }
                                      const newEscalas = (activeChar.escalas || []).map((item, i) => {
                                        if (i === idx) {
                                          return updatedS;
                                        }
                                        return item;
                                      });
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
                                      const newEscalas = (activeChar.escalas || []).map((item, i) => {
                                        if (i === idx) {
                                          return updatedS;
                                        }
                                        return item;
                                      });
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
            )}


            </div>
          );

          if (activePage === "sheet") {
            return renderSheetContent();
          }

          const renderOtherPages = () => {
            return activePage === "dice" ? (
          <div className="flex flex-col h-full w-full max-w-5xl mx-auto bg-zinc-950">
            {/* Tabs Header */}
            <div className="flex border-b border-zinc-800 bg-zinc-900/10">
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

                        const totalHit = (acuraciaBonus || 0);
                        const weaponAcerto = (arma.acerto || 0);
                        let displayDano = arma.dano || "1d6";
                        if (arma.categoria === 'Arma de Fogo') {
                          if (arma.magazineAmmo && arma.magazineAmmo.length > 0) {
                            displayDano = arma.magazineAmmo[0].dano || "1d6";
                          } else {
                            const loadedBullet = (activeChar.compartimentos || [])
                              .filter((c: any) => !c.externo)
                              .flatMap((c: any) => (c.itens || []))
                              .find((i: any) => i.id === arma.bulletId);
                            if (loadedBullet && loadedBullet.dano) {
                              displayDano = loadedBullet.dano;
                            } else {
                              displayDano = "Falta Bala";
                            }
                          }
                        }
                        const danoStr = displayDano.toLowerCase().replace(/\s+/g, "");

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
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                                <span className="text-[9px] text-zinc-500 font-bold uppercase">
                                  {arma.categoria !== 'Arma de Fogo' ? (
                                    <>Escala {arma.escala || "0"} • {arma.atributoBase} • </>
                                  ) : null}
                                  Acerto Arma: {weaponAcerto}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/50">
                              <div className="flex flex-col">
                                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                                  Bônus Acerto
                                </span>
                                <span className="text-xs font-black text-amber-500">
                                  +{totalHit}
                                </span>
                                <span className="text-[7px] text-zinc-600 uppercase font-bold">
                                  Acurácia +{acuraciaBonus}
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                                  Dano
                                </span>
                                <span className="text-xs font-black text-zinc-300">
                                  {danoStr}{arma.categoria !== 'Arma de Fogo' && (scalingBonus > 0 ? `+${scalingBonus}` : scalingBonus < 0 ? scalingBonus : "")}
                                </span>
                                {arma.categoria !== 'Arma de Fogo' && (
                                  <span className="text-[7px] text-zinc-600 uppercase font-bold">
                                    Escala +{scalingBonus}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="pt-2 border-t border-zinc-800/50 flex items-center justify-between">
                              <span className="text-[10px] font-black text-amber-500/80 uppercase tracking-widest flex items-center gap-1">
                                Rolar <Plus size={10} />
                              </span>
                            </div>
                          </motion.button>
                        );
                      })}
                      {!activeChar.armas?.length && !activeChar.magias?.length && (
                        <div className="col-span-full py-4 text-center text-zinc-600 text-[10px] font-bold uppercase italic border border-dashed border-zinc-800 rounded-xl">
                          Nenhum ataque ou magia disponível
                        </div>
                      )}
                      
                      {/* Magias do Personagem */}
                      {(activeChar.magias || []).map((spell, sIdx) => {
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

                        const totalHit = (acuraciaBonus || 0);
                        const spellAcerto = (spell.acerto || 0);
                        const danoStr = (spell.dano || "1d6").toLowerCase().replace(/\s+/g, "");
                        
                        const catalyst = activeChar.catalisadores?.[0];
                        const catalystBonus = catalyst ? (calculateWeaponDamageBonus(catalyst as any, activeChar.stats.INT) || 0) : 0;

                        return (
                          <motion.button
                            key={`${spell.id}-${sIdx}`}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => rollSpell(spell, diceBonus)}
                            className="flex flex-col gap-3 p-4 bg-indigo-900/10 border border-indigo-900/30 rounded-xl hover:border-indigo-500/50 transition-all text-left relative group overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity">
                              <Zap size={24} className="text-indigo-400" />
                            </div>

                            <div className="flex flex-col">
                              <span className="text-xs font-black text-indigo-400 uppercase tracking-tighter truncate pr-8">
                                {spell.nome}
                              </span>
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                                <span className="text-[9px] text-zinc-500 font-bold uppercase">
                                  {spell.escola} • Acerto Magia: {spellAcerto} • Mana: {spell.mana}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/50">
                              <div className="flex flex-col">
                                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                                  Bônus Acerto
                                </span>
                                <span className="text-xs font-black text-indigo-400">
                                  +{totalHit}
                                </span>
                                <span className="text-[7px] text-zinc-600 uppercase font-bold">
                                  Acurácia +{acuraciaBonus}
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                                  Dano
                                </span>
                                <span className="text-xs font-black text-zinc-300">
                                  {danoStr}{catalystBonus > 0 ? `+${catalystBonus}` : catalystBonus < 0 ? catalystBonus : ""}
                                </span>
                                <span className="text-[7px] text-zinc-600 uppercase font-bold text-indigo-900/70">
                                  Catalisador +{catalystBonus}
                                </span>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-zinc-800/50 flex items-center justify-between">
                              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                                Conjurar <Zap size={10} />
                              </span>
                            </div>
                          </motion.button>
                        );
                      })}
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
                          className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 group space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                                roll.isCombat && roll.hitSucceeded === false ? "bg-zinc-800 text-zinc-500" : "bg-zinc-800 text-amber-500"
                              )}>
                                {roll.isCombat ? roll.hitResult : roll.result}
                              </div>
                              <div>
                                <div className="text-[10px] font-bold text-zinc-300 uppercase">
                                  {roll.isCombat ? roll.armaNome : (roll.formula || `d${roll.result}`)}
                                </div>
                                <div className="text-[9px] text-zinc-600">
                                  {new Date(roll.timestamp).toLocaleTimeString(
                                    [],
                                    { hour: "2-digit", minute: "2-digit" },
                                  )}
                                </div>
                              </div>
                            </div>
                            {roll.isCombat ? (
                              <div className="flex flex-col items-end gap-1">
                                {roll.hitSucceeded !== false && (
                                  <div className="bg-amber-500/10 px-2 py-1 rounded text-amber-500 text-[10px] font-black uppercase leading-none">
                                    {roll.dmgResult} Dano
                                  </div>
                                )}
                                <div className={cn(
                                  "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider leading-none",
                                  roll.hitSucceeded === false 
                                    ? (getDetailedCombatTitle(roll).includes("defendeu") ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20")
                                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                )}>
                                  {getDetailedCombatTitle(roll)}
                                </div>
                              </div>
                            ) : null}
                          </div>

                          <div className="text-[9px] text-zinc-400/80 leading-tight">
                            {roll.isCombat ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 opacity-70">
                                  <span className="font-bold">Acerto:</span>
                                  <span>{roll.hitFormula}</span>
                                  <span className="text-zinc-500">[{roll.hitRolls?.join(', ')}]</span>
                                </div>
                                {roll.hitSucceeded !== false && (
                                  <>
                                    <div className="flex items-center gap-1 opacity-70">
                                      <span className="font-bold">Dano:</span>
                                      <span>{roll.dmgFormula}</span>
                                      <span className="text-zinc-500">[{roll.dmgRolls?.join(', ')}]</span>
                                    </div>
                                    {roll.hitLocation && (
                                      <div className="flex items-center gap-1 opacity-70">
                                        <span className="font-bold">Local:</span>
                                        <span className="text-amber-500/80">{roll.hitLocation}</span>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 opacity-70">
                                <span>{roll.formula}</span>
                                {roll.rolls && roll.rolls.length > 0 && (
                                  <span className="text-zinc-500">[{roll.rolls.join(', ')}]</span>
                                )}
                                {roll.bonus !== 0 && (
                                  <span className="text-amber-500/60">{roll.bonus! > 0 ? '+' : ''}{roll.bonus}</span>
                                )}
                              </div>
                            )}
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
                    defaultCollapsed={true}
                  >
                    <div className="space-y-4">
                      <div className="flex justify-between items-center gap-4">
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                            Título da Aba
                          </label>
                          <input
                            value={note.titulo || ""}
                            onChange={(e) => {
                              const newNotes = (activeChar.anotacoes || []).map((n, i) =>
                                i === idx ? { ...n, titulo: e.target.value } : n
                              );
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
                          value={note.conteudo ?? ""}
                          onChange={(e) => {
                            const newNotes = (activeChar.anotacoes || []).map((n, i) =>
                              i === idx ? { ...n, conteudo: e.target.value } : n
                            );
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
        ) : activePage === "library" ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-black text-amber-500 uppercase tracking-tighter">
                    Biblioteca de Personagens
                  </h2>
                  <p className="text-zinc-500 text-sm">
                    {state.characters.filter(char => !user || !char.userId || char.userId === user.uid).length} personagem(ns) sincronizados com a nuvem.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-xl font-bold cursor-pointer transition-all border border-zinc-700 shadow-lg">
                    <Upload size={20} className="text-amber-500" />
                    <span>Importar</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={importJSON}
                      accept=".json"
                    />
                  </label>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      const nc = createEmptyCharacter();
                      setState((prev) => ({
                        ...prev,
                        characters: [nc, ...prev.characters],
                        activeCharacterId: nc.id,
                      }));
                      if (user) {
                        saveCharacterToFirestore(nc);
                      }
                      setActivePage("sheet");
                    }}
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/20"
                  >
                    <Plus size={20} />
                    <span>Novo</span>
                  </motion.button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {state.characters.filter(char => !user || !char.userId || char.userId === user.uid).map((char) => (
                  <motion.div
                    key={char.id}
                    layoutId={char.id}
                    className={cn(
                      "group relative bg-zinc-900 border transition-all rounded-3xl overflow-hidden cursor-pointer",
                      state.activeCharacterId === char.id
                        ? "border-amber-500 ring-1 ring-amber-500/50 shadow-2xl shadow-amber-500/10"
                        : "border-zinc-800 hover:border-zinc-700"
                    )}
                    onClick={() => {
                      setState(prev => ({ ...prev, activeCharacterId: char.id }));
                    }}
                  >
                    <div className="aspect-[16/9] w-full relative bg-zinc-950 overflow-hidden">
                      {char.imagem ? (
                        <img
                          src={char.imagem}
                          alt={char.nome}
                          className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center opacity-20">
                          <UserIcon size={64} className="text-zinc-500" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent" />
                      <div className="absolute bottom-4 left-4 right-4">
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter truncate font-mono">
                          {char.nome || "Sem Nome"}
                        </h3>
                        <p className="text-amber-500/80 text-xs font-bold uppercase tracking-wider">
                          {char.etnia || "Etnia não definida"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-black/20 p-2 rounded-xl border border-zinc-800/50">
                          <span className="block text-[8px] font-bold text-zinc-500 uppercase">Vida</span>
                          <span className="text-sm font-mono text-emerald-500 font-bold">
                            {char.vidaAtual} / {getVidaMaxima(char.stats.CON)}
                          </span>
                        </div>
                        <div className="bg-black/20 p-2 rounded-xl border border-zinc-800/50">
                          <span className="block text-[8px] font-bold text-zinc-500 uppercase">Mana</span>
                          <span className="text-sm font-mono text-blue-500 font-bold">
                            {char.manaAtual} / {getManaMaxima(char.stats.APR)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setState(prev => ({ ...prev, activeCharacterId: char.id }));
                            setActivePage("sheet");
                          }}
                          className={cn(
                            "flex-1 py-2 px-4 rounded-xl font-bold text-xs uppercase transition-all",
                            state.activeCharacterId === char.id
                              ? "bg-amber-500 text-zinc-950"
                              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                          )}
                        >
                          Jogar
                        </motion.button>
                        
                        <div className="flex items-center gap-1">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              const nc = { ...char, id: generateId(), nome: `${char.nome} (Cópia)` };
                              setState(prev => ({
                                ...prev,
                                characters: [nc, ...prev.characters],
                                activeCharacterId: nc.id
                              }));
                              if (user) saveCharacterToFirestore(nc);
                              showToast("Cópia criada!", "success");
                            }}
                            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-colors border border-zinc-700"
                            title="Duplicar"
                          >
                            <Copy size={16} />
                          </motion.button>
                          
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (charIdToDelete === char.id) {
                                deletedCharsRef.current.add(char.id);
                                if (char.campaignId) {
                                  try {
                                    const storedKey = `campaign_characters_${char.campaignId}`;
                                    const stored = localStorage.getItem(storedKey);
                                    if (stored) {
                                      const parsed = JSON.parse(stored);
                                      if (Array.isArray(parsed)) {
                                        const filtered = parsed.filter((c: any) => c.id !== char.id);
                                        localStorage.setItem(storedKey, JSON.stringify(filtered));
                                      }
                                    }
                                  } catch (e) {
                                    console.error("Error cleaning up deleted char from campaign cache:", e);
                                  }
                                }
                                // Cancel any pending sync timers before deleting to prevent race condition uploads
                                if (syncTimersRef.current[char.id]) {
                                  console.log(`🛑 [LibraryDelete] Cancelando upload pendente do personagem de ID ${char.id} antes da remoção`);
                                  clearTimeout(syncTimersRef.current[char.id]);
                                  delete syncTimersRef.current[char.id];
                                }
                                if (user) deleteCharacterFromFirestore(char.id);
                                setState(prev => {
                                  const filtered = prev.characters.filter(c => c.id !== char.id);
                                  const newDirtyIds = (prev.dirtyCharacterIds || []).filter(id => id !== char.id);
                                  return {
                                    ...prev,
                                    characters: filtered,
                                    activeCharacterId: filtered.length > 0 ? filtered[0].id : "",
                                    dirtyCharacterIds: newDirtyIds
                                  };
                                });
                                showToast("Personagem removido.", "info");
                                setCharIdToDelete(null);
                              } else {
                                setCharIdToDelete(char.id);
                                setTimeout(() => setCharIdToDelete(null), 3000);
                              }
                            }}
                            className={cn(
                              "p-2 rounded-lg transition-all border",
                              charIdToDelete === char.id
                                ? "bg-red-600 text-white border-red-500 animate-pulse"
                                : "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20"
                            )}
                            title={charIdToDelete === char.id ? "Confirmar Exclusão?" : "Excluir"}
                          >
                            <Trash2 size={16} />
                            {charIdToDelete === char.id && <span className="text-[10px] ml-1 font-bold">Excluir?</span>}
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {state.characters.length === 0 && (
                <div className="text-center py-32 bg-zinc-900/20 border-2 border-dashed border-zinc-800 rounded-3xl">
                  <Library size={64} className="mx-auto text-zinc-800 mb-6" />
                  <h3 className="text-xl font-bold text-zinc-400 uppercase tracking-tighter">Sua biblioteca está vazia</h3>
                  <p className="text-zinc-600 mb-8">Crie um novo personagem ou importe um arquivo .json</p>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      const nc = createEmptyCharacter();
                      setState((prev) => ({
                        ...prev,
                        characters: [nc],
                        activeCharacterId: nc.id,
                      }));
                      if (user) saveCharacterToFirestore(nc);
                    }}
                    className="bg-amber-500 text-zinc-950 px-8 py-3 rounded-2xl font-black uppercase tracking-tighter hover:bg-amber-400 transition-all shadow-xl shadow-amber-500/20"
                  >
                    Iniciar Aventura
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
                        reader.onloadend = async () => {
                          try {
                            // Compressing to fit Firestore limit (1MB total for doc)
                            // 1280px at 0.8 is a good compromise for quality vs size
                            const compressed = await compressImageDataUrl(reader.result as string, 1280, 0.8);
                            const newImg = {
                              id: generateId(),
                              url: compressed,
                              titulo: "Nova Imagem",
                            };
                            updateChar({
                              imagens: [...(activeChar.imagens || []), newImg],
                            });
                          } catch (err) {
                            console.error("Compression error:", err);
                            const newImg = {
                              id: generateId(),
                              url: reader.result as string,
                              titulo: "Nova Imagem",
                            };
                            updateChar({
                              imagens: [...(activeChar.imagens || []), newImg],
                            });
                          }
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
                    className="relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden aspect-square shadow-lg cursor-pointer group"
                    onClick={() => setSelectedGalleryImage(img.url)}
                  >
                    {img.url ? (
                      <img
                        src={img.url}
                        alt="Galeria"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-950">
                        <Image className="text-zinc-800" size={48} />
                      </div>
                    )}
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const newImgs = activeChar.imagens.filter(
                          (i) => i.id !== img.id,
                        );
                        updateChar({ imagens: newImgs });
                      }}
                      className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full shadow-lg transition-colors z-10 opacity-0 group-hover:opacity-100"
                      title="Remover Imagem"
                    >
                      <Trash2 size={20} />
                    </motion.button>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <Maximize size={32} className="text-white/70" />
                    </div>
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
        ) : activePage === "master" ? (
          <div className="w-full flex-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
            <div className="w-full max-w-6xl mx-auto p-4 md:p-8 space-y-8 pb-32">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-3xl font-black text-purple-500 uppercase tracking-tighter">Painel do Mestre</h2>
                  <p className="text-zinc-500 text-sm">Gerencie suas campanhas e visualize as fichas dos seus jogadores.</p>
                </div>
                
                {!user ? (
                  <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl text-center w-full md:w-auto">
                    <Shield size={32} className="mx-auto text-zinc-700 mb-4" />
                    <p className="text-zinc-400 mb-4">Você precisa estar logado para usar o Modo Mestre.</p>
                    <button 
                      onClick={loginWithGoogle}
                      className="px-6 py-2 bg-amber-500 text-zinc-950 font-bold rounded-lg hover:bg-amber-400 transition-colors"
                    >
                      Entrar com Google
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full md:w-auto">
                    <div className="flex gap-2 flex-1 sm:flex-none">
                       <input 
                         type="text" 
                         placeholder="Cód. Convite"
                         value={inviteCodeInput}
                         onChange={(e) => setInviteCodeInput(e.target.value)}
                         className="flex-1 sm:w-32 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                       />
                       <button 
                         onClick={async () => {
                           if (!activeChar) {
                             showToast("Selecione uma ficha para vincular à campanha.", "error");
                             return;
                           }
                           try {
                             await joinCampaign(activeChar.id, inviteCodeInput);
                             showToast("Ficha vinculada à campanha!", "success");
                             setInviteCodeInput("");
                           } catch (err: any) {
                             showToast(err.message, "error");
                           }
                         }}
                         className="whitespace-nowrap px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition-colors text-xs uppercase"
                       >
                         Vincular
                       </button>
                    </div>
                    
                    <div className="flex gap-2 flex-1 sm:flex-none">
                       <input 
                         type="text" 
                         placeholder="Nome da Nova Campanha"
                         value={newCampaignName}
                         onChange={(e) => setNewCampaignName(e.target.value)}
                         className="flex-1 sm:w-48 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                       />
                       <button 
                         onClick={async () => {
                           if (!newCampaignName) return;
                           let camp = null;
                            try {
                              camp = await createCampaign(newCampaignName);
                            } catch (err: any) {
                              showToast(err.message || "Erro ao criar campanha.", "error");
                            }
                           if (camp) {
                             showToast("Campanha criada!", "success");
                             setNewCampaignName("");
                           }
                         }}
                         className="whitespace-nowrap px-4 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-500 transition-colors text-xs uppercase"
                       >
                         Criar
                       </button>
                    </div>
                  </div>
                )}
              </div>

              {user && (
                <div className="space-y-6">
                  {/* World/Time Control Section (For Masters) */}
                  {activeCampaignId && masterCampaigns.some(c => c.id === activeCampaignId) && (
                    <motion.div 
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl overflow-hidden relative group"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500" />
                      
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center shadow-lg">
                            <span className="text-3xl">{getSeasonIcon(getSeason(tableConfig.date?.month || 1))}</span>
                          </div>
                          <div>
                            <div className="flex items-baseline gap-3">
                              <span className="text-3xl font-black text-white tracking-tighter">
                                {formatTime(tableConfig.time?.hour ?? 0, tableConfig.time?.minute ?? 0)}
                              </span>
                              <span className="text-zinc-500 font-medium text-sm">
                                {formatDate(tableConfig.date?.day || 1, tableConfig.date?.month || 1, tableConfig.date?.year || 2024)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] font-black uppercase text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full tracking-wider">
                                {getSeason(tableConfig.date?.month || 1)}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] text-zinc-600 font-bold uppercase">
                                {(() => {
                                  const w = tableConfig.weather || "Céu limpo";
                                  if (w === "Céu limpo") return <><Sun size={10} className="text-amber-500" /> Céu Limpo</>;
                                  if (w === "Céu nublado") return <><Cloud size={10} className="text-zinc-400" /> Céu Nublado</>;
                                  if (w === "Chuvoso") return <><Droplets size={10} className="text-blue-500" /> Chuvoso</>;
                                  if (w === "Onda de calor") return <><Flame size={10} className="text-orange-500" /> Onda de Calor</>;
                                  if (w === "Neve") return <><Snowflake size={10} className="text-cyan-200" /> Neve</>;
                                  return <><Sun size={10} className="text-amber-500" /> Céu Limpo</>;
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                          <button 
                            onClick={() => advanceTime(10)}
                            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-[10px] font-black uppercase text-zinc-400 hover:text-cyan-500 transition-all flex items-center justify-center gap-2"
                          >
                            <Clock size={12} /> +10m
                          </button>
                          <button 
                            onClick={() => advanceTime(30)}
                            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-[10px] font-black uppercase text-zinc-400 hover:text-cyan-500 transition-all flex items-center justify-center gap-2"
                          >
                            <Clock size={12} /> +30m
                          </button>
                          <button 
                            onClick={() => advanceTime(60)}
                            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-[10px] font-black uppercase text-zinc-400 hover:text-cyan-500 transition-all flex items-center justify-center gap-2"
                          >
                            <Clock size={12} /> +1h
                          </button>
                          <button 
                            onClick={() => advanceTime(1440)}
                            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-[10px] font-black uppercase text-zinc-400 hover:text-cyan-500 transition-all flex items-center justify-center gap-2"
                          >
                            <Calendar size={12} /> +1 Dia
                          </button>
                        </div>
                      </div>

                      {/* Manual Controls */}
                      <div className="mt-6 pt-6 border-t border-zinc-900/50 grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Hora</label>
                          <input 
                            type="number"
                            min="0"
                            max="23"
                            value={localHour}
                            onChange={(e) => setLocalHour(e.target.value)}
                            onBlur={async () => {
                              const h = Math.max(0, Math.min(23, parseInt(localHour) || 0));
                              try {
                                await updateTableConfig(activeCampaignId!, { 
                                  time: { ...(tableConfig.time || { hour: 0, minute: 0 }), hour: h } 
                                });
                              } catch (err) {
                                showToast("Erro ao salvar", "error");
                              }
                            }}
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-cyan-500/50 outline-none transition-colors"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Minuto</label>
                          <input 
                            type="number"
                            min="0"
                            max="59"
                            value={localMinute}
                            onChange={(e) => setLocalMinute(e.target.value)}
                            onBlur={async () => {
                              const m = Math.max(0, Math.min(59, parseInt(localMinute) || 0));
                              try {
                                await updateTableConfig(activeCampaignId!, { 
                                  time: { ...(tableConfig.time || { hour: 0, minute: 0 }), minute: m } 
                                });
                              } catch (err) {
                                showToast("Erro ao salvar", "error");
                              }
                            }}
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-cyan-500/50 outline-none transition-colors"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Dia</label>
                          <input 
                            type="number"
                            min="1"
                            max="31"
                            value={localDay}
                            onChange={(e) => setLocalDay(e.target.value)}
                            onBlur={async () => {
                              try {
                                const d = Math.max(1, Math.min(31, parseInt(localDay) || 1));
                                await updateTableConfig(activeCampaignId!, { 
                                  date: { ...(tableConfig.date || { day: 1, month: 1, year: 2024 }), day: d } 
                                });
                              } catch (err) {
                                showToast("Erro ao salvar", "error");
                              }
                            }}
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-cyan-500/50 outline-none transition-colors"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Mês</label>
                          <select 
                            value={tableConfig.date?.month ?? 1}
                            onChange={async (e) => {
                              try {
                                await updateTableConfig(activeCampaignId!, { 
                                  date: { ...(tableConfig.date || { day: 1, month: 1, year: 2024 }), month: parseInt(e.target.value) || 1 } 
                                });
                              } catch (err) {
                                showToast("Erro ao salvar", "error");
                              }
                            }}
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-500/50 outline-none transition-colors appearance-none"
                          >
                            {Array.from({ length: 12 }).map((_, i) => (
                              <option key={i + 1} value={i + 1} className="bg-zinc-900 text-white">
                                {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2024, i, 1))}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-1">Ano (Era)</label>
                          <input 
                            type="number"
                            value={localYear}
                            onChange={(e) => setLocalYear(e.target.value)}
                            onBlur={async () => {
                              try {
                                await updateTableConfig(activeCampaignId!, { 
                                  date: { ...(tableConfig.date || { day: 1, month: 1, year: 2024 }), year: parseInt(localYear) || 0 } 
                                });
                              } catch (err) {
                                showToast("Erro ao salvar", "error");
                              }
                            }}
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-cyan-500/50 outline-none transition-colors"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Calendar and Events Section */}
                  {activeCampaignId && masterCampaigns.some(c => c.id === activeCampaignId) && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl overflow-hidden relative"
                    >
                      <div className="absolute top-0 right-0 w-1 h-full bg-amber-500" />
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <Calendar className="text-amber-500" size={20} />
                          <h3 className="text-sm font-black text-white uppercase tracking-widest">Calendário de Eventos</h3>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Month Grid */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between px-2">
                             <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                               {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2024, (tableConfig.date?.month || 1) - 1, 1))} {tableConfig.date?.year}
                             </span>
                          </div>
                          
                          <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: getDaysInMonth(tableConfig.date?.month || 1, tableConfig.date?.year || 2024) }).map((_, i) => {
                              const day = i + 1;
                              const isToday = tableConfig.date?.day === day;
                              const hasEvents = tableConfig.events?.some(e => e.day === day && e.month === tableConfig.date?.month);
                              const isSelected = selectedCalendarDay === day;

                              const moon = getMoonPhase(day);
                              return (
                                <button
                                  key={day}
                                  onClick={() => setSelectedCalendarDay(day)}
                                  title={`${day} de ${new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2024, (tableConfig.date?.month || 1) - 1, 1))} - ${moon.name}: ${moon.description}`}
                                  className={cn(
                                    "aspect-square rounded-lg text-[10px] font-bold flex flex-col items-center justify-between p-1 relative transition-all border",
                                    isToday 
                                      ? "bg-amber-500/20 border-amber-500 text-amber-500" 
                                      : isSelected
                                      ? "bg-white/10 border-white/30 text-white"
                                      : "bg-zinc-900 border-zinc-800 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400"
                                  )}
                                >
                                  <span className="self-start text-[8px] font-mono leading-none opacity-50">{day}</span>
                                  <span className="text-sm select-none" title={moon.name}>{moon.icon}</span>
                                  {hasEvents && (
                                    <div className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-amber-500" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Events List / Add Section */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
                          {selectedCalendarDay ? (
                            <>
                              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
                                  Eventos: Dia {selectedCalendarDay}
                                </span>
                                <button onClick={() => setSelectedCalendarDay(null)} className="text-zinc-600 hover:text-white">
                                  <X size={14} />
                                </button>
                              </div>

                              <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                {tableConfig.events?.filter(e => e.day === selectedCalendarDay && e.month === tableConfig.date?.month).map(event => (
                                  <div key={event.id} className="bg-zinc-800/80 border border-zinc-700 p-3 rounded-xl flex items-center justify-between group">
                                    <div className="space-y-0.5">
                                      <p className="text-xs font-bold text-white">{event.title}</p>
                                      {event.description && <p className="text-[9px] text-zinc-500 leading-tight">{event.description}</p>}
                                    </div>
                                    <button 
                                      onClick={() => {
                                        const newEvents = (tableConfig.events || []).filter(e => e.id !== event.id);
                                        updateTableConfig(activeCampaignId, { events: newEvents });
                                      }}
                                      className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-600 hover:text-red-500 transition-all"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ))}
                                {(!tableConfig.events || tableConfig.events.filter(e => e.day === selectedCalendarDay && e.month === tableConfig.date?.month).length === 0) && (
                                  <p className="text-[10px] text-zinc-600 italic text-center py-4">Nenhum evento para este dia.</p>
                                )}
                              </div>

                              <div className="pt-4 border-t border-zinc-800 space-y-3">
                                <input 
                                  type="text"
                                  placeholder="Novo evento..."
                                  value={newEventTitle}
                                  onChange={(e) => setNewEventTitle(e.target.value)}
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white focus:border-amber-500/50 outline-none"
                                />
                                <textarea 
                                  placeholder="Descrição (opcional)..."
                                  value={newEventDesc}
                                  onChange={(e) => setNewEventDesc(e.target.value)}
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white focus:border-amber-500/50 outline-none min-h-[60px] resize-none"
                                />
                                <button 
                                  disabled={!newEventTitle}
                                  onClick={() => {
                                    const event: CalendarEvent = {
                                      id: generateId(),
                                      day: selectedCalendarDay!,
                                      month: tableConfig.date?.month || 1,
                                      year: tableConfig.date?.year,
                                      title: newEventTitle,
                                      description: newEventDesc
                                    };
                                    const newEvents = [...(tableConfig.events || []), event];
                                    updateTableConfig(activeCampaignId, { events: newEvents });
                                    setNewEventTitle("");
                                    setNewEventDesc("");
                                  }}
                                  className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase rounded-xl transition-all"
                                >
                                  Adicionar Evento
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-10">
                              <Calendar className="text-zinc-800" size={32} />
                              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest max-w-[150px]">
                                Selecione um dia no calendário para gerenciar eventos
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Campanhas List */}
                  <div className="lg:col-span-4 space-y-6">
                    <div>
                      <h3 className="text-[10px] font-black text-purple-500 uppercase tracking-[0.2em] mb-3 px-1 flex items-center gap-2">
                        <Shield size={12} /> Campanhas que Mestro
                      </h3>
                      <div className="space-y-2">
                        {masterCampaigns.map(camp => (
                          <div
                            key={camp.id}
                            className={cn(
                              "group relative w-full p-4 rounded-2xl border transition-all flex flex-col gap-1 cursor-pointer",
                              activeCampaignId === camp.id
                                ? "bg-purple-600/10 border-purple-500 text-purple-400 shadow-[0_0_20px_rgba(147,51,234,0.1)]"
                                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                            )}
                            onClick={() => setActiveCampaignIdWithSync(camp.id)}
                          >
                            <span className="font-bold truncate pr-10 text-sm">{camp.name}</span>
                            <div className="flex items-center gap-2 text-[10px] font-mono opacity-60">
                               <div className="w-1 h-1 rounded-full bg-purple-500" />
                               Cód: {camp.inviteCode}
                            </div>
                            
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (campaignToDelete === camp.id) {
                                  try {
                                    await deleteCampaign(camp.id);
                                    if (activeCampaignId === camp.id) setActiveCampaignIdWithSync(null);
                                    showToast("Campanha apagada com sucesso.", "success");
                                    setCampaignToDelete(null);
                                  } catch (err: any) {
                                    console.error("Erro ao apagar campanha:", err);
                                    showToast(`Erro ao apagar campanha: ${err.message || err}`, "error");
                                  }
                                } else {
                                  setCampaignToDelete(camp.id);
                                  setTimeout(() => setCampaignToDelete(null), 3000);
                                }
                              }}
                              className={cn(
                                "absolute top-4 right-4 p-2 rounded-xl transition-all z-10 flex items-center gap-2",
                                campaignToDelete === camp.id 
                                  ? "bg-red-600 text-white" 
                                  : "bg-zinc-950 text-zinc-600 hover:text-red-500 hover:bg-zinc-800"
                              )}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        {masterCampaigns.length === 0 && (
                          <div className="text-center py-8 bg-zinc-900/50 border border-dashed border-zinc-800 rounded-2xl">
                             <p className="text-[10px] text-zinc-600 font-bold uppercase">Nenhuma campanha criada</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-3 px-1 flex items-center gap-2">
                        <UserIcon size={12} /> Campanhas que Participo
                      </h3>
                      <div className="space-y-2">
                        {joinedCampaigns.filter(camp => camp.masterId !== user?.uid).map(camp => (
                          <div
                            key={camp.id}
                            className={cn(
                              "group relative w-full p-4 rounded-2xl border transition-all flex flex-col gap-1 cursor-pointer pr-14",
                              activeCampaignId === camp.id
                                ? "bg-blue-600/10 border-blue-500 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.1)]"
                                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                            )}
                            onClick={() => setActiveCampaignIdWithSync(camp.id)}
                          >
                            <span className="font-bold truncate text-sm">{camp.name}</span>
                            <div className="flex items-center gap-2 text-[10px] font-medium opacity-60">
                               <div className="w-1 h-1 rounded-full bg-blue-500" />
                               Jogador
                            </div>
                            {activeCampaignId === camp.id && (
                              <div className="absolute right-12 top-1/2 -translate-y-1/2">
                                 <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const linkedChars = state.characters.filter(c => c.campaignId === camp.id);
                                linkedChars.forEach(char => {
                                  updateChar({ campaignId: "" }, char.id);
                                });
                                if (activeCampaignId === camp.id) setActiveCampaignIdWithSync(null);
                                showToast(`Você saiu da campanha "${camp.name}"!`, "success");
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-zinc-950 text-zinc-600 hover:text-red-500 hover:bg-zinc-800 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                              title="Sair da Campanha (Desvincular Fichas)"
                            >
                              <LogOut size={14} />
                            </button>
                          </div>
                        ))}
                        
                        {orphanedCampaignIds.map(orphanId => {
                          const linkedChars = state.characters.filter(c => c.campaignId === orphanId);
                          const charNames = linkedChars.map(c => c.nome).join(', ');
                          return (
                            <div
                              key={orphanId}
                              className="group relative w-full p-4 rounded-2xl border border-dashed border-red-900/40 bg-red-950/5 text-zinc-400 flex flex-col gap-1 pr-14"
                            >
                              <span className="font-bold text-red-400 text-sm">Campanha Perdida / Órfã</span>
                              <span className="text-[9px] text-zinc-500 font-mono">ID: {orphanId}</span>
                              {charNames && (
                                <span className="text-[10px] text-zinc-500 mt-1">
                                  Vinculado em: <strong className="text-zinc-400">{charNames}</strong>
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  linkedChars.forEach(char => {
                                    updateChar({ campaignId: "" }, char.id);
                                  });
                                  showToast("Campanha fantasma desvinculada com sucesso!", "success");
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-zinc-950 text-zinc-600 hover:text-red-500 hover:bg-zinc-800 transition-all"
                                title="Limpar / Desvincular"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          );
                        })}

                        {joinedCampaigns.filter(camp => camp.masterId !== user?.uid).length === 0 && orphanedCampaignIds.length === 0 && (
                          <div className="text-center py-8 bg-zinc-900/50 border border-dashed border-zinc-800 rounded-2xl">
                             <p className="text-[10px] text-zinc-600 font-bold uppercase">Nenhuma campanha vinculada</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Fichas na Campanha */}
                  <div className="lg:col-span-8">
                    <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest px-1">Fichas na Selecionada</h3>
                    {activeCampaignId && campaigns.some(c => c.id === activeCampaignId) ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {campaignCharacters.map(char => (
                          <div 
                            key={char.id}
                            className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between group hover:border-purple-500/50 transition-all overflow-hidden"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="shrink-0 w-12 h-12 bg-zinc-800 rounded-lg overflow-hidden flex items-center justify-center">
                                {char.imagem ? (
                                  <img src={char.imagem} className="w-full h-full object-cover" />
                                ) : (
                                  <UserIcon size={24} className="text-zinc-600" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-white leading-none mb-1 truncate">{char.nome}</h4>
                                {char.userEmail && (
                                  <p className="text-[9px] text-zinc-500 font-medium truncate mb-1">{char.userEmail}</p>
                                )}
                                <div className="flex gap-2">
                                  <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 rounded font-bold">PV: {char.vidaAtual}</span>
                                  <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 rounded font-bold">PM: {char.manaAtual}</span>
                                </div>
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                // Master opening player's character
                                setState(prev => {
                                  const exists = prev.characters.find(c => c.id === char.id);
                                  if (exists) {
                                    return { ...prev, activeCharacterId: char.id };
                                  } else {
                                    return { 
                                      ...prev, 
                                      characters: [...prev.characters, char],
                                      activeCharacterId: char.id
                                    };
                                  }
                                });
                                setActivePage("sheet");
                              }}
                              className="shrink-0 opacity-0 group-hover:opacity-100 p-2 bg-purple-600 text-white rounded-lg transition-all text-[10px] font-bold uppercase whitespace-nowrap"
                            >
                              Ver/Editar
                            </button>
                          </div>
                        ))}
                        {campaignCharacters.length === 0 && (
                          <div className="col-span-full py-12 text-center text-zinc-600 italic text-sm">
                            Nenhum jogador vinculado a esta campanha ainda.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/10 border border-dashed border-zinc-800 rounded-3xl">
                        <Shield size={48} className="text-zinc-800 mb-4" />
                        <p className="text-zinc-500 italic">Selecione uma campanha para ver os jogadores.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        ) : activePage === "bestiary" ? (
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-black uppercase tracking-tighter text-white flex items-center gap-3">
                <Skull size={32} className="text-red-500" /> Bestiário de Demônios
              </h1>
              <p className="text-zinc-500 text-sm mt-1">
                Gerencie as criaturas e inimigos que aparecerão em suas campanhas.
              </p>
            </div>
            <Bestiary 
              onEditMonsterSheet={(monsterId) => {
                setBestiaryEditingMonsterId(monsterId);
                setActivePage("sheet");
              }}
            />
          </div>
        ) : activePage === "toca" ? (
          <div className="max-w-6xl mx-auto">
            {activeChar ? (
              <TocaManager 
                activeChar={activeChar} 
                updateChar={updateChar} 
                cutItem={cutItem} 
                setCutItem={setCutItem} 
                showToast={showToast} 
                onEditCreatureSheet={(creatureId) => {
                  setTocaEditingCreatureId(creatureId);
                  setActivePage("sheet");
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/10 border border-dashed border-zinc-800 rounded-3xl">
                <PawPrint size={48} className="text-zinc-700 mb-4 animate-pulse" />
                <p className="text-zinc-400 font-black uppercase text-sm tracking-wider mb-1">Ficha Não Selecionada</p>
                <p className="text-zinc-500 text-xs">Por favor, selecione ou crie um personagem na aba "Ficha" para acessar a Toca.</p>
              </div>
            )}
          </div>
        ) : activePage === "materials" ? (
          <div className="max-w-6xl mx-auto p-6">
            <div className="mb-8">
              <h1 className="text-3xl font-black uppercase tracking-tighter text-white flex items-center gap-3">
                <Hammer size={32} className="text-amber-500" /> Biblioteca de Materiais
              </h1>
              <p className="text-zinc-500 text-sm mt-1">
                Customize os materiais base para criação de equipamentos no gerador.
              </p>
            </div>
            <MaterialManagement 
              materials={customMaterials}
              onSave={async (m) => {
                if (user) {
                  await saveMaterial(user.uid, m);
                  showToast("Material salvo com sucesso!", "success");
                }
              }}
              onDelete={async (id) => {
                if (user) {
                  await deleteMaterial(id);
                  showToast("Material removido.", "info");
                }
              }}
            />
          </div>
        ) : activePage === "items" ? (
          <div className="max-w-7xl mx-auto p-6">
            <div className="mb-6">
              <h1 className="text-3xl font-black uppercase tracking-tighter text-white flex items-center gap-3">
                <Package size={32} className="text-amber-500" /> Biblioteca de Itens
              </h1>
              <p className="text-zinc-500 text-sm mt-1">
                Gerencie itens personalizados salvos no banco de dados e envie-os diretamente para a mochila dos personagens.
              </p>
            </div>
            <ItemLibrary 
              characters={state.characters}
              activeCharId={state.activeCharacterId}
              onAddItemToCharacter={handleAddItemToCharacterCompartment}
              showToast={showToast}
              user={user}
            />
          </div>
        ) : activePage === "spells" ? (
          <div className="max-w-7xl mx-auto p-6">
            <div className="mb-6">
              <h1 className="text-3xl font-black uppercase tracking-tighter text-white flex items-center gap-3">
                <Wand2 size={32} className="text-amber-500" /> Biblioteca de Magias
              </h1>
              <p className="text-zinc-500 text-sm mt-1">
                Gerencie magias personalizadas salvas no banco de dados e envie-as diretamente para a lista de magias dos personagens.
              </p>
            </div>
            <SpellLibrary 
              characters={state.characters}
              activeCharId={state.activeCharacterId}
              onAddSpellToCharacter={handleAddSpellToCharacter}
              showToast={showToast}
              user={user}
            />
          </div>
        ) : activePage === "table" ? (
          <div className="flex-1 h-full overflow-hidden relative overscroll-none touch-none">
            {activeCampaignId && campaigns.some(c => c.id === activeCampaignId) ? (
              <VTTBoard 
                campaignId={activeCampaignId}
                isMaster={campaigns.find(c => c.id === activeCampaignId)?.masterId === user?.uid}
                tokens={tokens}
                config={tableConfig}
                availableCharacters={allAvailableCharacters}
                activeCharacterId={state.activeCharacterId}
                customMaterials={customMaterials}
                showToast={showToast}
                onUpdateCharacter={updateChar}
                isVttSheetOpen={isVttSheetOpen}
                setIsVttSheetOpen={setIsVttSheetOpen}
                renderCharacterSheet={renderSheetContent}
                onAddToken={async (t) => {
                  console.log("[App] onAddToken triggered:", t);
                  try {
                    await addToken(activeCampaignId, t);
                    showToast(`Token de ${t.name} adicionado.`, "success");
                  } catch (err) {
                    console.error("[App] Error in addToken:", err);
                    showToast("Erro ao adicionar token.", "error");
                  }
                }}
                onAddCharacter={(char) => handleAddCharacter({ ...char, campaignId: activeCampaignId || undefined })}
                onRemoveToken={(tid) => removeToken(activeCampaignId, tid)}
                onUpdateConfig={(cfg) => updateTableConfig(activeCampaignId, cfg)}
                onRollResult={handleRollResult}
              />
            ) : (
                <div className="h-full flex items-center justify-center bg-zinc-950">
                    <div className="text-center p-8 bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md">
                        <Shield size={48} className="mx-auto text-zinc-700 mb-6" />
                        <h2 className="text-xl font-bold text-white mb-2">Sem Mesa Ativa</h2>
                        <p className="text-zinc-500 text-sm">Selecione uma campanha no Painel do Mestre para entrar na mesa.</p>
                    </div>
                </div>
            )}
          </div>
        ) : activePage === "oracle" ? (
          <div className="w-full max-w-5xl mx-auto px-2 md:px-4 py-2">
            <div className="w-full h-[calc(100vh-190px)] min-h-[720px] flex flex-col">
              <OracleTab 
                characters={allAvailableCharacters}
                activeCharacterId={state.activeCharacterId}
                onUpdateCharacter={updateChar}
                showToast={showToast}
              />
            </div>
          </div>
        ) : null;
          };

          return renderOtherPages();
        })()}

        {/* Floating Action Bars for Multi-Copy/Paste */}
        <AnimatePresence>
          {selectedItems.size > 0 && (
            <motion.div
              initial={{ y: 100, x: "-50%", opacity: 0 }}
              animate={{ y: 0, x: "-50%", opacity: 1 }}
              exit={{ y: 100, x: "-50%", opacity: 0 }}
              className="fixed bottom-6 left-1/2 z-[100] flex items-center gap-3 bg-zinc-900 border border-amber-500/50 p-4 rounded-xl shadow-2xl shadow-amber-500/20 ring-1 ring-amber-500/20"
            >
              <div className="flex flex-col">
                <span className="text-amber-500 font-black text-[10px] uppercase tracking-[0.2em]">
                  {selectedItems.size} {selectedItems.size === 1 ? "Item" : "Itens"} Selecionado{selectedItems.size === 1 ? "" : "s"}
                </span>
                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Gestão de Inventário</span>
              </div>
              <div className="h-8 w-px bg-zinc-800 mx-1" />
              <div className="flex items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => copySelected(activeChar)}
                  className="flex items-center gap-2 bg-amber-500 text-zinc-950 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all hover:bg-amber-400 active:scale-95"
                >
                  <Copy size={14} />
                  Copiar
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setSelectionMode(false);
                    setSelectedItems(new Set());
                  }}
                  className="flex items-center gap-2 bg-zinc-800 text-zinc-400 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700"
                >
                  <X size={14} />
                  Cancelar
                </motion.button>
              </div>
            </motion.div>
          )}

          {cutItem && (
            <motion.div
              initial={{ y: 100, x: "-50%", opacity: 0 }}
              animate={{ y: 0, x: "-50%", opacity: 1 }}
              exit={{ y: 100, x: "-50%", opacity: 0 }}
              className="fixed bottom-6 left-1/2 z-[100] flex flex-col sm:flex-row items-center gap-3 bg-zinc-950/95 border border-amber-500/50 p-4 rounded-xl shadow-2xl shadow-amber-500/10 backdrop-blur-md font-mono"
            >
              <div className="flex items-center gap-2 max-w-[220px]">
                <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg">
                  <Scissors size={14} />
                </div>
                <div className="min-w-0">
                  <span className="text-[8px] text-zinc-500 font-bold uppercase block tracking-wider">Item Recortado</span>
                  <span className="text-xs font-black text-white truncate block">{cutItem.item.nome}</span>
                </div>
              </div>
              
              <div className="h-px sm:h-8 w-full sm:w-px bg-zinc-800" />
              
              <div className="flex items-center gap-2">
                {cutItem.companionId ? (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSendToMochila}
                    className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-3 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all"
                  >
                    Mandar p/ Mochila
                  </motion.button>
                ) : (
                  (activeChar?.tocaCreatures || []).length > 0 ? (
                    <div className="relative group">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer"
                      >
                        Enviar p/ Companheiro <ChevronDown size={12} />
                      </motion.button>
                      <div className="absolute bottom-full mb-2 right-0 bg-zinc-900 border border-zinc-805 rounded-xl p-1 shadow-xl hidden group-hover:block z-50 min-w-[160px] max-h-48 overflow-y-auto">
                        <span className="text-[8px] text-zinc-500 font-extrabold uppercase p-1.5 block border-b border-zinc-800">Selecione:</span>
                        {(activeChar.tocaCreatures || []).map(creature => (
                          <button
                            key={creature.id}
                            onClick={() => handleSendToCompanion(creature.id)}
                            className="w-full text-left px-2 py-1.5 text-xs text-zinc-300 hover:bg-amber-500 hover:text-zinc-950 rounded-lg font-bold truncate block transition-colors cursor-pointer"
                          >
                            {creature.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <span className="text-[10px] text-zinc-500 font-extrabold uppercase px-2">Crie um companheiro para enviar</span>
                  )
                )}
                
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCutItem(null)}
                  className="flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 px-3 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all border border-zinc-800/80 cursor-pointer"
                >
                  Cancelar
                </motion.button>
              </div>
            </motion.div>
          )}

          {multiClipboard.length > 0 && !selectionMode && (
            <motion.div
              initial={{ y: 100, x: "-50%", opacity: 0 }}
              animate={{ y: 0, x: "-50%", opacity: 1 }}
              exit={{ y: 100, x: "-50%", opacity: 0 }}
              className="fixed bottom-6 left-1/2 z-[100] flex items-center gap-3 bg-zinc-900 border border-emerald-500/50 p-4 rounded-xl shadow-2xl shadow-emerald-500/20 ring-1 ring-emerald-500/20"
            >
              <div className="flex flex-col">
                <span className="text-emerald-500 font-black text-[10px] uppercase tracking-[0.2em]">
                  {multiClipboard.length} {multiClipboard.length === 1 ? "Item" : "Itens"} no Clipboard
                </span>
                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Pronto para colar</span>
              </div>
              <div className="h-8 w-px bg-zinc-800 mx-1" />
              <div className="flex items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePasteSelected}
                  className="flex items-center gap-2 bg-emerald-500 text-zinc-950 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all hover:bg-emerald-400 active:scale-95"
                >
                  <Plus size={14} />
                  Colar Todos
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setMultiClipboard([])}
                  className="flex items-center gap-2 bg-zinc-800 text-zinc-400 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700"
                >
                  <Trash2 size={14} />
                  Limpar
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {lastRoll && (
        <div
          onClick={() => setLastRoll(null)}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] cursor-pointer p-4 backdrop-blur-sm"
        >
          <div
            className={cn(
              "bg-zinc-900 border-2 border-amber-500 rounded-3xl flex flex-col items-center pointer-events-auto shadow-2xl overflow-y-auto max-h-full custom-scrollbar",
              lastRoll.isCombat
                ? "max-w-md w-full"
                : "max-w-[280px] w-full p-8 gap-4",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {lastRoll.isCombat ? (
              <div className="w-full">
                {/* Combat Banner */}
                <div className={cn(
                  "p-3 flex flex-col items-center justify-center text-center border-b border-zinc-800/60 rounded-t-[22px]",
                  lastRoll.hitSucceeded === false 
                    ? (
                        getDetailedCombatTitle(lastRoll).includes("defendeu") 
                          ? "bg-gradient-to-r from-blue-950/90 to-indigo-950/90 border-b border-blue-500/20" 
                          : "bg-zinc-800"
                      ) 
                    : "bg-gradient-to-r from-amber-600 to-amber-500"
                )}>
                  <div className="flex items-center gap-2">
                    <Sword size={12} className={lastRoll.hitSucceeded === false ? "text-blue-400" : "text-zinc-950"} />
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest opacity-85",
                      lastRoll.hitSucceeded === false ? "text-zinc-400" : "text-zinc-900"
                    )}>
                      {lastRoll.armaNome || "Ataque"}
                    </span>
                  </div>
                  <span className={cn(
                    "text-xs font-black uppercase tracking-widest mt-1",
                    lastRoll.hitSucceeded === false ? "text-zinc-100" : "text-zinc-950"
                  )}>
                    {getDetailedCombatTitle(lastRoll)}
                  </span>
                </div>

                {lastRoll.combatNote && (
                  <div className="mx-4 mt-4 p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center gap-2 animate-pulse">
                    <Zap size={14} className="text-amber-500" />
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest text-center">
                      {lastRoll.combatNote}
                    </span>
                  </div>
                )}

                <div className="p-4 space-y-4">
                  {/* Results Row */}
                  <div className={cn(
                    "grid gap-3",
                    (lastRoll.defenseRolls && lastRoll.hitSucceeded !== false) ? "grid-cols-3" : 
                    ((lastRoll.hitSucceeded === false && !lastRoll.defenseRolls) ? "grid-cols-1" : "grid-cols-2")
                  )}>
                    <div className={cn(
                      "flex flex-col items-center p-2.5 rounded-xl border border-zinc-800 transition-all shadow-lg",
                      lastRoll.hitSucceeded === false ? "bg-zinc-950/30 opacity-60" : "bg-amber-500/5 border-amber-500/20"
                    )}>
                      <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">
                        Acurácia
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className={cn(
                          "text-3xl font-black",
                          lastRoll.hitSucceeded === false ? "text-zinc-500" : "text-amber-500"
                        )}>
                          {lastRoll.hitResult}
                        </span>
                      </div>
                      <span className="text-[7px] font-black text-zinc-500 uppercase tracking-tighter mt-1 opacity-80 text-center line-clamp-1">
                        {lastRoll.hitFormula}
                      </span>
                    </div>

                    {lastRoll.defenseRolls && (
                      <div className="flex flex-col items-center p-2.5 rounded-xl border border-blue-500/20 bg-blue-500/5 transition-all shadow-lg">
                        <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">
                          Defesa
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-blue-500">
                            {lastRoll.defenseResult}
                          </span>
                        </div>
                        <span className="text-[7px] font-black text-zinc-500 uppercase tracking-tighter mt-1 opacity-80 text-center line-clamp-1">
                          Rolagem
                        </span>
                      </div>
                    )}

                    {lastRoll.hitSucceeded !== false && (
                      <div className="flex flex-col items-center p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 transition-all shadow-lg">
                        <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">
                          Dano Total
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-emerald-500">
                            {lastRoll.dmgResult}
                          </span>
                        </div>
                        <span className="text-[7px] font-black text-zinc-500 uppercase tracking-tighter mt-1 opacity-80 text-center line-clamp-1">
                          {lastRoll.dmgFormula || "Aplicação"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Hit Location Row */}
                  {lastRoll.hitLocation && (
                    <div className="bg-zinc-950/40 p-2 rounded-xl border border-amber-500/10 flex items-center justify-between px-4">
                      <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                        Alvo: <span className="text-zinc-100 ml-1">{lastRoll.hitLocation}</span>
                      </span>
                      <Target size={12} className="text-amber-500 opacity-50" />
                    </div>
                  )}

                  {/* Dice Results Grid */}
                  <div className={cn(
                    "grid gap-4 bg-zinc-950/30 p-3 rounded-xl border border-zinc-800/50",
                    (lastRoll.defenseRolls && lastRoll.hitSucceeded !== false) ? "grid-cols-3" : 
                    ((lastRoll.hitSucceeded === false && !lastRoll.defenseRolls) ? "grid-cols-1" : "grid-cols-2")
                  )}>
                    <div className="space-y-2">
                      <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest block text-center opacity-70">
                        Acurácia
                      </span>
                      <div className="flex flex-wrap justify-center gap-1">
                        {lastRoll.hitRolls?.map((roll, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "w-6 h-6 rounded flex items-center justify-center font-black text-[9px] shadow-sm border relative",
                              roll === 1 ? "bg-red-500/10 border-red-500/30 text-red-400" : 
                              roll === 8 ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
                              "bg-zinc-800 border-zinc-700 text-zinc-100"
                            )}
                          >
                            <span className="relative z-10">{roll}</span>
                          </div>
                        ))}
                        <div className="w-6 h-6 bg-zinc-500/5 border border-zinc-500/20 rounded flex items-center justify-center text-zinc-500 font-black text-[8px]">
                          {lastRoll.hitBonus! >= 0 ? "+" : ""}{lastRoll.hitBonus}
                        </div>
                      </div>
                    </div>

                    {lastRoll.defenseRolls && lastRoll.defenseRolls.length > 0 && (
                      <div className="space-y-2 border-l border-zinc-800/50 pl-2">
                        <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest block text-center opacity-70">
                          Defesa
                        </span>
                        <div className="flex flex-wrap justify-center gap-1">
                          {lastRoll.defenseRolls.map((roll, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "w-6 h-6 rounded flex items-center justify-center font-black text-[9px] shadow-sm border relative",
                                roll === 8 ? "bg-blue-400/10 border-blue-400/30 text-blue-400" :
                                "bg-zinc-800 border-zinc-700 text-zinc-400"
                              )}
                            >
                              <span className="relative z-10">{roll}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {lastRoll.hitSucceeded !== false && (
                      <div className={cn(
                        "space-y-2",
                        (lastRoll.defenseRolls && lastRoll.defenseRolls.length > 0) ? "border-l border-zinc-800/50 pl-2" : ""
                      )}>
                        <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest block text-center opacity-70">
                          Dano
                        </span>
                        <div className="flex flex-wrap justify-center gap-1">
                          {lastRoll.dmgRolls?.length === 0 ? (
                            <span className="text-[8px] font-bold text-zinc-600 uppercase">Fixo</span>
                          ) : (
                            lastRoll.dmgRolls?.map((roll, idx) => (
                              <div
                                key={idx}
                                className="w-6 h-6 bg-zinc-900 border border-zinc-800 rounded flex items-center justify-center text-zinc-300 font-bold text-[9px] shadow-sm"
                              >
                                {roll}
                              </div>
                            ))
                          )}
                          <div className="w-6 h-6 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-center justify-center text-emerald-500 font-bold text-[8px]">
                            {lastRoll.dmgBonus! >= 0 ? "+" : ""}{lastRoll.dmgBonus}
                          </div>
                        </div>
                      </div>
                    )}
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
                          className="w-8 h-8 bg-zinc-800 border border-zinc-700 rounded-lg flex items-center justify-center text-zinc-300 font-bold text-xs relative"
                        >
                          <DiceImage sides={lastRoll.sides || 6} className="absolute inset-0 w-full h-full opacity-10" />
                          <span className="relative z-10">{roll}</span>
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
        {selectedGalleryImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 md:p-12 cursor-zoom-out"
            onClick={() => setSelectedGalleryImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedGalleryImage}
                alt="Zoom"
                className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain border border-zinc-800"
                referrerPolicy="no-referrer"
              />
              <button
                onClick={() => setSelectedGalleryImage(null)}
                className="absolute -top-4 -right-4 w-10 h-10 bg-zinc-900 text-white rounded-full flex items-center justify-center shadow-2xl border border-zinc-800 hover:bg-zinc-800 transition-colors"
              >
                <X size={24} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

      <AnimatePresence>
        {selectedItems.size > 0 && selectionMode && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] bg-zinc-900 border border-amber-500/50 p-4 rounded-2xl shadow-2xl flex items-center gap-4 backdrop-blur-xl"
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-tighter">
                {selectedItems.size} ITENS SELECIONADOS
              </span>
            </div>
            <div className="h-8 w-px bg-zinc-800" />
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (activeChar) copySelected(activeChar);
              }}
              className="bg-amber-500 text-zinc-950 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-amber-400 transition-colors"
            >
              <Copy size={18} />
              Copiar Selecionados
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={toggleSelectionMode}
              className="bg-zinc-800 text-zinc-400 px-4 py-2 rounded-xl font-bold text-sm hover:bg-zinc-700 transition-colors"
            >
              Cancelar
            </motion.button>
          </motion.div>
        )}

        {multiClipboard.length > 0 && !selectionMode && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] bg-zinc-900 border border-emerald-500/50 p-4 rounded-2xl shadow-2xl flex items-center gap-4 backdrop-blur-xl"
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter">
                {multiClipboard.length} ITENS NO CLIPBOARD
              </span>
            </div>
            <div className="h-8 w-px bg-zinc-800" />
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handlePasteSelected}
              className="bg-emerald-500 text-zinc-950 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-emerald-400 transition-colors"
            >
              <Plus size={18} />
              Colar Todos
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setMultiClipboard([])}
              className="bg-zinc-800 text-zinc-400 px-4 py-2 rounded-xl font-bold text-sm hover:bg-zinc-700 transition-colors"
            >
              Limpar
            </motion.button>
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

const SubSection = React.memo(({
  title,
  icon,
  children,
  defaultCollapsed = true,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}) => {
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
});

const Section = React.memo(({
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
}) => {
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
});

const Input = React.memo(({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) => {
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
});

const TextArea = React.memo(({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) => {
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
});

const ProgressBar = React.memo(({
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
}) => {
  const percent = Math.min(100, (current / max) * 100);
  const [innerValue, setInnerValue] = useState(current?.toString() ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement === inputRef.current) return;

    if (
      current !== undefined &&
      current !== null &&
      current.toString() !== innerValue
    ) {
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
            ref={inputRef}
            type="number"
            value={innerValue}
            onDoubleClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              setInnerValue(e.target.value);
              onChange(parseInt(e.target.value) || 0);
            }}
            onBlur={() => {
              if (current !== undefined && current !== null) {
                setInnerValue(current.toString());
              }
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
});

const MiniBar = React.memo(({
  label,
  value,
  max = 100,
  color,
  onChange,
  extra,
}: {
  label: string;
  value: number;
  max?: number;
  color: string;
  onChange: (v: number) => void;
  extra?: React.ReactNode;
}) => {
  const percent = Math.min(100, (value / max) * 100);
  const [innerValue, setInnerValue] = useState(value?.toString() ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement === inputRef.current) return;

    if (
      value !== undefined &&
      value !== null &&
      value.toString() !== innerValue
    ) {
      setInnerValue(value.toString());
    }
  }, [value]);

  return (
    <div
      onDoubleClick={() => value < max && onChange(max)}
      className="bg-zinc-900/50 border border-zinc-800 p-2 rounded-lg cursor-pointer"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="text-[9px] text-zinc-500 font-bold uppercase">
          {label}
        </div>
        {extra}
      </div>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="number"
          value={innerValue}
          onDoubleClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            setInnerValue(e.target.value);
            onChange(parseInt(e.target.value) || 0);
          }}
          onBlur={() => {
            if (value !== undefined && value !== null) {
              setInnerValue(value.toString());
            }
          }}
          className="w-10 bg-transparent text-xs font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      <div className="h-1 bg-zinc-800 rounded-full mt-1 overflow-hidden">
        <div className={cn("h-full", color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
});

const WeaponProperties = React.memo(({
  item,
  character,
  updateCharacter,
  onChange,
}: {
  item: any;
  character: any;
  updateCharacter?: (fn: any) => void;
  onChange: (updates: any) => void;
}) => {
  const [showTypeSelector, setShowTypeSelector] = React.useState(false);
  const isFirearm = item.categoria === 'Arma de Fogo';
  const isBow = item.categoria === 'Arco';
  const isMelee = item.categoria === 'Arma Branca' || !item.categoria;

  // Find available bullets in internal compartments
  const internalBullets = (character?.compartimentos || [])
    .filter((c: any) => !c.externo)
    .flatMap((c: any) => (c.itens || []))
    .filter((i: any) => {
      const n = (i.nome || "").toLowerCase();
      const t = (i.tipo || "").toLowerCase();
      return n.includes("bala") || n.includes("munição") || n.includes("projetil") || n.includes("flecha") || t === "munição";
    });

  const handleConvertType = (newCategory: 'Arma Branca' | 'Arma de Fogo' | 'Arco') => {
    if (item.categoria === newCategory) return;
    
    const updates: any = {
      categoria: newCategory,
      atributoBase: newCategory === 'Arma Branca' ? 'Força' : 'Destreza',
    };

    const oldCat = item.categoria || 'Arma Branca';
    const customName = item.nome || '';
    if (customName === `Nova ${oldCat}` || customName === `Novo ${oldCat}` || customName === 'Nova Arma' || !customName) {
      const article = newCategory === 'Arco' ? 'Novo' : 'Nova';
      updates.nome = `${article} ${newCategory}`;
    }

    if (newCategory === 'Arma de Fogo') {
      updates.municaoTotal = item.municaoTotal !== undefined ? item.municaoTotal : 6;
      updates.municaoCarregada = item.municaoCarregada !== undefined ? item.municaoCarregada : 6;
    } else {
      updates.municaoTotal = undefined;
      updates.municaoCarregada = undefined;
      updates.bulletId = undefined;
    }

    onChange(updates);
  };

  return (
    <div className="space-y-2 pt-1 border-t border-zinc-800/30">
      {/* Mini Seletor de Tipo de Arma */}
      <div className="flex items-center justify-between bg-zinc-950/20 px-2 py-1 rounded border border-zinc-800/20 relative">
        <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider">Tipo/Propriedades</span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTypeSelector(!showTypeSelector)}
            className="flex items-center gap-1 px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-amber-500 text-[8px] font-black uppercase rounded shadow-sm transition-colors cursor-pointer select-none"
          >
            <RotateCw size={8} />
            <span>{item.categoria || 'Arma Branca'} ▾</span>
          </button>
          
          {showTypeSelector && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowTypeSelector(false)} />
              <div className="absolute right-0 mt-1 w-28 bg-zinc-950 border border-zinc-800 rounded shadow-xl z-50 py-0.5 font-mono overflow-hidden">
                {[
                  { cat: "Arma Branca", icon: <Sword size={10} /> },
                  { cat: "Arma de Fogo", icon: <Zap size={10} /> },
                  { cat: "Arco", icon: <Target size={10} /> }
                ].map((opt) => (
                  <button
                    key={opt.cat}
                    type="button"
                    onClick={() => {
                      handleConvertType(opt.cat as any);
                      setShowTypeSelector(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-1.5 px-2 py-1 text-[9px] font-bold uppercase transition-colors text-left",
                      (item.categoria === opt.cat || (opt.cat === 'Arma Branca' && !item.categoria))
                        ? "bg-amber-500 text-zinc-950"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                    )}
                  >
                    {opt.icon}
                    <span>{opt.cat}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {!isFirearm ? ( 
          <MiniInput
            label="Dano"
            value={item.dano || "0"}
            onChange={(v) => onChange({ dano: v })}
          />
        ) : (
          <div className="flex flex-col gap-0.5 bg-zinc-950/30 p-1 rounded border border-dashed border-zinc-800/50 justify-center">
            <span className="text-[7px] text-zinc-600 font-bold uppercase px-0.5">Dano Arma de Fogo</span>
            <span className="text-[9px] text-amber-500 font-mono px-0.5">Definido pelas Balas</span>
          </div>
        )}
        <MiniInput
          label="Acerto"
          value={item.acerto || 0}
          type="number"
          onChange={(v) => onChange({ acerto: parseInt(v) || 0 })}
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <MiniInput
          label="Durabilidade Atual"
          value={item.durabilidade || 0}
          type="number"
          onChange={(v) => onChange({ durabilidade: parseInt(v) || 0 })}
        />
        <MiniInput
          label="Durabilidade Total"
          value={item.maxDurabilidade || 0}
          type="number"
          onChange={(v) => onChange({ 
            maxDurabilidade: parseInt(v) || 0,
            durabilidadeMaxUtil: parseInt(v) || 0 
          })}
        />
      </div>

      {!isFirearm && (
        <div className="grid grid-cols-2 gap-1.5 bg-zinc-950/20 p-1 rounded border border-zinc-800/30">
          <div className="flex flex-col gap-0.5">
            <span className="text-[7px] text-zinc-600 font-bold uppercase px-0.5">Escala</span>
            <select
              value={item.escala || "0"}
              onChange={(e) => onChange({ escala: e.target.value })}
              className="bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[10px] text-amber-500 font-bold focus:outline-none"
            >
              {['0', 'D', 'C', 'B', 'A'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[7px] text-zinc-600 font-bold uppercase px-0.5">Atrib.</span>
            <select
              value={item.atributoBase || "Força"}
              onChange={(e) => onChange({ atributoBase: e.target.value })}
              className="bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[10px] text-amber-500 font-bold focus:outline-none"
            >
              {['Força', 'Destreza', 'Inteligência', 'Ritual'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
      )}

      {isMelee && (
        <div className="grid grid-cols-4 gap-1">
          <MiniInput label="Corte" value={item.corte || 0} type="number" onChange={(v) => onChange({ corte: parseInt(v) || 0 })} />
          <MiniInput label="Imp." value={item.impacto || 0} type="number" onChange={(v) => onChange({ impacto: parseInt(v) || 0 })} />
          <MiniInput label="Perf." value={item.perfuracao || 0} type="number" onChange={(v) => onChange({ perfuracao: parseInt(v) || 0 })} />
          <MiniInput label="Res." value={item.resistencia || 0} type="number" onChange={(v) => onChange({ resistencia: parseInt(v) || 0 })} />
        </div>
      )}

      {isFirearm && (
        <div className="space-y-1.5 border-l-2 border-amber-500/30 pl-2">
           <div className="grid grid-cols-2 gap-1.5">
             <MiniInput 
               label="Munição Total" 
               value={item.municaoTotal || 0} 
               type="number" 
               onChange={(v) => onChange({ municaoTotal: parseInt(v) || 0 })} 
             />
             <MiniInput 
               label="No Tambor/Pente" 
               value={item.municaoCarregada || 0} 
               type="number" 
               onChange={(v) => onChange({ municaoCarregada: parseInt(v) || 0 })} 
             />
           </div>
           <div className="flex flex-col gap-0.5">
             <span className="text-[7px] text-zinc-600 font-bold uppercase px-0.5">Munição em Uso (Membro)</span>
             <select
               value={item.bulletId || ""}
               onChange={(e) => onChange({ bulletId: e.target.value })}
               className="bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[9px] text-amber-500 font-medium focus:outline-none"
             >
               <option value="">Nenhuma selecionada</option>
               {internalBullets.map(b => (
                 <option key={b.id} value={b.id}>{b.nome} ({b.quantidade}x)</option>
               ))}
             </select>
           </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-1">
        <MiniInput label="Peso" value={item.peso || 0} type="number" onChange={(v) => onChange({ peso: parseFloat(v) || 0 })} />
        <MiniInput label="Vol" value={item.volume || 0} type="number" onChange={(v) => onChange({ volume: parseFloat(v) || 0 })} />
        <MiniInput label="Qtd" value={item.quantidade || 1} type="number" onChange={(v) => onChange({ quantidade: parseInt(v) || 1 })} />
      </div>

      {isFirearm && (
        <div className="flex gap-1 pt-1">
          <button
            type="button"
            onClick={() => onChange({ durabilidade: item.durabilidadeMaxUtil || item.maxDurabilidade })}
            className="flex-1 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[8px] font-black uppercase text-zinc-400 border border-zinc-700"
          >
            Fazer Manutenção
          </button>
          <button
            type="button"
            onClick={() => {
              const bullet = internalBullets.find(it => it.id === item.bulletId);
              if (bullet && bullet.quantidade > 0 && (item.municaoCarregada || 0) < (item.municaoTotal || 0) && updateCharacter) {
                const amountToLoad = 1;
                const bulletProperties = { perfuracao: bullet.perfuracao || 0, impacto: bullet.impacto || 0, resistencia: bullet.resistencia || 0, nome: bullet.nome, dano: bullet.dano || "0" };
                const ammoToAdd = Array.from({ length: amountToLoad }, () => ({ ...bulletProperties, id: generateId() }));
                updateCharacter((c: any) => {
                  const newCompartimentos = (c.compartimentos || []).map((comp: any) => ({ ...comp, itens: (comp.itens || []).map((i: any) => i.id === bullet.id ? { ...i, quantidade: Math.max(0, i.quantidade - amountToLoad) } : i) }));
                  const newArmas = (c.armas || []).map((w: any) => w.id === item.id ? { ...w, municaoCarregada: (w.municaoCarregada || 0) + amountToLoad, magazineAmmo: [...(w.magazineAmmo || []), ...ammoToAdd] } : w );
                  const finalCompartimentos = newCompartimentos.map((comp: any) => ({ ...comp, itens: comp.itens.map((i: any) => i.id === item.id ? { ...i, municaoCarregada: (i.municaoCarregada || 0) + amountToLoad, magazineAmmo: [...(i.magazineAmmo || []), ...ammoToAdd] } : i) }));
                  return { compartimentos: finalCompartimentos, armas: newArmas };
                });
              }
            }}
            className="flex-1 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-[8px] font-black uppercase text-amber-500 border border-amber-500/30"
          >
            Recarregar 1
          </button>
          <button
            type="button"
            onClick={() => {
              const bullet = internalBullets.find(it => it.id === item.bulletId);
              if (bullet && bullet.quantidade > 0 && (item.municaoCarregada || 0) < (item.municaoTotal || 0) && updateCharacter) {
                const needed = (item.municaoTotal || 0) - (item.municaoCarregada || 0);
                const amountToLoad = Math.min(bullet.quantidade, needed);
                const bulletProperties = { perfuracao: bullet.perfuracao || 0, impacto: bullet.impacto || 0, resistencia: bullet.resistencia || 0, nome: bullet.nome, dano: bullet.dano || "0" };
                const ammoToAdd = Array.from({ length: amountToLoad }, () => ({ ...bulletProperties, id: generateId() }));
                updateCharacter((c: any) => {
                  const newCompartimentos = (c.compartimentos || []).map((comp: any) => ({ ...comp, itens: (comp.itens || []).map((i: any) => i.id === bullet.id ? { ...i, quantidade: Math.max(0, i.quantidade - amountToLoad) } : i) }));
                  const newArmas = (c.armas || []).map((w: any) => w.id === item.id ? { ...w, municaoCarregada: (w.municaoCarregada || 0) + amountToLoad, magazineAmmo: [...(w.magazineAmmo || []), ...ammoToAdd] } : w );
                  const finalCompartimentos = newCompartimentos.map((comp: any) => ({ ...comp, itens: comp.itens.map((i: any) => i.id === item.id ? { ...i, municaoCarregada: (i.municaoCarregada || 0) + amountToLoad, magazineAmmo: [...(i.magazineAmmo || []), ...ammoToAdd] } : i) }));
                  return { compartimentos: finalCompartimentos, armas: newArmas };
                });
              }
            }}
            className="flex-1 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-[8px] font-black uppercase text-amber-500 border border-amber-500/30"
          >
            Recarregar Tudo
          </button>
        </div>
      )}

      <TextArea
        label="Descrição / Efeitos"
        value={item.descricao || item.efeito || ""}
        onChange={(v) => onChange({ descricao: v, efeito: v })}
      />
    </div>
  );
});

const CatalystProperties = React.memo(({
  item,
  onChange,
}: {
  item: any;
  onChange: (updates: any) => void;
}) => {
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
          label="Peso (x100g)"
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
});

const AmmunitionProperties = React.memo(({
  item,
  onChange,
}: {
  item: any;
  onChange: (updates: any) => void;
}) => {
  const templates = [
    { name: 'Bala', weight: 0.1, vol: 0.3, dano: '2d6' },
    { name: 'Flecha (A. Curto)', weight: 0.5, vol: 0.9, dano: '1d6' },
    { name: 'Flecha (A. Longo)', weight: 0.6, vol: 1.3, dano: '1d8' },
  ];

  return (
    <div className="space-y-2 pt-1 border-t border-zinc-800/30">
      <div className="flex flex-wrap gap-1">
        {templates.map(tmp => (
          <motion.button
            key={tmp.name}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange({ 
              nome: item.nome === "Nova Munição" ? tmp.name : item.nome, 
              peso: tmp.weight, 
              volume: tmp.vol,
              dano: tmp.dano
            })}
            className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[7px] font-black uppercase text-zinc-400 border border-zinc-700 transition-colors"
          >
            {tmp.name}
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MiniInput 
          label="Dano (ex: 2d6, 1d10)" 
          value={item.dano || ""} 
          onChange={(v) => onChange({ dano: v })} 
        />
        <MiniInput 
          label="Perf." 
          value={item.perfuracao || 0} 
          type="number" 
          onChange={(v) => onChange({ perfuracao: parseInt(v) || 0 })} 
        />
        <MiniInput 
          label="Imp." 
          value={item.impacto || 0} 
          type="number" 
          onChange={(v) => onChange({ impacto: parseInt(v) || 0 })} 
        />
        <MiniInput 
          label="Res." 
          value={item.resistencia || 0} 
          type="number" 
          onChange={(v) => onChange({ resistencia: parseInt(v) || 0 })} 
        />
        <MiniInput 
          label="Peso (Un)" 
          value={item.peso || 0} 
          type="number" 
          onChange={(v) => onChange({ peso: parseFloat(v) || 0 })} 
        />
        <MiniInput 
          label="Vol (Un)" 
          value={item.volume || 0} 
          type="number" 
          onChange={(v) => onChange({ volume: parseFloat(v) || 0 })} 
        />
        <div className="col-span-2">
          <TextArea
            label="Efeito / Descrição"
            value={item.efeito || item.descricao || ""}
            onChange={(v) => onChange({ efeito: v, descricao: v })}
          />
        </div>
      </div>
    </div>
  );
});

const ArmorProperties = React.memo(({
  item,
  onChange,
}: {
  item: any;
  onChange: (updates: any) => void;
}) => {
  return (
    <div className="space-y-2">
      {item.tipo !== "Acessório" && item.tipo !== "Acessórios" && (
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
      )}
      <div className="grid grid-cols-4 gap-2">
        <MiniInput
          label="Durab."
          value={item.durabilidade || 0}
          type="number"
          onChange={(v) => onChange({ durabilidade: parseInt(v) || 0 })}
        />
        <MiniInput
          label="Peso (x100g)"
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
});

const NumericInput = React.memo(({
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
}) => {
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
});

const MiniInput = React.memo(({
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
}) => {
  const [innerValue, setInnerValue] = useState(value?.toString() ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const isFocused = document.activeElement === inputRef.current || document.activeElement === textareaRef.current;
    if (isFocused) return;

    if (
      value !== undefined &&
      value !== null &&
      value.toString() !== innerValue
    ) {
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
          ref={textareaRef}
          value={innerValue}
          disabled={disabled}
          onChange={(e) => {
            setInnerValue(e.target.value);
            onChange(e.target.value);
          }}
          onBlur={() => {
            if (value !== undefined && value !== null) {
              setInnerValue(value.toString());
            }
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
          ref={inputRef}
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
          onBlur={() => {
            if (value !== undefined && value !== null) {
              setInnerValue(value.toString());
            }
          }}
          className="bg-transparent text-sm font-bold focus:outline-none border-b border-zinc-800 focus:border-amber-500/50 w-full min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      )}
    </div>
  );
});
