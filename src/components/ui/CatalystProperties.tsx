import React from "react";
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

export const CatalystProperties = React.memo(({
  item,
  onChange,
}: {
  item: any;
  onChange: (updates: any) => void;
}) => {
  return (
    <div className="space-y-1.5 pt-1 border-t border-zinc-800">
      <div className="bg-zinc-950/40 px-2 py-1 rounded border border-zinc-800/60 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
            Escala:
          </span>
          <select
            value={item.escala || "0"}
            onChange={(e) => onChange({ escala: e.target.value })}
            className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-xs text-amber-500 font-bold focus:outline-none"
          >
            <option value="0">0</option>
            <option value="D">D</option>
            <option value="C">C</option>
            <option value="B">B</option>
            <option value="A">A</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
            Bônus:
          </span>
          <span className="text-xs font-bold text-amber-500 font-mono">
            {item.bonus || 0}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
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
      <div className="grid grid-cols-3 gap-1.5">
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
