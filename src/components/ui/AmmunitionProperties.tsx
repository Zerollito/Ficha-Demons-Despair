import React from "react";
import { motion } from "motion/react";
import { MiniInput } from "./MiniInput";
import { TextArea } from "./Input";

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

export const AmmunitionProperties = React.memo(({
  item,
  onChange,
}: {
  item: any;
  onChange: (updates: any) => void;
}) => {
  const templates = [
    { name: 'Bala', weight: 0, vol: 0 },
    { name: 'Flecha (A. Curto)', weight: 0.5, vol: 0.9 },
    { name: 'Flecha (A. Longo)', weight: 0.6, vol: 1.3 },
  ];

  return (
    <div className="space-y-1.5 pt-1 border-t border-zinc-800/40">
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[7.5px] text-zinc-500 font-bold uppercase tracking-wider mr-0.5">Presets:</span>
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
            className="px-1.5 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-[7.5px] font-bold text-zinc-300 border border-zinc-700/60 transition-colors cursor-pointer"
          >
            {tmp.name}
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-1">
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
          label="Corte" 
          value={item.corte ?? ""} 
          type="number" 
          onChange={(v) => onChange({ corte: safeParseInt(v) })} 
        />
        <MiniInput 
          label="Res." 
          value={item.resistencia ?? ""} 
          type="number" 
          onChange={(v) => onChange({ resistencia: safeParseInt(v) })} 
        />
        <MiniInput 
          label="Qtd" 
          value={item.quantidade ?? ""} 
          type="number" 
          onChange={(v) => onChange({ quantidade: safeParseInt(v, 1) })} 
        />
      </div>

      <div className="grid grid-cols-2 gap-1">
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
      </div>

      <TextArea 
        label="Descrição" 
        value={item.descricao || item.efeito || ""} 
        onChange={(v) => onChange({ descricao: v, efeito: v })} 
      />
    </div>
  );
});
