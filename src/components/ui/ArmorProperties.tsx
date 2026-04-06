import React from 'react';
import { MiniInput } from './MiniInput';
import { TextArea } from './Input';

interface ArmorPropertiesProps {
  item: any;
  onChange: (updates: any) => void;
}

export function ArmorProperties({ item, onChange }: ArmorPropertiesProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <MiniInput label="Corte" value={item.corte || 0} type="number" onChange={v => onChange({ corte: parseInt(v) || 0 })} />
        <MiniInput label="Impacto" value={item.impacto || 0} type="number" onChange={v => onChange({ impacto: parseInt(v) || 0 })} />
        <MiniInput label="Perf." value={item.perfuracao || 0} type="number" onChange={v => onChange({ perfuracao: parseInt(v) || 0 })} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <MiniInput label="Durab." value={item.durabilidade || 0} type="number" onChange={v => onChange({ durabilidade: parseInt(v) || 0 })} />
        <MiniInput label="Peso" value={item.peso || 0} type="number" onChange={v => onChange({ peso: parseFloat(v) || 0 })} />
        <MiniInput label="Vol" value={item.volume || 0} type="number" onChange={v => onChange({ volume: parseFloat(v) || 0 })} />
        <MiniInput label="Redução de Dano" value={item.reducaoDano || 0} type="number" onChange={v => onChange({ reducaoDano: parseInt(v) || 0 })} />
      </div>
      <TextArea label="Descrição" value={item.descricao || item.efeito || ''} onChange={v => onChange({ descricao: v, efeito: v })} />
    </div>
  );
}
