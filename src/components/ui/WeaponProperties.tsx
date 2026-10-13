import React from 'react';
import { MiniInput } from './MiniInput';
import { TextArea } from './Input';

interface WeaponPropertiesProps {
  item: any;
  onChange: (updates: any) => void;
  character?: any;
  updateCharacter?: any;
  onReload?: (ammoId: string, all?: boolean) => void;
  onMaintenance?: () => void;
}

export function WeaponProperties({ item, onChange, character, updateCharacter, onReload, onMaintenance }: WeaponPropertiesProps) {
  const [selectedAmmoId, setSelectedAmmoId] = React.useState<string | null>(null);

  const ammoItems = React.useMemo(() => {
    if (!character) return [];
    return character.compartimentos?.flatMap((c: any) => c.itens || [])
      .filter((i: any) => {
        const lowerTipo = (i.tipo || "").toLowerCase();
        return lowerTipo === 'munição' || lowerTipo === 'municao';
      }) || [];
  }, [character]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <MiniInput label="Dano" value={item.dano || '0'} onChange={v => onChange({ dano: v })} />
        <MiniInput label="Acerto" value={item.acerto || 0} type="number" onChange={v => onChange({ acerto: parseInt(v) || 0 })} />
        <MiniInput label="Escala" value={item.escala ?? ''} onChange={v => onChange({ escala: v })} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MiniInput label="Corte" value={item.corte || 0} type="number" onChange={v => onChange({ corte: parseInt(v) || 0 })} />
        <MiniInput label="Impacto" value={item.impacto || 0} type="number" onChange={v => onChange({ impacto: parseInt(v) || 0 })} />
        <MiniInput label="Perf." value={item.perfuracao || 0} type="number" onChange={v => onChange({ perfuracao: parseInt(v) || 0 })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniInput label="Resist." value={item.resistencia || 0} type="number" onChange={v => onChange({ resistencia: parseInt(v) || 0 })} />
        <MiniInput label="Durab." value={item.durabilidade || 0} type="number" onChange={v => onChange({ durabilidade: parseInt(v) || 0 })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniInput label="Peso (x100g)" value={item.peso || 0} type="number" onChange={v => onChange({ peso: parseFloat(v) || 0 })} />
        <MiniInput label="Vol" value={item.volume || 0} type="number" onChange={v => onChange({ volume: parseFloat(v) || 0 })} />
      </div>
      <TextArea label="Descrição" value={item.descricao || item.efeito || ''} onChange={v => onChange({ descricao: v, efeito: v })} />
      {item.categoria === "Arma de Fogo" && (
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <select 
            className="w-full bg-zinc-900 text-zinc-300 text-[10px] p-1 rounded border border-zinc-700"
            value={selectedAmmoId || ""}
            onChange={(e) => setSelectedAmmoId(e.target.value)}
          >
            <option value="">Selecione a munição...</option>
            {ammoItems.map((a: any) => (
              <option key={a.id} value={a.id}>{a.nome} ({a.quantidade}x)</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button 
              onClick={() => onReload?.(selectedAmmoId)} 
              disabled={!selectedAmmoId}
              className="flex-1 bg-amber-500/10 text-amber-500 text-[10px] font-bold py-1 rounded hover:bg-amber-500/20 disabled:opacity-30"
            >
              +1
            </button>
            <button 
              onClick={() => onMaintenance?.()} 
              className="flex-1 bg-zinc-800 text-zinc-300 text-[10px] font-bold py-1 rounded hover:bg-zinc-700"
            >
              Manutenção
            </button>
            <button 
              onClick={() => onReload?.(selectedAmmoId, true)} 
              disabled={!selectedAmmoId}
              className="flex-1 bg-amber-600 text-white text-[10px] font-bold py-1 rounded hover:bg-amber-500 disabled:opacity-30"
            >
              Tudo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
