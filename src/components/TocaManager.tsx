import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Plus, 
  Minus,
  Trash2, 
  Save, 
  Heart, 
  Swords, 
  Shield, 
  Activity, 
  Utensils, 
  Droplets, 
  Sun, 
  Weight, 
  PawPrint,
  X,
  Target,
  Move,
  Info,
  ChevronRight,
  ChevronDown,
  Image as ImageIcon,
  BookOpen,
  Search,
  Package,
  Scissors,
  Wand,
  HeartCrack,
  Skull,
  ClipboardList,
  Sparkles,
  RotateCw,
  Sword,
  Copy,
  Gem,
  Zap,
  Disc
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Character, 
  TocaCreature, 
  MonsterAction, 
  Weapon, 
  Catalyst, 
  ArmorPiece, 
  Compartment, 
  Item,
  BestiaryMonster
} from "../types";
import { getItemPeso, getItemVolume, getArmorWeight, getArmorVolume } from "../rules/inventoryRules";
import { generateId } from "../lib/random";
import { cn } from "../lib/utils";
import { compressImageDataUrl } from "../lib/imageUtils";
import { subscribeToBestiary } from "../services/bestiaryService";
import { DEFAULT_MONSTERS } from "../constants/defaultMonsters";
import { auth } from "../lib/supabase";

// Mini component identical to custom inputs
const TocaInput = ({
  label,
  value,
  onChange,
  type = "number"
}: {
  label: string;
  value: any;
  onChange: (v: any) => void;
  type?: string;
}) => (
  <div className="bg-zinc-900 border border-zinc-805 rounded-xl p-2 flex flex-col">
    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-wider mb-1">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(e) => {
        const val = e.target.value;
        onChange(type === "number" ? (val === "" ? "" : Number(val)) : val);
      }}
      className="w-full bg-transparent text-xs font-bold text-white focus:outline-none focus:ring-0 p-0 border-0"
    />
  </div>
);

const safeParseInt = (v: string, defaultValue: number = 0): number | "" => {
  if (v === "") return "";
  const val = parseInt(v);
  return isNaN(val) ? defaultValue : val;
};

const safeParseFloat = (v: string, defaultValue: number = 0): number | "" => {
  if (v === "") return "";
  const val = parseFloat(v);
  return isNaN(val) ? defaultValue : val;
};

const MiniInput = React.memo(({
  label,
  value,
  onChange,
  type = "text",
  className,
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) => {
  const [innerValue, setInnerValue] = useState(value?.toString() ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value !== undefined && value !== null && value !== "") {
      if (document.activeElement === inputRef.current) {
        return;
      }
      if (value.toString() !== innerValue) {
        setInnerValue(value.toString());
      }
    } else {
      if (document.activeElement !== inputRef.current) {
        setInnerValue("");
      }
    }
  }, [value]);

  return (
    <div className={cn("bg-zinc-950 p-1.5 rounded border border-zinc-800 flex flex-col min-w-0 flex-1", className)}>
      <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-tighter block truncate mb-0.5 select-none">{label}</span>
      <input
        ref={inputRef}
        type={type}
        value={innerValue}
        onChange={(e) => {
          setInnerValue(e.target.value);
          onChange(e.target.value);
        }}
        onBlur={() => {
          if (value !== undefined && value !== null && value !== "") {
            setInnerValue(value.toString());
          } else {
            setInnerValue("");
          }
        }}
        className="bg-transparent border-0 p-0 text-white font-bold w-full text-xs focus:ring-0 focus:outline-none"
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
    <div className={cn("flex flex-col min-w-0 bg-zinc-950 p-1.5 rounded border border-zinc-800", className)}>
      <label className="block text-[8px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5 select-none">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full bg-transparent text-xs text-zinc-300 font-sans focus:outline-none p-0 border-0 focus:ring-0 resize-none"
      />
    </div>
  );
});

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
        className="flex items-center justify-between p-2 cursor-pointer select-none bg-zinc-900/10 hover:bg-zinc-900/30 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-zinc-500 shrink-0">{icon}</span>
          <span className="text-[10px] font-black uppercase text-zinc-400 select-none tracking-wider truncate">
            {title}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={cn(
            "text-zinc-500 transition-transform shrink-0",
            isCollapsed && "-rotate-90",
          )}
        />
      </div>
      {!isCollapsed && (
        <div className="p-2 border-t border-zinc-800 space-y-2">{children}</div>
      )}
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
    <div className="space-y-2 pt-1 border-t border-zinc-805">
      {/* Mini Seletor de Tipo de Arma */}
      <div className="flex items-center justify-between bg-zinc-950/20 px-2 py-1 rounded border border-zinc-800/20 relative">
        <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider">Tipo/Propriedades</span>
        <div className="relative font-sans">
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
                        ? "bg-amber-500 text-zinc-950 hover:bg-amber-400"
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
        <MiniInput
          label="Dano"
          value={item.dano || "0"}
          onChange={(v) => onChange({ dano: v })}
        />
        <MiniInput
          label="Acerto"
          value={item.acerto ?? ""}
          type="number"
          onChange={(v) => onChange({ acerto: safeParseInt(v) })}
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <MiniInput
          label="Durabilidade Atual"
          value={item.durabilidade ?? ""}
          type="number"
          onChange={(v) => onChange({ durabilidade: safeParseInt(v) })}
        />
        <MiniInput
          label="Durabilidade Total"
          value={item.maxDurabilidade ?? ""}
          type="number"
          onChange={(v) => onChange({ 
            maxDurabilidade: safeParseInt(v),
            durabilidadeMaxUtil: safeParseInt(v) 
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
              className="bg-zinc-900 border border-zinc-805 rounded px-1 py-0.5 text-[10px] text-amber-500 font-bold focus:outline-none"
            >
              {['0', 'D', 'C', 'B', 'A'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[7px] text-zinc-600 font-bold uppercase px-0.5">Atrib.</span>
            <select
              value={item.atributoBase || "Força"}
              onChange={(e) => onChange({ atributoBase: e.target.value })}
              className="bg-zinc-900 border border-zinc-805 rounded px-1 py-0.5 text-[10px] text-amber-500 font-bold focus:outline-none"
            >
              {['Força', 'Agilidade', 'Destreza', 'Vontade', 'Potencial', 'Inteligência', 'Ritual'].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
      )}

      {isMelee && (
        <div className="grid grid-cols-4 gap-1">
          <MiniInput label="Corte" value={item.corte ?? ""} type="number" onChange={(v) => onChange({ corte: safeParseInt(v) })} />
          <MiniInput label="Imp." value={item.impacto ?? ""} type="number" onChange={(v) => onChange({ impacto: safeParseInt(v) })} />
          <MiniInput label="Perf." value={item.perfuracao ?? ""} type="number" onChange={(v) => onChange({ perfuracao: safeParseInt(v) })} />
          <MiniInput label="Res." value={item.resistencia ?? ""} type="number" onChange={(v) => onChange({ resistencia: safeParseInt(v) })} />
        </div>
      )}

      {isFirearm && (
        <div className="space-y-1.5 border-l-2 border-amber-550/30 pl-2">
           <div className="grid grid-cols-2 gap-1.5">
             <MiniInput 
               label="Munição Total" 
               value={item.municaoTotal ?? ""} 
               type="number" 
               onChange={(v) => onChange({ municaoTotal: safeParseInt(v) })} 
             />
             <MiniInput 
               label="No Tambor/Pente" 
               value={item.municaoCarregada ?? ""} 
               type="number" 
               onChange={(v) => onChange({ municaoCarregada: safeParseInt(v) })} 
             />
           </div>
           <div className="flex flex-col gap-0.5">
             <span className="text-[7px] text-zinc-650 font-bold uppercase px-0.5">Munição em Uso (Membro)</span>
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
        <MiniInput label="Peso" value={item.peso ?? ""} type="number" onChange={(v) => onChange({ peso: safeParseFloat(v) })} />
        <MiniInput label="Vol" value={item.volume ?? ""} type="number" onChange={(v) => onChange({ volume: safeParseFloat(v) })} />
        <MiniInput label="Qtd" value={item.quantidade ?? ""} type="number" onChange={(v) => onChange({ quantidade: safeParseInt(v, 1) })} />
      </div>

      {isFirearm && (
        <div className="flex gap-1 pt-1 font-sans">
          <button
            type="button"
            onClick={() => onChange({ durabilidade: item.durabilidadeMaxUtil || item.maxDurabilidade })}
            className="flex-1 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[8px] font-black uppercase text-zinc-400 border border-zinc-700 transition-colors cursor-pointer"
          >
            Fazer Manutenção
          </button>
          <button
            type="button"
            onClick={() => {
              const bullet = internalBullets.find(it => it.id === item.bulletId);
              if (bullet && bullet.quantidade > 0 && (item.municaoCarregada || 0) < (item.municaoTotal || 0) && updateCharacter) {
                const amountToLoad = 1;
                const bulletProperties = { perfuracao: bullet.perfuracao || 0, impacto: bullet.impacto || 0, resistencia: bullet.resistencia || 0, nome: bullet.nome };
                const ammoToAdd = Array.from({ length: amountToLoad }, () => ({ ...bulletProperties, id: generateId() }));
                updateCharacter((c: any) => {
                  const newCompartimentos = (c.compartimentos || []).map((comp: any) => ({ ...comp, itens: (comp.itens || []).map((i: any) => i.id === bullet.id ? { ...i, quantidade: Math.max(0, i.quantidade - amountToLoad) } : i) }));
                  // note: we do not have separate weapons list top-level, we just return the updated compartments
                  return { compartimentos: newCompartimentos };
                });
              }
            }}
            className="flex-1 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-[8px] font-black uppercase text-amber-500 border border-amber-500/30 transition-colors cursor-pointer"
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
                const bulletProperties = { perfuracao: bullet.perfuracao || 0, impacto: bullet.impacto || 0, resistencia: bullet.resistencia || 0, nome: bullet.nome };
                const ammoToAdd = Array.from({ length: amountToLoad }, () => ({ ...bulletProperties, id: generateId() }));
                updateCharacter((c: any) => {
                  const newCompartimentos = (c.compartimentos || []).map((comp: any) => ({ ...comp, itens: (comp.itens || []).map((i: any) => i.id === bullet.id ? { ...i, quantidade: Math.max(0, i.quantidade - amountToLoad) } : i) }));
                  return { compartimentos: newCompartimentos };
                });
              }
            }}
            className="flex-1 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-[8px] font-black uppercase text-amber-500 border border-amber-500/30 transition-colors cursor-pointer"
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
    <div className="space-y-4 pt-1 border-t border-zinc-805">
      <div className="bg-zinc-950/30 p-2 rounded-lg border border-zinc-800/50 space-y-2">
        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
          Escala
        </span>
        <div className="grid grid-cols-2 gap-2 font-sans">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-zinc-650 font-bold uppercase">
              Nível
            </span>
            <select
              value={item.escala || "0"}
              onChange={(e) => onChange({ escala: e.target.value })}
              className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-amber-500 font-bold focus:outline-none"
            >
              <option value="0">0</option>
              <option value="D">D</option>
              <option value="C">C</option>
              <option value="B">B</option>
              <option value="A">A</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-zinc-650 font-bold uppercase">
              Bônus
            </span>
            <div className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-amber-500 font-bold">
              Inteligência
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MiniInput
          label="Feitiço"
          value={item.feitico ?? ""}
          type="number"
          onChange={(v) => onChange({ feitico: safeParseInt(v) })}
        />
        <MiniInput
          label="Elemental"
          value={item.elemental ?? ""}
          type="number"
          onChange={(v) => onChange({ elemental: safeParseInt(v) })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniInput
          label="Magia Negra"
          value={item.magiaNegra ?? ""}
          type="number"
          onChange={(v) => onChange({ magiaNegra: safeParseInt(v) })}
        />
        <MiniInput
          label="Potencial"
          value={item.potencial ?? ""}
          type="number"
          onChange={(v) => onChange({ potencial: safeParseInt(v) })}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MiniInput
          label="Durab."
          value={item.durabilidade ?? ""}
          type="number"
          onChange={(v) => onChange({ durabilidade: safeParseInt(v) })}
        />
        <MiniInput
          label="Peso (x100g)"
          value={item.peso ?? ""}
          type="number"
          onChange={(v) => onChange({ peso: safeParseFloat(v) })}
        />
        <MiniInput
          label="Vol"
          value={item.volume ?? ""}
          type="number"
          onChange={(v) => onChange({ volume: safeParseFloat(v) })}
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

const ArmorProperties = React.memo(({
  item,
  onChange,
}: {
  item: any;
  onChange: (updates: any) => void;
}) => {
  return (
    <div className="space-y-2 pt-1 border-t border-zinc-800/30">
      {item.tipo !== "Acessório" && item.tipo !== "Acessórios" && (
        <div className="grid grid-cols-3 gap-2">
          <MiniInput
            label="Corte"
            value={item.corte ?? ""}
            type="number"
            onChange={(v) => onChange({ corte: safeParseInt(v) })}
          />
          <MiniInput
            label="Impacto"
            value={item.impacto ?? ""}
            type="number"
            onChange={(v) => onChange({ impacto: safeParseInt(v) })}
          />
          <MiniInput
            label="Perf."
            value={item.perfuracao ?? ""}
            type="number"
            onChange={(v) => onChange({ perfuracao: safeParseInt(v) })}
          />
        </div>
      )}
      <div className="grid grid-cols-4 gap-2">
        <MiniInput
          label="Durab."
          value={item.durabilidade ?? ""}
          type="number"
          onChange={(v) => onChange({ durabilidade: safeParseInt(v) })}
        />
        <MiniInput
          label="Peso (x100g)"
          value={item.peso ?? ""}
          type="number"
          onChange={(v) => onChange({ peso: safeParseFloat(v) })}
        />
        <MiniInput
          label="Vol"
          value={item.volume ?? ""}
          type="number"
          onChange={(v) => onChange({ volume: safeParseFloat(v) })}
        />
        <MiniInput
          label="Redução de Dano"
          value={item.reducaoDano ?? ""}
          type="number"
          onChange={(v) => onChange({ reducaoDano: safeParseInt(v) })}
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
    { name: 'Bala', weight: 0.1, vol: 0.3 },
    { name: 'Flecha (A. Curto)', weight: 0.5, vol: 0.9 },
    { name: 'Flecha (A. Longo)', weight: 0.6, vol: 1.3 },
  ];

  return (
    <div className="space-y-2 pt-1 border-t border-zinc-800/30">
      <div className="flex flex-wrap gap-1">
        {templates.map(tmp => (
          <motion.button
            key={tmp.name}
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange({ 
              nome: item.nome === "Nova Munição" ? tmp.name : item.nome, 
              peso: tmp.weight, 
              volume: tmp.vol 
            })}
            className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[7px] font-black uppercase text-zinc-400 border border-zinc-700 transition-colors cursor-pointer"
          >
            {tmp.name}
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 col-span-2">
        <MiniInput 
          label="Perf." 
          value={item.perfuracao ?? ""} 
          type="number" 
          onChange={(v) => onChange({ perfuracao: safeParseInt(v) })} 
        />
        <MiniInput 
          label="Imp." 
          value={item.impacto ?? ""} 
          type="number" 
          onChange={(v) => onChange({ impacto: safeParseInt(v) })} 
        />
        <MiniInput 
          label="Res." 
          value={item.resistencia ?? ""} 
          type="number" 
          onChange={(v) => onChange({ resistencia: safeParseInt(v) })} 
        />
        <MiniInput 
          label="Peso (Un)" 
          value={item.peso ?? ""} 
          type="number" 
          onChange={(v) => onChange({ peso: safeParseFloat(v) })} 
        />
        <MiniInput 
          label="Vol (Un)" 
          value={item.volume ?? ""} 
          type="number" 
          onChange={(v) => onChange({ volume: safeParseFloat(v) })} 
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

// Helper helper function to transform bestiary monster to toca creature
const fromBestiaryToToca = (b: any): TocaCreature => {
  const cId = generateId();
  return {
    id: cId,
    name: b.name || "Criatura do Bestiário",
    imageUrl: b.imageUrl || "",
    maxHp: Number(b.maxHp) || 15,
    hpAtual: Number(b.maxHp) || 15,
    size: Number(b.size) || 1,
    esquiva: Number(b.esquiva) || 0,
    acuracia: Number(b.acuracia) || 0,
    deslocamento: b.deslocamento || "4 metros",
    bonus: b.bonus || "",
    ataque: {
      corte: Number(b.ataque?.corte) || 0,
      perfuracao: Number(b.ataque?.perfuracao) || 0,
      impacto: Number(b.ataque?.impacto) || 0,
      resistencia: Number(b.ataque?.resistencia) || 0,
      feitico: Number(b.ataque?.feitico) || 0,
      elemental: Number(b.ataque?.elemental) || 0,
      magiaNegra: Number(b.ataque?.magiaNegra) || 0,
      potencial: Number(b.ataque?.potencial) || 0,
    },
    defesa: {
      corte: Number(b.defesa?.corte) || 0,
      perfuracao: Number(b.defesa?.perfuracao) || 0,
      impacto: Number(b.defesa?.impacto) || 0,
      feitico: Number(b.defesa?.feitico) || 0,
      elemental: Number(b.defesa?.elemental) || 0,
      magiaNegra: Number(b.defesa?.magiaNegra) || 0,
    },
    acoes: b.acoes || [],
    fome: 0,
    sede: 0,
    clima: 0,
    carga: 200, // padrao 20kg
    armas: [],
    catalisadores: [],
    armaduras: [],
    acessorios: [],
    compartimentos: [{ id: generateId(), nome: "Bolsa Principal", volumeMax: 50, itens: [] }],
    local: b.local || "",
    personalidade: b.personalidade || "",
    gostaNaoGosta: b.gostaNaoGosta || "",
    partesUteis: b.partesUteis || "",
    informacoes: b.informacoes || "",
    habitos: b.habitos || ""
  };
};

interface TocaManagerProps {
  activeChar: Character;
  updateChar: (updates: Partial<Character> | ((c: Character) => Partial<Character>)) => void;
  cutItem?: any;
  setCutItem?: (item: any) => void;
  showToast?: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  onEditCreatureSheet?: (creatureId: string) => void;
}

export const TocaManager: React.FC<TocaManagerProps> = React.memo(({ 
  activeChar, 
  updateChar,
  cutItem,
  setCutItem,
  showToast,
  onEditCreatureSheet
}) => {
  const [editingCreature, setEditingCreature] = useState<TocaCreature | null>(null);

  const getCompanionClimateEffects = (climaVal: number) => {
    const diff = Math.abs(climaVal || 0);
    const effects: string[] = [];

    if (diff >= 2) {
      effects.push(
        "-1 em proficiências que usem inteligência, aprendizado e ritual. -5 em mentalidade."
      );
    }
    if (diff >= 4) {
      effects.push(
        "-1 em proficiências que usem força, destreza, resistência, adaptabilidade e constituição."
      );
    }
    if (diff >= 6) {
      const condition =
        climaVal < 0 ? "Hipotermia" : "Desidratação";
      effects.push(
        `${condition}: ⅓ a mais de dano de ataques, 1/2 do deslocamento, 1/2 resistência a efeitos de dano, ataques Críticos com 18 no d20.`
      );
    }
    return effects;
  };

  const [isAdding, setIsAdding] = useState(false);
  
  // Custom bestiary integration state
  const [isBestiaryModalOpen, setIsBestiaryModalOpen] = useState(false);
  const [customBestiary, setCustomBestiary] = useState<BestiaryMonster[]>([]);
  const [bestiarySearch, setBestiarySearch] = useState("");

  // Editor inner tab
  const [activeFormTab, setActiveFormTab] = useState<"attributes" | "combat" | "equipment" | "compartments">("attributes");

  // New action form state
  const [showAddAction, setShowAddAction] = useState(false);
  
  // For custom native dialogs to replace window.confirm, window.alert, and window.prompt
  const [appConfirm, setAppConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [appPrompt, setAppPrompt] = useState<{
    isOpen: boolean;
    title: string;
    defaultValue: string;
    placeholder: string;
    onConfirm: (val: string) => void;
  } | null>(null);

  const [newAction, setNewAction] = useState<Omit<MonsterAction, 'id'>>({
    name: "",
    type: "Major",
    categoria: "Corte",
    acerto: 10,
    dano: "1d6",
    description: ""
  });

  // Equipments fields state inline helper
  const [showAddInCompanionInv, setShowAddInCompanionInv] = useState<string | null>(null); // compId or 'weapon' / 'armor' etc.
  const [newInvItem, setNewInvItem] = useState<Partial<Item>>({
    nome: "",
    tipo: "Item",
    peso: 10,
    volume: 1,
    quantidade: 1,
    durabilidade: 10,
    maxDurabilidade: 10,
    descricao: ""
  });

  // Subscribe to Bestiary
  useEffect(() => {
    if (!auth.currentUser?.uid) {
      setCustomBestiary([]);
      return;
    }
    const unsub = subscribeToBestiary(auth.currentUser.uid, (monsters) => {
      setCustomBestiary(monsters);
    });
    return unsub;
  }, [auth.currentUser?.uid]);

  const creatures = activeChar.tocaCreatures || [];

  const getInitialCreature = (): TocaCreature => ({
    id: generateId(),
    name: "Nova Criatura",
    maxHp: 15,
    hpAtual: 15,
    size: 1,
    esquiva: 0,
    acuracia: 0,
    deslocamento: "4 metros",
    bonus: "",
    ataque: {
      corte: 0, perfuracao: 0, impacto: 0, resistencia: 0,
      feitico: 0, elemental: 0, magiaNegra: 0, potencial: 0
    },
    defesa: {
      corte: 0, perfuracao: 0, impacto: 0,
      feitico: 0, elemental: 0, magiaNegra: 0
    },
    acoes: [],
    fome: 0,
    sede: 0,
    clima: 0,
    carga: 200, // padrao 20kg
    armas: [],
    catalisadores: [],
    armaduras: [],
    acessorios: [],
    compartimentos: [{ id: generateId(), nome: "Bolsa Principal", volumeMax: 50, itens: [] }],
    local: "",
    personalidade: "",
    gostaNaoGosta: "",
    partesUteis: "",
    informacoes: "",
    habitos: ""
  });

  const handleCreate = () => {
    setEditingCreature(getInitialCreature());
    setIsAdding(true);
    setActiveFormTab("attributes");
  };

  const handleEdit = (creature: TocaCreature) => {
    // Ensure nested fields are non-null
    setEditingCreature({
      ...creature,
      armas: creature.armas || [],
      catalisadores: creature.catalisadores || [],
      armaduras: creature.armaduras || [],
      acessorios: creature.acessorios || [],
      compartimentos: creature.compartimentos || [
        { id: generateId(), nome: "Bolsa Principal", volumeMax: 50, itens: [] }
      ]
    });
    setIsAdding(false);
    setActiveFormTab("attributes");
  };

  const handleDelete = (id: string) => {
    setAppConfirm({
      isOpen: true,
      title: "Liberar Criatura",
      message: "Tem certeza que deseja liberar esta criatura da Toca? Essa ação é irreversível.",
      onConfirm: () => {
        updateChar({
          tocaCreatures: creatures.filter(c => c.id !== id)
        });
        if (editingCreature?.id === id) {
          setEditingCreature(null);
        }
        if (showToast) showToast("Criatura liberada com sucesso da Toca.", "info");
        setAppConfirm(null);
      }
    });
  };

  const handleSave = () => {
    if (!editingCreature) return;
    
    if (!editingCreature.name.trim()) {
      if (showToast) showToast("A criatura precisa de um nome!", "error");
      return;
    }

    const updatedList = [...creatures];
    const index = updatedList.findIndex(c => c.id === editingCreature.id);

    const cleaned: TocaCreature = {
      ...editingCreature,
      maxHp: Number(editingCreature.maxHp) || 0,
      hpAtual: editingCreature.hpAtual !== undefined ? Number(editingCreature.hpAtual) : Number(editingCreature.maxHp),
      esquiva: Number(editingCreature.esquiva) || 0,
      acuracia: Number(editingCreature.acuracia) || 0,
      fome: Number(editingCreature.fome) || 0,
      sede: Number(editingCreature.sede) || 0,
      clima: Number(editingCreature.clima) || 0,
      carga: Number(editingCreature.carga) || 0,
      ataque: {
        corte: Number(editingCreature.ataque.corte) || 0,
        perfuracao: Number(editingCreature.ataque.perfuracao) || 0,
        impacto: Number(editingCreature.ataque.impacto) || 0,
        resistencia: Number(editingCreature.ataque.resistencia) || 0,
        feitico: Number(editingCreature.ataque.feitico) || 0,
        elemental: Number(editingCreature.ataque.elemental) || 0,
        magiaNegra: Number(editingCreature.ataque.magiaNegra) || 0,
        potencial: Number(editingCreature.ataque.potencial) || 0,
      },
      defesa: {
        corte: Number(editingCreature.defesa.corte) || 0,
        perfuracao: Number(editingCreature.defesa.perfuracao) || 0,
        impacto: Number(editingCreature.defesa.impacto) || 0,
        feitico: Number(editingCreature.defesa.feitico) || 0,
        elemental: Number(editingCreature.defesa.elemental) || 0,
        magiaNegra: Number(editingCreature.defesa.magiaNegra) || 0,
      }
    };

    if (index > -1) {
      updatedList[index] = cleaned;
    } else {
      updatedList.push(cleaned);
    }

    updateChar({ tocaCreatures: updatedList });
    setEditingCreature(null);
    if (showToast) showToast(`Salvou "${cleaned.name}" com sucesso!`, "success");
  };

  // Import Bestiary creature logic
  const handleSelectFromBestiary = (b: any) => {
    const tocaCreature = fromBestiaryToToca(b);
    const updated = [...creatures, tocaCreature];
    updateChar({ tocaCreatures: updated });
    setIsBestiaryModalOpen(false);
    if (showToast) showToast(`Criatura "${tocaCreature.name}" importada com sucesso do bestiário!`, "success");
  };

  // Helper helper to calculate current weights inside companion
  const calculateTotalCompanionWeight = (c: TocaCreature): number => {
    let sum = 0;
    (c.compartimentos || []).forEach(comp => {
      (comp.itens || []).forEach(it => {
        const qty = Number(it.quantidade) || 1;
        const peso = getItemPeso(it);
        sum += peso * qty;
      });
    });
    (c.armas || []).forEach(w => sum += (Number(w.peso) || 0));
    (c.catalisadores || []).forEach(cat => sum += (Number(cat.peso) || 0));
    (c.armaduras || []).forEach(arm => sum += getArmorWeight(arm));
    (c.acessorios || []).forEach(a => sum += (Number(a.peso) || 0));
    return sum;
  };

  // Form handle actions list
  const handleAddNewAction = () => {
    if (!editingCreature || !newAction.name.trim()) return;
    const items = [...(editingCreature.acoes || [])];
    items.push({
      id: generateId(),
      ...newAction
    });
    setEditingCreature({ ...editingCreature, acoes: items });
    setNewAction({ name: "", type: "Major", categoria: "Corte", acerto: 10, dano: "1d6", description: "" });
    setShowAddAction(false);
  };

  const handleRemoveAction = (actionId: string) => {
    if (!editingCreature) return;
    setEditingCreature({
      ...editingCreature,
      acoes: (editingCreature.acoes || []).filter(a => a.id !== actionId)
    });
  };

  // Inventory handling inside TocaManager
  const handleCutCompItem = (
    item: any, 
    sourceId: string, 
    type: 'inventory' | 'weapon' | 'catalyst' | 'armor' | 'accessory'
  ) => {
    if (!editingCreature || !setCutItem) return;
    setCutItem({
      item,
      charId: activeChar.id,
      sourceId,
      type,
      companionId: editingCreature.id
    });
    if (showToast) showToast(`Item "${item.nome}" recortado da criatura! Pronto para mandar à mochila do personagem no menu abaixo.`, "info");
  };

  const handlePasteToCompanionCompartment = (compartmentId: string) => {
    if (!editingCreature || !cutItem) return;

    // We paste cutItem directly there
    const movedItem: Item = {
      ...cutItem.item,
      quantidade: Number(cutItem.item.quantidade) || 1,
      tipo: cutItem.type === 'weapon' ? 'Arma' 
            : cutItem.type === 'catalyst' ? 'Catalisador' 
            : cutItem.type === 'armor' ? 'Armadura' 
            : cutItem.type === 'accessory' ? 'Acessório' 
            : (cutItem.item.tipo || 'Item')
    };

    // Update locally in editingCreature
    const comps = (editingCreature.compartimentos || []).map(comp => {
      if (comp.id === compartmentId) {
        return {
          ...comp,
          itens: [...(comp.itens || []), movedItem]
        };
      }
      return comp;
    });

    // Remove item from source
    // If from same companion
    let updatedCreature = { ...editingCreature, compartimentos: comps };
    if (cutItem.companionId === editingCreature.id) {
      if (cutItem.type === 'weapon') {
        updatedCreature.armas = (updatedCreature.armas || []).filter(w => w.id !== cutItem.item.id);
      } else if (cutItem.type === 'catalyst') {
        updatedCreature.catalisadores = (updatedCreature.catalisadores || []).filter(c => c.id !== cutItem.item.id);
      } else if (cutItem.type === 'armor') {
        updatedCreature.armaduras = (updatedCreature.armaduras || []).filter(a => a.id !== cutItem.item.id);
      } else if (cutItem.type === 'accessory') {
        updatedCreature.acessorios = (updatedCreature.acessorios || []).filter(a => a.id !== cutItem.item.id);
      } else {
        updatedCreature.compartimentos = updatedCreature.compartimentos.map(comp => {
          if (comp.id === cutItem.sourceId) {
            return {
              ...comp,
              itens: (comp.itens || []).filter(it => it.id !== cutItem.item.id)
            };
          }
          return comp;
        });
      }
    } else {
      // It came from character! Update character sheet immediately
      updateChar(char => {
        const charUpdates: any = {};
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
        return charUpdates;
      });
    }

    setEditingCreature(updatedCreature);
    if (setCutItem) setCutItem(null);
    if (showToast) showToast(`Item "${movedItem.nome}" colado no compartimento!`, "success");
  };

  const handlePasteToCompanionEquipment = () => {
    if (!editingCreature || !cutItem) return;

    let targetType = cutItem.type;
    if (targetType === "inventory") {
      const companionItemTipo = cutItem.item.tipo || "";
      if (companionItemTipo === "Arma") targetType = "weapon";
      else if (companionItemTipo === "Catalisador") targetType = "catalyst";
      else if (companionItemTipo === "Armadura") targetType = "armor";
      else if (companionItemTipo === "Acessório" || companionItemTipo === "Acessórios") targetType = "accessory";
    }

    if (targetType === 'weapon' || targetType === 'catalyst') {
      if (showToast) showToast("Armas e Catalisadores devem ser guardados em compartimentos (bolsas/alforjes), não equipados na criatura!", "error");
      return;
    }

    const movedItem: any = {
      ...cutItem.item,
      quantidade: Number(cutItem.item.quantidade) || 1,
      tipo: targetType === 'weapon' ? 'Arma' 
            : targetType === 'catalyst' ? 'Catalisador' 
            : targetType === 'armor' ? 'Armadura' 
            : targetType === 'accessory' ? 'Acessório' 
            : (cutItem.item.tipo || 'Item')
    };

    let updatedCreature = { ...editingCreature };

    if (targetType === 'weapon') {
      updatedCreature.armas = [...(updatedCreature.armas || []), movedItem];
    } else if (targetType === 'catalyst') {
      updatedCreature.catalisadores = [...(updatedCreature.catalisadores || []), movedItem];
    } else if (targetType === 'armor') {
      updatedCreature.armaduras = [...(updatedCreature.armaduras || []), movedItem];
    } else if (targetType === 'accessory') {
      updatedCreature.acessorios = [...(updatedCreature.acessorios || []), movedItem];
    } else {
      if (showToast) showToast("Este item não é um equipamento válido para equipar!", "error");
      return;
    }

    // Remove from source companion if same
    if (cutItem.companionId === editingCreature.id) {
      if (cutItem.type === 'weapon') {
        updatedCreature.armas = (updatedCreature.armas || []).filter(w => w.id !== cutItem.item.id);
      } else if (cutItem.type === 'catalyst') {
        updatedCreature.catalisadores = (updatedCreature.catalisadores || []).filter(c => c.id !== cutItem.item.id);
      } else if (cutItem.type === 'armor') {
        updatedCreature.armaduras = (updatedCreature.armaduras || []).filter(a => a.id !== cutItem.item.id);
      } else if (cutItem.type === 'accessory') {
        updatedCreature.acessorios = (updatedCreature.acessorios || []).filter(a => a.id !== cutItem.item.id);
      } else {
        updatedCreature.compartimentos = (updatedCreature.compartimentos || []).map(comp => {
          if (comp.id === cutItem.sourceId) {
            return {
              ...comp,
              itens: (comp.itens || []).filter(it => it.id !== cutItem.item.id)
            };
          }
          return comp;
        });
      }
    } else {
      // It came from character! Update character sheet immediately to remove it
      updateChar(char => {
        const charUpdates: any = {};
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
        return charUpdates;
      });
    }

    setEditingCreature(updatedCreature);
    if (setCutItem) setCutItem(null);
    if (showToast) showToast(`Equipamento "${movedItem.nome}" equipado na criatura com sucesso!`, "success");
  };

  const handleAddNewInvItem = (target: string) => {
    if (!editingCreature || !newInvItem.nome?.trim()) return;
    const finalItem: Item = {
      id: generateId(),
      nome: newInvItem.nome,
      tipo: newInvItem.tipo || "Item",
      peso: Number(newInvItem.peso) || 0,
      volume: Number(newInvItem.volume) || 0,
      quantidade: Number(newInvItem.quantidade) || 1,
      durabilidade: Number(newInvItem.durabilidade) || 10,
      maxDurabilidade: Number(newInvItem.maxDurabilidade) || 10,
      descricao: newInvItem.descricao || ""
    };

    if (target === "weapon") {
      setEditingCreature({ ...editingCreature, armas: [...(editingCreature.armas || []), finalItem as any] });
    } else if (target === "armor") {
      setEditingCreature({ ...editingCreature, armaduras: [...(editingCreature.armaduras || []), finalItem as any] });
    } else if (target === "accessory") {
      setEditingCreature({ ...editingCreature, acessorios: [...(editingCreature.acessorios || []), finalItem as any] });
    } else if (target === "catalyst") {
      setEditingCreature({ ...editingCreature, catalisadores: [...(editingCreature.catalisadores || []), finalItem as any] });
    } else {
      // Must be a compartment ID
      const updatedComps = (editingCreature.compartimentos || []).map(comp => {
        if (comp.id === target) {
          return {
            ...comp,
            itens: [...(comp.itens || []), finalItem]
          };
        }
        return comp;
      });
      setEditingCreature({  ...editingCreature, compartimentos: updatedComps });
    }

    setNewInvItem({
      nome: "",
      tipo: "Item",
      peso: 10,
      volume: 1,
      quantidade: 1,
      durabilidade: 10,
      maxDurabilidade: 10,
      descricao: ""
    });
    setShowAddInCompanionInv(null);
  };

  const handleRemoveInvItem = (itemId: string, type: 'weapon' | 'armor' | 'accessory' | 'catalyst' | 'inventory', compId?: string) => {
    if (!editingCreature) return;
    
    if (type === 'weapon') {
      setEditingCreature({ ...editingCreature, armas: (editingCreature.armas || []).filter(w => w.id !== itemId) });
    } else if (type === 'armor') {
      setEditingCreature({ ...editingCreature, armaduras: (editingCreature.armaduras || []).filter(a => a.id !== itemId) });
    } else if (type === 'accessory') {
      setEditingCreature({ ...editingCreature, acessorios: (editingCreature.acessorios || []).filter(a => a.id !== itemId) });
    } else if (type === 'catalyst') {
      setEditingCreature({ ...editingCreature, catalisadores: (editingCreature.catalisadores || []).filter(c => c.id !== itemId) });
    } else {
      const updated = (editingCreature.compartimentos || []).map(c => {
        if (c.id === compId) {
          return {
            ...c,
            itens: (c.itens || []).filter(it => it.id !== itemId)
          };
        }
        return c;
      });
      setEditingCreature({ ...editingCreature, compartimentos: updated });
    }
  };

  const handleCreateCompartment = () => {
    if (!editingCreature) return;
    setAppPrompt({
      isOpen: true,
      title: "Criar Compartimento",
      defaultValue: "Bolsa Extra",
      placeholder: "Digite o nome da bolsa...",
      onConfirm: (name) => {
        if (!name?.trim()) return;
        const newComp: Compartment = {
          id: generateId(),
          nome: name.trim(),
          volumeMax: 50,
          itens: []
        };
        setEditingCreature({
          ...editingCreature,
          compartimentos: [...(editingCreature.compartimentos || []), newComp]
        });
        setAppPrompt(null);
      }
    });
  };

  const handleRemoveCompartment = (compId: string) => {
    if (!editingCreature) return;
    setAppConfirm({
      isOpen: true,
      title: "Remover Compartimento",
      message: "Deseja mesmo remover este compartimento? Todos e quaisquer itens guardados serão apagados.",
      onConfirm: () => {
        setEditingCreature({
          ...editingCreature,
          compartimentos: (editingCreature.compartimentos || []).filter(c => c.id !== compId)
        });
        setAppConfirm(null);
      }
    });
  };

  // Merge build-in system default monsters + user saved monsters from database
  const combinedBestiary = useMemo(() => {
    const rawList = [
      ...DEFAULT_MONSTERS.map(m => m as BestiaryMonster),
      ...customBestiary
    ];
    const unique: BestiaryMonster[] = [];
    const seen = new Set<string>();
    for (const m of rawList) {
      const nameKey = (m.name || "").toLowerCase().trim();
      if (!seen.has(nameKey)) {
        seen.add(nameKey);
        unique.push(m);
      }
    }
    return unique;
  }, [customBestiary]);

  const filteredBestiary = combinedBestiary.filter(m => 
    m.name?.toLowerCase().includes(bestiarySearch.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-xl font-bold text-amber-500 flex items-center gap-2">
            <PawPrint size={24} /> Toca das Criaturas
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">Gerencie os bichos, montarias, feras e companheiros de {activeChar.nome}.</p>
        </div>
        {!editingCreature && (
          <div className="flex flex-wrap gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsBestiaryModalOpen(true)}
              className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-amber-500 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              <BookOpen size={16} /> Bestiário
            </motion.button>
            
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleCreate}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Plus size={16} /> Criar Criatura
            </motion.button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Creature List Grid */}
        <div className={cn("space-y-3 animate-fade-in", editingCreature ? "lg:col-span-4" : "lg:col-span-12")}>
          {creatures.length === 0 ? (
            <div className="border border-zinc-800 bg-zinc-950/20 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3">
              <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-full text-zinc-500">
                <PawPrint size={32} />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-300">Sua toca está silenciosa...</p>
                <p className="text-xs text-zinc-500 mt-1">Sua alcateia, cavalos de carga, ou cães de caça ficarão guardados aqui.</p>
              </div>
              <div className="flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsBestiaryModalOpen(true)}
                  className="text-xs uppercase tracking-wider px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-amber-500 rounded-xl transition-colors cursor-pointer"
                >
                  Importar do Bestiário
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCreate}
                  className="text-xs uppercase tracking-wider px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl font-bold transition-all cursor-pointer"
                >
                  Criar do Zero
                </motion.button>
              </div>
            </div>
          ) : (
            <div className={cn("grid gap-3", editingCreature ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3")}>
              {creatures.map((creature) => {
                const isSelected = editingCreature?.id === creature.id;
                const totalPeso = calculateTotalCompanionWeight(creature);
                const isHeavy = totalPeso > (creature.carga || 200);

                return (
                  <div
                    key={creature.id}
                    className={cn(
                      "border rounded-2xl p-4 flex flex-col justify-between transition-all relative overflow-hidden backdrop-blur-md",
                      isSelected
                        ? "bg-amber-950/15 border-amber-500 shadow-md shadow-amber-500/5"
                        : "bg-zinc-900/20 border-zinc-800/80 hover:bg-zinc-900/40 hover:border-zinc-700"
                    )}
                  >
                    <div>
                      {/* Header */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {creature.imageUrl ? (
                            <img
                              src={creature.imageUrl}
                              alt={creature.name}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 object-cover bg-zinc-950 rounded-xl border border-zinc-800 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 flex items-center justify-center bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500 flex-shrink-0">
                              <PawPrint size={18} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm text-zinc-100 truncate">{creature.name}</h3>
                            <div className="flex items-center gap-1 text-[10px] text-zinc-405 font-mono mt-0.5">
                              <Heart size={10} className="text-red-500" />
                              <span>{creature.hpAtual}/{creature.maxHp} HP</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(creature)}
                            className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors"
                            title="Visualizar e Editar Equipamento/Ficha"
                          >
                            <ChevronRight size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(creature.id)}
                            className="p-1.5 hover:bg-red-950/35 text-zinc-500 hover:text-red-400 rounded-lg transition-colors"
                            title="Remover Companheiro"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Vital status modifiers without modif. Prefix */}
                      <div className="grid grid-cols-4 gap-1.5 py-2 border-t border-b border-zinc-800/30 my-2 font-mono text-center">
                        <div className="flex flex-col p-1 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                          <span className="text-[8px] text-zinc-500 font-bold uppercase block mb-0.5">Fome</span>
                          <span className={cn("text-[11px] font-black", creature.fome > 0 ? "text-orange-500" : "text-zinc-400")}>
                            {creature.fome >= 0 ? `+${creature.fome}` : creature.fome}
                          </span>
                        </div>
                        <div className="flex flex-col p-1 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                          <span className="text-[8px] text-zinc-500 font-bold uppercase block mb-0.5">Sede</span>
                          <span className={cn("text-[11px] font-black", creature.sede > 0 ? "text-cyan-500" : "text-zinc-400")}>
                            {creature.sede >= 0 ? `+${creature.sede}` : creature.sede}
                          </span>
                        </div>
                        <div className="flex flex-col p-1 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                          <span className="text-[8px] text-zinc-500 font-bold uppercase block mb-0.5">Clima</span>
                          <span className={cn("text-[11px] font-black", creature.clima > 0 ? "text-amber-500" : "text-zinc-400")}>
                            {creature.clima >= 0 ? `+${creature.clima}` : creature.clima}
                          </span>
                        </div>
                        <div className="flex flex-col p-1 bg-zinc-950/50 rounded-xl border border-zinc-800/50" title="Carga total colocada contra limite máximo">
                          <span className="text-[8px] text-zinc-500 font-bold uppercase block mb-0.5">Carga</span>
                          <span className={cn("text-[10px] font-black truncate leading-tight", isHeavy ? "text-red-500 font-extrabold" : "text-emerald-500")}>
                            {(totalPeso / 10).toFixed(1)}kg
                          </span>
                        </div>
                      </div>

                      {/* Attribute specs without 'modificador' */}
                      <div className="grid grid-cols-3 gap-1.5 text-[10px] text-zinc-400 mt-2 font-mono">
                        <div className="bg-zinc-950/30 p-1 rounded-lg border border-zinc-800/20 text-center">
                          <span className="text-[8px] text-zinc-500 font-bold block uppercase">Veloc.</span>
                          <span className="font-bold text-zinc-300 truncate block">{creature.deslocamento || "—"}</span>
                        </div>
                        <div className="bg-zinc-950/30 p-1 rounded-lg border border-zinc-800/20 text-center">
                          <span className="text-[8px] text-zinc-500 font-bold block uppercase">Esquiva</span>
                          <span className="font-bold text-zinc-300">+{creature.esquiva}</span>
                        </div>
                        <div className="bg-zinc-950/30 p-1 rounded-lg border border-zinc-800/20 text-center">
                          <span className="text-[8px] text-zinc-500 font-bold block uppercase">Acurácia</span>
                          <span className="font-bold text-zinc-300">+{creature.acuracia}</span>
                        </div>
                      </div>

                      {/* Climate Debuffs Overview */}
                      {getCompanionClimateEffects(creature.clima).length > 0 && (
                        <div className="mt-2.5 space-y-1 font-sans text-[9px]">
                          {getCompanionClimateEffects(creature.clima).map((effect, idx) => (
                            <div key={idx} className="text-[9px] leading-tight text-red-400 bg-red-550/5 p-1.5 rounded-lg border border-red-500/15 flex gap-1 items-start">
                              <Activity size={8} className="shrink-0 mt-0.5 text-red-500" />
                              <span>{effect}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Full Sheet Button */}
                      {onEditCreatureSheet && (
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.98 }}
                          onClick={() => onEditCreatureSheet(creature.id)}
                          className="w-full mt-3 flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-amber-500/10"
                        >
                          <BookOpen size={12} /> Abrir Ficha Completa
                        </motion.button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Tabbed Interactive Form Editor */}
        <AnimatePresence>
          {editingCreature && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="lg:col-span-8 bg-zinc-950/30 border border-zinc-800 rounded-2xl p-5 md:p-6 space-y-6 backdrop-blur-lg"
            >
              {/* Card Header Title */}
              <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <PawPrint size={18} className="text-amber-500" />
                  <h3 className="font-black text-sm uppercase text-amber-500">
                    {isAdding ? "Modelar Novo Companheiro" : `Painel de Ficha: ${editingCreature.name}`}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {!isAdding && onEditCreatureSheet && (
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onEditCreatureSheet(editingCreature.id)}
                      className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-amber-500/10"
                    >
                      <BookOpen size={12} /> Ficha Completa
                    </motion.button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingCreature(null)}
                    className="p-1 hover:bg-zinc-900 rounded-lg text-zinc-500 hover:text-zinc-200 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Form Navigation Tabs */}
              <div className="flex border-b border-zinc-850 gap-1 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveFormTab("attributes")}
                  className={cn(
                    "px-4 py-2 text-[10px] uppercase tracking-widest font-black border-b-2 transition-all cursor-pointer whitespace-nowrap",
                    activeFormTab === "attributes" 
                      ? "border-amber-500 text-amber-500 bg-amber-500/5 rounded-t-xl" 
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Atributos & Vitalidade
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFormTab("combat")}
                  className={cn(
                    "px-4 py-2 text-[10px] uppercase tracking-widest font-black border-b-2 transition-all cursor-pointer whitespace-nowrap",
                    activeFormTab === "combat" 
                      ? "border-amber-500 text-amber-500 bg-amber-500/5 rounded-t-xl" 
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Níveis & Ataques
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFormTab("equipment")}
                  className={cn(
                    "px-4 py-2 text-[10px] uppercase tracking-widest font-black border-b-2 transition-all cursor-pointer whitespace-nowrap",
                    activeFormTab === "equipment" 
                      ? "border-amber-500 text-amber-500 bg-amber-500/5 rounded-t-xl" 
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Equipamentos
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFormTab("compartments")}
                  className={cn(
                    "px-4 py-2 text-[10px] uppercase tracking-widest font-black border-b-2 transition-all cursor-pointer whitespace-nowrap",
                    activeFormTab === "compartments" 
                      ? "border-amber-500 text-amber-500 bg-amber-500/5 rounded-t-xl" 
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Compartimentos
                </button>
              </div>

              {/* Tab Content Box */}
              <div className="space-y-6">
                {/* 1. Attributes & Survival Fields */}
                {activeFormTab === "attributes" && (
                  <div className="space-y-5 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Name input & HP parameters */}
                      <div className="md:col-span-2 space-y-4">
                        <TocaInput
                          label="Nome da Criatura"
                          value={editingCreature.name || ""}
                          type="text"
                          onChange={(v) => setEditingCreature({ ...editingCreature, name: v })}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <TocaInput
                            label="Hp Máximo"
                            value={editingCreature.maxHp}
                            onChange={(v) => setEditingCreature({ ...editingCreature, maxHp: v, hpAtual: editingCreature.hpAtual || v })}
                          />
                          <TocaInput
                            label="Hp Atual"
                            value={editingCreature.hpAtual ?? editingCreature.maxHp}
                            onChange={(v) => setEditingCreature({ ...editingCreature, hpAtual: v })}
                          />
                        </div>
                      </div>

                      {/* Avatar Photo Logo File Upload/Card instead of URL input */}
                      <div className="flex flex-col justify-between gap-2 p-3 bg-zinc-900 border border-zinc-800 rounded-xl relative min-h-[110px]">
                        <span className="text-[9px] text-zinc-500 font-extrabold uppercase tracking-wider block">Imagem do Companheiro</span>
                        {editingCreature.imageUrl ? (
                          <div className="relative group w-full h-[62px] rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950">
                            <img
                              src={editingCreature.imageUrl}
                              alt="Preview"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => setEditingCreature({ ...editingCreature, imageUrl: "" })}
                              className="absolute top-1 right-1 p-1 bg-black/70 rounded-full text-zinc-300 hover:text-white transition-colors"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ) : (
                          <label className="border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 rounded-xl p-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all hover:bg-zinc-900/40">
                            <ImageIcon size={18} className="text-zinc-500" />
                            <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider text-center">Selecionar arquivo</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = async (event) => {
                                  try {
                                    const result = event.target?.result as string;
                                    const compressed = await compressImageDataUrl(result, 512, 0.7);
                                    setEditingCreature({ ...editingCreature, imageUrl: compressed });
                                  } catch (error) {
                                    console.error("Erro ao comprimir imagem:", error);
                                    setEditingCreature({ ...editingCreature, imageUrl: event.target?.result as string });
                                  }
                                };
                                reader.readAsDataURL(file);
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Fome, Sede, Clima, Carga (Without 'modif.' prefixes - fully clean labels!) */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-amber-500/80 uppercase tracking-widest flex items-center gap-1.5 border-b border-zinc-800/60 pb-1.5">
                        <Activity size={14} className="text-orange-500" /> Parâmetros Vitais
                      </h4>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-zinc-900/40 p-2.5 border border-zinc-800 rounded-xl flex flex-col justify-between">
                          <label className="text-[9px] font-black text-orange-400 uppercase tracking-wider mb-1 block flex items-center gap-1">
                            <Utensils size={10} /> Fome
                          </label>
                          <input
                            type="number"
                            placeholder="+0"
                            className="w-full bg-transparent text-white font-mono text-xs font-bold focus:outline-none focus:ring-0 p-0 border-0"
                            value={editingCreature.fome ?? ""}
                            onChange={(e) => setEditingCreature({ ...editingCreature, fome: (e.target.value === "" ? "" : (parseInt(e.target.value) || 0)) as any })}
                          />
                        </div>
                        
                        <div className="bg-zinc-900/40 p-2.5 border border-zinc-800 rounded-xl flex flex-col justify-between">
                          <label className="text-[9px] font-black text-cyan-400 uppercase tracking-wider mb-1 block flex items-center gap-1">
                            <Droplets size={10} /> Sede
                          </label>
                          <input
                            type="number"
                            placeholder="+0"
                            className="w-full bg-transparent text-white font-mono text-xs font-bold focus:outline-none focus:ring-0 p-0 border-0"
                            value={editingCreature.sede ?? ""}
                            onChange={(e) => setEditingCreature({ ...editingCreature, sede: (e.target.value === "" ? "" : (parseInt(e.target.value) || 0)) as any })}
                          />
                        </div>

                        <div className="bg-zinc-900/40 p-2.5 border border-zinc-800 rounded-xl flex flex-col justify-between" title="Força máxima limite de carga que a criatura sustenta.">
                          <label className="text-[9px] font-black text-emerald-400 uppercase tracking-wider mb-1 block flex items-center gap-1">
                            <Weight size={10} /> limite de Carga (kg)
                          </label>
                          <input
                            type="number"
                            placeholder="Ex: 20"
                            className="w-full bg-transparent text-white font-mono text-xs font-bold focus:outline-none focus:ring-0 p-0 border-0"
                            value={(editingCreature.carga !== undefined && editingCreature.carga !== null && typeof editingCreature.carga === "number") ? (editingCreature.carga / 10) : ""}
                            onChange={(e) => setEditingCreature({ ...editingCreature, carga: (e.target.value === "" ? "" : Math.round((parseFloat(e.target.value) || 0) * 10)) as any })}
                          />
                        </div>
                      </div>

                      {/* Climate (Clima) Interactive Slider and Debuffs */}
                      <div className="bg-zinc-900/40 p-3.5 border border-zinc-800 rounded-xl space-y-3">
                        <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase">
                          <span className="flex items-center gap-1.5 font-sans">
                            <Sun size={14} className="text-amber-550" />
                            Funcionamento de Clima
                          </span>
                          <span className={cn(editingCreature.clima > 0 ? "text-orange-400" : editingCreature.clima < 0 ? "text-blue-400" : "text-zinc-400")}>
                            {editingCreature.clima > 0 ? `+${editingCreature.clima}` : editingCreature.clima}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setEditingCreature({ ...editingCreature, clima: Math.max(-10, (editingCreature.clima || 0) - 1) })}
                            className="p-1.5 hover:bg-zinc-850 rounded text-blue-400 transition-colors cursor-pointer"
                          >
                            <Minus size={16} />
                          </motion.button>
                          <div className="relative flex-1 h-1.5 flex items-center">
                            <input
                              type="range"
                              min="-10"
                              max="10"
                              step="1"
                              value={editingCreature.clima || 0}
                              onChange={(e) => setEditingCreature({ ...editingCreature, clima: parseInt(e.target.value) })}
                              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-white"
                              style={{ background: `linear-gradient(to right, #3b82f6 0%, #27272a 50%, #ef4444 100%)` }}
                            />
                          </div>
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setEditingCreature({ ...editingCreature, clima: Math.min(10, (editingCreature.clima || 0) + 1) })}
                            className="p-1.5 hover:bg-zinc-850 rounded text-red-500 transition-colors cursor-pointer"
                          >
                            <Plus size={16} />
                          </motion.button>
                        </div>
                        <div className="flex justify-between text-[8px] text-zinc-650 font-extrabold px-8">
                          <span>FRIO (-10)</span>
                          <span>NORMAL (0)</span>
                          <span>CALOR (+10)</span>
                        </div>
                        {getCompanionClimateEffects(editingCreature.clima).length > 0 && (
                          <div className="mt-2 space-y-1">
                            {getCompanionClimateEffects(editingCreature.clima).map((effect, idx) => (
                              <div key={idx} className="text-[9px] leading-tight text-red-400 bg-red-400/10 p-2 rounded border border-red-400/20 flex gap-1.5 items-start">
                                <Activity size={10} className="shrink-0 mt-0.5" />
                                <span>{effect}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Extra descriptions text areas */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest border-b border-zinc-800/60 pb-1.5 flex items-center gap-1.5">
                        <BookOpen size={14} /> Detalhes Biográficos & Notas
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                        <div className="flex flex-col bg-zinc-900/20 border border-zinc-800 p-2.5 rounded-xl">
                          <span className="text-[9px] text-zinc-500 font-extrabold uppercase mb-1">Local de Origem / Habitat</span>
                          <input
                            type="text"
                            placeholder="ex: Pântanos de Cinzas"
                            className="bg-transparent font-bold border-0 p-0 focus:ring-0 text-white w-full text-xs"
                            value={editingCreature.local || ""}
                            onChange={(e) => setEditingCreature({ ...editingCreature, local: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col bg-zinc-900/20 border border-zinc-800 p-2.5 rounded-xl">
                          <span className="text-[9px] text-zinc-500 font-extrabold uppercase mb-1">Personalidade</span>
                          <input
                            type="text"
                            placeholder="ex: Doce, leal mas agressiva com estranhos"
                            className="bg-transparent font-bold border-0 p-0 focus:ring-0 text-white w-full text-xs"
                            value={editingCreature.personalidade || ""}
                            onChange={(e) => setEditingCreature({ ...editingCreature, personalidade: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col bg-zinc-900/20 border border-zinc-800 p-2.5 rounded-xl md:col-span-2">
                          <span className="text-[9px] text-zinc-500 font-extrabold uppercase mb-1">Gosta / Não Gosta</span>
                          <input
                            type="text"
                            placeholder="ex: Carne fresca, dormir perto da fogueira / Barulhos estridentes"
                            className="bg-transparent font-bold border-0 p-0 focus:ring-0 text-white w-full text-xs"
                            value={editingCreature.gostaNaoGosta || ""}
                            onChange={(e) => setEditingCreature({ ...editingCreature, gostaNaoGosta: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col bg-zinc-900/20 border border-zinc-800 p-2.5 rounded-xl md:col-span-2">
                          <span className="text-[9px] text-zinc-500 font-extrabold uppercase mb-1">Informações Adicionais</span>
                          <textarea
                            rows={3}
                            placeholder="Instruções adicionais ou observações..."
                            className="bg-transparent border-0 p-0 focus:ring-0 text-zinc-300 w-full text-xs mt-1 resize-none"
                            value={editingCreature.informacoes || ""}
                            onChange={(e) => setEditingCreature({ ...editingCreature, informacoes: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Combat Levels & Actions Tab */}
                {activeFormTab === "combat" && (
                  <div className="space-y-6 animate-fade-in">
                    {/* Basic specs without "modificador" suffix */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <TocaInput
                        label="Deslocamento / Velocidade"
                        type="text"
                        value={editingCreature.deslocamento || "4 metros"}
                        onChange={(v) => setEditingCreature({ ...editingCreature, deslocamento: v })}
                      />
                      <TocaInput
                        label="Esquiva"
                        value={editingCreature.esquiva}
                        onChange={(v) => setEditingCreature({ ...editingCreature, esquiva: v })}
                      />
                      <TocaInput
                        label="Acurácia"
                        value={editingCreature.acuracia}
                        onChange={(v) => setEditingCreature({ ...editingCreature, acuracia: v })}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Attack slots */}
                      <div className="bg-zinc-900/20 p-4 border border-zinc-800 rounded-xl space-y-3">
                        <div className="text-[10px] font-black text-red-500 uppercase tracking-widest border-b border-red-500/20 pb-1 flex items-center justify-between">
                          <span>Níveis de Ataque</span>
                          <Swords size={12} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {(Object.keys(editingCreature.ataque || {}) as Array<keyof typeof editingCreature.ataque>).map((key) => (
                            <div key={key} className="flex justify-between items-center bg-zinc-950/40 px-2 py-1.5 rounded-lg border border-zinc-800/40">
                              <span className="capitalize font-mono text-zinc-500 text-[10px]">{key}</span>
                              <input
                                type="number"
                                value={editingCreature.ataque[key] ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? "" : (parseInt(e.target.value) || 0);
                                  setEditingCreature({
                                    ...editingCreature,
                                    ataque: { ...editingCreature.ataque, [key]: val }
                                  });
                                }}
                                className="w-10 bg-transparent text-right text-xs text-white font-bold font-mono focus:outline-none p-0 border-0"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Defense slots */}
                      <div className="bg-zinc-900/20 p-4 border border-zinc-800 rounded-xl space-y-3">
                        <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest border-b border-blue-400/20 pb-1 flex items-center justify-between">
                          <span>Níveis de Defesa</span>
                          <Shield size={12} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {(Object.keys(editingCreature.defesa || {}) as Array<keyof typeof editingCreature.defesa>).map((key) => (
                            <div key={key} className="flex justify-between items-center bg-zinc-950/40 px-2 py-1.5 rounded-lg border border-zinc-800/40">
                              <span className="capitalize font-mono text-zinc-500 text-[10px]">{key}</span>
                              <input
                                type="number"
                                value={editingCreature.defesa[key] ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value === "" ? "" : (parseInt(e.target.value) || 0);
                                  setEditingCreature({
                                    ...editingCreature,
                                    defesa: { ...editingCreature.defesa, [key]: val }
                                  });
                                }}
                                className="w-10 bg-transparent text-right text-xs text-white font-bold font-mono focus:outline-none p-0 border-0"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Action attacks manager */}
                    <div className="space-y-3 bg-zinc-900/10 border border-zinc-800 p-4 rounded-xl">
                      <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                        <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider flex items-center gap-1.5">
                          <ClipboardList size={14} /> Lista de Ações / Ataques
                        </h4>
                        <button
                          type="button"
                          onClick={() => setShowAddAction(!showAddAction)}
                          className="flex items-center gap-1 text-[10px] uppercase font-black tracking-widest px-2.5 py-1 bg-amber-500 text-zinc-950 rounded-lg hover:bg-amber-400 cursor-pointer transition-all"
                        >
                          <Plus size={12} /> {showAddAction ? "Fechar" : "Inserir"}
                        </button>
                      </div>

                      {showAddAction && (
                        <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3 animate-fade-in font-mono text-xs">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div className="flex flex-col bg-zinc-950 px-2 py-1.5 rounded-lg border border-zinc-800">
                              <span className="text-[8px] text-zinc-500 font-bold uppercase">Nome do Ataque</span>
                              <input
                                type="text"
                                placeholder="ex: Mordida de Fogo"
                                className="bg-transparent border-0 p-0 text-white font-bold w-full text-xs mt-0.5 focus:ring-0"
                                value={newAction.name}
                                onChange={(e) => setNewAction({ ...newAction, name: e.target.value })}
                              />
                            </div>
                            <div className="flex flex-col bg-zinc-950 px-2 py-1.5 rounded-lg border border-zinc-800">
                              <span className="text-[8px] text-zinc-500 font-bold uppercase">Tipo</span>
                              <select
                                className="bg-transparent border-0 p-0 text-white font-black w-full text-xs mt-0.5 focus:ring-0 cursor-pointer bg-zinc-950"
                                value={newAction.type}
                                onChange={(e) => setNewAction({ ...newAction, type: e.target.value as any })}
                              >
                                <option value="Major" className="bg-zinc-950">Ação Maior</option>
                                <option value="Minor" className="bg-zinc-950">Ação Menor</option>
                                <option value="Passive" className="bg-zinc-950">Passiva</option>
                              </select>
                            </div>
                            <div className="flex flex-col bg-zinc-950 px-2 py-1.5 rounded-lg border border-zinc-800">
                              <span className="text-[8px] text-zinc-500 font-bold uppercase">Dado de Dano + Bônus</span>
                              <input
                                type="text"
                                placeholder="ex: 2d6+4 Fogo"
                                className="bg-transparent border-0 p-0 text-white font-bold w-full text-xs mt-0.5 focus:ring-0"
                                value={newAction.dano}
                                onChange={(e) => setNewAction({ ...newAction, dano: e.target.value })}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="flex flex-col bg-zinc-950 px-2 py-1.5 rounded-lg border border-zinc-800">
                              <span className="text-[8px] text-zinc-500 font-bold uppercase">Acerto Base (Nível)</span>
                              <input
                                type="number"
                                className="bg-transparent border-0 p-0 text-white font-bold w-full text-xs mt-0.5 focus:ring-0"
                                value={newAction.acerto ?? ""}
                                onChange={(e) => setNewAction({ ...newAction, acerto: e.target.value === "" ? "" : (parseInt(e.target.value) || 0) })}
                              />
                            </div>
                            <div className="flex flex-col bg-zinc-950 px-2 py-1.5 rounded-lg border border-zinc-800">
                              <span className="text-[8px] text-zinc-500 font-bold uppercase">Categoria de Dano</span>
                              <select
                                className="bg-transparent border-0 p-0 text-white font-black w-full text-xs mt-0.5 focus:ring-0 cursor-pointer bg-zinc-950"
                                value={newAction.categoria}
                                onChange={(e) => setNewAction({ ...newAction, categoria: e.target.value as any })}
                              >
                                <option value="Corte" className="bg-zinc-950">Corte</option>
                                <option value="Perfuração" className="bg-zinc-950">Perfuração</option>
                                <option value="Impacto" className="bg-zinc-950">Impacto</option>
                                <option value="Elemental" className="bg-zinc-950">Elemental</option>
                                <option value="Feitiço" className="bg-zinc-950">Feitiço</option>
                                <option value="Magia Negra" className="bg-zinc-950">Magia Negra</option>
                                <option value="Outro" className="bg-zinc-950">Outro</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex flex-col bg-zinc-950 px-2 py-1.5 rounded-lg border border-zinc-800">
                            <span className="text-[8px] text-zinc-500 font-bold uppercase">Efeito Extra / Descrição</span>
                            <input
                              type="text"
                              placeholder="ex: Causa Queimadura. Acerto diminui com deslocamento."
                              className="bg-transparent border-0 p-0 text-white font-medium w-full text-xs mt-0.5 focus:ring-0"
                              value={newAction.description}
                              onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={handleAddNewAction}
                            className="w-full py-2 bg-amber-500 text-zinc-950 font-black rounded-lg uppercase tracking-wider text-[10px] hover:bg-amber-400"
                          >
                            Salvar Ataque na Ficha
                          </button>
                        </div>
                      )}

                      {/* Display Action rows */}
                      <div className="space-y-1.5">
                        {(editingCreature.acoes || []).length === 0 ? (
                          <p className="text-center font-mono text-[10px] text-zinc-600 py-3">Nenhum ataque cadastrado para esta criatura.</p>
                        ) : (
                          (editingCreature.acoes || []).map((act) => (
                            <div key={act.id} className="flex justify-between items-center bg-zinc-950/40 p-2 border border-zinc-800/60 rounded-xl">
                              <div className="font-mono">
                                <p className="text-xs font-black text-white">{act.name} <span className="text-[9px] px-1.5 py-0.5 bg-zinc-900 rounded-full text-zinc-500 ml-1 border border-zinc-800 uppercase font-black">{act.type}</span></p>
                                <p className="text-[10px] text-zinc-400 mt-1">Dano: <strong className="text-red-400">{act.dano}</strong> | Categoria: <strong>{act.categoria}</strong> | Acerto: <strong>{act.acerto} ACC</strong></p>
                                {act.description && <p className="text-[10px] text-zinc-500 italic mt-0.5">{act.description}</p>}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveAction(act.id)}
                                className="p-1.5 hover:bg-red-950/20 text-zinc-500 hover:text-red-400 rounded-xl transition-all"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {activeFormTab === "equipment" && (
                  <div className="space-y-6 animate-fade-in font-sans">
                    {/* Weight Capacity Progress Bar */}
                    {(() => {
                      const totalPeso = calculateTotalCompanionWeight(editingCreature);
                      const maxCapacity = editingCreature.carga || 200;
                      const percentage = Math.min(100, (totalPeso / maxCapacity) * 100);
                      const isOverloaded = totalPeso > maxCapacity;

                      return (
                        <div className="bg-zinc-900/30 border border-zinc-800 p-4 rounded-xl space-y-2">
                          <div className="flex justify-between text-xs font-bold text-zinc-400">
                            <span className="flex items-center gap-1.5 align-middle select-none">
                              <Weight size={14} className={isOverloaded ? "text-red-500" : "text-emerald-500"} />
                              Limitação de Carga Física
                            </span>
                            <span className={cn("font-bold font-mono", isOverloaded ? "text-red-500" : "text-emerald-500")}>
                              {(totalPeso / 10).toFixed(1)} / {(maxCapacity / 10).toFixed(1)} kg ({percentage.toFixed(0)}%)
                            </span>
                          </div>
                          
                          <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800/80">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-300", 
                                isOverloaded ? "bg-red-500" : "bg-emerald-500"
                              )}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          {isOverloaded && (
                            <p className="text-[10px] text-red-500/85 font-black uppercase text-center mt-1 animate-pulse">⚠️ Criatura Sobrecarregada! Penalidades de locomoção são aplicadas.</p>
                          )}
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 align-top">
                      <div className="space-y-3 font-sans">
                        <div className="flex justify-between items-center bg-zinc-950/25 px-3 py-2 rounded-lg border border-zinc-800/60 shadow-sm">
                          <span className="text-[10px] text-zinc-400 font-extrabold flex items-center gap-1.5 uppercase"><Shield size={13} className="text-blue-500" /> Armaduras</span>
                          <div className="flex gap-1.5">
                            {cutItem && (cutItem.type === "armor" || (cutItem.type === "inventory" && cutItem.item.tipo === "Armadura")) && (
                              <button
                                type="button"
                                onClick={handlePasteToCompanionEquipment}
                                className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded border border-emerald-500/35 text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                              >
                                Colar Armadura
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCreature({
                                  ...editingCreature,
                                  armaduras: [
                                    ...(editingCreature.armaduras || []),
                                    {
                                      id: generateId(),
                                      nome: "Nova Armadura",
                                      corte: 0,
                                      impacto: 0,
                                      perfuracao: 0,
                                      durabilidade: 10,
                                      peso: 20,
                                      volume: 1,
                                      reducaoDano: 0,
                                      efeito: "",
                                    }
                                  ]
                                });
                              }}
                              className="px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded text-[9px] uppercase font-black transition-colors border border-amber-500/20 cursor-pointer"
                            >
                              + Adicionar
                            </button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {(editingCreature.armaduras || []).length === 0 ? (
                            <p className="text-center text-[10px] text-zinc-655 py-3 border border-zinc-800/40 rounded-lg">Nenhuma armadura equipada no momento.</p>
                          ) : (
                            (editingCreature.armaduras || []).map((arm, index) => (
                              <div key={arm.id} className="bg-zinc-900/30 p-3 rounded-xl border border-zinc-800 text-xs relative group space-y-2">
                                <div className="flex justify-between items-center">
                                  <input
                                    value={arm.nome || ""}
                                    onChange={(e) => {
                                      const newName = e.target.value;
                                      const updatedArms = [...(editingCreature.armaduras || [])];
                                      updatedArms[index] = { ...updatedArms[index], nome: newName };
                                      setEditingCreature({ ...editingCreature, armaduras: updatedArms });
                                    }}
                                    className="bg-transparent font-bold focus:outline-none flex-1 min-w-0 text-amber-500 p-0 border-0 text-xs focus:ring-0"
                                  />
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleCutCompItem(arm, 'equipment', 'armor')}
                                      className="text-zinc-500 hover:text-amber-500 p-1 rounded transition-colors cursor-pointer"
                                      title="Recortar Armadura"
                                    >
                                      <Scissors size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveInvItem(arm.id, 'armor')}
                                      className="text-zinc-655 hover:text-red-500 p-1 rounded transition-colors cursor-pointer"
                                      title="Excluir Armadura"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>

                                <ArmorProperties
                                  item={arm}
                                  onChange={(updates) => {
                                    const updatedArms = [...(editingCreature.armaduras || [])];
                                    updatedArms[index] = { ...updatedArms[index], ...updates };
                                    setEditingCreature({ ...editingCreature, armaduras: updatedArms });
                                  }}
                                />
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Acessórios Equipados */}
                      <div className="space-y-3 font-sans">
                        <div className="flex justify-between items-center bg-zinc-950/25 px-3 py-2 rounded-lg border border-zinc-800/60 shadow-sm">
                          <span className="text-[10px] text-zinc-400 font-extrabold flex items-center gap-1.5 uppercase"><Gem size={13} className="text-amber-500" /> Acessórios</span>
                          <div className="flex gap-1.5">
                            {cutItem && (cutItem.type === "accessory" || (cutItem.type === "inventory" && (cutItem.item.tipo === "Acessório" || cutItem.item.tipo === "Acessórios"))) && (
                              <button
                                type="button"
                                onClick={handlePasteToCompanionEquipment}
                                className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded border border-emerald-500/35 text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                              >
                                Colar Acessório
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCreature({
                                  ...editingCreature,
                                  acessorios: [
                                    ...(editingCreature.acessorios || []),
                                    {
                                      id: generateId(),
                                      nome: "Novo Acessório",
                                      corte: 0,
                                      impacto: 0,
                                      perfuracao: 0,
                                      durabilidade: 10,
                                      peso: 2,
                                      volume: 1,
                                      reducaoDano: 0,
                                      efeito: "",
                                    }
                                  ]
                                });
                              }}
                              className="px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded text-[9px] uppercase font-black transition-colors border border-amber-500/20 cursor-pointer"
                            >
                              + Adicionar
                            </button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {(editingCreature.acessorios || []).length === 0 ? (
                            <p className="text-center text-[10px] text-zinc-650 py-3 border border-zinc-800/40 rounded-lg">Nenhum acessório equipado no momento.</p>
                          ) : (
                            (editingCreature.acessorios || []).map((ac, index) => (
                              <div key={ac.id} className="bg-zinc-900/30 p-3 rounded-xl border border-zinc-800 text-xs relative group space-y-2">
                                <div className="flex justify-between items-center">
                                  <input
                                    value={ac.nome || ""}
                                    onChange={(e) => {
                                      const newName = e.target.value;
                                      const updatedAcs = [...(editingCreature.acessorios || [])];
                                      updatedAcs[index] = { ...updatedAcs[index], nome: newName };
                                      setEditingCreature({ ...editingCreature, acessorios: updatedAcs });
                                    }}
                                    className="bg-transparent font-bold focus:outline-none flex-1 min-w-0 text-amber-500 p-0 border-0 text-xs focus:ring-0"
                                  />
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleCutCompItem(ac, 'equipment', 'accessory')}
                                      className="text-zinc-500 hover:text-amber-500 p-1 rounded transition-colors cursor-pointer"
                                      title="Recortar Acessório"
                                    >
                                      <Scissors size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveInvItem(ac.id, 'accessory')}
                                      className="text-zinc-650 hover:text-red-500 p-1 rounded transition-colors cursor-pointer"
                                      title="Excluir Acessório"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>

                                <ArmorProperties
                                  item={{ ...ac, tipo: "Acessório" }}
                                  onChange={(updates) => {
                                    const updatedAcs = [...(editingCreature.acessorios || [])];
                                    updatedAcs[index] = { ...updatedAcs[index], ...updates };
                                    setEditingCreature({ ...editingCreature, acessorios: updatedAcs });
                                  }}
                                />
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {/* 3. Compartments & Carry Equipment Tab */}
                {activeFormTab === "compartments" && (
                  <div className="space-y-6 animate-fade-in font-sans">
                    
                    {/* Weight Capacity Progress Bar */}
                    {(() => {
                      const totalPeso = calculateTotalCompanionWeight(editingCreature);
                      const maxCapacity = editingCreature.carga || 200;
                      const percentage = Math.min(100, (totalPeso / maxCapacity) * 100);
                      const isOverloaded = totalPeso > maxCapacity;

                      return (
                        <div className="bg-zinc-900/30 border border-zinc-800 p-4 rounded-xl space-y-2">
                          <div className="flex justify-between text-xs font-bold text-zinc-400">
                            <span className="flex items-center gap-1.5 select-none font-mono">
                              <Weight size={14} className={isOverloaded ? "text-red-500" : "text-emerald-500"} />
                              Limitação de Carga Física
                            </span>
                            <span className={cn("font-bold font-mono", isOverloaded ? "text-red-500" : "text-emerald-500")}>
                              {(totalPeso / 10).toFixed(1)} / {(maxCapacity / 10).toFixed(1)} kg ({percentage.toFixed(0)}%)
                            </span>
                          </div>
                          
                          <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800/80">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-300", 
                                isOverloaded ? "bg-red-500" : "bg-emerald-500"
                              )}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          {isOverloaded && (
                            <p className="text-[10px] text-red-500/85 font-black uppercase text-center mt-1 animate-pulse">⚠️ Criatura Sobrecarregada! Penalidades de locomoção são aplicadas.</p>
                          )}
                        </div>
                      );
                    })()}

                    {/* Quick Inventory Paster */}
                    {cutItem && (
                      <div className="bg-amber-500/5 border border-dashed border-amber-500/30 p-3 rounded-xl flex items-center justify-between text-xs">
                        <p className="text-zinc-300">
                          📋 Item pronto na área: <strong>{cutItem.item.nome}</strong> 
                          {cutItem.companionId === editingCreature.id ? " (Desta criatura)" : ""}
                        </p>
                        <span className="text-[9px] bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Pronto para Colar</span>
                      </div>
                    )}

                    {/* Compartment Boxes (Alforges ou Bolsas do companheiro) */}
                    <div className="space-y-3.5">
                      <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                        <span className="text-[10px] font-black uppercase text-zinc-400 flex items-center gap-1.5 tracking-wider select-none">
                          <Package size={14} className="text-emerald-500" /> Compartimentos de Bagagem (Bolsas, Selas, Alforjes)
                        </span>
                        <button
                          type="button"
                          onClick={handleCreateCompartment}
                          className="flex items-center gap-1 text-[9px] uppercase font-extrabold tracking-widest px-2.5 py-1 bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 rounded-lg text-amber-500 cursor-pointer"
                        >
                          <Plus size={12} /> + Sacola
                        </button>
                      </div>

                      <div className="space-y-4">
                        {(editingCreature.compartimentos || []).length === 0 ? (
                          <p className="text-center text-[10px] text-zinc-650 py-6 border border-dashed border-zinc-800 rounded-xl font-mono">Sem compartimentos de bagagem. Adicione uma Sacola/Alforje clicando no botão acima.</p>
                        ) : (
                          (editingCreature.compartimentos || []).map((comp, cIdx) => {
                            const compVolume = (comp.itens || []).reduce(
                              (acc, it) => acc + getItemVolume(it) * (it.quantidade || 1),
                              0
                            );

                            return (
                              <div key={comp.id} className="bg-zinc-900/20 border border-zinc-800/80 rounded-xl overflow-hidden space-y-2">
                                {/* Cabecalho do Compartimento */}
                                <div className="bg-zinc-950/45 px-3 py-2 border-b border-zinc-800/60 flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2 flex-1 min-w-[150px]">
                                    <Package size={14} className="text-amber-500 shrink-0" />
                                    <input
                                      value={comp.nome}
                                      onChange={(e) => {
                                        const newName = e.target.value;
                                        const updated = (editingCreature.compartimentos || []).map((c, idx) =>
                                          idx === cIdx ? { ...c, nome: newName } : c
                                        );
                                        setEditingCreature({ ...editingCreature, compartimentos: updated });
                                      }}
                                      className="bg-transparent text-xs font-black focus:outline-none flex-1 min-w-0 text-amber-500 uppercase tracking-tight focus:ring-0 border-0 p-0"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {cutItem && (
                                      <button
                                        type="button"
                                        onClick={() => handlePasteToCompanionCompartment(comp.id)}
                                        className="px-2 py-0.5 bg-amber-500 text-zinc-950 font-black text-[9px] uppercase rounded-md hover:bg-amber-400 cursor-pointer"
                                      >
                                        Colar Item
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCompartment(comp.id)}
                                      className="text-red-500 hover:text-red-400 p-1 rounded transition-colors cursor-pointer"
                                      title="Apagar Compartimento"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>

                                {/* Informações de Limites */}
                                <div className="px-3 py-1.5 flex items-center justify-between border-b border-zinc-800/40 gap-2 flex-wrap text-[10px] text-zinc-400">
                                  <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={!!comp.externo}
                                        onChange={(e) => {
                                          const isChecked = e.target.checked;
                                          const updated = (editingCreature.compartimentos || []).map((c, idx) =>
                                            idx === cIdx ? { ...c, externo: isChecked } : c
                                          );
                                          setEditingCreature({ ...editingCreature, compartimentos: updated });
                                        }}
                                        className="rounded border-zinc-800 bg-zinc-950 text-amber-500 focus:ring-amber-500/50 h-3.5 w-3.5"
                                      />
                                      <span className="font-extrabold uppercase tracking-wider text-[8px] text-zinc-500 hover:text-zinc-455 transition-colors">
                                        Externo (Sela/Alforje Externo)
                                      </span>
                                    </label>
                                  </div>
                                  <div className="flex items-center gap-1.5 font-bold font-mono">
                                    <span>Vol Máx:</span>
                                    <input
                                      type="number"
                                      value={comp.volumeMax ?? ""}
                                      onChange={(e) => {
                                        const vol = e.target.value === "" ? "" : (parseInt(e.target.value) || 0);
                                        const updated = (editingCreature.compartimentos || []).map((c, idx) =>
                                          idx === cIdx ? { ...c, volumeMax: vol as any } : c
                                        );
                                        setEditingCreature({ ...editingCreature, compartimentos: updated });
                                      }}
                                      className="bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-center w-10 text-amber-400 font-bold font-mono focus:outline-none text-[10px]"
                                    />
                                    <span className="text-zinc-500 ml-1">
                                      Ocupado: {compVolume.toFixed(1)} / {comp.volumeMax || 10}
                                    </span>
                                  </div>
                                </div>

                                {/* Botões para Adicionar Itens de tipos específicos */}
                                <div className="px-3 pt-1 flex gap-1.5 flex-wrap">
                                  <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                      const newItens = [
                                        ...(comp.itens || []),
                                        {
                                          id: generateId(),
                                          nome: "Novo Item de Utilidade",
                                          peso: 1,
                                          volume: 1,
                                          quantidade: 1,
                                          tipo: "Item Geral",
                                          durabilidade: 0,
                                          maxDurabilidade: 0,
                                          descricao: "",
                                        }
                                      ];
                                      setEditingCreature({
                                        ...editingCreature,
                                        compartimentos: (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: newItens } : c)
                                      });
                                    }}
                                    className="px-2 py-1 bg-zinc-950 border border-zinc-800/80 rounded text-[8px] font-black uppercase text-zinc-400 hover:border-amber-500/50 hover:text-amber-500 transition-all cursor-pointer"
                                  >
                                    + Item
                                  </motion.button>
                                  <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                      const newItens = [
                                        ...(comp.itens || []),
                                        {
                                          id: generateId(),
                                          nome: "Nova Arma de Bagagem",
                                          peso: 10,
                                          volume: 2,
                                          quantidade: 1,
                                          tipo: "Arma",
                                          durabilidade: 10,
                                          maxDurabilidade: 10,
                                          descricao: "",
                                          dano: "1d6",
                                          acerto: 0,
                                          escala: "0",
                                          atributoBase: "Força",
                                          corte: 0,
                                          impacto: 0,
                                          perfuracao: 0,
                                          resistencia: 0,
                                        }
                                      ];
                                      setEditingCreature({
                                        ...editingCreature,
                                        compartimentos: (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: newItens } : c)
                                      });
                                    }}
                                    className="px-2 py-1 bg-zinc-950 border border-zinc-800/80 rounded text-[8px] font-black uppercase text-zinc-400 hover:border-amber-500/50 hover:text-amber-500 transition-all cursor-pointer"
                                  >
                                    + Arma
                                  </motion.button>
                                  <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                      const newItens = [
                                        ...(comp.itens || []),
                                        {
                                          id: generateId(),
                                          nome: "Novo Catalisador",
                                          peso: 5,
                                          volume: 1,
                                          quantidade: 1,
                                          tipo: "Catalisador",
                                          durabilidade: 10,
                                          maxDurabilidade: 10,
                                          descricao: "",
                                          escala: "0",
                                          atributoBase: "Inteligência",
                                          feitico: 0,
                                          elemental: 0,
                                          magiaNegra: 0,
                                          potencial: 0,
                                        }
                                      ];
                                      setEditingCreature({
                                        ...editingCreature,
                                        compartimentos: (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: newItens } : c)
                                      });
                                    }}
                                    className="px-2 py-1 bg-zinc-950 border border-zinc-800/80 rounded text-[8px] font-black uppercase text-zinc-400 hover:border-amber-500/50 hover:text-amber-500 transition-all cursor-pointer"
                                  >
                                    + Cat
                                  </motion.button>
                                  <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                      const newItens = [
                                        ...(comp.itens || []),
                                        {
                                          id: generateId(),
                                          nome: "Armadura Bagagem",
                                          peso: 20,
                                          volume: 2,
                                          quantidade: 1,
                                          tipo: "Armadura",
                                          durabilidade: 10,
                                          maxDurabilidade: 10,
                                          descricao: "",
                                          corte: 0,
                                          impacto: 0,
                                          perfuracao: 0,
                                          reducaoDano: 0,
                                          efeito: "",
                                        }
                                      ];
                                      setEditingCreature({
                                        ...editingCreature,
                                        compartimentos: (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: newItens } : c)
                                      });
                                    }}
                                    className="px-2 py-1 bg-zinc-950 border border-zinc-800/80 rounded text-[8px] font-black uppercase text-zinc-400 hover:border-amber-500/50 hover:text-amber-500 transition-all cursor-pointer"
                                  >
                                    + Armad
                                  </motion.button>
                                  <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                      const newItens = [
                                        ...(comp.itens || []),
                                        {
                                          id: generateId(),
                                          nome: "Projéteis de Munição",
                                          peso: 0.1,
                                          volume: 0.2,
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
                                      setEditingCreature({
                                        ...editingCreature,
                                        compartimentos: (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: newItens } : c)
                                      });
                                    }}
                                    className="px-2 py-1 bg-zinc-950 border border-zinc-800/80 rounded text-[8px] font-black uppercase text-zinc-400 hover:border-amber-500/50 hover:text-amber-500 transition-all cursor-pointer"
                                  >
                                    + Mun
                                  </motion.button>
                                </div>

                                {/* Seções de Itens (SubSections Accordions) */}
                                <div className="px-3 pb-3 pt-1 space-y-2">
                                  {(comp.itens || []).length === 0 ? (
                                    <p className="text-center text-[10px] text-zinc-700 py-3 font-mono">Sem itens guardados nesta sacola.</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {/* 1. Category ARMAs */}
                                      <SubSection title="Armas" icon={<Sword size={14} className="text-amber-500" />}>
                                        {(comp.itens || []).map((item, iIdx) => item.tipo === "Arma" ? (
                                          <div key={item.id} className="bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-850/80 space-y-2">
                                            <div className="flex justify-between items-center gap-2">
                                              <input
                                                value={item.nome}
                                                onChange={(e) => {
                                                  const newName = e.target.value;
                                                  const updated = (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: (c.itens || []).map(it => it.id === item.id ? { ...it, nome: newName } : it) } : c);
                                                  setEditingCreature({ ...editingCreature, compartimentos: updated });
                                                }}
                                                className="bg-transparent font-bold text-xs focus:outline-none text-zinc-100 flex-1 min-w-0 border-0 p-0 focus:ring-0"
                                              />
                                              <div className="flex items-center gap-1 flex-shrink-0">
                                                <motion.button
                                                  type="button"
                                                  whileTap={{ scale: 0.95 }}
                                                  onClick={() => handleCutCompItem(item, comp.id, 'inventory')}
                                                  className="text-zinc-500 hover:text-amber-500 p-1 rounded"
                                                  title="Recortar"
                                                >
                                                  <Scissors size={14} />
                                                </motion.button>
                                                <motion.button
                                                  type="button"
                                                  whileTap={{ scale: 0.95 }}
                                                  onClick={() => {
                                                    const updated = (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: (c.itens || []).filter(it => it.id !== item.id) } : c);
                                                    setEditingCreature({ ...editingCreature, compartimentos: updated });
                                                  }}
                                                  className="text-red-500 p-1 rounded hover:text-red-400"
                                                  title="Excluir"
                                                >
                                                  <Trash2 size={14} />
                                                </motion.button>
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                              <MiniInput
                                                label="Qtd"
                                                type="number"
                                                value={item.quantidade ?? ""}
                                                onChange={(v) => {
                                                  const val = v === "" ? "" : (parseInt(v) || 1);
                                                  const updated = (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: (c.itens || []).map(it => it.id === item.id ? { ...it, quantidade: val as any } : it) } : c);
                                                  setEditingCreature({ ...editingCreature, compartimentos: updated });
                                                }}
                                              />
                                              <div className="flex flex-col">
                                                <span className="text-[9px] text-zinc-650 uppercase font-black">Total</span>
                                                <span className="text-xs font-bold text-zinc-400 font-mono">{((getItemPeso(item) * (Number(item.quantidade) || 0)) / 10).toFixed(1)}kg</span>
                                              </div>
                                            </div>
                                            <WeaponProperties
                                              item={item}
                                              character={editingCreature}
                                              updateCharacter={(updater) => {
                                                setEditingCreature((prev: any) => {
                                                  const res = typeof updater === "function" ? updater(prev) : updater;
                                                  return {
                                                    ...prev,
                                                    compartimentos: res.compartimentos || prev.compartimentos,
                                                  };
                                                });
                                              }}
                                              onChange={(updates) => {
                                                const updated = (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: (c.itens || []).map(it => it.id === item.id ? { ...it, ...updates } : it) } : c);
                                                setEditingCreature({ ...editingCreature, compartimentos: updated });
                                              }}
                                            />
                                          </div>
                                        ) : null)}
                                      </SubSection>

                                      {/* 2. Category CATALISADORes */}
                                      <SubSection title="Catalisadores" icon={<Wand size={14} className="text-purple-500" />}>
                                        {(comp.itens || []).map((item, iIdx) => item.tipo === "Catalisador" ? (
                                          <div key={item.id} className="bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-850/80 space-y-2">
                                            <div className="flex justify-between items-center gap-2">
                                              <input
                                                value={item.nome}
                                                onChange={(e) => {
                                                  const newName = e.target.value;
                                                  const updated = (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: (c.itens || []).map(it => it.id === item.id ? { ...it, nome: newName } : it) } : c);
                                                  setEditingCreature({ ...editingCreature, compartimentos: updated });
                                                }}
                                                className="bg-transparent font-bold text-xs focus:outline-none text-zinc-100 flex-1 min-w-0 border-0 p-0 focus:ring-0"
                                              />
                                              <div className="flex items-center gap-1 flex-shrink-0">
                                                <motion.button
                                                  type="button"
                                                  whileTap={{ scale: 0.95 }}
                                                  onClick={() => handleCutCompItem(item, comp.id, 'inventory')}
                                                  className="text-zinc-500 hover:text-amber-500 p-1 rounded"
                                                  title="Recortar"
                                                >
                                                  <Scissors size={14} />
                                                </motion.button>
                                                <motion.button
                                                  type="button"
                                                  whileTap={{ scale: 0.95 }}
                                                  onClick={() => {
                                                    const updated = (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: (c.itens || []).filter(it => it.id !== item.id) } : c);
                                                    setEditingCreature({ ...editingCreature, compartimentos: updated });
                                                  }}
                                                  className="text-red-500 p-1 rounded hover:text-red-400"
                                                  title="Excluir"
                                                >
                                                  <Trash2 size={14} />
                                                </motion.button>
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                              <MiniInput
                                                label="Qtd"
                                                type="number"
                                                value={item.quantidade ?? ""}
                                                onChange={(v) => {
                                                  const val = v === "" ? "" : (parseInt(v) || 1);
                                                  const updated = (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: (c.itens || []).map(it => it.id === item.id ? { ...it, quantidade: val as any } : it) } : c);
                                                  setEditingCreature({ ...editingCreature, compartimentos: updated });
                                                }}
                                              />
                                              <div className="flex flex-col">
                                                <span className="text-[9px] text-zinc-650 uppercase font-black">Total</span>
                                                <span className="text-xs font-bold text-zinc-400 font-mono">{((getItemPeso(item) * (Number(item.quantidade) || 0)) / 10).toFixed(1)}kg</span>
                                              </div>
                                            </div>
                                            <CatalystProperties
                                              item={item}
                                              onChange={(updates) => {
                                                const updated = (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: (c.itens || []).map(it => it.id === item.id ? { ...it, ...updates } : it) } : c);
                                                setEditingCreature({ ...editingCreature, compartimentos: updated });
                                              }}
                                            />
                                          </div>
                                        ) : null)}
                                      </SubSection>

                                      {/* 3. Category ARMADURAs */}
                                      <SubSection title="Armaduras" icon={<Shield size={14} className="text-blue-500" />}>
                                        {(comp.itens || []).map((item, iIdx) => item.tipo === "Armadura" ? (
                                          <div key={item.id} className="bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-850/80 space-y-2">
                                            <div className="flex justify-between items-center gap-2">
                                              <input
                                                value={item.nome}
                                                onChange={(e) => {
                                                  const newName = e.target.value;
                                                  const updated = (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: (c.itens || []).map(it => it.id === item.id ? { ...it, nome: newName } : it) } : c);
                                                  setEditingCreature({ ...editingCreature, compartimentos: updated });
                                                }}
                                                className="bg-transparent font-bold text-xs focus:outline-none text-zinc-100 flex-1 min-w-0 border-0 p-0 focus:ring-0"
                                              />
                                              <div className="flex items-center gap-1 flex-shrink-0">
                                                <motion.button
                                                  type="button"
                                                  whileTap={{ scale: 0.95 }}
                                                  onClick={() => handleCutCompItem(item, comp.id, 'inventory')}
                                                  className="text-zinc-500 hover:text-amber-500 p-1 rounded"
                                                  title="Recortar"
                                                >
                                                  <Scissors size={14} />
                                                </motion.button>
                                                <motion.button
                                                  type="button"
                                                  whileTap={{ scale: 0.95 }}
                                                  onClick={() => {
                                                    const updated = (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: (c.itens || []).filter(it => it.id !== item.id) } : c);
                                                    setEditingCreature({ ...editingCreature, compartimentos: updated });
                                                  }}
                                                  className="text-red-500 p-1 rounded hover:text-red-400"
                                                  title="Excluir"
                                                >
                                                  <Trash2 size={14} />
                                                </motion.button>
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                              <MiniInput
                                                label="Qtd"
                                                type="number"
                                                value={item.quantidade ?? ""}
                                                onChange={(v) => {
                                                  const val = v === "" ? "" : (parseInt(v) || 1);
                                                  const updated = (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: (c.itens || []).map(it => it.id === item.id ? { ...it, quantidade: val as any } : it) } : c);
                                                  setEditingCreature({ ...editingCreature, compartimentos: updated });
                                                }}
                                              />
                                              <div className="flex flex-col">
                                                <span className="text-[9px] text-zinc-650 uppercase font-black">Total</span>
                                                <span className="text-xs font-bold text-zinc-400 font-mono">{((getItemPeso(item) * (Number(item.quantidade) || 0)) / 10).toFixed(1)}kg</span>
                                              </div>
                                            </div>
                                            <ArmorProperties
                                              item={item}
                                              onChange={(updates) => {
                                                const updated = (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: (c.itens || []).map(it => it.id === item.id ? { ...it, ...updates } : it) } : c);
                                                setEditingCreature({ ...editingCreature, compartimentos: updated });
                                              }}
                                            />
                                          </div>
                                        ) : null)}
                                      </SubSection>

                                      {/* 4. Category MUNIÇÕEs */}
                                      <SubSection title="Munições" icon={<Disc size={14} className="text-teal-500" />}>
                                        {(comp.itens || []).map((item, iIdx) => item.tipo === "Munição" ? (
                                          <div key={item.id} className="bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-850/80 space-y-2">
                                            <div className="flex justify-between items-center gap-2">
                                              <input
                                                value={item.nome}
                                                onChange={(e) => {
                                                  const newName = e.target.value;
                                                  const updated = (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: (c.itens || []).map(it => it.id === item.id ? { ...it, nome: newName } : it) } : c);
                                                  setEditingCreature({ ...editingCreature, compartimentos: updated });
                                                }}
                                                className="bg-transparent font-bold text-xs focus:outline-none text-zinc-100 flex-1 min-w-0 border-0 p-0 focus:ring-0"
                                              />
                                              <div className="flex items-center gap-1 flex-shrink-0">
                                                <motion.button
                                                  type="button"
                                                  whileTap={{ scale: 0.95 }}
                                                  onClick={() => handleCutCompItem(item, comp.id, 'inventory')}
                                                  className="text-zinc-500 hover:text-amber-500 p-1 rounded"
                                                  title="Recortar"
                                                >
                                                  <Scissors size={14} />
                                                </motion.button>
                                                <motion.button
                                                  type="button"
                                                  whileTap={{ scale: 0.95 }}
                                                  onClick={() => {
                                                    const updated = (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: (c.itens || []).filter(it => it.id !== item.id) } : c);
                                                    setEditingCreature({ ...editingCreature, compartimentos: updated });
                                                  }}
                                                  className="text-red-500 p-1 rounded hover:text-red-400"
                                                  title="Excluir"
                                                >
                                                  <Trash2 size={14} />
                                                </motion.button>
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                              <MiniInput
                                                label="Qtd"
                                                type="number"
                                                value={item.quantidade ?? ""}
                                                onChange={(v) => {
                                                  const val = v === "" ? "" : (parseInt(v) || 1);
                                                  const updated = (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: (c.itens || []).map(it => it.id === item.id ? { ...it, quantidade: val as any } : it) } : c);
                                                  setEditingCreature({ ...editingCreature, compartimentos: updated });
                                                }}
                                              />
                                              <div className="flex flex-col">
                                                <span className="text-[9px] text-zinc-650 uppercase font-black">Total</span>
                                                <span className="text-xs font-bold text-zinc-400 font-mono">{((getItemPeso(item) * (Number(item.quantidade) || 0)) / 10).toFixed(1)}kg</span>
                                              </div>
                                            </div>
                                            <AmmunitionProperties
                                              item={item}
                                              onChange={(updates) => {
                                                const updated = (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: (c.itens || []).map(it => it.id === item.id ? { ...it, ...updates } : it) } : c);
                                                setEditingCreature({ ...editingCreature, compartimentos: updated });
                                              }}
                                            />
                                          </div>
                                        ) : null)}
                                      </SubSection>

                                      {/* 5. Category OUTROS ITENS */}
                                      <SubSection title="Outros Itens" icon={<Package size={14} className="text-emerald-500" />}>
                                        {(comp.itens || []).map((item, iIdx) => (item.tipo !== "Arma" && item.tipo !== "Catalisador" && item.tipo !== "Armadura" && item.tipo !== "Munição") ? (
                                          <div key={item.id} className="bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-850/80 space-y-2">
                                            <div className="flex justify-between items-center gap-2">
                                              <input
                                                value={item.nome}
                                                onChange={(e) => {
                                                  const newName = e.target.value;
                                                  const updated = (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: (c.itens || []).map(it => it.id === item.id ? { ...it, nome: newName } : it) } : c);
                                                  setEditingCreature({ ...editingCreature, compartimentos: updated });
                                                }}
                                                className="bg-transparent font-bold text-xs focus:outline-none text-zinc-100 flex-1 min-w-0 border-0 p-0 focus:ring-0"
                                              />
                                              <div className="flex items-center gap-1 flex-shrink-0">
                                                <motion.button
                                                  type="button"
                                                  whileTap={{ scale: 0.95 }}
                                                  onClick={() => handleCutCompItem(item, comp.id, 'inventory')}
                                                  className="text-zinc-500 hover:text-amber-500 p-1 rounded"
                                                  title="Recortar"
                                                >
                                                  <Scissors size={14} />
                                                </motion.button>
                                                <motion.button
                                                  type="button"
                                                  whileTap={{ scale: 0.95 }}
                                                  onClick={() => {
                                                    const updated = (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: (c.itens || []).filter(it => it.id !== item.id) } : c);
                                                    setEditingCreature({ ...editingCreature, compartimentos: updated });
                                                  }}
                                                  className="text-red-500 p-1 rounded hover:text-red-400"
                                                  title="Excluir"
                                                >
                                                  <Trash2 size={14} />
                                                </motion.button>
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                              <MiniInput
                                                label="Qtd"
                                                type="number"
                                                value={item.quantidade ?? ""}
                                                onChange={(v) => {
                                                  const val = v === "" ? "" : (parseInt(v) || 1);
                                                  const updated = (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: (c.itens || []).map(it => it.id === item.id ? { ...it, quantidade: val as any } : it) } : c);
                                                  setEditingCreature({ ...editingCreature, compartimentos: updated });
                                                }}
                                              />
                                              <MiniInput
                                                label="Peso (Un)"
                                                type="number"
                                                value={item.peso ?? ""}
                                                onChange={(v) => {
                                                  const val = v === "" ? "" : (parseFloat(v) || 0);
                                                  const updated = (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: (c.itens || []).map(it => it.id === item.id ? { ...it, peso: val as any } : it) } : c);
                                                  setEditingCreature({ ...editingCreature, compartimentos: updated });
                                                }}
                                              />
                                              <MiniInput
                                                label="Vol (Un)"
                                                type="number"
                                                value={item.volume ?? ""}
                                                onChange={(v) => {
                                                  const val = v === "" ? "" : (parseFloat(v) || 0);
                                                  const updated = (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: (c.itens || []).map(it => it.id === item.id ? { ...it, volume: val as any } : it) } : c);
                                                  setEditingCreature({ ...editingCreature, compartimentos: updated });
                                                }}
                                              />
                                              <div className="flex flex-col font-sans">
                                                <span className="text-[9px] text-zinc-650 uppercase font-black">Total</span>
                                                <span className="text-xs font-bold text-zinc-400 font-mono">{((getItemPeso(item) * (Number(item.quantidade) || 0)) / 10).toFixed(1)}kg</span>
                                              </div>
                                            </div>
                                            <div className="col-span-4 mt-1">
                                              <TextArea
                                                label="Descrição / Efeito"
                                                value={item.descricao || item.efeito || ""}
                                                onChange={(v) => {
                                                  const updated = (editingCreature.compartimentos || []).map((c, idx) => idx === cIdx ? { ...c, itens: (c.itens || []).map(it => it.id === item.id ? { ...it, descricao: v, efeito: v } : it) } : c);
                                                  setEditingCreature({ ...editingCreature, compartimentos: updated });
                                                }}
                                              />
                                            </div>
                                          </div>
                                        ) : null)}
                                      </SubSection>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Botões de Ação Final - Salvar ou Cancelar */}
              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingCreature(null)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer text-zinc-400"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/10 cursor-pointer flex items-center gap-1.5"
                >
                  <Save size={14} />
                  <span>Salvar na Toca</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. Bestiary Monsters Catalog Picker Modal */}
      <AnimatePresence>
        {isBestiaryModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in font-mono">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col p-5 shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                <h3 className="font-black text-sm uppercase text-amber-500 flex items-center gap-1.5">
                  <BookOpen size={16} /> Importar Base do Bestiário
                </h3>
                <button 
                  onClick={() => setIsBestiaryModalOpen(false)}
                  className="text-zinc-500 hover:text-white p-1"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Search input field */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Pesquisar fera ou demônio na base..."
                  className="w-full bg-zinc-900 border border-zinc-800/80 rounded-xl pl-9 pr-4 py-2 font-mono text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={bestiarySearch}
                  onChange={(e) => setBestiarySearch(e.target.value)}
                />
              </div>

              {/* Monsters scrolling rows list */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[50vh]">
                {filteredBestiary.length === 0 ? (
                  <p className="text-center text-zinc-500 text-xs py-10 uppercase">Sem resultados para a busca.</p>
                ) : (
                  filteredBestiary.map((monster) => (
                    <div 
                      key={monster.id || monster.name}
                      className="border border-zinc-805 bg-zinc-900/10 rounded-xl p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-zinc-900/25 transition-all text-xs"
                    >
                      <div className="flex items-center gap-3.5">
                        {monster.imageUrl ? (
                          <img 
                            src={monster.imageUrl} 
                            alt={monster.name} 
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 object-cover bg-zinc-950 rounded-xl border border-zinc-800"
                          />
                        ) : (
                          <div className="w-11 h-11 flex items-center justify-center bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-600">
                            <Skull size={18} />
                          </div>
                        )}
                        <div>
                          <h4 className="font-bold text-zinc-100 text-sm uppercase">{monster.name}</h4>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <span className="text-[9px] px-1.5 py-0.5 bg-red-950/20 text-red-500 border border-red-950/25 rounded-md font-black uppercase text-[8px]">{monster.maxHp} HP</span>
                            <span className="text-[9px] px-1.5 py-0.5 bg-amber-950/20 text-amber-500 border border-amber-950/25 rounded-md font-black uppercase text-[8px]">{monster.acuracia} ACC</span>
                            {monster.deslocamento && <span className="text-[9px] px-1.5 py-0.5 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-md uppercase text-[8px]">{monster.deslocamento}</span>}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectFromBestiary(monster)}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black uppercase text-[9px] rounded-xl tracking-wider transition-all cursor-pointer whitespace-nowrap self-end sm:self-center"
                      >
                        Importar p/ Toca
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom appConfirm Dialog in TocaManager */}
      <AnimatePresence>
        {appConfirm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[10000] font-sans">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border border-zinc-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl space-y-4"
            >
              <h3 className="font-black text-sm uppercase text-amber-500 flex items-center gap-1.5 border-b border-zinc-800/60 pb-2">
                {appConfirm.title}
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed font-semibold">
                {appConfirm.message}
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAppConfirm(null)}
                  className="px-3.5 py-2 bg-zinc-900 border border-zinc-805 hover:bg-zinc-850 rounded-xl text-[10px] font-black uppercase tracking-wider text-zinc-400 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => appConfirm.onConfirm()}
                  className="px-4 py-2 bg-red-650 hover:bg-red-650/85 rounded-xl text-[10px] font-black uppercase tracking-wider text-white transition-all cursor-pointer shadow-lg shadow-red-950/20"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom appPrompt Dialog in TocaManager */}
      <AnimatePresence>
        {appPrompt && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[10000] font-sans">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border border-zinc-805 p-6 rounded-2xl max-w-sm w-full shadow-2xl space-y-4"
            >
              <h3 className="font-black text-sm uppercase text-amber-500 border-b border-zinc-850 pb-2">
                {appPrompt.title}
              </h3>
              <div className="space-y-1.5">
                <input
                  id="custom-app-prompt-input"
                  type="text"
                  defaultValue={appPrompt.defaultValue}
                  placeholder={appPrompt.placeholder}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold font-sans"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = (e.currentTarget as HTMLInputElement).value || "";
                      appPrompt.onConfirm(val);
                    }
                  }}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAppPrompt(null)}
                  className="px-3.5 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 rounded-xl text-[10px] font-black uppercase tracking-wider text-zinc-400 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const inputVal = (document.getElementById("custom-app-prompt-input") as HTMLInputElement)?.value || "";
                    appPrompt.onConfirm(inputVal);
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-amber-500/10"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});
