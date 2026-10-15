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
  const isFirearm = (item.categoria || "").toLowerCase() === "arma de fogo";
  const isBow = (item.categoria || "").toLowerCase() === "arco";
  const isMelee = !isFirearm && !isBow;

  const allCompartmentItems = React.useMemo(() => {
    if (!character) return [];
    return character.compartimentos?.flatMap((c: any) => c.itens || []) || [];
  }, [character]);

  const ammoItems = React.useMemo(() => {
    return allCompartmentItems.filter((i: any) => {
      const lowerTipo = (i.tipo || "").toLowerCase();
      const lowerNome = (i.nome || "").toLowerCase();

      // Apenas itens classificados como munição
      const isAmmoType = lowerTipo === 'munição' || lowerTipo === 'municao';
      if (!isAmmoType) return false;

      if (isBow) {
        // Exclui balas e cartuchos de armas de fogo
        if (lowerNome.includes('bala') || lowerNome.includes('cartucho') || lowerNome.includes('chumbo')) {
          return false;
        }
        return true;
      }

      if (isFirearm) {
        // Exclui flechas e virotes de arcos
        if (lowerNome.includes('flecha') || lowerNome.includes('virote') || lowerNome.includes('arco')) {
          return false;
        }
        return true;
      }

      return true;
    });
  }, [allCompartmentItems, isBow, isFirearm]);

  // Find active ammo (from arrowId/bulletId or from magazineAmmo)
  const currentAmmoId = (isBow ? (item.arrowId || item.bulletId) : (item.bulletId || item.arrowId)) || (item.magazineAmmo && item.magazineAmmo.length > 0 ? item.magazineAmmo[0].id : "");
  const [selectedAmmoId, setSelectedAmmoId] = React.useState<string>(currentAmmoId || "");

  React.useEffect(() => {
    if (currentAmmoId && currentAmmoId !== selectedAmmoId) {
      setSelectedAmmoId(currentAmmoId);
    }
  }, [currentAmmoId]);

  const activeAmmo = React.useMemo(() => {
    if (!isFirearm && !isBow) return null;
    const targetId = selectedAmmoId || (isBow ? (item.arrowId || item.bulletId) : (item.bulletId || item.arrowId));
    if (targetId) {
      const found = allCompartmentItems.find((i: any) => i.id === targetId);
      if (found) return found;
    }
    if (item.magazineAmmo && item.magazineAmmo.length > 0) {
      return item.magazineAmmo[0];
    }
    return null;
  }, [selectedAmmoId, item.bulletId, item.arrowId, item.magazineAmmo, allCompartmentItems, isFirearm, isBow]);

  const derivedCorte = (isFirearm || isBow) ? (activeAmmo ? (Number(activeAmmo.corte) || 0) : 0) : (item.corte || 0);
  const derivedImpacto = (isFirearm || isBow) ? (activeAmmo ? (Number(activeAmmo.impacto) || 0) : 0) : (item.impacto || 0);
  const derivedPerfuracao = (isFirearm || isBow) ? (activeAmmo ? (Number(activeAmmo.perfuracao) || 0) : 0) : (item.perfuracao || 0);
  const derivedResistencia = (isFirearm || isBow) ? (activeAmmo ? (Number(activeAmmo.resistencia) || 0) : 0) : (item.resistencia || 0);

  const handleSelectAmmo = (newAmmoId: string) => {
    setSelectedAmmoId(newAmmoId);
    const ammoObj = allCompartmentItems.find((i: any) => i.id === newAmmoId);
    if (ammoObj) {
      onChange({
        bulletId: isFirearm ? newAmmoId : undefined,
        arrowId: isBow ? newAmmoId : undefined,
        corte: Number(ammoObj.corte) || 0,
        impacto: Number(ammoObj.impacto) || 0,
        perfuracao: Number(ammoObj.perfuracao) || 0,
        resistencia: Number(ammoObj.resistencia) || 0,
        ...(ammoObj.dano ? { municaoDano: ammoObj.dano } : {})
      });
    } else {
      onChange({
        bulletId: undefined,
        arrowId: undefined,
        corte: 0,
        impacto: 0,
        perfuracao: 0,
        resistencia: 0,
        municaoDano: undefined
      });
    }
  };

  return (
    <div className="space-y-3">
      {/* Category Header */}
      <div className="flex justify-between items-center pb-1.5 border-b border-zinc-800">
        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Tipo</span>
        <span className="bg-zinc-950 border border-zinc-800 text-amber-500 font-bold uppercase rounded px-2 py-0.5 text-[9px]">
          {item.categoria || "Arma Branca"}
        </span>
      </div>

      {/* Row 1: Dano & Acerto */}
      <div className="grid grid-cols-2 gap-2">
        <MiniInput label="Dano" value={item.dano || '0'} onChange={v => onChange({ dano: v })} />
        <MiniInput label="Acerto" value={item.acerto || 0} type="number" onChange={v => onChange({ acerto: parseInt(v) || 0 })} />
      </div>

      {/* Row 2: Durabilidade Atual & Total */}
      <div className="grid grid-cols-2 gap-2">
        <MiniInput label="Durabilidade Atual" value={item.durabilidade ?? 0} type="number" onChange={v => onChange({ durabilidade: parseInt(v) || 0 })} />
        <MiniInput label="Durabilidade Total" value={item.maxDurabilidade ?? 0} type="number" onChange={v => onChange({ maxDurabilidade: parseInt(v) || 0 })} />
      </div>

      {/* Row 3: Escala & Atributo */}
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
          <label className="text-[9px] font-bold text-zinc-500 uppercase">Atrib.</label>
          <select 
            className="bg-zinc-900 border border-zinc-700 text-zinc-300 rounded p-1.5 text-xs"
            value={item.atributoBase || (isBow ? 'Destreza' : 'Força')}
            onChange={(e) => onChange({ atributoBase: e.target.value })}
          >
            {['Força', 'Destreza', 'Inteligência', 'Ritual'].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Row 4: Níveis de Corte / Impacto / Perfuração / Resistência */}
      {isMelee ? (
        <div className="grid grid-cols-4 gap-2">
          <MiniInput label="Corte" value={item.corte || 0} type="number" onChange={v => onChange({ corte: parseInt(v) || 0 })} />
          <MiniInput label="Imp." value={item.impacto || 0} type="number" onChange={v => onChange({ impacto: parseInt(v) || 0 })} />
          <MiniInput label="Perf." value={item.perfuracao || 0} type="number" onChange={v => onChange({ perfuracao: parseInt(v) || 0 })} />
          <MiniInput label="Res." value={item.resistencia || 0} type="number" onChange={v => onChange({ resistencia: parseInt(v) || 0 })} />
        </div>
      ) : (
        /* Para Arcos e Armas de Fogo, os níveis são exibidos com base na munição (flecha ou bala) */
        <div className="bg-zinc-950/60 p-2 rounded-xl border border-zinc-800 space-y-1.5">
          <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-wider text-zinc-500">
            <span>Níveis da {isBow ? 'Flecha' : 'Bala'} (Automáticos)</span>
            <span className={activeAmmo ? "text-amber-500 font-bold truncate max-w-[140px]" : "text-zinc-600"}>
              {activeAmmo ? activeAmmo.nome : "Sem munição selecionada"}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
              <span className="text-[7px] text-zinc-500 font-bold uppercase block">Corte</span>
              <span className="text-xs font-black text-zinc-200">{derivedCorte}</span>
            </div>
            <div className="bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
              <span className="text-[7px] text-zinc-500 font-bold uppercase block">Imp.</span>
              <span className="text-xs font-black text-zinc-200">{derivedImpacto}</span>
            </div>
            <div className="bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
              <span className="text-[7px] text-zinc-500 font-bold uppercase block">Perf.</span>
              <span className="text-xs font-black text-zinc-200">{derivedPerfuracao}</span>
            </div>
            <div className="bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
              <span className="text-[7px] text-zinc-500 font-bold uppercase block">Res.</span>
              <span className="text-xs font-black text-zinc-200">{derivedResistencia}</span>
            </div>
          </div>
        </div>
      )}

      {/* Row 5: Seção de Munição de Arma de Fogo (com Manutenção) */}
      {isFirearm && (
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <div className="grid grid-cols-2 gap-2">
            <MiniInput label="Munição Total" value={item.municaoTotal || 0} type="number" onChange={v => onChange({ municaoTotal: parseInt(v) || 0 })} />
            <MiniInput label="No Tambor/Pente" value={item.municaoCarregada || 0} type="number" onChange={v => onChange({ municaoCarregada: parseInt(v) || 0 })} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[8px] font-bold text-zinc-500 uppercase">Bala em Uso</label>
            <select 
              className="w-full bg-zinc-900 text-zinc-300 text-[10px] p-1.5 rounded border border-zinc-700"
              value={selectedAmmoId || ""}
              onChange={(e) => handleSelectAmmo(e.target.value)}
            >
              <option value="">Nenhuma bala selecionada</option>
              {ammoItems.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.nome} ({a.quantidade || 0}x) [C:{a.corte || 0} P:{a.perfuracao || 0} I:{a.impacto || 0} R:{a.resistencia || 0}]
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={() => onMaintenance?.()} 
              className="flex-1 bg-zinc-800 text-zinc-300 text-[10px] font-bold py-1.5 rounded hover:bg-zinc-700 transition-colors"
            >
              Fazer Manutenção
            </button>
            <button 
              type="button"
              onClick={() => onReload?.(selectedAmmoId, false)} 
              disabled={!selectedAmmoId}
              className="flex-1 bg-amber-500/10 text-amber-500 text-[10px] font-bold py-1.5 rounded hover:bg-amber-500/20 disabled:opacity-30 transition-colors"
            >
              Recarregar 1
            </button>
            <button 
              type="button"
              onClick={() => onReload?.(selectedAmmoId, true)} 
              disabled={!selectedAmmoId}
              className="flex-1 bg-amber-600 text-white text-[10px] font-bold py-1.5 rounded hover:bg-amber-500 disabled:opacity-30 transition-colors"
            >
              Recarregar Tudo
            </button>
          </div>
        </div>
      )}

      {/* Row 5 (Alternativa): Seção de Munição de Arco (SEM Manutenção e SEM Recarga manual) */}
      {isBow && (
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <div className="flex flex-col gap-1">
            <label className="text-[8px] font-bold text-zinc-500 uppercase">Flecha em Uso</label>
            <select 
              className="w-full bg-zinc-900 text-zinc-300 text-[10px] p-1.5 rounded border border-zinc-700"
              value={selectedAmmoId || ""}
              onChange={(e) => handleSelectAmmo(e.target.value)}
            >
              <option value="">Nenhuma flecha selecionada</option>
              {ammoItems.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.nome} ({a.quantidade || 0}x) [C:{a.corte || 0} P:{a.perfuracao || 0} I:{a.impacto || 0} R:{a.resistencia || 0}]
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Row 6: Peso, Vol, Qtd */}
      <div className="grid grid-cols-3 gap-2">
        <MiniInput label="Peso (x100g)" value={item.peso || 0} type="number" onChange={v => onChange({ peso: parseFloat(v) || 0 })} />
        <MiniInput label="Vol" value={item.volume || 0} type="number" onChange={v => onChange({ volume: parseFloat(v) || 0 })} />
        <MiniInput label="Qtd" value={item.quantidade ?? 1} type="number" onChange={v => onChange({ quantidade: parseInt(v) || 1 })} />
      </div>

      {/* Row 7: Descrição / Efeitos */}
      <TextArea label="Descrição / Efeitos" value={item.descricao || item.efeito || ''} onChange={v => onChange({ descricao: v, efeito: v })} />
    </div>
  );
}

