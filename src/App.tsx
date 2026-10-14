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
  Info,
  MoreVertical,
  Flame,
  Skull,
  Biohazard,
  Bone,
  RotateCw,
  X,
  Moon,
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
  Printer,
  Mail,
  Lock,
  LogIn,
  UserPlus,
  Settings,
  Eye,
  EyeOff,
  Database,
  Check,
  AlertCircle,
  Terminal,
  ShieldAlert,
  Archive,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DiceImage } from "./components/ui/DiceImage";
import { diceBase64 } from "./diceIcons";
import { 
  auth, 
  loginAsGuest, 
  logout, 
  handleRedirectResult, 
  clearFirestoreCache, 
  isFirebaseQuotaExceeded, 
  onAuthStateChanged, 
  syncLocalToCloud, 
  forceSyncAndRestoreByEmail,
  setSupabaseQuotaExceeded, 
  signInWithEmail, 
  signUpWithEmail, 
  resetPasswordForEmail, 
  loginWithEmailOnly, 
  updateUserPassword,
  getSupabaseConfig,
  setSupabaseConfig,
  testSupabaseConnection,
  rescueAllLocalCharacters,
  loginWithGoogle,
  safeLocalStorageSetItem,
  safeLocalStorageGetItem,
  idbGet,
  isSupabaseConnected as initialSupabaseConnected
} from "./lib/supabase";
import type { FirebaseUserLike as User } from "./lib/supabase";
import { subscribeToUserCharacters, saveCharacterToFirestore, deleteCharacterFromFirestore, getMaxCapacity } from "./services/characterService";
import { 
  createCampaign, 
  saveCampaign,
  subscribeToMasterCampaigns, 
  subscribeToCampaignsByIds,
  joinCampaign, 
  leaveCampaign,
  linkCharacterToCampaign,
  unlinkCharacterFromCampaign,
  subscribeToJoinedCampaigns,
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
import { Character, AppState, ArmorPiece, Campaign, TableToken, TableConfig, BestiaryMonster, NegativeEffect, CalendarEvent, Spell, MonsterAction } from "./types";
import { VTTBoard } from "./components/VTTBoard";
import { Bestiary } from "./components/Bestiary";
import { TocaManager } from "./components/TocaManager";
import { MaterialManagement } from "./components/MaterialManagement";
import { ItemLibrary } from "./components/ItemLibrary";
import { SpellLibrary } from "./components/SpellLibrary";
import { PrintSheetModal } from "./components/PrintSheetModal";
import { Section } from "./components/ui/Section";
import { SubSection } from "./components/ui/SubSection";
import { Input, TextArea } from "./components/ui/Input";
import { NumericInput } from "./components/ui/NumericInput";
import { MiniInput } from "./components/ui/MiniInput";
import { ProgressBar } from "./components/ui/ProgressBar";
import { MiniBar } from "./components/ui/MiniBar";
import { WeaponProperties } from "./components/ui/WeaponProperties";
import { ArmorProperties } from "./components/ui/ArmorProperties";
import { CatalystProperties, AmmunitionProperties } from "./components/TocaManager";
import { subscribeToMaterials, saveMaterial, deleteMaterial } from "./services/materialService";
import { subscribeToBestiary, saveMonsterToBestiary } from "./services/bestiaryService";
import { saveItemToLibrary } from "./services/itemLibraryService";
import { saveSpellToLibrary } from "./services/spellLibraryService";
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
import { getSeason, getSeasonIcon, formatTime, formatDate, getDaysInMonth, generateWeather, getMoonPhase, dateToAbsoluteDays } from "./rules/timeRules";
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

// Função utilitária para verificar se uma ficha pertence ao usuário logado ou se é anônima/guest
export const isCharacterOwnedByCurrentUser = (char: Character, currentUser: any | null): boolean => {
  if (!char) return false;
  const charEmail = (char.userEmail || (char as any).user_email || '').trim().toLowerCase();
  const isGuestEmail = !charEmail || charEmail.startsWith('guest_');

  if (currentUser && currentUser.email) {
    const userEmail = (currentUser.email || '').trim().toLowerCase();
    const isSameEmail = Boolean(userEmail && charEmail && userEmail === charEmail);
    return isSameEmail || isGuestEmail;
  }

  // Se o usuário NÃO está logado (!currentUser):
  // Ele SÓ tem permissão para visualizar fichas anônimas/de convidado (guest).
  return isGuestEmail;
};

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
  const { updatedAt, isRemoteSynced, isLocalOnly, userId, userEmail, campaignId, ...rest } = cleaned as any;
  
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
                  localStorage.removeItem(STORAGE_KEY);
                  window.location.reload();
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
  const deletedCharsRef = useRef<Set<string>>((() => {
    try {
      const stored = localStorage.getItem("deleted_characters_blacklist") || localStorage.getItem("demons_despair_deleted_chars");
      return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>();
    } catch (e) {
      return new Set<string>();
    }
  })());

  const persistDeletedCharId = (id: string) => {
    if (!id) return;
    deletedCharsRef.current.add(id);
    try {
      const json = JSON.stringify(Array.from(deletedCharsRef.current));
      localStorage.setItem("demons_despair_deleted_chars", json);
      localStorage.setItem("deleted_characters_blacklist", json);
      safeLocalStorageSetItem("deleted_characters_blacklist", json);
    } catch (e) {
      console.error("Error saving deleted character IDs:", e);
    }
  };

  const [state, setState] = useState<AppState>(() => {
    const saved = safeLocalStorageGetItem(STORAGE_KEY) || (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null);
    const savedUserRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('supabase_auth_user') : null;
    let initialUser: any = null;
    if (savedUserRaw) {
      try { initialUser = JSON.parse(savedUserRaw); } catch (e) {}
    }

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.characters)) {
          const blacklist = deletedCharsRef.current;
          let chars = parsed.characters
            .filter((c: any) => c && c.id && !blacklist.has(c.id))
            .map(sanitizeCharacter);

          // Isolamento imediato: se não há usuário logado no storage, nunca carregar fichas de usuários registrados
          if (!initialUser || (!initialUser.uid && !initialUser.email)) {
            chars = chars.filter((c: Character) => isCharacterOwnedByCurrentUser(c, null));
          } else {
            chars = chars.filter((c: Character) => isCharacterOwnedByCurrentUser(c, initialUser));
          }

          if (chars.length === 0) {
            chars = [createEmptyCharacter()];
          }

          parsed.characters = chars;
          if (!chars.some((c: Character) => c.id === parsed.activeCharacterId)) {
            parsed.activeCharacterId = chars[0]?.id || "";
          }
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

  // IndexedDB image recovery on load (restores images if localStorage was previously cleared or stripped)
  useEffect(() => {
    idbGet(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.characters) && parsed.characters.length > 0) {
          const blacklist = deletedCharsRef.current;
          setState((prev) => {
            let hasImageRestoration = false;
            const updatedChars = prev.characters
              .filter((curChar) => !blacklist.has(curChar.id))
              .map((curChar) => {
                if (!curChar.imagem) {
                  const idbMatch = parsed.characters.find((c: any) => c.id === curChar.id);
                  if (idbMatch?.imagem) {
                    hasImageRestoration = true;
                    return { ...curChar, imagem: idbMatch.imagem, imagens: idbMatch.imagens || curChar.imagens };
                  }
                }
                return curChar;
              });
            if (hasImageRestoration) {
              console.log("🖼️ [Storage] Imagens restauradas com sucesso do IndexedDB!");
              return { ...prev, characters: updatedChars };
            }
            return prev;
          });
        }
      } catch (e) {}
    });
  }, []);

  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(() => (state as any).activeCampaignId || null);

  const [isLoadingSync, setIsLoadingSync] = useState(true);

  // Full Backup & Import State
  const [showFullBackupModal, setShowFullBackupModal] = useState(false);
  const [backupModalTab, setBackupModalTab] = useState<'export' | 'import'>('export');
  const [pasteFullBackupText, setPasteFullBackupText] = useState("");
  const [isImportingAll, setIsImportingAll] = useState(false);

  // Email Auth Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'set_password' | 'reset'>('login');
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [modalAuthError, setModalAuthError] = useState<string | null>(null);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalAuthError(null);

    // Mode 1: Login with Email & Password
    if (authMode === 'login') {
      if (!authEmail.trim()) {
        setModalAuthError("Por favor, informe seu e-mail.");
        return;
      }
      if (!authPassword.trim()) {
        setModalAuthError("Por favor, informe sua senha.");
        return;
      }
      setAuthSubmitting(true);
      try {
        await loginWithEmailOnly(authEmail, authDisplayName, authPassword);
        showToast("Conectado com sucesso à conta!", "success");
        setIsAuthModalOpen(false);
      } catch (err: any) {
        console.error("Login error:", err);
        setModalAuthError(err.message || "Erro ao conectar com este e-mail.");
      } finally {
        setAuthSubmitting(false);
      }
      return;
    }

    // Mode 2: Set or Change Password / Register
    if (authMode === 'set_password') {
      const targetEmail = (authEmail.trim() || user?.email || "").toLowerCase();
      if (!targetEmail || !targetEmail.includes('@')) {
        setModalAuthError("Por favor, informe um e-mail válido.");
        return;
      }
      if (!authPassword.trim() || authPassword.length < 6) {
        setModalAuthError("A senha deve ter pelo menos 6 caracteres.");
        return;
      }
      setAuthSubmitting(true);
      try {
        if (!user) {
          await loginWithEmailOnly(targetEmail, authDisplayName, authPassword);
        } else {
          await updateUserPassword(authPassword, targetEmail);
        }
        showToast("Conta configurada / senha salva com sucesso!", "success");
        setIsAuthModalOpen(false);
        setAuthPassword("");
      } catch (err: any) {
        console.error("Set password error:", err);
        setModalAuthError(err.message || "Erro ao criar conta ou salvar nova senha.");
      } finally {
        setAuthSubmitting(false);
      }
      return;
    }

    // Mode 3: Reset password email
    if (authMode === 'reset') {
      if (!authEmail.trim()) {
        setModalAuthError("Por favor, informe seu e-mail.");
        return;
      }
      setAuthSubmitting(true);
      try {
        await resetPasswordForEmail(authEmail);
        showToast("E-mail enviado! Verifique sua Caixa de Entrada e SPAM.", "success");
        setModalAuthError("✅ Solicitação enviada com sucesso! Verifique sua Caixa de Entrada e a pasta de SPAM/Lixo Eletrônico.");
      } catch (err: any) {
        console.error("Password reset error:", err);
        setModalAuthError(err.message || "Erro ao enviar e-mail de redefinição de senha.");
      } finally {
        setAuthSubmitting(false);
      }
      return;
    }
  };

  const [isQuotaExceeded, setIsQuotaExceeded] = useState(() => isFirebaseQuotaExceeded());
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(() => isFirebaseQuotaExceeded());

  useEffect(() => {
    const handleQuotaChange = (e: any) => {
      const exceeded = e.detail;
      setIsQuotaExceeded(exceeded);
      if (exceeded === true) {
        setIsQuotaModalOpen(true);
      }
    };
    window.addEventListener('supabase_quota_exceeded_change', handleQuotaChange);
    return () => {
      window.removeEventListener('supabase_quota_exceeded_change', handleQuotaChange);
    };
  }, []);

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
  const [weaponMenuCompIdx, setWeaponMenuCompIdx] = useState<number | null>(null);

  const showToast = useCallback(
    (message: string, type: "error" | "success" | "info" = "info") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    },
    [],
  );
  const [activePage, setActivePage] = useState<
    "sheet" | "notes" | "dice" | "gallery" | "master" | "table" | "bestiary" | "library" | "materials" | "toca" | "items" | "spells"
  >("sheet");
  const [customMaterials, setCustomMaterials] = useState<MaterialData[]>([]);
  const [masterCampaigns, setMasterCampaigns] = useState<Campaign[]>([]);
  const [joinedCampaigns, setJoinedCampaigns] = useState<Campaign[]>([]);
  const [isCampaignsLoaded, setIsCampaignsLoaded] = useState(false);
  const [isJoinedCampaignsLoaded, setIsJoinedCampaignsLoaded] = useState(false);
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
    if (isLoadingSync || !isJoinedCampaignsLoaded) return [];
    const allCampaignIds = new Set(campaigns.map(c => c.id));
    const idsInChars = Array.from(new Set(state.characters.map(c => c.campaignId).filter(id => !!id)));
    return idsInChars.filter(id => !allCampaignIds.has(id));
  }, [state.characters, campaigns, isLoadingSync, isJoinedCampaignsLoaded]);
  const [campaignCharacters, setCampaignCharacters] = useState<Character[]>([]);
  const [tokens, setTokens] = useState<TableToken[]>([]);
  const [tableConfig, setTableConfig] = useState<TableConfig>({ gridSize: 50, showGrid: true, masterFog: false });
  const [masterReminderModal, setMasterReminderModal] = useState<{
    showHungerThirst: boolean;
    showFatigue: boolean;
    hour: number;
  } | null>(null);
  const [remindersEnabled, setRemindersEnabled] = useState({
    hungerThirst: true,
    fatigue: true,
  });
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [newCampaignName, setNewCampaignName] = useState("");
  const [charToLinkCampaignId, setCharToLinkCampaignId] = useState("");
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
  const [charIdToDelete, setCharIdToDelete] = useState<string | null>(null);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<{ id: string; url: string; titulo: string } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
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

  const handleRescueAllCharacters = useCallback(() => {
    const rescued = rescueAllLocalCharacters();
    if (rescued.length === 0) {
      showToast("Nenhuma ficha antiga encontrada no cache deste navegador.", "info");
      return;
    }
    setState(prev => {
      const existingMap = new Map<string, Character>();
      prev.characters.forEach(c => existingMap.set(c.id, c));
      
      let added = 0;
      let updated = 0;

      for (const r of rescued) {
        const sanitized = sanitizeCharacter({
          ...r,
          userId: user?.uid || r.userId,
          userEmail: user?.email || r.userEmail
        });
        
        if (existingMap.has(sanitized.id)) {
          const current = existingMap.get(sanitized.id)!;
          // Se a ficha resgatada tiver nome real e a atual não, ou se tiver mais armas/magias
          const currentIsPlaceholder = current.nome === 'Novo Personagem' && (!current.armas || current.armas.length === 0);
          const sanitizedHasData = sanitized.nome !== 'Novo Personagem' || (sanitized.armas && sanitized.armas.length > 0);
          if (currentIsPlaceholder && sanitizedHasData) {
            existingMap.set(sanitized.id, sanitized);
            updated++;
          }
        } else {
          existingMap.set(sanitized.id, sanitized);
          added++;
        }
      }

      let cleaned = Array.from(existingMap.values());
      // Se encontramos fichas reais, descarta placeholder "Novo Personagem" vazio
      const hasReal = cleaned.some(c => c.nome && c.nome !== 'Novo Personagem');
      if (hasReal) {
        cleaned = cleaned.filter(c => c.nome !== 'Novo Personagem' || (c.armas && c.armas.length > 0) || (c.magias && c.magias.length > 0));
      }

      const dirty = new Set(prev.dirtyCharacterIds || []);
      cleaned.forEach(c => dirty.add(c.id));
      
      try {
        safeLocalStorageSetItem(STORAGE_KEY, JSON.stringify({
          ...prev,
          characters: cleaned,
          activeCharacterId: cleaned[0]?.id || "",
          dirtyCharacterIds: Array.from(dirty)
        }));
      } catch (e) {}

      showToast(`Sucesso! ${cleaned.length} ficha(s) restaurada(s) no seu navegador.`, "success");
      return {
        ...prev,
        characters: cleaned,
        activeCharacterId: cleaned.length > 0 ? (cleaned.some(c => c.id === prev.activeCharacterId) ? prev.activeCharacterId : cleaned[0].id) : "",
        dirtyCharacterIds: Array.from(dirty)
      };
    });
    if (user?.uid) {
      syncLocalToCloud().catch(console.error);
    }
  }, [user, showToast]);

  // Função para exportar todas as fichas locais em arquivo JSON
  const handleExportAllBackup = useCallback(() => {
    const rescued = rescueAllLocalCharacters();
    const allChars = [...state.characters];
    for (const r of rescued) {
      if (!allChars.some(c => c.id === r.id)) {
        allChars.push(sanitizeCharacter(r));
      }
    }
    const backupData = {
      version: "5.1",
      exportedAt: new Date().toISOString(),
      userEmail: user?.email || "local",
      characters: allChars
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `demons_despair_fichas_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Backup baixado com sucesso!", "success");
  }, [state.characters, user, showToast]);

  // Restaura uma ficha individual específica para a lista ativa do usuário
  const handleRestoreSingleCharacter = useCallback((char: any) => {
    setState(prev => {
      const sanitized = sanitizeCharacter({
        ...char,
        userId: user?.uid || char.userId,
        userEmail: user?.email || char.userEmail
      });
      const exists = prev.characters.some(c => c.id === sanitized.id);
      let updatedChars = exists 
        ? prev.characters.map(c => c.id === sanitized.id ? sanitized : c)
        : [...prev.characters, sanitized];
      
      // Remove o placeholder vazio inicial se houver fichas reais
      if (updatedChars.length > 1) {
        updatedChars = updatedChars.filter(c => c.nome !== 'Novo Personagem' || (c.armas && c.armas.length > 0));
      }
      const dirty = new Set(prev.dirtyCharacterIds || []);
      dirty.add(sanitized.id);

      try {
        safeLocalStorageSetItem(STORAGE_KEY, JSON.stringify({
          ...prev,
          characters: updatedChars,
          activeCharacterId: sanitized.id,
          dirtyCharacterIds: Array.from(dirty)
        }));
      } catch (e) {}

      showToast(`Ficha "${sanitized.nome}" restaurada com sucesso!`, "success");
      return {
        ...prev,
        characters: updatedChars,
        activeCharacterId: sanitized.id,
        dirtyCharacterIds: Array.from(dirty)
      };
    });
    if (user?.uid) {
      syncLocalToCloud().catch(console.error);
    }
  }, [user, showToast]);

  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? window.navigator.onLine : true);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(initialSupabaseConnected);

  // Monitorar conexão
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const handleStatusChange = (e: any) => {
      if (e.detail) {
        setIsSupabaseConnected(e.detail.connected);
      }
    };
    window.addEventListener('supabase_connection_status_changed', handleStatusChange);

    const handleMixedContentError = (e: any) => {
      if (e.detail?.message) {
        showToast(e.detail.message, "error");
      }
    };
    window.addEventListener('supabase_connection_mixed_content_error', handleMixedContentError);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('supabase_connection_status_changed', handleStatusChange);
      window.removeEventListener('supabase_connection_mixed_content_error', handleMixedContentError);
    };
  }, [showToast]);

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
      try {
        const redirectedUser = await handleRedirectResult();
        if (redirectedUser && isSubscribed) {
          console.log("Usuário recuperado do redirect:", redirectedUser.email);
          setUser(redirectedUser);
          setAuthLoading(false);
        }
      } catch (err) {
        console.error("Erro ao verificar redirect:", err);
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

  // Adopt and retain local characters on login/logout state transitions
  useEffect(() => {
    if (authLoading) return; // Wait until authentication state is resolved!

    if (user) {
      setState(prev => {
        const userEmailLower = (user.email || '').trim().toLowerCase();

        // Filter and adopt only characters that belong to this account or are genuinely unowned guests
        const userCharacters = prev.characters.filter(char => {
          return isCharacterOwnedByCurrentUser(char, user);
        }).map(char => {
          const charEmailLower = (char.userEmail || '').trim().toLowerCase();
          const isUnownedGuest = (!charEmailLower || charEmailLower.startsWith('guest_')) && (!char.userId || char.userId.startsWith('guest_'));
          if (isUnownedGuest) {
            return {
              ...char,
              userId: user.uid,
              userEmail: user.email || char.userEmail
            };
          }
          return char;
        });

        let finalChars = userCharacters;

        // Se não tem fichas reais, tenta primeiro restaurar da chave privada da conta salva no logout
        if (!finalChars.some(c => c.nome && c.nome !== 'Novo Personagem') && userEmailLower) {
          try {
            const accountSavedRaw = localStorage.getItem('rpg_chars_account_' + userEmailLower);
            if (accountSavedRaw) {
              const parsed = JSON.parse(accountSavedRaw);
              if (Array.isArray(parsed) && parsed.length > 0) {
                console.log(`⚡ [Account Restore] Restauradas ${parsed.length} fichas do cache da conta: ${userEmailLower}`);
                finalChars = parsed.map(sanitizeCharacter);
              }
            }
          } catch (e) {}
        }

        const hasRealChars = finalChars.some(c => c.nome && c.nome !== 'Novo Personagem');
        if (!hasRealChars) {
          const rescued = rescueAllLocalCharacters();
          const ownRescued = rescued.filter(c => {
            const cEmail = (c.userEmail || c.user_email || c.email || '').trim().toLowerCase();
            const cUid = c.userId || c.user_id;
            const isSameEmail = Boolean(userEmailLower && cEmail && userEmailLower === cEmail);
            const isSameUid = Boolean(cUid && cUid === user.uid);
            const isUnownedGuest = (!cEmail || cEmail.startsWith('guest_')) && (!cUid || String(cUid).startsWith('guest_'));
            return isSameEmail || isSameUid || isUnownedGuest;
          });

          if (ownRescued.length > 0) {
            console.log(`⚡ [Rescue on Login] Resgatadas ${ownRescued.length} fichas do usuário!`);
            finalChars = ownRescued.map(c => {
              const cEmail = (c.userEmail || c.user_email || c.email || '').trim().toLowerCase();
              const isUnownedGuest = (!cEmail || cEmail.startsWith('guest_')) && (!c.userId || String(c.userId).startsWith('guest_'));
              return {
                ...sanitizeCharacter(c),
                userId: isUnownedGuest ? user.uid : (c.userId || user.uid),
                userEmail: isUnownedGuest ? (user.email || c.userEmail) : (c.userEmail || user.email)
              };
            });
          }
        }

        return {
          ...prev,
          characters: finalChars,
          activeCharacterId: finalChars.length > 0 ? (finalChars.some(c => c.id === prev.activeCharacterId) ? prev.activeCharacterId : finalChars[0].id) : "",
          dirtyCharacterIds: prev.dirtyCharacterIds || []
        };
      });
    } else {
      // Quando o jogador NÃO está logado (!user):
      // Isolamento estrito de conta: remove imediatamente qualquer ficha de usuários registrados.
      // Jogador não logado só tem acesso a fichas anônimas/convidado (guest) ou uma nova ficha limpa!
      setState(prev => {
        const guestChars = prev.characters.filter(char => isCharacterOwnedByCurrentUser(char, null));
        let finalChars = guestChars;
        if (finalChars.length === 0) {
          finalChars = [createEmptyCharacter()];
        }
        const activeId = finalChars.some(c => c.id === prev.activeCharacterId)
          ? prev.activeCharacterId
          : finalChars[0].id;

        return {
          ...prev,
          characters: finalChars,
          activeCharacterId: activeId,
          dirtyCharacterIds: []
        };
      });
    }
  }, [user, authLoading]);

  // Firebase Sync Effect
  useEffect(() => {
    if (!user?.uid) {
      setIsLoadingSync(false);
      return;
    }
    
    console.log("🔥 [Sync] Iniciando assinatura de personagens para:", user.uid);
    setIsLoadingSync(true);
    lastSyncedRef.current = {}; // Limpa cache ao trocar de usuário

    // Auto-analisar e restaurar tudo atrelado ao e-mail no Supabase
    if (user.email) {
      forceSyncAndRestoreByEmail(user.email, user.uid).catch(e => {
        console.warn("⚠️ [Sync] Auto-restauração por e-mail em background:", e);
      });
    }

    const unsubscribe = subscribeToUserCharacters(user.uid, user.email || "", (fireChars, metadata) => {
      console.log(`📡 [Sync] ${fireChars.length} personagens carregados (${metadata.fromCache ? 'Cache' : 'Servidor'}). Pendentes: ${metadata.hasPendingWrites}`);
      
      // Só paramos o loading principal quando recebemos dados do servidor (ou se o cache estiver vazio e carregado)
      if (!metadata.fromCache) {
        setIsLoadingSync(false);
      }

      // We keep deleted character IDs in deletedCharsRef to ensure they are never resurrected.
      // This prevents race conditions and snapshot glitches from bringing deleted characters back.

      // Sanitize characters from Firestore and exclude those deleted locally
      const sanitizedFireChars = fireChars
        .filter(fc => !deletedCharsRef.current.has(fc.id))
        .map(fc => ({ ...sanitizeCharacter(fc), isRemoteSynced: true }));

      setState(prev => {
        const dirtyIds = new Set(prev.dirtyCharacterIds || []);
        
        // Se a única ficha local for o "Novo Personagem" inicial/vazio, e temos fichas no servidor,
        // vamos descartá-lo para evitar que ele seja fundido como "ficha local nova" e suba para o servidor.
        let localCharacters = prev.characters;
        if (localCharacters.length === 1 && 
            localCharacters[0].nome === "Novo Personagem" && 
            !localCharacters[0].isRemoteSynced && 
            sanitizedFireChars.length > 0) {
          localCharacters = [];
        }

        console.log(`🔍 [Sync] Merge: Local=${localCharacters.length}, Remote=${sanitizedFireChars.length}, PendingWrites=${metadata.hasPendingWrites}, Dirty=${Array.from(dirtyIds).join(', ')}`);
        
        // Map Firestore characters to our state
        const mergedCharacters = sanitizedFireChars.map(fChar => {
          const charJson = getSyncJson(fChar);
          const localMatch = localCharacters.find(lc => lc.id === fChar.id);
          
          // Migração: Se a ficha vinda do servidor tem o email correto mas o UID está faltando ou é diferente do atual,
          // vamos marcar como dirty para forçar a atualização com o UID correto do usuário logado.
          const needsMigration = fChar.userEmail === user.email && (!fChar.userId || fChar.userId !== user.uid);
          
          const migratedFChar = needsMigration
            ? { ...fChar, userId: user.uid, userEmail: user.email || fChar.userEmail }
            : fChar;

          if (needsMigration && !dirtyIds.has(fChar.id)) {
            console.log(`🔄 [Sync] Migrando ${fChar.nome} para o UID ${user.uid} (vincular por email)`);
            dirtyIds.add(fChar.id);
          }

          if (localMatch) {
            const localJson = getSyncJson(localMatch);
            const localMigrated = needsMigration
              ? { ...localMatch, userId: user.uid, userEmail: user.email || localMatch.userEmail }
              : localMatch;
            
            // Se a ficha local é exatamente igual à do servidor ou não está "suja" (dirty), usamos a do servidor
            if (localJson === charJson || !dirtyIds.has(localMatch.id)) {
              if (localJson === charJson && dirtyIds.has(localMatch.id) && !metadata.hasPendingWrites) {
                console.log(`✅ [Sync] Dados coincidem para ${fChar.nome}. Limpando flag dirty.`);
                dirtyIds.delete(localMatch.id);
              }
              lastSyncedRef.current[fChar.id] = charJson;
              return { ...migratedFChar, isRemoteSynced: true };
            } else {
              // Se a local está suja (tem alteração não salva), preservamos a local por enquanto
              console.log(`⚠️ [Sync] Preservando alteração local de ${fChar.nome}`);
              return { ...localMigrated, isRemoteSynced: true };
            }
          }
          
          // Nova ficha vinda do servidor
          lastSyncedRef.current[fChar.id] = charJson;
          return { ...migratedFChar, isRemoteSynced: true };
        });

        // Adicionar fichas que só existem localmente (novas criadas off-line ou em processamento)
        const localOnly = localCharacters.filter(lc => {
          const isRemote = sanitizedFireChars.some(fc => fc.id === lc.id);
          const isOwn = lc.userId === user.uid || (lc.userEmail && lc.userEmail === user.email);

          // Se não é nossa ficha (por exemplo, pertence a outro jogador ou é uma criatura na campanha),
          // não devemos aplicar a lógica de remoção/sincronização de ficha própria privada.
          if (!isOwn) {
            return !isRemote && !deletedCharsRef.current.has(lc.id);
          }

          // Se a ficha não existe no servidor mas existe localmente e não foi deletada pelo usuário:
          // NUNCA excluí-la automaticamente! Preservá-la e agendar o envio ao servidor.
          const isDeletedLocally = deletedCharsRef.current.has(lc.id);
          if (!isRemote && !isDeletedLocally) {
            if (!dirtyIds.has(lc.id) && lc.nome && lc.nome !== 'Novo Personagem') {
              console.log(`🛡️ [Sync] Preservando ficha local existente para upload: ${lc.nome}`);
              dirtyIds.add(lc.id);
            }
            return true;
          }
          
          return false;
        });

        // Se estamos logados, queremos que as fichas locais (novas e nunca sincronizadas) subam para o servidor
        localOnly.forEach(lc => {
          const isOwn = lc.userId === user.uid || (lc.userEmail && lc.userEmail === user.email) || (!lc.userId && !lc.userEmail);
          if (!isOwn) return; // Não tenta subir fichas de outros usuários

          const wasPreviouslySynced = lc.isRemoteSynced || !!lastSyncedRef.current[lc.id];
          const isDefaultPlaceholder = lc.nome === "Novo Personagem" && 
            (!lc.armas || lc.armas.length === 0) && 
            (!lc.magias || lc.magias.length === 0) &&
            (!lc.habilidades || lc.habilidades.length === 0);

          if (!wasPreviouslySynced && !dirtyIds.has(lc.id) && !isDefaultPlaceholder) {
            console.log(`📡 [Sync] Agendando upload de ficha local nova: ${lc.nome}`);
            dirtyIds.add(lc.id);
          }
        });
        
        let finalCharacters = [...mergedCharacters, ...localOnly];
        
        // Se a lista resultante não possuir nenhuma ficha com nome personalizado/real,
        // realiza o auto-resgate do histórico local do navegador atrelando ao usuário logado
        const hasRealCharacters = finalCharacters.some(c => c.nome && c.nome !== 'Novo Personagem');
        if (!hasRealCharacters) {
          const rescued = rescueAllLocalCharacters();
          const validRescued = rescued.filter(r => r.nome && r.nome !== 'Novo Personagem');
          if (validRescued.length > 0) {
            console.log(`🛡️ [Auto-Rescue] Restaurando automaticamente ${validRescued.length} fichas do cache local.`);
            finalCharacters = validRescued.map(r => ({
              ...sanitizeCharacter(r),
              userId: user.uid,
              userEmail: user.email || r.userEmail || ""
            }));
            finalCharacters.forEach(c => dirtyIds.add(c.id));
          }
        }
        
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
    if (!user?.uid) {
      setMasterCampaigns([]);
      setIsCampaignsLoaded(false);
      return;
    }
    const unsubscribe = subscribeToMasterCampaigns((camps) => {
      setMasterCampaigns(camps);
      setIsCampaignsLoaded(true);
    });
    return () => unsubscribe();
  }, [user?.uid, user?.email]);

  // Player Joined Campaigns Effect - Fetch campaigns based on player email instead of character campaignId fields
  useEffect(() => {
    if (!user?.email) {
      setJoinedCampaigns([]);
      setIsJoinedCampaignsLoaded(true);
      return;
    }
    setIsJoinedCampaignsLoaded(false);
    console.log(`📡 [Sync] Assinando campanhas participadas para o email: ${user.email}`);
    const unsubscribe = subscribeToJoinedCampaigns(user.email, (camps) => {
      setJoinedCampaigns(camps);
      setIsJoinedCampaignsLoaded(true);
    });
    return () => {
      console.log(`🔌 [Sync] Cancelando assinatura de campanhas participadas`);
      unsubscribe();
    };
  }, [user?.email]);

  // Validate activeCampaignId against current campaigns to auto-deselect if deleted/invalid
  useEffect(() => {
    if (user?.uid && activeCampaignId && !isLoadingSync && isCampaignsLoaded && isJoinedCampaignsLoaded) {
      const allLoadedCamps = [...masterCampaigns, ...joinedCampaigns];
      // Only clear if we actually loaded campaigns and the active campaign is definitely not in the user's master or joined list
      if (allLoadedCamps.length > 0) {
        const exists = allLoadedCamps.some(c => c.id === activeCampaignId) || campaignCharacters.length > 0;
        if (!exists) {
          console.log("🧹 Clearing stale/orphan activeCampaignId because it does not exist in campaigns:", activeCampaignId);
          setActiveCampaignIdWithSync(null);
        }
      }
    }
  }, [masterCampaigns, joinedCampaigns, campaignCharacters.length, activeCampaignId, user?.uid, isLoadingSync, isCampaignsLoaded, isJoinedCampaignsLoaded]);

  // Redirect to library if there are no characters (activeChar is null) and we are not on the DM/library/oracle pages
  useEffect(() => {
    if (!isLoadingSync && state.characters.length === 0) {
      const allowedPagesWithoutChar = [
        "library", "master", "bestiary", "toca", 
        "materials", "items", "spells"
      ];
      if (!allowedPagesWithoutChar.includes(activePage)) {
        setActivePage("library");
      }
    }
  }, [isLoadingSync, state.characters.length, activePage]);

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

  // Merge campaign characters with user's local characters so players always see their characters in VTT
  const vttAvailableCharacters = useMemo(() => {
    const map = new Map<string, Character>();
    campaignCharacters.forEach(c => {
      if (!deletedCharsRef.current.has(c.id)) {
        map.set(c.id, c);
      }
    });
    state.characters.forEach(c => {
      if (!deletedCharsRef.current.has(c.id) && !map.has(c.id)) {
        map.set(c.id, c);
      }
    });
    return Array.from(map.values());
  }, [campaignCharacters, state.characters]);

  // Automatically merge campaign characters into state.characters so Mestre and players have full sheet access
  useEffect(() => {
    if (!user?.uid || !activeCampaignId || campaignCharacters.length === 0) return;

    setState(prev => {
      let changed = false;
      const charMap = new Map(prev.characters.map(c => [c.id, c]));

      campaignCharacters.forEach(cc => {
        if (cc && cc.id && !deletedCharsRef.current.has(cc.id) && !charMap.has(cc.id)) {
          charMap.set(cc.id, cc);
          changed = true;
        }
      });

      if (!changed) return prev;
      const newChars = Array.from(charMap.values());
      return {
        ...prev,
        characters: newChars,
        activeCharacterId: prev.activeCharacterId || (newChars.length > 0 ? newChars[0].id : "")
      };
    });
  }, [activeCampaignId, campaignCharacters, user?.uid]);

  const [tocaEditingCreatureId, setTocaEditingCreatureId] = useState<string | null>(null);
  const [bestiaryEditingMonsterId, setBestiaryEditingMonsterId] = useState<string | null>(null);
  const [bestiaryMonsters, setBestiaryMonsters] = useState<BestiaryMonster[]>([]);
  const [isVttSheetOpen, setIsVttSheetOpen] = useState(false);
  const [activeNoteImageModal, setActiveNoteImageModal] = useState<{ url: string; title?: string } | null>(null);

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

  const cleanCharFromCampaignCaches = (charId: string) => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("campaign_characters_")) {
          const stored = safeLocalStorageGetItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              const filtered = parsed.filter((c: any) => c.id !== charId);
              safeLocalStorageSetItem(key, JSON.stringify(filtered));
            }
          }
        }
      }
    } catch (e) {
      console.error("Error sweeping campaign caches for deleted char:", e);
    }
  };

  // Lista de personagens visíveis e permitidos para a conta atual (ou guest se deslogado)
  const visibleCharacters = useMemo(() => {
    if (!user) {
      // Quando não logado: isolamento estrito, exibe apenas fichas de visitante/convidado deste navegador
      return state.characters.filter(c => isCharacterOwnedByCurrentUser(c, null));
    }
    // Quando logado: exibe as fichas pertencentes a este usuário ou fichas anônimas locais adotadas
    return state.characters.filter(c => isCharacterOwnedByCurrentUser(c, user));
  }, [state.characters, user]);

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
    const char = visibleCharacters.find((c) => c.id === state.activeCharacterId);
    if (char) return char;
    if (visibleCharacters.length > 0) return visibleCharacters[0];
    return null;
  }, [visibleCharacters, state.activeCharacterId, state.characters, tocaEditingCreatureId, bestiaryEditingMonsterId, bestiaryMonsters]);

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
      safeLocalStorageSetItem(STORAGE_KEY, JSON.stringify(state));
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
    damage?: number;
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
    attackerName?: string;
    targetName?: string;
    detailedTitle?: string;
    combatStatus?: string;
    effectType?: string;
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

  // Decoupled campaign association from active character, allowing players and masters to navigate campaigns independently

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
      const isCrossing18 = (current.hour < 18 && newHour >= 18) && (newDay === currentDate.day);
      const newWeather = (newDay !== currentDate.day || (minutes >= 1440) || isCrossing18) 
        ? generateWeather(season) 
        : tableConfig.weather;

      await updateTableConfig(activeCampaignId, {
        time: { hour: newHour, minute: newMinute },
        date: { day: newDay, month: newMonth, year: newYear },
        weather: newWeather
      });
      showToast(minutes >= 1440 ? "+1 Dia" : `+${minutes}m`, "success");

      // Check time reminders for Master page
      const hungerHours = [0, 4, 8, 12, 16, 20];
      const fatigueHours = [20, 22, 0, 2];

      let showHungerThirst = false;
      let showFatigue = false;
      let reminderHour = newHour;

      if (minutes >= 1440) {
        if (remindersEnabled.hungerThirst) {
          showHungerThirst = true;
        }
        if (remindersEnabled.fatigue && (newHour >= 20 || newHour <= 2)) {
          showFatigue = true;
        }
      } else {
        let h = current.hour;
        let m = current.minute;
        for (let elapsed = 1; elapsed <= minutes; elapsed++) {
          m++;
          if (m >= 60) {
            m = 0;
            h = (h + 1) % 24;
          }
          if (m === 0) {
            if (remindersEnabled.hungerThirst && hungerHours.includes(h)) {
              showHungerThirst = true;
              reminderHour = h;
            }
            if (remindersEnabled.fatigue && fatigueHours.includes(h)) {
              showFatigue = true;
              reminderHour = h;
            }
          }
        }
      }

      if (showHungerThirst || showFatigue) {
        setMasterReminderModal({
          showHungerThirst,
          showFatigue,
          hour: reminderHour
        });
      }
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
      const userEmailLower = user.email?.toLowerCase();
      const isMasterOfCampaign = activeCampaignId && campaigns.some(c => c.id === activeCampaignId && ((c.masterEmail && c.masterEmail.toLowerCase() === userEmailLower) || c.masterId === user.uid));

      // 1. Filtrar e fazer upload apenas das fichas que pertencem a nós ou que somos o mestre da campanha ativa
      const allowedCharacters = state.characters.filter(char => {
        const isOwn = (char.userEmail && char.userEmail.toLowerCase() === userEmailLower) || char.userId === user.uid || (!char.userId && !char.userEmail);
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
    if (!activeChar && (label === "Fome e Sede" || label === "Cansaço" || label?.includes("3d8"))) {
      showToast("Selecione um personagem para rolar dados de condição.", "info");
      return;
    }
    if (label === "Fome e Sede") {
      if (!activeChar) return;
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
        activeChar.efeitosNegativos || [],
        activeChar.sanidadeAtual,
        getSanidadeMaxima(activeChar.stats.MEN)
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
      activeChar.efeitosNegativos || [],
      activeChar.sanidadeAtual,
      getSanidadeMaxima(activeChar.stats.MEN)
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
      activeChar.efeitosNegativos || [],
      activeChar.sanidadeAtual,
      getSanidadeMaxima(activeChar.stats.MEN)
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
    const isFirearm = arma.categoria === 'Arma de Fogo';
    const isBow = arma.categoria === 'Arco';
    if (isFirearm || isBow) {
      if (arma.magazineAmmo && arma.magazineAmmo.length > 0) {
        bulletDano = arma.magazineAmmo[0].dano || arma.dano || (isBow ? "1d6" : "2d6");
      } else {
        const ammoId = isBow ? (arma.arrowId || arma.bulletId) : (arma.bulletId || arma.arrowId);
        const loadedAmmo = (activeChar.compartimentos || [])
          .flatMap((c: any) => (c.itens || []))
          .find((i: any) => i.id === ammoId);
        if (loadedAmmo && loadedAmmo.dano) {
          bulletDano = loadedAmmo.dano;
        } else {
          bulletDano = arma.dano || (isBow ? "1d6" : "2d6");
        }
      }
    }
    const rollData = parseAndRollDice((isFirearm || isBow) ? bulletDano : (arma.dano || "1d6"));
    
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

    // 6. Handle Ammunition & Durability Degradation for the weapon used
    updateChar((c: any) => {
      let weaponProcessed = false;
      const hasTwoOnes = hitRolls.filter(r => r === 1).length >= 2;

      const updateWeaponProps = (w: any) => {
        if (w.id !== arma.id) return w;
        weaponProcessed = true;
        
        let newDur = w.durabilidade || 0;
        let newMaxDur = w.maxDurabilidade || 0;
        let newQtd = w.quantidade || 1;

        if (isThrowable) {
          newQtd = Math.max(0, newQtd - 1);
        }
        
        // Firearms always degrade by 1 per shot; others degrade on critical error (two 1s)
        if (isFirearm || hasTwoOnes) {
          if (newDur > 0) {
            newDur -= 1;
          } else if (newMaxDur > 0) {
            newMaxDur -= 1;
          }
        }
        
        let newMunCarregada = w.municaoCarregada;
        let newMagAmmo = w.magazineAmmo || [];
        if ((isFirearm || isBow) && (newMunCarregada || 0) > 0) {
          newMunCarregada = Math.max(0, newMunCarregada - 1);
          if (newMagAmmo.length > 0) {
            newMagAmmo = newMagAmmo.slice(1);
          }
        }
        
        return {
          ...w,
          durabilidade: newDur,
          maxDurabilidade: newMaxDur,
          quantidade: newQtd,
          municaoCarregada: newMunCarregada,
          magazineAmmo: newMagAmmo
        };
      };

      const newArmas = (c.armas || []).map(updateWeaponProps);
      let newCompartimentos = c.compartimentos || [];
      if (!weaponProcessed) {
        newCompartimentos = newCompartimentos.map((comp: any) => ({
          ...comp,
          itens: (comp.itens || []).map(updateWeaponProps)
        }));
      }

      if (isBow && arma.arrowId) {
        newCompartimentos = newCompartimentos.map((comp: any) => ({
          ...comp,
          itens: (comp.itens || []).map((it: any) => {
            if (it.id === arma.arrowId) {
              return { ...it, quantidade: Math.max(0, (it.quantidade || 0) - 1) };
            }
            return it;
          })
        }));
      }
      
      return { armas: newArmas, compartimentos: newCompartimentos };
    });
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

  const handleReloadChar = (char: Character, weaponId: string, ammoId: string, all: boolean = false) => {
    updateChar((c) => {
      let weapon = c.armas.find(w => w.id === weaponId);
      let inArmas = !!weapon;
      if (!weapon) {
        weapon = (c.compartimentos || []).flatMap(comp => comp.itens || []).find(it => it.id === weaponId) as any;
      }
      if (!weapon) return c;
      
      const ammo = c.compartimentos?.flatMap(comp => comp.itens || []).find(it => it.id === ammoId);
      if (!ammo || (ammo.quantidade || 0) <= 0) return c;
      
      const currentMagazine = (weapon as any).magazineAmmo || [];
      const maxCapacity = getMaxCapacity(weapon);
      if (currentMagazine.length >= maxCapacity) return c;
      
      const needed = all ? (maxCapacity - currentMagazine.length) : 1;
      const amountToLoad = Math.min(ammo.quantidade || 0, needed);
      if (amountToLoad <= 0) return c;

      const ammoToAdd = Array.from({ length: amountToLoad }, () => ({ ...ammo as any, id: generateId(), quantidade: 1 }));
      const newMagazine = [...currentMagazine, ...ammoToAdd];

      const isBow = (weapon.categoria || "").toLowerCase() === "arco" || ((weapon as any).tipo || "").toLowerCase().includes("arco");
      const updatedWeaponProps = {
        ...weapon,
        municaoCarregada: newMagazine.length,
        magazineAmmo: newMagazine,
        bulletId: !isBow ? ammo.id : undefined,
        arrowId: isBow ? ammo.id : undefined,
        corte: Number(ammo.corte) || 0,
        perfuracao: Number(ammo.perfuracao) || 0,
        impacto: Number(ammo.impacto) || 0,
        resistencia: Number(ammo.resistencia) || 0,
        ...(ammo.dano ? { municaoDano: ammo.dano } : {})
      };

      const newArmas = (c.armas || []).map(w => w.id === weaponId ? updatedWeaponProps : w);

      const newCompartimentos = (c.compartimentos || []).map(comp => ({
        ...comp,
        itens: comp.itens.map(it => {
          if (it.id === ammoId) {
            return { ...it, quantidade: Math.max(0, (it.quantidade || 0) - amountToLoad) };
          }
          if (!inArmas && it.id === weaponId) {
            return updatedWeaponProps;
          }
          return it;
        })
      }));

      return { ...c, armas: newArmas, compartimentos: newCompartimentos };
    });
  };

  const handleMaintenanceChar = (char: Character, weaponId: string) => {
    updateChar((c) => {
      let weapon = c.armas.find(w => w.id === weaponId);
      let inArmas = !!weapon;
      if (!weapon) {
        weapon = (c.compartimentos || []).flatMap(comp => comp.itens || []).find(it => it.id === weaponId) as any;
      }
      if (!weapon) return c;
      const maxDur = (weapon as any).durabilidadeMaxUtil || weapon.maxDurabilidade || 10;
      
      const updatedWeapon = { ...weapon, durabilidade: maxDur };
      const newArmas = (c.armas || []).map(w => w.id === weaponId ? updatedWeapon : w);
      const newCompartimentos = (c.compartimentos || []).map(comp => ({
        ...comp,
        itens: comp.itens.map(it => it.id === weaponId ? updatedWeapon : it)
      }));
      
      return { ...c, armas: newArmas, compartimentos: newCompartimentos };
    });
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
      activeChar.efeitosNegativos || [],
      activeChar.sanidadeAtual,
      getSanidadeMaxima(activeChar.stats.MEN)
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

  const sanityEffects = useMemo(() => {
    if (!activeChar) return [];
    const maxSanity = getSanidadeMaxima(activeChar.stats.MEN);
    if (maxSanity <= 0) return [];
    const ratio = activeChar.sanidadeAtual / maxSanity;
    const effects: string[] = [];

    if (ratio <= 0.25) {
      effects.push(
        "Mente em ruínas: -50% de deslocamento e -2 em todas as proficiências de APR, MEN ou INT.",
      );
    } else if (ratio <= 0.50) {
      effects.push(
        "Mente abalada: -33.3% de deslocamento e -1 em todas as proficiências de APR, MEN ou INT.",
      );
    }
    return effects;
  }, [activeChar?.sanidadeAtual, activeChar?.stats.MEN]);

  // Auto-save removed - handled by debounced effect above

  const updateChar = useCallback((updatesOrFn: (Partial<Character> & Record<string, any>) | ((c: Character) => Partial<Character> & Record<string, any>), characterId?: string) => {
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
  }, [tocaEditingCreatureId, bestiaryEditingMonsterId, bestiaryMonsters]);

  const handleAddItemToCharacterCompartment = useCallback((characterId: string, compartmentId: string, item: Item) => {
    updateChar(char => {
      const comps = char.compartimentos || [];
      const compIdx = comps.findIndex(c => c.id === compartmentId);
      if (compIdx === -1) return {};
      
      const targetComp = comps[compIdx];
      const currentDate = tableConfig.date || { day: 1, month: 1, year: 2024 };
      const itemToInsert = { ...item };
      if (itemToInsert.isFood && !itemToInsert.dataCriacao) {
        itemToInsert.dataCriacao = { ...currentDate };
      }
      
      const newItens = [
        ...(targetComp.itens || []),
        {
          ...itemToInsert,
          id: generateId()
        }
      ];
      
      return {
        compartimentos: comps.map((c, i) => i === compIdx ? { ...c, itens: newItens } : c)
      };
    }, characterId);
  }, [updateChar, tableConfig.date]);

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
        const userEmailLower = user.email?.toLowerCase();
        const isMasterOfCharCampaign = char.campaignId && campaigns.some(c => c.id === char.campaignId && ((c.masterEmail && c.masterEmail.toLowerCase() === userEmailLower) || c.masterId === user.uid));
        const isOwn = (char.userEmail && char.userEmail.toLowerCase() === userEmailLower) || char.userId === user.uid || (!char.userId && !char.userEmail) || isMasterOfCharCampaign;
        
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
            } catch (err: any) {
              const errMsg = String(err?.message || err || "").toLowerCase();
              const isNetError = errMsg.includes('fetch') || errMsg.includes('network') || errMsg.includes('typeerror') || errMsg.includes('cors');
              if (isNetError) {
                console.warn(`⚠️ [Sync] Problema de conexão ao sincronizar ${char.nome} (mantendo em modo offline):`, err?.message || err);
              } else {
                console.error(`❌ [Sync] Erro ao sincronizar ${char.nome}:`, err);
              }
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
      const isDefaultPlaceholder = activeChar.nome === "Novo Personagem" && 
        (!activeChar.armas || activeChar.armas.length === 0) && 
        (!activeChar.magias || activeChar.magias.length === 0) &&
        (!activeChar.habilidades || activeChar.habilidades.length === 0);

      if (isDefaultPlaceholder) return;

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
    const conVal = Math.max(0, Math.floor(maxHp / 2));
    stats.CON = conVal;
    stats.RES = Math.max(0, Math.floor(maxHp / 4)); // approximate resistance

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
        climateProficiency,
        activeChar.sanidadeAtual,
        getSanidadeMaxima(s.MEN)
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
      Math.floor(deslocamentoBase * p.deslocamentoMult) + s.movement + (activeChar?.bonusDeslocamento || 0),
    );

    return { pesoTotal: total, penalties: p, survivalPenalties: s, deslocamentoFinal: d };
  }, [compartimentos, armas, catalisadores, armaduras, acessorios, cargaMax, deslocamentoBase, activeChar?.fome, activeChar?.sede, activeChar?.bonusDeslocamento]);

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

  if (!activeChar && isLoadingSync) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  // Exportar Tudo (Backup Completo: Fichas, Campanhas, Bestiário, Materiais, Customizações, Toca)
  const exportAllUserData = () => {
    try {
      let localCustomItems: any[] = [];
      try {
        const saved = localStorage.getItem('supabase_table_custom_items');
        if (saved) localCustomItems = JSON.parse(saved);
      } catch (e) {}

      let localCustomSpells: any[] = [];
      try {
        const saved = localStorage.getItem('supabase_table_custom_spells');
        if (saved) localCustomSpells = JSON.parse(saved);
      } catch (e) {}

      let tocaData: any = null;
      try {
        const saved = localStorage.getItem('toca_creatures_data');
        if (saved) tocaData = JSON.parse(saved);
      } catch (e) {}

      const fullBackup = {
        app: "Demons Despair RPG",
        version: "1.14.1",
        exportDate: new Date().toISOString(),
        user: {
          uid: user?.uid || null,
          email: user?.email || null,
          displayName: user?.displayName || null,
        },
        characters: state.characters || [],
        activeCharacterId: state.activeCharacterId,
        campaigns: campaigns || [],
        activeCampaignId: activeCampaignId,
        bestiary: bestiaryMonsters || [],
        customMaterials: customMaterials || [],
        customItems: localCustomItems || [],
        customSpells: localCustomSpells || [],
        toca: tocaData,
      };

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(fullBackup, null, 2))}`;
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`;
      const fileName = `demons_despair_backup_completo_${dateStr}_${timeStr}.json`;

      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute("download", fileName);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      showToast("Backup completo exportado com sucesso!", "success");
    } catch (err: any) {
      console.error("Erro ao exportar backup completo:", err);
      showToast("Falha ao exportar backup completo.", "error");
    }
  };

  // Importar Tudo (Restaura/Adiciona Fichas, Campanhas, Monstros, Materiais, Customizações)
  const processImportAllJson = async (jsonText: string) => {
    setIsImportingAll(true);
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error("Arquivo JSON inválido.");
      }

      let charsImported = 0;
      let campsImported = 0;
      let bestiaryImported = 0;
      let matsImported = 0;
      let itemsImported = 0;
      let spellsImported = 0;

      // 1. IMPORTAR FICHAS DE PERSONAGEM
      let rawChars: any[] = [];
      if (Array.isArray(parsed)) {
        rawChars = parsed;
      } else if (Array.isArray(parsed.characters)) {
        rawChars = parsed.characters;
      } else if (parsed.nome || parsed.id) {
        rawChars = [parsed];
      }

      if (rawChars.length > 0) {
        const sanitizedChars = rawChars.map((c: any) => {
          const sc = sanitizeCharacter(c);
          if (user) {
            sc.userId = user.uid;
            sc.userEmail = user.email || "";
          }
          return sc;
        });

        setState(prev => {
          const map = new Map<string, Character>();
          prev.characters.forEach(c => map.set(c.id, c));
          sanitizedChars.forEach(c => map.set(c.id, c));
          const updatedChars = Array.from(map.values());
          const dirty = new Set(prev.dirtyCharacterIds || []);
          sanitizedChars.forEach(c => dirty.add(c.id));

          return {
            ...prev,
            characters: updatedChars,
            activeCharacterId: sanitizedChars[sanitizedChars.length - 1]?.id || prev.activeCharacterId,
            dirtyCharacterIds: Array.from(dirty)
          };
        });

        // Persist characters to cloud/local
        for (const ch of sanitizedChars) {
          try {
            saveCharacterToFirestore(ch);
          } catch (e) {}
        }
        charsImported = sanitizedChars.length;
      }

      // 2. IMPORTAR CAMPANHAS
      const rawCamps = parsed.campaigns || parsed.campanhas;
      if (Array.isArray(rawCamps) && rawCamps.length > 0) {
        const validCamps: Campaign[] = [];
        for (const camp of rawCamps) {
          if (camp && camp.id) {
            const sanitizedCamp: Campaign = {
              ...camp,
              masterId: user?.uid || camp.masterId || "",
              masterEmail: user?.email || camp.masterEmail || "",
            };
            validCamps.push(sanitizedCamp);
            saveCampaign(sanitizedCamp).catch(console.error);
            campsImported++;
          }
        }
        if (validCamps.length > 0) {
          setMasterCampaigns(prev => {
            const map = new Map<string, Campaign>();
            prev.forEach(c => map.set(c.id, c));
            validCamps.forEach(c => map.set(c.id, c));
            return Array.from(map.values());
          });
        }
      }

      // 3. IMPORTAR BESTIÁRIO
      const rawBestiary = parsed.bestiary || parsed.monstros || parsed.bestiario;
      if (Array.isArray(rawBestiary) && rawBestiary.length > 0) {
        const validMonsters: BestiaryMonster[] = [];
        for (const m of rawBestiary) {
          if (m && (m.name || m.id)) {
            const sanitizedMonster: BestiaryMonster = {
              ...m,
              id: m.id || generateId(),
              masterId: user?.uid || m.masterId || "",
            };
            validMonsters.push(sanitizedMonster);
            if (user?.uid) {
              saveMonsterToBestiary(sanitizedMonster).catch(() => {});
            }
            bestiaryImported++;
          }
        }
        if (validMonsters.length > 0) {
          setBestiaryMonsters(prev => {
            const map = new Map<string, BestiaryMonster>();
            prev.forEach(m => map.set(m.id, m));
            validMonsters.forEach(m => map.set(m.id, m));
            return Array.from(map.values());
          });
        }
      }

      // 4. IMPORTAR MATERIAIS
      const rawMats = parsed.customMaterials || parsed.materials || parsed.materiais;
      if (Array.isArray(rawMats) && rawMats.length > 0) {
        const validMats: MaterialData[] = [];
        for (const mat of rawMats) {
          if (mat && (mat.name || mat.id)) {
            const sMat: MaterialData = { ...mat, id: mat.id || generateId() };
            validMats.push(sMat);
            if (user?.uid) {
              saveMaterial(user.uid, sMat).catch(() => {});
            }
            matsImported++;
          }
        }
        if (validMats.length > 0) {
          setCustomMaterials(prev => {
            const map = new Map<string, MaterialData>();
            prev.forEach(m => map.set(m.id, m));
            validMats.forEach(m => map.set(m.id, m));
            return Array.from(map.values());
          });
        }
      }

      // 5. IMPORTAR ITENS CUSTOMIZADOS
      const rawItems = parsed.customItems || parsed.items || parsed.itens;
      if (Array.isArray(rawItems) && rawItems.length > 0) {
        for (const item of rawItems) {
          if (item && item.nome) {
            saveItemToLibrary(item).catch(() => {});
            itemsImported++;
          }
        }
      }

      // 6. IMPORTAR MAGIAS CUSTOMIZADAS
      const rawSpells = parsed.customSpells || parsed.spells || parsed.magias;
      if (Array.isArray(rawSpells) && rawSpells.length > 0) {
        for (const spell of rawSpells) {
          if (spell && spell.nome) {
            saveSpellToLibrary(spell).catch(() => {});
            spellsImported++;
          }
        }
      }

      // 7. IMPORTAR TOCA SE HOUVER
      if (parsed.toca) {
        try {
          safeLocalStorageSetItem('toca_creatures_data', JSON.stringify(parsed.toca));
        } catch (e) {}
      }

      const totalCustom = matsImported + itemsImported + spellsImported;
      showToast(`Backup importado com sucesso! ${charsImported} ficha(s), ${campsImported} campanha(s), ${bestiaryImported} monstro(s), ${totalCustom} customizações.`, "success");
      setShowFullBackupModal(false);
      setPasteFullBackupText("");
    } catch (err: any) {
      console.error("Erro ao importar backup completo:", err);
      showToast(err.message || "Erro ao processar o arquivo de backup.", "error");
    } finally {
      setIsImportingAll(false);
    }
  };

  const handleFullBackupFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        await processImportAllJson(content);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const exportJSON = () => {
    if (!activeChar) return;
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

  const exportActiveCampaign = () => {
    if (!activeCampaignId) {
      showToast("Selecione uma campanha para exportar.", "error");
      return;
    }
    const camp = campaigns.find(c => c.id === activeCampaignId) || masterCampaigns.find(c => c.id === activeCampaignId);
    if (!camp) {
      showToast("Campanha ativa não encontrada.", "error");
      return;
    }
    try {
      const backupData = {
        version: "1.14.3",
        type: "demons_despair_campaign_backup",
        exportedAt: new Date().toISOString(),
        campaign: camp,
        tableConfig: tableConfig,
        tokens: tokens,
        characters: campaignCharacters
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safeName = (camp.name || "campanha").replace(/[^a-z0-9]/gi, "_").toLowerCase();
      link.download = `${safeName}_backup.json`;
      link.style.display = "none";
      document.body.appendChild(link);
      setTimeout(() => {
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
      }, 0);
      showToast(`Campanha "${camp.name}" exportada com sucesso!`, "success");
    } catch (err: any) {
      console.error("Erro ao exportar campanha:", err);
      showToast("Falha ao exportar campanha.", "error");
    }
  };

  const handleImportCampaignFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed || !parsed.campaign || !parsed.campaign.id) {
          throw new Error("Arquivo de campanha inválido.");
        }

        const importedCamp = parsed.campaign;
        const importedConfig = parsed.tableConfig || {};
        const importedTokens = parsed.tokens || [];
        const importedChars = parsed.characters || [];

        if (user && user.email) {
          importedCamp.masterEmail = user.email;
          importedCamp.masterId = user.uid;
        }

        setMasterCampaigns(prev => {
          if (prev.some(c => c.id === importedCamp.id)) return prev;
          return [...prev, importedCamp];
        });

        setActiveCampaignIdWithSync(importedCamp.id);

        if (Object.keys(importedConfig).length > 0) {
          setTableConfig(importedConfig);
        }

        if (Array.isArray(importedTokens) && importedTokens.length > 0) {
          setTokens(importedTokens);
        }

        if (Array.isArray(importedChars) && importedChars.length > 0) {
          setState(prev => {
            const existingMap = new Map(prev.characters.map(c => [c.id, c]));
            for (const ic of importedChars) {
              const sanitized = sanitizeCharacter(ic);
              existingMap.set(sanitized.id, { ...sanitized, campaignId: importedCamp.id });
            }
            return {
              ...prev,
              characters: Array.from(existingMap.values())
            };
          });
          for (const ic of importedChars) {
            saveCharacterToFirestore({ ...ic, campaignId: importedCamp.id });
          }
        }

        showToast(`Campanha "${importedCamp.name}" importada com sucesso!`, "success");
      } catch (err: any) {
        console.error("Erro ao importar campanha:", err);
        showToast(err.message || "Falha ao importar arquivo de campanha.", "error");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const duplicateChar = () => {
    if (!activeChar) return;
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
    if (!activeChar) return;
    const idToDelete = state.activeCharacterId;
    
    if (idToDelete) {
      persistDeletedCharId(idToDelete);
      cleanCharFromCampaignCaches(idToDelete);
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
      
      const nextState = {
        ...prev,
        characters: remaining,
        activeCharacterId: newActiveId,
        dirtyCharacterIds: newDirtyIds
      };
      try {
        safeLocalStorageSetItem(STORAGE_KEY, JSON.stringify(nextState));
      } catch (e) {}
      return nextState;
    });
    
    // Purge character from local Supabase, caches, and remote
    if (idToDelete) {
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

  const handleNoteImageFileUpload = async (noteIdx: number, files: FileList | null) => {
    if (!files || files.length === 0 || !activeChar) return;
    const fileArray = Array.from(files);
    const dataUrls: string[] = [];

    for (const file of fileArray) {
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const compressed = await compressImageDataUrl(dataUrl, 800, 0.7);
        dataUrls.push(compressed);
      } catch (err) {
        console.error("Erro ao carregar ou comprimir imagem da nota:", err);
      }
    }

    if (dataUrls.length > 0) {
      const currentNotes = [...(activeChar.anotacoes || [])];
      if (!currentNotes[noteIdx]) return;
      const existingImgs = currentNotes[noteIdx].imagens || [];
      currentNotes[noteIdx] = {
        ...currentNotes[noteIdx],
        imagens: [...existingImgs, ...dataUrls],
      };
      updateChar({ anotacoes: currentNotes });
      showToast(`${dataUrls.length} imagem(ns) adicionada(s) à nota!`, "success");
    }
  };

  const handleAddNoteImageUrl = (noteIdx: number, url: string) => {
    if (!url || !url.trim() || !activeChar) return;
    const currentNotes = [...(activeChar.anotacoes || [])];
    if (!currentNotes[noteIdx]) return;
    const existingImgs = currentNotes[noteIdx].imagens || [];
    currentNotes[noteIdx] = {
      ...currentNotes[noteIdx],
      imagens: [...existingImgs, url.trim()],
    };
    updateChar({ anotacoes: currentNotes });
    showToast("Imagem adicionada à nota!", "success");
  };

  const handleRemoveNoteImage = (noteIdx: number, imgIdx: number) => {
    if (!activeChar) return;
    const currentNotes = [...(activeChar.anotacoes || [])];
    if (!currentNotes[noteIdx]) return;
    const existingImgs = currentNotes[noteIdx].imagens || [];
    const updatedImgs = existingImgs.filter((_, i) => i !== imgIdx);
    currentNotes[noteIdx] = {
      ...currentNotes[noteIdx],
      imagens: updatedImgs,
    };
    updateChar({ anotacoes: currentNotes });
    showToast("Imagem removida da nota.", "info");
  };

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
                      <span className="text-[9px] font-black text-zinc-600 uppercase tracking-tighter opacity-50">v1.14.7</span>
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

                      {campaigns.some(c => (c.masterEmail && c.masterEmail.toLowerCase() === user?.email?.toLowerCase()) || (c.masterId && c.masterId === user?.uid)) && (
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
             <span className="text-[10px] font-black text-zinc-400 font-mono leading-none">v1.14.7</span>
           </div>

           {/* Quick Active Page Status - desktop only */}
           <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-zinc-950/50 border border-zinc-800 rounded-2xl min-w-[140px]">
               <div className="flex flex-col">
                 <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest leading-none">Página Atual</span>
                 <span className="text-[9px] font-bold text-zinc-800 uppercase tracking-tighter mt-0.5">v1.14.7</span>
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



          {/* Auth Status & Login Indicator */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (user) {
                if (window.confirm(`Conectado como ${user.email || user.displayName || 'Usuário'}.\nDeseja sair da conta?`)) {
                  logout();
                  showToast("Você saiu da conta.", "info");
                }
              } else {
                setModalAuthError(null);
                setIsAuthModalOpen(true);
              }
            }}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg border transition-all cursor-pointer",
              user 
                ? (isSupabaseConnected 
                    ? (state.dirtyCharacterIds?.length > 0 
                        ? "bg-green-500/20 border-green-500/50" 
                        : "bg-green-500/10 border-green-500/30")
                    : "bg-blue-500/10 border-blue-500/30")
                : "bg-amber-500/20 border-amber-500/40 text-amber-500 hover:bg-amber-500/30"
            )}
            title={user ? (isSupabaseConnected ? (state.dirtyCharacterIds?.length > 0 ? "Sincronizando..." : `Conectado: ${user.email}`) : "Offline (Local Only)") : "Entrar ou Criar Conta"}
          >
            {user && isSupabaseConnected && state.dirtyCharacterIds?.length > 0 ? (
              <RefreshCwIcon size={16} className="text-green-500 animate-spin" />
            ) : (
              <div className={cn(
                "w-2.5 h-2.5 rounded-full",
                user 
                  ? (isSupabaseConnected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]")
                  : "bg-amber-500 animate-pulse"
              )} />
            )}
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
                {visibleCharacters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="my-1 border-t border-zinc-800/60" />

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const nc = createEmptyCharacter();
                setState((prev) => ({
                  ...prev,
                  characters: [...(prev.characters || []), nc],
                  activeCharacterId: nc.id,
                  dirtyCharacterIds: Array.from(new Set([...(prev.dirtyCharacterIds || []), nc.id])),
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
              <Copy size={18} className="text-amber-500" /> Copiar Ficha Atual
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                exportJSON();
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium text-zinc-300 cursor-pointer"
            >
              <Download size={18} className="text-zinc-400" /> Exportar Ficha
            </motion.button>

            <label className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium text-zinc-300 cursor-pointer">
              <Upload size={18} className="text-zinc-400" /> Importar Ficha
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

          {showDeleteConfirm && activeChar && (
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

      <main key={activeChar?.id || "no-char"} className={cn(
        "flex-1 overscroll-none flex flex-col min-h-0",
        activePage === "table" || activePage === "dice" || activePage === "master"
          ? "flex-1 h-0 min-h-0 w-full overflow-hidden p-0"
          : "max-w-7xl mx-auto w-full p-4 md:p-6 pb-20 overflow-y-auto custom-scrollbar"
      )}>
        {(() => {
          const renderSheetContent = () => {
            if (!activeChar) {
              return (
                <div className="flex flex-col items-center justify-center p-8 text-center bg-zinc-900 border border-zinc-850 rounded-2xl max-w-md mx-auto my-12">
                  <UserIcon size={48} className="text-zinc-600 mb-3 animate-pulse" />
                  <h3 className="text-lg font-bold text-zinc-300">Nenhum Personagem Selecionado</h3>
                  <p className="text-sm text-zinc-500 mt-1 mb-4">Selecione ou crie um personagem na Biblioteca para começar a jogar.</p>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActivePage("library")}
                    className="px-4 py-2 bg-amber-500 text-zinc-950 font-bold rounded-xl text-sm transition-all cursor-pointer"
                  >
                    Ir para Biblioteca
                  </motion.button>
                </div>
              );
            }
            return (
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
                    label={isCreatureMode ? "Localização" : "Etnia/Cultura"}
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
                    <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1 flex justify-between items-center">
                      <span>Deslocamento</span>
                      <span className="text-[9px] text-zinc-500 normal-case font-bold">Modificador (m)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-amber-400 font-bold">
                        {deslocamentoFinal}m
                      </div>
                      <input
                        type="number"
                        value={activeChar?.bonusDeslocamento || ""}
                        placeholder="0"
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          updateChar({ bonusDeslocamento: val });
                        }}
                        className="w-16 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-2 text-center text-amber-500 font-bold focus:outline-none focus:border-amber-400"
                      />
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
                      {sanityEffects.length > 0 && (
                        <div className="space-y-1">
                          {sanityEffects.map((effect, idx) => (
                            <div key={idx} className="text-[9px] leading-tight text-emerald-400 bg-emerald-400/10 p-1.5 rounded border border-emerald-400/20 flex gap-1.5 items-start">
                              <Activity size={10} className="shrink-0 mt-0.5 animate-pulse" />
                              <span>{effect}</span>
                            </div>
                          ))}
                        </div>
                      )}
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

              {isCreatureMode && (
                <Section
                  title="Informações"
                  icon={<Info size={18} />}
                  collapsible
                  defaultCollapsed={true}
                >
                  <div className="space-y-4">
                    <Input
                      label="Personalidade"
                      value={(activeChar as any).personalidade || ""}
                      onChange={(v) => updateChar({ personalidade: v })}
                      placeholder="Ex: Agressivo, territorialista..."
                    />
                    <Input
                      label="Gosta / Não Gosta"
                      value={(activeChar as any).gostaNaoGosta || ""}
                      onChange={(v) => updateChar({ gostaNaoGosta: v })}
                      placeholder="Ex: Gosta de calor, teme água..."
                    />
                    <TextArea
                      label="Descrição / Lore"
                      value={(activeChar as any).informacoes || ""}
                      onChange={(v) => updateChar({ informacoes: v })}
                      placeholder="História, lendas e detalhes..."
                      rows={5}
                    />
                    <TextArea
                      label="Hábitos / Comportamento"
                      value={(activeChar as any).habitos || ""}
                      onChange={(v) => updateChar({ habitos: v })}
                      placeholder="Comportamento, táticas..."
                      rows={5}
                    />
                  </div>
                </Section>
              )}

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
                      activeChar.efeitosNegativos || [],
                      activeChar.sanidadeAtual,
                      sanidadeMax
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
                                : totalBonus < 0
                                ? "border-red-500/50 text-red-500 bg-red-500/10"
                                : "border-zinc-700 text-zinc-500",
                            )}
                          >
                            {totalBonus > 0 ? `+${totalBonus}` : totalBonus}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>

              {!isCreatureMode && (
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
                            onReload={(ammoId, all) => handleReloadChar(activeChar, w.id, ammoId || "", all)}
                            onMaintenance={() => handleMaintenanceChar(activeChar, w.id)}
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
              )}

              {isCreatureMode && (
                <>
                  <Section
                    title="Ataques"
                    icon={<Sword size={18} />}
                    collapsible
                    defaultCollapsed={true}
                  >
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-[10px] font-bold text-zinc-500 uppercase">
                          Ações e Ataques do Monstro
                        </h4>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            const newAction: MonsterAction = {
                              id: generateId(),
                              name: "Novo Ataque",
                              type: "Major",
                              categoria: "Corte",
                              acerto: 0,
                              dano: "1d6",
                              description: "",
                              mana: 0,
                              efeito: ""
                            };
                            updateChar((c: any) => ({
                              acoes: [...(c.acoes || []), newAction]
                            }));
                          }}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-500 p-1.5 rounded transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                        >
                          <Plus size={14} /> Novo Ataque
                        </motion.button>
                      </div>

                      <div className="space-y-4">
                        {((activeChar as any).acoes || []).map((acao: any, idx: number) => {
                          const normCat = (acao.categoria || "Corte").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                          let statKey = "corte";
                          if (normCat.includes("perfur")) statKey = "perfuracao";
                          if (normCat.includes("impacto")) statKey = "impacto";
                          if (normCat.includes("feitico")) statKey = "feitico";
                          if (normCat.includes("elemental")) statKey = "elemental";
                          if (normCat.includes("magia negra")) statKey = "magiaNegra";
                          
                          const levelVal = Number((activeChar as any).ataque?.[statKey]) || 0;

                          return (
                            <div
                              key={acao.id}
                              className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3 relative group"
                            >
                              <div className="absolute top-2 right-2">
                                <motion.button
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => {
                                    updateChar((c: any) => ({
                                      acoes: (c.acoes || []).filter((a: any) => a.id !== acao.id)
                                    }));
                                  }}
                                  className="text-red-500 hover:text-red-400 p-1 bg-red-500/10 rounded-lg transition-colors"
                                >
                                  <Trash2 size={16} />
                                </motion.button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Input
                                  label="Nome do Ataque"
                                  value={acao.name || ""}
                                  onChange={(v) => {
                                    const newAcoes = [...((activeChar as any).acoes || [])];
                                    newAcoes[idx] = { ...newAcoes[idx], name: v };
                                    updateChar({ acoes: newAcoes });
                                  }}
                                />

                                <div className="space-y-1">
                                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                    Tipo (Categoria de Dano)
                                  </label>
                                  <select
                                    value={acao.categoria || "Corte"}
                                    onChange={(e) => {
                                      const newAcoes = [...((activeChar as any).acoes || [])];
                                      newAcoes[idx] = { ...newAcoes[idx], categoria: e.target.value };
                                      updateChar({ acoes: newAcoes });
                                    }}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
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

                                <Input
                                  label="Dano (ex: 2d6)"
                                  value={acao.dano || ""}
                                  onChange={(v) => {
                                    const newAcoes = [...((activeChar as any).acoes || [])];
                                    newAcoes[idx] = { ...newAcoes[idx], dano: v };
                                    updateChar({ acoes: newAcoes });
                                  }}
                                />

                                <div className="space-y-1">
                                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex justify-between">
                                    <span>Acerto</span>
                                    <span className="text-amber-500 text-[9px] font-black uppercase">
                                      Nível {acao.categoria}: {levelVal}
                                    </span>
                                  </label>
                                  <NumericInput
                                    value={Number(acao.acerto) || 0}
                                    onChange={(v) => {
                                      const newAcoes = [...((activeChar as any).acoes || [])];
                                      newAcoes[idx] = { ...newAcoes[idx], acerto: v };
                                      updateChar({ acoes: newAcoes });
                                    }}
                                    className="w-full h-9"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                    Custo de Mana
                                  </label>
                                  <NumericInput
                                    value={Number(acao.mana) || 0}
                                    onChange={(v) => {
                                      const newAcoes = [...((activeChar as any).acoes || [])];
                                      newAcoes[idx] = { ...newAcoes[idx], mana: v };
                                      updateChar({ acoes: newAcoes });
                                    }}
                                    className="w-full h-9"
                                  />
                                </div>

                                <Input
                                  label="Efeito (Envenenamento, etc)"
                                  value={acao.efeito || ""}
                                  onChange={(v) => {
                                    const newAcoes = [...((activeChar as any).acoes || [])];
                                    newAcoes[idx] = { ...newAcoes[idx], efeito: v };
                                    updateChar({ acoes: newAcoes });
                                  }}
                                  placeholder="Ex: Queimadura, Putrefação..."
                                />

                                <div className="space-y-1">
                                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                    Tipo de Ação
                                  </label>
                                  <select
                                    value={acao.type || "Major"}
                                    onChange={(e) => {
                                      const newAcoes = [...((activeChar as any).acoes || [])];
                                      newAcoes[idx] = { ...newAcoes[idx], type: e.target.value };
                                      updateChar({ acoes: newAcoes });
                                    }}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                                  >
                                    <option value="Major">Ação Maior</option>
                                    <option value="Minor">Ação Menor</option>
                                  </select>
                                </div>
                              </div>

                              <TextArea
                                label="Descrição do Ataque"
                                value={acao.description || ""}
                                onChange={(v) => {
                                    const newAcoes = [...((activeChar as any).acoes || [])];
                                    newAcoes[idx] = { ...newAcoes[idx], description: v };
                                    updateChar({ acoes: newAcoes });
                                }}
                              />
                            </div>
                          );
                        })}

                        {(!((activeChar as any).acoes) || (activeChar as any).acoes.length === 0) && (
                          <p className="text-zinc-600 text-xs italic text-center py-4">Nenhum ataque cadastrado para esta criatura.</p>
                        )}
                      </div>
                    </div>
                  </Section>

                  <Section
                    title="Níveis de Ataque"
                    icon={<Sword size={18} />}
                    collapsible
                    defaultCollapsed={true}
                  >
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {(["corte", "feitico", "perfuracao", "elemental", "impacto", "magiaNegra", "resistencia", "potencial"] as const).map((key) => {
                          const label = {
                            corte: "Corte",
                            perfuracao: "Perfuração",
                            impacto: "Impacto",
                            resistencia: "Resistência",
                            feitico: "Feitiço",
                            elemental: "Elemental",
                            magiaNegra: "Magia Negra",
                            potencial: "Potencial",
                          }[key];

                          return (
                            <div key={key} className="space-y-1">
                              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                {label}
                              </label>
                              <NumericInput
                                value={Number((activeChar as any).ataque?.[key]) || 0}
                                onChange={(v) => {
                                  const baseAtaque = (activeChar as any).ataque || {
                                    corte: 0, perfuracao: 0, impacto: 0, resistencia: 0,
                                    feitico: 0, elemental: 0, magiaNegra: 0, potencial: 0
                                  };
                                  updateChar({
                                    ataque: {
                                      ...baseAtaque,
                                      [key]: v
                                    }
                                  });
                                }}
                                className="w-full h-9"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Section>

                  <Section
                    title="Níveis de Defesa"
                    icon={<Shield size={18} />}
                    collapsible
                    defaultCollapsed={true}
                  >
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {(["corte", "perfuracao", "impacto", "feitico", "elemental", "magiaNegra"] as const).map((key) => {
                          const label = {
                            corte: "Corte",
                            perfuracao: "Perfuração",
                            impacto: "Impacto",
                            feitico: "Feitiço",
                            elemental: "Elemental",
                            magiaNegra: "Magia Negra",
                          }[key];

                          return (
                            <div key={key} className="space-y-1">
                              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                {label}
                              </label>
                              <NumericInput
                                value={Number((activeChar as any).defesa?.[key]) || 0}
                                onChange={(v) => {
                                  const baseDefesa = (activeChar as any).defesa || {
                                    corte: 0, perfuracao: 0, impacto: 0,
                                    feitico: 0, elemental: 0, magiaNegra: 0
                                  };
                                  updateChar({
                                    defesa: {
                                      ...baseDefesa,
                                      [key]: v
                                    }
                                  });
                                }}
                                className="w-full h-9"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Section>
                </>
              )}

              {!isCreatureMode && (
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
                               <div className="relative flex-1">
                                 <button
                                   onClick={() => setWeaponMenuCompIdx(weaponMenuCompIdx === cIdx ? null : cIdx)}
                                   className="w-full py-1.5 border border-dashed border-zinc-700 rounded text-[9px] font-bold uppercase text-zinc-500 hover:border-amber-500/50 hover:text-amber-500 transition-all px-1 flex items-center justify-center gap-1"
                                 >
                                   <span>+ Arma</span>
                                   <span className="text-[7px]">▾</span>
                                 </button>
                                 {weaponMenuCompIdx === cIdx && (
                                   <div className="absolute bottom-full left-0 mb-1 w-32 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 p-1 flex flex-col gap-1 text-[9px]">
                                     <button
                                       type="button"
                                       onClick={() => {
                                         updateChar(char => {
                                           const comps = char.compartimentos || [];
                                           const targetComp = comps[cIdx];
                                           const newItem = {
                                             id: generateId(),
                                             nome: "Nova Arma Branca",
                                             peso: 0, volume: 0, quantidade: 1,
                                             tipo: "Arma", categoria: "Arma Branca",
                                             durabilidade: 0, maxDurabilidade: 0,
                                             descricao: "", dano: "0", acerto: 0, escala: "0",
                                             atributoBase: "Força", corte: 0, impacto: 0, perfuracao: 0, resistencia: 0
                                           };
                                           return { compartimentos: comps.map((c, i) => i === cIdx ? { ...c, itens: [...(targetComp.itens || []), newItem] } : c) };
                                         });
                                         setWeaponMenuCompIdx(null);
                                       }}
                                       className="text-left px-2 py-1.5 hover:bg-zinc-800 text-zinc-300 font-bold rounded transition-colors"
                                     >
                                       Arma Branca
                                     </button>
                                     <button
                                       type="button"
                                       onClick={() => {
                                         updateChar(char => {
                                           const comps = char.compartimentos || [];
                                           const targetComp = comps[cIdx];
                                           const newItem = {
                                             id: generateId(),
                                             nome: "Nova Arma de Fogo",
                                             peso: 0, volume: 0, quantidade: 1,
                                             tipo: "Arma", categoria: "Arma de Fogo",
                                             durabilidade: 0, maxDurabilidade: 0,
                                             descricao: "", dano: "0", acerto: 0, escala: "0",
                                             atributoBase: "Destreza", corte: 0, impacto: 0, perfuracao: 0, resistencia: 0,
                                             municaoTotal: 0, municaoCarregada: 0
                                           };
                                           return { compartimentos: comps.map((c, i) => i === cIdx ? { ...c, itens: [...(targetComp.itens || []), newItem] } : c) };
                                         });
                                         setWeaponMenuCompIdx(null);
                                       }}
                                       className="text-left px-2 py-1.5 hover:bg-zinc-800 text-zinc-300 font-bold rounded transition-colors"
                                     >
                                       Arma de Fogo
                                     </button>
                                     <button
                                       type="button"
                                       onClick={() => {
                                         updateChar(char => {
                                           const comps = char.compartimentos || [];
                                           const targetComp = comps[cIdx];
                                           const newItem = {
                                             id: generateId(),
                                             nome: "Novo Arco",
                                             peso: 0, volume: 0, quantidade: 1,
                                             tipo: "Arma", categoria: "Arco",
                                             durabilidade: 0, maxDurabilidade: 0,
                                             descricao: "", dano: "0", acerto: 0, escala: "0",
                                             atributoBase: "Destreza", corte: 0, impacto: 0, perfuracao: 0, resistencia: 0
                                           };
                                           return { compartimentos: comps.map((c, i) => i === cIdx ? { ...c, itens: [...(targetComp.itens || []), newItem] } : c) };
                                         });
                                         setWeaponMenuCompIdx(null);
                                       }}
                                       className="text-left px-2 py-1.5 hover:bg-zinc-800 text-zinc-300 font-bold rounded transition-colors"
                                     >
                                       Arco
                                     </button>
                                   </div>
                                 )}
                               </div>
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
                               <div className="relative flex-1">
                                 <button
                                   onClick={() => setWeaponMenuCompIdx(weaponMenuCompIdx === cIdx ? null : cIdx)}
                                   className="w-full py-1.5 border border-dashed border-zinc-700 rounded text-[9px] font-bold uppercase text-zinc-500 hover:border-amber-500/50 hover:text-amber-500 transition-all px-1 flex items-center justify-center gap-1"
                                 >
                                   <span>+ Arma</span>
                                   <span className="text-[7px]">▾</span>
                                 </button>
                                 {weaponMenuCompIdx === cIdx && (
                                   <div className="absolute bottom-full left-0 mb-1 w-32 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 p-1 flex flex-col gap-1 text-[9px]">
                                     <button
                                       type="button"
                                       onClick={() => {
                                         updateChar(char => {
                                           const comps = char.compartimentos || [];
                                           const targetComp = comps[cIdx];
                                           const newItem = {
                                             id: generateId(),
                                             nome: "Nova Arma Branca",
                                             peso: 0, volume: 0, quantidade: 1,
                                             tipo: "Arma", categoria: "Arma Branca",
                                             durabilidade: 0, maxDurabilidade: 0,
                                             descricao: "", dano: "0", acerto: 0, escala: "0",
                                             atributoBase: "Força", corte: 0, impacto: 0, perfuracao: 0, resistencia: 0
                                           };
                                           return { compartimentos: comps.map((c, i) => i === cIdx ? { ...c, itens: [...(targetComp.itens || []), newItem] } : c) };
                                         });
                                         setWeaponMenuCompIdx(null);
                                       }}
                                       className="text-left px-2 py-1.5 hover:bg-zinc-800 text-zinc-300 font-bold rounded transition-colors"
                                     >
                                       Arma Branca
                                     </button>
                                     <button
                                       type="button"
                                       onClick={() => {
                                         updateChar(char => {
                                           const comps = char.compartimentos || [];
                                           const targetComp = comps[cIdx];
                                           const newItem = {
                                             id: generateId(),
                                             nome: "Nova Arma de Fogo",
                                             peso: 0, volume: 0, quantidade: 1,
                                             tipo: "Arma", categoria: "Arma de Fogo",
                                             durabilidade: 0, maxDurabilidade: 0,
                                             descricao: "", dano: "0", acerto: 0, escala: "0",
                                             atributoBase: "Destreza", corte: 0, impacto: 0, perfuracao: 0, resistencia: 0,
                                             municaoTotal: 0, municaoCarregada: 0
                                           };
                                           return { compartimentos: comps.map((c, i) => i === cIdx ? { ...c, itens: [...(targetComp.itens || []), newItem] } : c) };
                                         });
                                         setWeaponMenuCompIdx(null);
                                       }}
                                       className="text-left px-2 py-1.5 hover:bg-zinc-800 text-zinc-300 font-bold rounded transition-colors"
                                     >
                                       Arma de Fogo
                                     </button>
                                     <button
                                       type="button"
                                       onClick={() => {
                                         updateChar(char => {
                                           const comps = char.compartimentos || [];
                                           const targetComp = comps[cIdx];
                                           const newItem = {
                                             id: generateId(),
                                             nome: "Novo Arco",
                                             peso: 0, volume: 0, quantidade: 1,
                                             tipo: "Arma", categoria: "Arco",
                                             durabilidade: 0, maxDurabilidade: 0,
                                             descricao: "", dano: "0", acerto: 0, escala: "0",
                                             atributoBase: "Destreza", corte: 0, impacto: 0, perfuracao: 0, resistencia: 0
                                           };
                                           return { compartimentos: comps.map((c, i) => i === cIdx ? { ...c, itens: [...(targetComp.itens || []), newItem] } : c) };
                                         });
                                         setWeaponMenuCompIdx(null);
                                       }}
                                       className="text-left px-2 py-1.5 hover:bg-zinc-800 text-zinc-300 font-bold rounded transition-colors"
                                     >
                                       Arco
                                     </button>
                                   </div>
                                 )}
                               </div>
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
                                        onReload={(ammoId, all) => handleReloadChar(activeChar, item.id, ammoId || "", all)}
                                        onMaintenance={() => handleMaintenanceChar(activeChar, item.id)}
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

                                      <div className="flex items-end gap-2">
                                        <div className="grid grid-cols-4 gap-2 flex-1">
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
                                          <div className="flex flex-col min-w-0">
                                            <span className="text-[10px] text-zinc-600 uppercase tracking-tighter font-bold truncate">
                                              Total
                                            </span>
                                            <span className="text-xs font-bold text-zinc-400 mt-[3px]">
                                              {(
                                                (getItemPeso(item) * item.quantidade) / 10
                                              ).toFixed(2)}
                                              kg
                                            </span>
                                          </div>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            const isChecked = !item.isFood;
                                            const currentDate = tableConfig.date || { day: 1, month: 1, year: 2024 };
                                            updateChar(char => ({
                                              compartimentos: (char.compartimentos || []).map(c => 
                                                c.id === comp.id ? {
                                                  ...c,
                                                  itens: (c.itens || []).map(it => it.id === item.id ? { 
                                                    ...it, 
                                                    isFood: isChecked,
                                                    dataCriacao: isChecked ? (it.dataCriacao || { ...currentDate }) : it.dataCriacao,
                                                    validade: isChecked ? (it.validade ?? 0) : it.validade,
                                                    saciedade: isChecked ? (it.saciedade ?? "0+0") : it.saciedade
                                                  } : it)
                                                } : c
                                              )
                                            }));
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

                                       {/* Propriedades de Comida */}
                                       {item.isFood && (
                                         <div className="bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-800/80 space-y-2.5 my-2">
                                           {(() => {
                                             const currentDate = tableConfig.date || { day: 1, month: 1, year: 2024 };
                                             const createdDate = item.dataCriacao || currentDate;
                                             const absCreated = dateToAbsoluteDays(createdDate.day, createdDate.month, createdDate.year);
                                             const absCurrent = dateToAbsoluteDays(currentDate.day, currentDate.month, currentDate.year);
                                             const daysPassed = absCurrent - absCreated;
                                             const daysRemaining = (item.validade || 0) - daysPassed;
                                             const isSpoiled = daysPassed > (item.validade || 0);
 
                                             return (
                                               <div className="space-y-2">
                                              <div className="grid grid-cols-2 gap-2">
                                                <MiniInput
                                                  label="Validade (Dias)"
                                                  type="number"
                                                  value={item.validade ?? 0}
                                                  onChange={(v) => {
                                                    const val = parseInt(v) || 0;
                                                    updateChar(char => ({
                                                      compartimentos: (char.compartimentos || []).map(c => 
                                                        c.id === comp.id ? {
                                                          ...c,
                                                          itens: (c.itens || []).map(it => it.id === item.id ? { ...it, validade: val } : it)
                                                        } : c
                                                      )
                                                    }));
                                                  }}
                                                />
                                                <MiniInput
                                                  label="Saciedade (ex: 30+15)"
                                                  type="text"
                                                  value={item.saciedade ?? "0+0"}
                                                  onChange={(v) => {
                                                    updateChar(char => ({
                                                      compartimentos: (char.compartimentos || []).map(c => 
                                                        c.id === comp.id ? {
                                                          ...c,
                                                          itens: (c.itens || []).map(it => it.id === item.id ? { ...it, saciedade: v } : it)
                                                        } : c
                                                      )
                                                    }));
                                                  }}
                                                />
                                              </div>

                                              <div className="text-[10px] space-y-1 bg-black/30 p-2 rounded-lg border border-zinc-900">
                                                <div className="flex justify-between">
                                                  <span className="text-zinc-500 font-bold uppercase tracking-tight">Criado em:</span>
                                                  <span className="text-zinc-300 font-mono">{createdDate.day}/{createdDate.month}/{createdDate.year}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                  <span className="text-zinc-500 font-bold uppercase tracking-tight">Status:</span>
                                                  {isSpoiled ? (
                                                    <span className="text-red-500 font-black uppercase tracking-widest text-[9px] bg-red-950/20 px-1.5 py-0.5 rounded border border-red-900/30">⚠️ Estragou</span>
                                                  ) : (
                                                    <span className="text-emerald-500 font-black uppercase tracking-wider text-[9px] bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-900/30">⏰ {daysRemaining} Dias Restantes</span>
                                                  )}
                                                </div>
                                              </div>

                                              {/* Botão de Comer */}
                                              <motion.button
                                                whileTap={!isSpoiled ? { scale: 0.95 } : {}}
                                                disabled={isSpoiled}
                                                onClick={() => {
                                                  if (isSpoiled) return;
                                                  const sacStr = item.saciedade || "0+0";
                                                  const [recHungerStr, recBonusStr] = sacStr.split('+');
                                                  const recHunger = parseInt(recHungerStr) || 0;
                                                  const recBonus = parseInt(recBonusStr) || 0;

                                                  updateChar(char => {
                                                    const currentFome = char.fome ?? 100;
                                                    const currentBonus = char.bonusFomeProximaRolagem ?? 0;
                                                    const nextFome = Math.min(100, currentFome + recHunger);
                                                    const nextBonus = currentBonus + recBonus;

                                                    // Decrement quantity or filter out
                                                    const comps = char.compartimentos || [];
                                                    const updatedComps = comps.map(c => {
                                                      if (c.id !== comp.id) return c;
                                                      const newQty = item.quantidade - 1;
                                                      if (newQty <= 0) {
                                                        return {
                                                          ...c,
                                                          itens: (c.itens || []).filter(it => it.id !== item.id)
                                                        };
                                                      } else {
                                                        return {
                                                          ...c,
                                                          itens: (c.itens || []).map(it => it.id === item.id ? { ...it, quantidade: newQty } : it)
                                                        };
                                                      }
                                                    });

                                                    return {
                                                      fome: nextFome,
                                                      bonusFomeProximaRolagem: nextBonus,
                                                      compartimentos: updatedComps
                                                    };
                                                  });

                                                  showToast(`Você comeu 1x "${item.nome}"! Recuperou ${recHunger} de Fome e obteve +${recBonus} de bônus na próxima rolagem.`, "success");
                                                }}
                                                className={cn(
                                                  "w-full py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-all flex items-center justify-center gap-1.5",
                                                  isSpoiled 
                                                    ? "bg-zinc-950/50 border-red-500/30 text-red-500/50 cursor-not-allowed"
                                                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 active:bg-emerald-500/30 cursor-pointer"
                                                )}
                                              >
                                                🍽️ {isSpoiled ? "Comida Estragada" : `Comer 1 (${item.quantidade} rest.)`}
                                              </motion.button>
                                               </div>
                                             );
                                           })()}
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
              )}

              {!isCreatureMode && (
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
                                const val = e.target.value;
                                const newMags = (activeChar?.magias || []).map((mag, i) =>
                                  i === idx ? { ...mag, escola: val } : mag
                                );
                                updateChar({ magias: newMags });
                              }}
                              className="bg-black/40 border border-zinc-700/50 rounded px-2 py-0.5 text-xs text-zinc-300 font-bold focus:outline-none focus:border-amber-500/50"
                            >
                              <option value="Feitiço" className="bg-zinc-900 text-zinc-100">Feitiço</option>
                              <option value="elemental" className="bg-zinc-900 text-zinc-100">Elemental</option>
                              <option value="magia negra" className="bg-zinc-900 text-zinc-100">Magia Negra</option>
                            </select>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter mb-0.5 truncate">
                              Tipo
                            </span>
                            <select
                               value={m.tipo || "Ataque"}
                               onChange={(e) => {
                                 const val = e.target.value as 'Ataque' | 'Efeito' | 'Utilidade';
                                 const newMags = (activeChar?.magias || []).map((mag, i) =>
                                   i === idx ? { ...mag, tipo: val } : mag
                                 );
                                 updateChar({ magias: newMags });
                               }}
                              className="bg-black/40 border border-zinc-700/50 rounded px-2 py-0.5 text-xs text-zinc-300 font-bold focus:outline-none focus:border-amber-500/50"
                            >
                              <option value="Ataque" className="bg-zinc-900 text-zinc-100">Ataque</option>
                              <option value="Efeito" className="bg-zinc-900 text-zinc-100">Efeito</option>
                              <option value="Utilidade" className="bg-zinc-900 text-zinc-100">Utilidade</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <MiniInput
                            label="Dano"
                            value={m.dano}
                            onChange={(v) => {
                              const newMags = (activeChar?.magias || []).map((mag, i) =>
                                i === idx ? { ...mag, dano: v } : mag
                              );
                              updateChar({ magias: newMags });
                            }}
                            disabled={m.tipo === "Utilidade"}
                          />
                          <MiniInput
                            label="Acerto"
                            value={m.acerto}
                            type="number"
                            onChange={(v) => {
                              const val = parseInt(v) || 0;
                              const newMags = (activeChar?.magias || []).map((mag, i) =>
                                i === idx ? { ...mag, acerto: val } : mag
                              );
                              updateChar({ magias: newMags });
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
                              const val = parseInt(v) || 0;
                              const newMags = (activeChar?.magias || []).map((mag, i) =>
                                i === idx ? { ...mag, mana: val } : mag
                              );
                              updateChar({ magias: newMags });
                            }}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter mb-0.5 truncate">
                              Escala
                            </span>
                            <select
                              value={m.escala || "0"}
                              onChange={(e) => {
                                const val = e.target.value as any;
                                const newMags = (activeChar?.magias || []).map((mag, i) =>
                                  i === idx ? { ...mag, escala: val } : mag
                                );
                                updateChar({ magias: newMags });
                              }}
                              className="bg-black/40 border border-zinc-700/50 rounded px-2 py-0.5 text-xs text-zinc-300 font-bold focus:outline-none focus:border-amber-500/50"
                            >
                              <option value="0" className="bg-zinc-900 text-zinc-100">0</option>
                              <option value="D" className="bg-zinc-900 text-zinc-100">D</option>
                              <option value="C" className="bg-zinc-900 text-zinc-100">C</option>
                              <option value="B" className="bg-zinc-900 text-zinc-100">B</option>
                              <option value="A" className="bg-zinc-900 text-zinc-100">A</option>
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
                                activeChar.bonusProficiencias?.["Acurácia"] || 0,
                                activeChar.efeitosNegativos || [],
                                activeChar.sanidadeAtual,
                                getSanidadeMaxima(activeChar.stats.MEN)
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
                                activeChar.bonusProficiencias?.["Acurácia"] || 0,
                                activeChar.efeitosNegativos || [],
                                activeChar.sanidadeAtual,
                                getSanidadeMaxima(activeChar.stats.MEN)
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
                            const newMags = (activeChar?.magias || []).map((mag, i) =>
                              i === idx ? { ...mag, efeito: v } : mag
                            );
                            updateChar({ magias: newMags });
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
                                  const val = e.target.value;
                                  const newHabs = (activeChar?.habilidades || []).map((hab, i) =>
                                    i === idx ? { ...hab, nome: val } : hab
                                  );
                                  updateChar({ habilidades: newHabs });
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
                              const newHabs = (activeChar?.habilidades || []).map((hab, i) =>
                                i === idx ? { ...hab, efeito: v } : hab
                              );
                              updateChar({ habilidades: newHabs });
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
                                  const newLevel = Math.max(0, Math.min(5, v));
                                  const newMaxXp = getXpToNextLevel(newLevel);
                                  const newKs = (activeChar?.conhecimentos || []).map((item, i) =>
                                    i === idx
                                      ? {
                                          ...item,
                                          nivel: newLevel,
                                          limite: newMaxXp,
                                          xp: Math.min(item.xp, Math.max(0, newMaxXp - 1)),
                                        }
                                      : item
                                  );
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
                                      const newKs = (activeChar?.conhecimentos || []).map((item, i) => {
                                        if (i === idx) {
                                          const nextXp = getXpToNextLevel(item.nivel);
                                          return { ...item, xp: Math.max(0, item.xp - 1), limite: nextXp };
                                        }
                                        return item;
                                      });
                                      updateChar({ conhecimentos: newKs });
                                    }}
                                    className="w-6 h-6 flex items-center justify-center bg-zinc-800 rounded text-zinc-400 hover:text-white"
                                  >
                                    <Minus size={12} />
                                  </motion.button>
                                  <NumericInput
                                    value={k.xp}
                                    onChange={(v) => {
                                      const newKs = (activeChar?.conhecimentos || []).map((item, i) => {
                                        if (i === idx) {
                                          let currentNivel = item.nivel;
                                          let currentXp = Math.max(0, v);
                                          let nextXp = getXpToNextLevel(currentNivel);
                                          if (currentXp >= nextXp && currentNivel < 5) {
                                            currentNivel = Math.min(5, currentNivel + 1);
                                            currentXp = 0;
                                            nextXp = getXpToNextLevel(currentNivel);
                                          }
                                          return {
                                            ...item,
                                            nivel: currentNivel,
                                            xp: currentNivel >= 5 ? 0 : currentXp,
                                            limite: nextXp,
                                          };
                                        }
                                        return item;
                                      });
                                      updateChar({ conhecimentos: newKs });
                                    }}
                                    className="w-16"
                                    size="sm"
                                  />
                                  <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                      const newKs = (activeChar?.conhecimentos || []).map((item, i) => {
                                        if (i === idx) {
                                          let currentNivel = item.nivel;
                                          let currentXp = item.xp + 1;
                                          let nextXp = getXpToNextLevel(currentNivel);
                                          if (currentXp >= nextXp && currentNivel < 5) {
                                            currentNivel = Math.min(5, currentNivel + 1);
                                            currentXp = 0;
                                            nextXp = getXpToNextLevel(currentNivel);
                                          }
                                          return {
                                            ...item,
                                            nivel: currentNivel,
                                            xp: currentNivel >= 5 ? 0 : currentXp,
                                            limite: nextXp,
                                          };
                                        }
                                        return item;
                                      });
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
                                                    const nextXp = getXpToNextLevel(lIdx);
                                                    return {
                                                      ...item,
                                                      nivel: lIdx,
                                                      limite: nextXp,
                                                      xp: Math.min(item.xp, Math.max(0, nextXp - 1)),
                                                    };
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
        };

          if (activePage === "sheet") {
            return renderSheetContent();
          }

          const renderDiceContent = () => {
            return (
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
                <div className="space-y-6 pb-24">
                  {/* Armas do Personagem (se ativo) */}
                  {activeChar && (
                    <SubSection
                      title="Combate (Acerto & Dano)"
                      icon={<Sword size={14} />}
                      defaultCollapsed={false}
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
                          activeChar.efeitosNegativos || [],
                          activeChar.sanidadeAtual,
                          getSanidadeMaxima(activeChar.stats.MEN)
                        );

                        const totalHit = (acuraciaBonus || 0);
                        const weaponAcerto = (arma.acerto || 0);
                        let displayDano = arma.dano || "1d6";
                        const isBow = arma.categoria === 'Arco';
                        const isFirearm = arma.categoria === 'Arma de Fogo';
                        if (isFirearm || isBow) {
                          if (arma.magazineAmmo && arma.magazineAmmo.length > 0) {
                            displayDano = arma.magazineAmmo[0].dano || arma.dano || (isBow ? "1d6" : "2d6");
                          } else {
                            const ammoId = isBow ? (arma.arrowId || arma.bulletId) : (arma.bulletId || arma.arrowId);
                            const loadedAmmo = (activeChar.compartimentos || [])
                              .flatMap((c: any) => (c.itens || []))
                              .find((i: any) => i.id === ammoId);
                            if (loadedAmmo && loadedAmmo.dano) {
                              displayDano = loadedAmmo.dano;
                            } else if ((arma.municaoCarregada || 0) <= 0) {
                              displayDano = isBow ? "Falta Flecha" : "Falta Bala";
                            } else {
                              displayDano = arma.dano || (isBow ? "1d6" : "2d6");
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
                          activeChar.efeitosNegativos || [],
                          activeChar.sanidadeAtual,
                          getSanidadeMaxima(activeChar.stats.MEN)
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
                                <span className="text-xs font-black text-indigo-400">
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
                  )}

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
                        className="flex flex-col items-center group cursor-pointer"
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
                    {activeChar && (
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
                            activeChar.efeitosNegativos || [],
                            activeChar.sanidadeAtual,
                            getSanidadeMaxima(activeChar.stats.MEN)
                          );
                          rollDice(8, 3, diceBonus + acuraciaBonus, "3d8 (Acurácia)");
                        }}
                        className="flex flex-col items-center group cursor-pointer"
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
                    )}

                    {/* Fome e Sede Roll */}
                    {activeChar && (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => rollDice(0, 0, 0, "Fome e Sede")}
                        className="flex flex-col items-center group cursor-pointer"
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
                    )}

                    {/* Cansaço Roll */}
                    {activeChar && (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => rollDice(0, 0, 0, "Cansaço")}
                        className="flex flex-col items-center group cursor-pointer"
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
                    )}
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
                            if (activeChar) {
                              updateChar({
                                dadosCustomizados: [
                                  ...(activeChar.dadosCustomizados || []),
                                  { id: generateId(), lados: sides, nome: name },
                                ],
                              });
                            } else {
                              showToast("Selecione uma ficha para salvar dados personalizados.", "info");
                            }
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
          </div>
            );
          };

          const renderOtherPages = () => {
            return activePage === "dice" ? (
              renderDiceContent()
            ) : activePage === "notes" ? (
          !activeChar ? (
            <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto h-[60vh]">
              <FileText size={48} className="text-zinc-600 mb-4 animate-pulse" />
              <h3 className="text-lg font-bold text-zinc-300 mb-2">Nenhum Personagem Selecionado</h3>
              <p className="text-zinc-500 text-sm mb-6">Você precisa criar ou selecionar um personagem na aba "Ficha" para gerenciar suas anotações.</p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setActivePage("sheet")}
                className="px-6 py-2 bg-amber-500 text-zinc-950 font-bold rounded-lg hover:bg-amber-400 transition-colors text-sm"
              >
                Ir para Ficha
              </motion.button>
            </div>
          ) : (
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
                      {/* Seção de Imagens Anexadas da Nota (Acima do Conteúdo) */}
                      <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3.5 space-y-3 mb-4 shadow-inner">
                        <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
                          <div className="flex items-center gap-2">
                            <Image size={16} className="text-amber-500" />
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                              Imagens {note.imagens && note.imagens.length > 0 ? `(${note.imagens.length})` : ""}
                            </span>
                          </div>

                          {/* Botão + para Enviar Imagem por Arquivo */}
                          <label
                            className="flex items-center justify-center p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:border-amber-500/60 rounded-lg cursor-pointer transition-all shadow-sm active:scale-95"
                            title="Adicionar imagem"
                          >
                            <Plus size={16} />
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                handleNoteImageFileUpload(idx, e.target.files);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>

                        {/* Grid de Miniaturas com Expansão ao Clicar */}
                        {note.imagens && note.imagens.length > 0 ? (
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-1">
                            {note.imagens.map((imgUrl, imgIdx) => (
                              <div
                                key={imgIdx}
                                className="group relative aspect-square rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-amber-500/80 shadow-md transition-all cursor-pointer"
                                onClick={() =>
                                  setActiveNoteImageModal({
                                    url: imgUrl,
                                    title: `${note.titulo || "Anotação"} (Imagem ${imgIdx + 1})`,
                                  })
                                }
                              >
                                <img
                                  src={imgUrl}
                                  alt={`Imagem ${imgIdx + 1} de ${note.titulo}`}
                                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                />
                                {/* Overlay ao passar o mouse */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                  <Maximize size={18} className="text-white drop-shadow-md" />
                                </div>

                                {/* Botão para Excluir Imagem */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveNoteImage(idx, imgIdx);
                                  }}
                                  className="absolute top-1.5 right-1.5 p-1 bg-black/80 hover:bg-red-600 text-zinc-300 hover:text-white rounded-md opacity-0 group-hover:opacity-100 transition-all shadow-md z-10"
                                  title="Remover Imagem"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-500 italic py-0.5">
                            Nenhuma imagem anexada. Clique no botão + para adicionar.
                          </p>
                        )}
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
                          rows={12}
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
          )
        ) : activePage === "library" ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-black text-amber-500 uppercase tracking-tighter">
                    Biblioteca de Personagens
                  </h2>
                  <p className="text-zinc-500 text-sm">
                    {visibleCharacters.length} personagem(ns) {user ? "sincronizados com a sua conta." : "locais (modo visitante)."}
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

              {!user && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                      <UserIcon size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-amber-400 uppercase tracking-tight">Modo Visitante (Sem Login)</h4>
                      <p className="text-xs text-zinc-400">Você está visualizando apenas fichas locais deste navegador. Para acessar suas fichas salvas na nuvem ou sincronizar com o Mestre, faça login na sua conta.</p>
                    </div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setModalAuthError(null);
                      setIsAuthModalOpen(true);
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs uppercase rounded-xl transition-all shadow-md shrink-0 whitespace-nowrap cursor-pointer"
                  >
                    Entrar na Conta
                  </motion.button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleCharacters.map((char) => (
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
                                persistDeletedCharId(char.id);
                                cleanCharFromCampaignCaches(char.id);
                                // Cancel any pending sync timers before deleting to prevent race condition uploads
                                if (syncTimersRef.current[char.id]) {
                                  console.log(`🛑 [LibraryDelete] Cancelando upload pendente do personagem de ID ${char.id} antes da remoção`);
                                  clearTimeout(syncTimersRef.current[char.id]);
                                  delete syncTimersRef.current[char.id];
                                }
                                deleteCharacterFromFirestore(char.id);
                                setState(prev => {
                                  const filtered = prev.characters.filter(c => c.id !== char.id);
                                  const newDirtyIds = (prev.dirtyCharacterIds || []).filter(id => id !== char.id);
                                  const nextState = {
                                    ...prev,
                                    characters: filtered,
                                    activeCharacterId: filtered.length > 0 ? filtered[0].id : "",
                                    dirtyCharacterIds: newDirtyIds
                                  };
                                  try {
                                    safeLocalStorageSetItem(STORAGE_KEY, JSON.stringify(nextState));
                                  } catch (e) {}
                                  return nextState;
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

              {visibleCharacters.length === 0 && (
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
          !activeChar ? (
            <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto h-[60vh]">
              <Image size={48} className="text-zinc-600 mb-4 animate-pulse" />
              <h3 className="text-lg font-bold text-zinc-300 mb-2">Nenhum Personagem Selecionado</h3>
              <p className="text-zinc-500 text-sm mb-6">Você precisa criar ou selecionar um personagem na aba "Ficha" para usar a galeria de imagens.</p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setActivePage("sheet")}
                className="px-6 py-2 bg-amber-500 text-zinc-950 font-bold rounded-lg hover:bg-amber-400 transition-colors text-sm"
              >
                Ir para Ficha
              </motion.button>
            </div>
          ) : (
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
                            // Compressing to fit Firestore limit and storage quota
                            // 800px at 0.7 gives excellent fidelity while preserving storage
                            const compressed = await compressImageDataUrl(reader.result as string, 800, 0.7);
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
                    onClick={() => setSelectedGalleryImage(img)}
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
                      className="absolute top-2 right-2 p-2 bg-red-600/90 hover:bg-red-600 text-white rounded-xl shadow-lg transition-all z-10 hover:scale-110 backdrop-blur-sm"
                      title="Remover Imagem"
                    >
                      <Trash2 size={16} />
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
          )
        ) : activePage === "master" ? (
          <div className="w-full flex-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
            <div className="w-full max-w-6xl mx-auto p-4 md:p-8 space-y-8 pb-32">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-3xl font-black text-purple-500 uppercase tracking-tighter">Painel do Mestre</h2>
                  <p className="text-zinc-500 text-sm">Gerencie suas campanhas e visualize as fichas dos seus jogadores.</p>
                </div>
                
                {!user ? (
                  <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl text-center w-full max-w-sm md:w-auto">
                    <Shield size={32} className="mx-auto text-amber-500 mb-4" />
                    <p className="text-zinc-300 font-bold mb-1">Acesso ao Modo Mestre</p>
                    <p className="text-zinc-500 text-xs mb-4">Informe seu e-mail e senha para conectar e gerenciar suas fichas e campanhas.</p>
                    <div className="flex flex-col gap-2.5">
                      <button 
                        type="button"
                        onClick={() => { setAuthMode('login'); setModalAuthError(null); setIsAuthModalOpen(true); }}
                        className="px-6 py-2.5 bg-amber-500 text-zinc-950 font-black rounded-xl hover:bg-amber-400 transition-all w-full text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                      >
                        <LogIn size={16} /> Entrar na Conta (E-mail e Senha)
                      </button>
                      <button 
                        type="button"
                        onClick={() => { setAuthMode('set_password'); setModalAuthError(null); setIsAuthModalOpen(true); }}
                        className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 font-bold rounded-xl transition-all w-full text-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Lock size={16} /> Criar / Trocar Senha
                      </button>
                      <button 
                        type="button"
                        onClick={loginAsGuest}
                        className="px-4 py-1.5 bg-transparent hover:bg-zinc-800/50 text-zinc-500 hover:text-zinc-300 font-medium rounded-lg transition-colors w-full text-[11px] cursor-pointer mt-1"
                      >
                        Usar Modo Convidado (Offline)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full md:w-auto items-center">
                    <div className="bg-zinc-900/80 border border-zinc-800 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs text-zinc-400">
                      <UserIcon size={14} className="text-amber-500" />
                      <span className="truncate max-w-[150px] font-medium">{user.email || user.displayName}</span>
                      <button
                        type="button"
                        onClick={() => { setAuthEmail(user.email || ""); setAuthMode('set_password'); setModalAuthError(null); setIsAuthModalOpen(true); }}
                        className="text-[10px] text-amber-400 hover:underline font-bold ml-1 cursor-pointer"
                        title="Cadastrar ou alterar senha para esta conta"
                      >
                        Criar/Trocar Senha
                      </button>
                    </div>
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
                           if (!inviteCodeInput.trim()) {
                             showToast("Por favor, digite o código de convite da campanha.", "error");
                             return;
                           }
                           try {
                             const joinedCampId = await joinCampaign(inviteCodeInput.trim(), user?.email || "");
                             if (activeChar) {
                               try {
                                 await linkCharacterToCampaign(joinedCampId, activeChar);
                                 showToast(`Você entrou na campanha e vinculou a ficha "${activeChar.nome}"!`, "success");
                               } catch (e) {
                                 showToast("Você entrou na campanha!", "success");
                               }
                             } else {
                               showToast("Você entrou na campanha!", "success");
                             }
                             setActiveCampaignIdWithSync(joinedCampId);
                             setInviteCodeInput("");
                           } catch (err: any) {
                             showToast(err.message, "error");
                           }
                         }}
                         className="whitespace-nowrap px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition-colors text-xs uppercase cursor-pointer"
                       >
                         Entrar
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
                           if (!newCampaignName.trim()) {
                             showToast("Por favor, insira o nome da nova campanha.", "error");
                             return;
                           }
                           let camp = null;
                            try {
                              camp = await createCampaign(newCampaignName.trim());
                            } catch (err: any) {
                              showToast(err.message || "Erro ao criar campanha.", "error");
                            }
                           if (camp) {
                             showToast("Campanha criada!", "success");
                             setNewCampaignName("");
                             // Optimistic update to guarantee immediate rendering
                             setMasterCampaigns(prev => {
                               if (prev.some(c => c.id === camp!.id)) return prev;
                               return [...prev, camp!];
                             });
                             setActiveCampaignIdWithSync(camp.id);
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
                                const currentHour = tableConfig.time?.hour ?? 0;
                                const season = getSeason(tableConfig.date?.month || 1);
                                const isCrossing18 = currentHour < 18 && h >= 18;
                                const newWeather = isCrossing18 ? generateWeather(season) : tableConfig.weather;

                                await updateTableConfig(activeCampaignId!, { 
                                  time: { ...(tableConfig.time || { hour: 0, minute: 0 }), hour: h },
                                  weather: newWeather
                                });

                                // Check reminders for manual edit
                                const hungerHours = [0, 4, 8, 12, 16, 20];
                                const fatigueHours = [20, 22, 0, 2];
                                const showHungerThirst = remindersEnabled.hungerThirst && hungerHours.includes(h);
                                const showFatigue = remindersEnabled.fatigue && fatigueHours.includes(h);
                                if (showHungerThirst || showFatigue) {
                                  setMasterReminderModal({
                                    showHungerThirst,
                                    showFatigue,
                                    hour: h
                                  });
                                }
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

                      {/* Lembretes Automáticos */}
                      <div className="mt-6 pt-6 border-t border-zinc-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                            <Shield size={14} className="text-purple-500" /> Configuração de Lembretes do Mestre
                          </h4>
                          <p className="text-[10px] text-zinc-500 mt-1 font-medium">
                            Ative ou desative os alertas automáticos de sobrevivência mostrados durante a passagem do tempo.
                          </p>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setRemindersEnabled(prev => ({ ...prev, hungerThirst: !prev.hungerThirst }))}
                            className={`px-4 py-2 border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                              remindersEnabled.hungerThirst 
                                ? "bg-orange-500/10 border-orange-500/30 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.05)]" 
                                : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-400"
                            }`}
                          >
                            <Flame size={12} /> Fome & Sede: {remindersEnabled.hungerThirst ? "Ativo" : "Inativo"}
                          </button>
                          <button
                            onClick={() => setRemindersEnabled(prev => ({ ...prev, fatigue: !prev.fatigue }))}
                            className={`px-4 py-2 border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                              remindersEnabled.fatigue 
                                ? "bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.05)]" 
                                : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-400"
                            }`}
                          >
                            <Moon size={12} /> Cansaço: {remindersEnabled.fatigue ? "Ativo" : "Inativo"}
                          </button>
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
                      <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="text-[10px] font-black text-purple-500 uppercase tracking-[0.2em] flex items-center gap-2">
                          <Shield size={12} /> Campanhas que Mestro
                        </h3>
                        <div className="flex items-center gap-1.5">
                          {activeCampaignId && masterCampaigns.some(c => c.id === activeCampaignId) && (
                            <button
                              type="button"
                              onClick={exportActiveCampaign}
                              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-amber-400 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center gap-1 cursor-pointer"
                              title="Exportar Campanha Ativa (Grid, VTT Tokens, Data/Hora e Fichas)"
                            >
                              <Download size={12} /> Exportar
                            </button>
                          )}
                          <label 
                            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-amber-400 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center gap-1 cursor-pointer"
                            title="Importar Campanha de arquivo .json"
                          >
                            <Upload size={12} /> Importar
                            <input type="file" accept=".json" className="hidden" onChange={handleImportCampaignFile} />
                          </label>
                        </div>
                      </div>
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
                        {joinedCampaigns.filter(camp => (camp.masterEmail?.toLowerCase() !== user?.email?.toLowerCase()) && camp.masterId !== user?.uid).map(camp => (
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
                                leaveCampaign(camp.id, user?.email || "");
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

                        {joinedCampaigns.filter(camp => (camp.masterEmail?.toLowerCase() !== user?.email?.toLowerCase()) && camp.masterId !== user?.uid).length === 0 && orphanedCampaignIds.length === 0 && (
                          <div className="text-center py-8 bg-zinc-900/50 border border-dashed border-zinc-800 rounded-2xl">
                             <p className="text-[10px] text-zinc-600 font-bold uppercase">Nenhuma campanha vinculada</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Fichas na Campanha */}
                  <div className="lg:col-span-8 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest px-1">Fichas na Campanha Selecionada</h3>
                      {activeCampaignId && (
                        <span className="text-[10px] text-zinc-500 font-bold bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full">
                          {campaignCharacters.length} {campaignCharacters.length === 1 ? "ficha" : "fichas"}
                        </span>
                      )}
                    </div>

                    {activeCampaignId && campaigns.some(c => c.id === activeCampaignId) ? (
                      <div className="space-y-4">
                        {/* Barra para vincular ficha pessoal à mesa */}
                        {visibleCharacters.length > 0 && (
                          <div className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-inner">
                            <div className="flex items-center gap-2">
                              <UserPlus size={16} className="text-blue-500 shrink-0" />
                              <span className="text-xs font-bold text-zinc-200">Vincular ficha a esta mesa:</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={charToLinkCampaignId}
                                onChange={(e) => setCharToLinkCampaignId(e.target.value)}
                                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                              >
                                <option value="">Selecione uma das suas fichas...</option>
                                {visibleCharacters.map(c => (
                                  <option key={c.id} value={c.id}>
                                    {c.nome} {campaignCharacters.some(cc => cc.id === c.id) ? "(Já na mesa)" : ""}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={async () => {
                                  const char = state.characters.find(c => c.id === charToLinkCampaignId);
                                  if (!char) {
                                    showToast("Selecione um personagem para vincular.", "error");
                                    return;
                                  }
                                  try {
                                    await linkCharacterToCampaign(activeCampaignId, char);
                                    updateChar({ campaignId: activeCampaignId }, char.id);
                                    showToast(`Ficha "${char.nome}" vinculada à campanha com sucesso!`, "success");
                                    setCharToLinkCampaignId("");
                                  } catch (err: any) {
                                    showToast(err.message || "Erro ao vincular ficha.", "error");
                                  }
                                }}
                                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold uppercase transition-all whitespace-nowrap cursor-pointer shadow-md"
                              >
                                Vincular
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {campaignCharacters.map(char => (
                            <div 
                              key={char.id}
                              className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between group hover:border-purple-500/50 transition-all overflow-hidden shadow-lg"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="shrink-0 w-12 h-12 bg-zinc-800 rounded-lg overflow-hidden flex items-center justify-center border border-zinc-700/50">
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
                                    <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded font-bold">PV: {char.vidaAtual}</span>
                                    <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-bold">PM: {char.manaAtual}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button 
                                  onClick={() => {
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
                                  className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-all text-[10px] font-bold uppercase whitespace-nowrap cursor-pointer shadow"
                                  title="Ver ou editar a ficha"
                                >
                                  Ver/Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await unlinkCharacterFromCampaign(activeCampaignId, char.id);
                                      updateChar({ campaignId: "" }, char.id);
                                      showToast(`Ficha "${char.nome}" desvinculada da campanha.`, "success");
                                    } catch (err: any) {
                                      showToast(err.message || "Erro ao desvincular.", "error");
                                    }
                                  }}
                                  className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                                  title="Desvincular ficha desta campanha"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                          {campaignCharacters.length === 0 && (
                            <div className="col-span-full py-12 text-center text-zinc-500 italic text-sm bg-zinc-950/40 border border-dashed border-zinc-800 rounded-2xl p-6">
                              Nenhuma ficha vinculada a esta mesa ainda. Use a caixa acima para vincular uma ficha!
                            </div>
                          )}
                        </div>
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
                <Backpack size={48} className="text-zinc-800 mb-4" />
                <p className="text-zinc-500 italic">Selecione um personagem para acessar a Toca.</p>
              </div>
            )}
          </div>
        ) : activePage === "items" ? (
          <div className="max-w-6xl mx-auto">
            <ItemLibrary 
              characters={visibleCharacters}
              activeCharId={activeChar?.id || null}
              onAddItemToCharacter={handleAddItemToCharacterCompartment}
              showToast={showToast}
              user={user}
            />
          </div>
        ) : activePage === "spells" ? (
          <div className="max-w-6xl mx-auto">
            <SpellLibrary 
              characters={visibleCharacters}
              activeCharId={activeChar?.id || null}
              onAddSpellToCharacter={handleAddSpellToCharacter}
              showToast={showToast}
              user={user}
            />
          </div>
        ) : activePage === "materials" ? (
          <div className="max-w-6xl mx-auto">
            <MaterialManagement 
              materials={customMaterials} 
              onSave={(mat) => saveMaterial(user?.uid || "guest", mat)} 
              onDelete={deleteMaterial} 
            />
          </div>
        ) : activePage === "table" ? (
          <div className="w-full flex-1">
            {activeCampaignId ? (
              <VTTBoard 
                campaignId={activeCampaignId}
                isMaster={!!(activeCampaignId && campaigns.some(c => c.id === activeCampaignId && ((c.masterEmail && c.masterEmail.toLowerCase() === user?.email?.toLowerCase()) || (c.masterId && c.masterId === user?.uid))))}
                tokens={tokens}
                config={tableConfig}
                availableCharacters={vttAvailableCharacters}
                activeCharacterId={activeChar?.id || null}
                customMaterials={customMaterials}
                onAddToken={(t) => addToken(activeCampaignId, t)}
                onRemoveToken={(id) => removeToken(activeCampaignId, id)}
                onUpdateConfig={(cfg) => updateTableConfig(activeCampaignId, cfg)}
                showToast={showToast}
                onUpdateCharacter={updateChar}
                renderCharacterSheet={renderSheetContent}
                renderDiceContent={renderDiceContent}
                onRollResult={handleRollResult}
                isVttSheetOpen={isVttSheetOpen}
                setIsVttSheetOpen={setIsVttSheetOpen}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/10 border border-dashed border-zinc-800 rounded-3xl max-w-md mx-auto">
                <Shield size={48} className="text-zinc-800 mb-4" />
                <p className="text-zinc-500 italic">Selecione uma campanha para acessar a Mesa de Jogo.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-zinc-500 italic">Página desconhecida ou em desenvolvimento.</p>
          </div>
        );
      };

      return renderOtherPages();
    })()}
  </main>

  <PrintSheetModal
    isOpen={isPrintModalOpen}
    onClose={() => setIsPrintModalOpen(false)}
    character={activeChar}
    stats={stats}
    vidaMax={vidaMax}
    manaMax={manaMax}
    sanidadeMax={sanidadeMax}
    cargaMax={cargaMax}
    deslocamentoFinal={deslocamentoFinal}
    pesoTotal={pesoTotal}
    climateProficiency={climateProficiency}
  />

  {activeNoteImageModal && (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
      onClick={() => setActiveNoteImageModal(null)}
    >
      <div
        className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center justify-center bg-zinc-950/90 border border-zinc-800 rounded-2xl p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal da Imagem */}
        <div className="w-full flex items-center justify-between pb-3 mb-2 border-b border-zinc-800/80">
          <h3 className="text-sm font-bold text-amber-500 uppercase tracking-wider flex items-center gap-2 truncate">
            <Image size={18} />
            {activeNoteImageModal.title || "Visualizar Imagem"}
          </h3>
          <div className="flex items-center gap-2">
            <a
              href={activeNoteImageModal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors text-xs flex items-center gap-1 font-bold"
              title="Abrir em nova aba"
            >
              <Maximize size={16} />
              <span className="hidden sm:inline">Nova Aba</span>
            </a>
            <button
              onClick={() => setActiveNoteImageModal(null)}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors"
              title="Fechar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Conteúdo da Imagem Expandida */}
        <div className="relative flex-1 w-full flex items-center justify-center overflow-auto max-h-[78vh] rounded-xl bg-zinc-900/50 p-2">
          <img
            src={activeNoteImageModal.url}
            alt={activeNoteImageModal.title || "Imagem Expandida"}
            className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl"
          />
        </div>
      </div>
    </div>
  )}

  {/* Pop-up Modal de Resultado de Rolagem (Dados e Combate) */}
  <AnimatePresence>
    {lastRoll && (
      <div 
        id="roll-result-popup-overlay"
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={() => setLastRoll(null)}
      >
        <motion.div
          id="roll-result-popup-card"
          initial={{ scale: 0.9, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 12 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-zinc-950 border border-amber-500/40 p-5 sm:p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4 font-sans relative overflow-hidden"
        >
          {/* Atmospheric subtle glow */}
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Cabeçalho */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                {lastRoll.isCombat ? <Sword size={18} /> : <Dices size={18} />}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-amber-500 uppercase tracking-wider truncate">
                  {lastRoll.isCombat
                    ? (getDetailedCombatTitle(lastRoll) || lastRoll.armaNome || "Resultado de Combate")
                    : "Resultado da Rolagem"}
                </h3>
                {lastRoll.isCombat && (lastRoll.armaNome || lastRoll.attackerName) && (
                  <span className="text-[11px] text-zinc-400 font-bold block truncate">
                    {lastRoll.attackerName ? `${lastRoll.attackerName} • ` : ""}{lastRoll.armaNome || ""}{lastRoll.targetName ? ` vs ${lastRoll.targetName}` : ""}
                  </span>
                )}
              </div>
            </div>
            <button
              id="close-roll-popup-btn"
              type="button"
              onClick={() => setLastRoll(null)}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Conteúdo da Rolagem */}
          {lastRoll.isCombat ? (
            <div className="space-y-3">
              {/* Acerto e Dano */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                    Acerto (3d8)
                  </span>
                  <span className="text-2xl font-black text-amber-400 my-0.5">
                    {lastRoll.hitResult ?? lastRoll.result}
                  </span>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {lastRoll.hitRolls && lastRoll.hitRolls.length > 0
                      ? `[${lastRoll.hitRolls.join(", ")}]${lastRoll.hitBonus !== undefined && lastRoll.hitBonus !== 0 ? (lastRoll.hitBonus > 0 ? ` +${lastRoll.hitBonus}` : ` ${lastRoll.hitBonus}`) : ""}`
                      : (lastRoll.hitFormula || "")}
                  </span>
                </div>

                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                    Dano
                  </span>
                  <span className="text-2xl font-black text-red-400 my-0.5">
                    {lastRoll.dmgResult ?? (lastRoll.damage !== undefined ? lastRoll.damage : "-")}
                  </span>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {lastRoll.dmgRolls && lastRoll.dmgRolls.length > 0
                      ? `[${lastRoll.dmgRolls.join(", ")}]${lastRoll.dmgBonus !== undefined && lastRoll.dmgBonus !== 0 ? (lastRoll.dmgBonus > 0 ? ` +${lastRoll.dmgBonus}` : ` ${lastRoll.dmgBonus}`) : ""}`
                      : (lastRoll.dmgFormula || "")}
                  </span>
                </div>
              </div>

              {/* Local do Golpe e Informações Adicionais */}
              <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-3 space-y-1.5 text-xs">
                {lastRoll.hitLocation && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">Local do Golpe:</span>
                    <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {lastRoll.hitLocation}
                    </span>
                  </div>
                )}
                {lastRoll.defenseResult !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 font-medium">Defesa do Alvo:</span>
                    <span className="font-mono text-zinc-300">
                      {lastRoll.defenseRolls && lastRoll.defenseRolls.length > 0 ? `[${lastRoll.defenseRolls.join(", ")}] = ` : ""}{lastRoll.defenseResult}
                    </span>
                  </div>
                )}
                {lastRoll.combatNote && (
                  <div className="pt-1.5 border-t border-zinc-800 text-[11px] text-zinc-400 italic">
                    {lastRoll.combatNote}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                  Resultado
                </span>
                <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-3xl font-black text-amber-400 shadow-inner mb-2">
                  {lastRoll.result}
                </div>
                <div className="text-xs font-bold text-zinc-300">
                  {lastRoll.formula}
                </div>
                {lastRoll.rolls && lastRoll.rolls.length > 0 && (
                  <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-1 font-mono">
                    <span>Dados:</span>
                    <span className="text-amber-400">[{lastRoll.rolls.join(", ")}]</span>
                    {lastRoll.bonus !== 0 && (
                      <span className="text-zinc-500">
                        {lastRoll.bonus! > 0 ? `+${lastRoll.bonus}` : lastRoll.bonus} (bônus)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex items-center gap-2 pt-1">
            {!lastRoll.isCombat && lastRoll.sides && (
              <button
                id="repeat-roll-btn"
                type="button"
                onClick={() => {
                  rollDice(lastRoll.sides || 20, diceQuantity, diceBonus, "Rolagem Repetida");
                }}
                className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-200 border border-zinc-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCw size={14} />
                Rolar Novamente
              </button>
            )}
            <button
              id="close-roll-modal-btn"
              type="button"
              onClick={() => setLastRoll(null)}
              className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>

  {/* Modal de Autenticação (E-mail, Senha, Google, Convidado) */}
  <AnimatePresence>
    {isAuthModalOpen && (
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        onClick={() => setIsAuthModalOpen(false)}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-zinc-950 border border-zinc-800 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-5 font-sans relative"
        >
          {/* Botão Fechar */}
          <button
            type="button"
            onClick={() => setIsAuthModalOpen(false)}
            className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>

          {/* Cabeçalho */}
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-500 mb-2">
              <Shield size={24} />
            </div>
            <h3 className="text-xl font-black text-amber-500 uppercase tracking-tight">
              {authMode === 'login' 
                ? "Acessar Conta" 
                : authMode === 'set_password' 
                ? "Criar / Trocar Senha" 
                : "Redefinir Senha"}
            </h3>
            <p className="text-xs text-zinc-400">
              {authMode === 'login' 
                ? "Digite seu e-mail e senha para acessar sua conta com segurança" 
                : authMode === 'set_password'
                ? "Cadastre ou atualize a senha para proteger sua conta"
                : "Enviaremos um e-mail para redefinição"}
            </p>
          </div>



          {/* Abas Alternar Login / Senha */}
          {authMode !== 'reset' ? (
            <div className="grid grid-cols-2 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setModalAuthError(null); }}
                className={cn(
                  "py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5",
                  authMode === 'login' 
                    ? "bg-amber-500 text-zinc-950 shadow-md" 
                    : "text-zinc-400 hover:text-white"
                )}
              >
                <LogIn size={14} /> Entrar
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('set_password'); setModalAuthError(null); }}
                className={cn(
                  "py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5",
                  authMode === 'set_password' 
                    ? "bg-amber-500 text-zinc-950 shadow-md" 
                    : "text-zinc-400 hover:text-white"
                )}
              >
                <Lock size={14} /> Criar Conta / Senha
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setModalAuthError(null); }}
              className="text-xs text-amber-400 hover:underline flex items-center justify-center gap-1 cursor-pointer mx-auto"
            >
              ← Voltar para o Login
            </button>
          )}

          {/* Erro de Autenticação */}
          {modalAuthError && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-medium text-amber-300 text-center animate-in fade-in leading-relaxed">
              {modalAuthError}
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleAuthSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Seu E-mail *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  required
                  placeholder="seu.email@exemplo.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {authMode !== 'reset' && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Nome / Apelido (Opcional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <UserIcon size={16} />
                  </div>
                  <input
                    type="text"
                    placeholder="Seu nome de jogador"
                    value={authDisplayName}
                    onChange={(e) => setAuthDisplayName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}

            {authMode === 'login' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Senha de Acesso *
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Digite sua senha"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-10 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {authMode === 'set_password' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Senha Desejada (Mínimo 6 dígitos) *
                  </label>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('reset'); setModalAuthError(null); }}
                    className="text-[10px] text-amber-500 hover:underline cursor-pointer font-semibold"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-10 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-zinc-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2 mt-2"
            >
              {authSubmitting ? (
                <>
                  <RefreshCwIcon size={16} className="animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  {authMode === 'login' ? <LogIn size={16} /> : authMode === 'set_password' ? <Lock size={16} /> : <Mail size={16} />}
                  <span>
                    {authMode === 'login' 
                      ? "Entrar na Conta" 
                      : authMode === 'set_password' 
                      ? (user ? "Atualizar Senha" : "Criar Conta / Salvar Senha")
                      : "Enviar E-mail de Redefinição"}
                  </span>
                </>
              )}
            </button>
          </form>


        </motion.div>
      </div>
    )}
  </AnimatePresence>

  {/* Modal de Importar / Exportar Tudo (Backup Completo) */}
  <AnimatePresence>
    {showFullBackupModal && (
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        onClick={() => setShowFullBackupModal(false)}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-zinc-950 border border-zinc-800 p-6 rounded-2xl max-w-xl w-full shadow-2xl space-y-5 font-sans relative max-h-[90vh] overflow-y-auto"
        >
          {/* Botão Fechar */}
          <button
            type="button"
            onClick={() => setShowFullBackupModal(false)}
            className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>

          {/* Cabeçalho */}
          <div className="flex items-center gap-3 border-b border-zinc-800/80 pb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
              <Archive size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-amber-500 uppercase tracking-tight">
                Importar & Exportar Tudo
              </h3>
              <p className="text-xs text-zinc-400">
                Backup completo de todas as suas fichas, campanhas, monstros, materiais e customizações
              </p>
            </div>
          </div>

          {/* Abas */}
          <div className="grid grid-cols-2 gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800/80">
            <button
              type="button"
              onClick={() => setBackupModalTab('export')}
              className={cn(
                "py-2.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer",
                backupModalTab === 'export' ? "bg-amber-500 text-zinc-950 shadow-md" : "text-zinc-400 hover:text-white"
              )}
            >
              <Download size={16} />
              Exportar Tudo
            </button>
            <button
              type="button"
              onClick={() => setBackupModalTab('import')}
              className={cn(
                "py-2.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer",
                backupModalTab === 'import' ? "bg-amber-500 text-zinc-950 shadow-md" : "text-zinc-400 hover:text-white"
              )}
            >
              <Upload size={16} />
              Importar Tudo
            </button>
          </div>

          {/* Aba EXPORTAR */}
          {backupModalTab === 'export' && (
            <div className="space-y-4 pt-1">
              <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300">Conteúdo do Backup:</span>
                  <span className="text-[11px] text-amber-400 font-mono font-bold">
                    {state.characters.length} fichas • {campaigns.length} campanhas • {bestiaryMonsters.length} monstros
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-zinc-400">
                  <div className="p-2.5 bg-zinc-950/70 border border-zinc-850 rounded-lg">
                    <span className="block text-[10px] text-zinc-500 uppercase font-black">Fichas</span>
                    <strong className="text-sm text-zinc-200">{state.characters.length}</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-950/70 border border-zinc-850 rounded-lg">
                    <span className="block text-[10px] text-zinc-500 uppercase font-black">Campanhas</span>
                    <strong className="text-sm text-zinc-200">{campaigns.length}</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-950/70 border border-zinc-850 rounded-lg">
                    <span className="block text-[10px] text-zinc-500 uppercase font-black">Bestiário</span>
                    <strong className="text-sm text-zinc-200">{bestiaryMonsters.length}</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-950/70 border border-zinc-850 rounded-lg">
                    <span className="block text-[10px] text-zinc-500 uppercase font-black">Materiais</span>
                    <strong className="text-sm text-zinc-200">{customMaterials.length}</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-950/70 border border-zinc-850 rounded-lg col-span-2 sm:col-span-2">
                    <span className="block text-[10px] text-zinc-500 uppercase font-black">Customizações</span>
                    <strong className="text-sm text-zinc-200">Itens, Magias, Toca & Notas</strong>
                  </div>
                </div>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                Gera um arquivo de backup seguro contendo todos os dados da sua conta para você salvar no seu dispositivo e restaurar quando quiser.
              </p>

              <button
                type="button"
                onClick={exportAllUserData}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download size={18} />
                Baixar Arquivo de Backup Completo
              </button>
            </div>
          )}

          {/* Aba IMPORTAR */}
          {backupModalTab === 'import' && (
            <div className="space-y-4 pt-1">
              <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-3">
                <label className="block text-xs font-bold text-zinc-300">
                  Selecione o arquivo de Backup
                </label>
                <label className="w-full py-6 border-2 border-dashed border-zinc-700 hover:border-amber-500/60 bg-zinc-950/60 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors group">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 group-hover:bg-amber-500/20 text-amber-400 flex items-center justify-center transition-colors">
                    <Upload size={20} />
                  </div>
                  <span className="text-xs font-bold text-zinc-300 group-hover:text-amber-400 transition-colors">
                    Clique para escolher o arquivo de backup do seu dispositivo
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    Compatível com backups completos, listas de fichas ou fichas individuais
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".json"
                    onChange={handleFullBackupFileInput}
                  />
                </label>
              </div>

              {/* Colar JSON Opcional */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setPasteFullBackupText(prev => prev ? "" : " ")}
                  className="text-xs font-bold text-zinc-400 hover:text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Terminal size={14} />
                  {pasteFullBackupText ? "Ocultar área de texto JSON" : "Ou colar texto JSON diretamente"}
                </button>

                {pasteFullBackupText !== "" && (
                  <div className="space-y-2 animate-in fade-in duration-150">
                    <textarea
                      value={pasteFullBackupText.trim()}
                      onChange={(e) => setPasteFullBackupText(e.target.value)}
                      placeholder='Cole o conteúdo do seu arquivo .json aqui...'
                      rows={4}
                      className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-200 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                    <button
                      type="button"
                      disabled={isImportingAll || !pasteFullBackupText.trim()}
                      onClick={() => processImportAllJson(pasteFullBackupText.trim())}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isImportingAll ? <RefreshCwIcon size={14} className="animate-spin" /> : <Upload size={14} />}
                      {isImportingAll ? "Processando..." : "Importar JSON Colado"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    )}
  </AnimatePresence>
</div>
);
}
