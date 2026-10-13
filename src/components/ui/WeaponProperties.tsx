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
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MiniInput label="Dano" value={item.dano || '0'} onChange={v => onChange({ dano: v })} />
        <MiniInput label="Acerto" value={item.acerto || 0} type="number" onChange={v => onChange({ acerto: parseInt(v) || 0 })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-bold text-zinc-500 uppercase">Escala</label>
          <select 
            className="bg-zinc-900 border border-zinc-700 text-zinc-300 rounded p-1.5 text-xs"
            value={item.escala || '0'}
            onChange={(e) => onChange({ escala: e.target.value })}
          >
            {['0', 'D', 'C', 'B', 'A'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-bold text-zinc-500 uppercase">Atributo</label>
          <select 
            className="bg-zinc-900 border border-zinc-700 text-zinc-300 rounded p-1.5 text-xs"
            value={item.atributoBase || 'Força'}
            onChange={(e) => onChange({ atributoBase: e.target.value })}
          >
            {['Força', 'Destreza', 'Inteligência', 'Ritual'].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <MiniInput label="Corte" value={item.corte || 0} type="number" onChange={v => onChange({ corte: parseInt(v) || 0 })} />
        <MiniInput label="Impacto" value={item.impacto || 0} type="number" onChange={v => onChange({ impacto: parseInt(v) || 0 })} />
        <MiniInput label="Perf." value={item.perfuracao || 0} type="number" onChange={v => onChange({ perfuracao: parseInt(v) || 0 })} />
        <MiniInput label="Res." value={item.resistencia || 0} type="number" onChange={v => onChange({ resistencia: parseInt(v) || 0 })} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MiniInput label="Durab." value={item.durabilidade || 0} type="number" onChange={v => onChange({ durabilidade: parseInt(v) || 0 })} />
        <MiniInput label="Peso (x100g)" value={item.peso || 0} type="number" onChange={v => onChange({ peso: parseFloat(v) || 0 })} />
        <MiniInput label="Vol" value={item.volume || 0} type="number" onChange={v => onChange({ volume: parseFloat(v) || 0 })} />
      </div>

      {item.categoria === "Arma de Fogo" && (
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <div className="grid grid-cols-2 gap-2">
            <MiniInput label="Munição Total" value={item.municaoTotal || 0} type="number" onChange={v => onChange({ municaoTotal: parseInt(v) || 0 })} />
            <MiniInput label="No Tambor/Pente" value={item.municaoCarregada || 0} type="number" onChange={v => onChange({ municaoCarregada: parseInt(v) || 0 })} />
          </div>
          <select 
            className="w-full bg-zinc-900 text-zinc-300 text-[10px] p-1.5 rounded border border-zinc-700"
            value={selectedAmmoId || ""}
            onChange={(e) => setSelectedAmmoId(e.target.value)}
          >
            <option value="">Nenhuma selecionada</option>
            {ammoItems.map((a: any) => (
              <option key={a.id} value={a.id}>{a.nome} ({a.quantidade}x)</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button 
              onClick={() => onMaintenance?.()} 
              className="flex-1 bg-zinc-800 text-zinc-300 text-[10px] font-bold py-1.5 rounded hover:bg-zinc-700"
            >
              Fazer Manutenção
            </button>
            <button 
              onClick={() => onReload?.(selectedAmmoId, false)} 
              disabled={!selectedAmmoId}
              className="flex-1 bg-amber-500/10 text-amber-500 text-[10px] font-bold py-1.5 rounded hover:bg-amber-500/20 disabled:opacity-30"
            >
              Recarregar 1
            </button>
            <button 
              onClick={() => onReload?.(selectedAmmoId, true)} 
              disabled={!selectedAmmoId}
              className="flex-1 bg-amber-600 text-white text-[10px] font-bold py-1.5 rounded hover:bg-amber-500 disabled:opacity-30"
            >
              Recarregar Tudo
            </button>
          </div>
        </div>
      )}
      <TextArea label="Descrição / Efeitos" value={item.descricao || item.efeito || ''} onChange={v => onChange({ descricao: v, efeito: v })} />
    </div>
  );
}
