import React, { useState, useMemo } from 'react';
import { ETHNICITIES, getEthnicityById, isPredefinedEthnicity } from '../rules/ethnicityRules';
import { ChevronDown, Shield, Award, AlertCircle, Info, Sparkles } from 'lucide-react';

interface EthnicitySelectorProps {
  value: string;
  onChangeEthnicity: (ethnicityId: string, customName?: string) => void;
  onCustomNameChange: (customName: string) => void;
  isCreatureMode?: boolean;
}

export const EthnicitySelector: React.FC<EthnicitySelectorProps> = ({
  value,
  onChangeEthnicity,
  onCustomNameChange,
  isCreatureMode = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Determinar se o valor atual corresponde a uma etnia pré-definida
  const activeEthnicity = useMemo(() => {
    return getEthnicityById(value);
  }, [value]);

  const isCustom = activeEthnicity.id === 'custom' || !isPredefinedEthnicity(value);

  const handleSelect = (ethId: string) => {
    setIsOpen(false);
    if (ethId === 'custom') {
      onChangeEthnicity('custom', value && !isPredefinedEthnicity(value) ? value : 'Customizado');
    } else {
      onChangeEthnicity(ethId);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
          {isCreatureMode ? 'Localização / Origem' : 'Etnia / Cultura'}
        </label>
        {activeEthnicity.id !== 'custom' && (
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-[10px] text-amber-500/80 hover:text-amber-400 font-medium flex items-center gap-1 transition-colors"
          >
            <Info size={11} />
            {showDetails ? 'Ocultar Detalhes' : 'Ver Benefícios & Trajes'}
          </button>
        )}
      </div>

      {/* Dropdown Principal */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-200 text-xs px-3 py-2.5 rounded transition-all focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        >
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-zinc-100">
              {isCustom ? (value || 'Customizado') : activeEthnicity.name}
            </span>
            {isCustom && (
              <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
                Livre
              </span>
            )}
          </div>
          <ChevronDown
            size={14}
            className={`text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Menu Flutuante */}
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute left-0 right-0 top-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl z-50 max-h-72 overflow-y-auto divide-y divide-zinc-900/60 custom-scrollbar">
              {ETHNICITIES.map((eth) => {
                const isSelected =
                  eth.id === activeEthnicity.id ||
                  (eth.id === 'custom' && isCustom);

                return (
                  <button
                    key={eth.id}
                    type="button"
                    onClick={() => handleSelect(eth.id)}
                    className={`w-full text-left px-3 py-2.5 hover:bg-zinc-900/80 transition-colors flex flex-col gap-0.5 ${
                      isSelected ? 'bg-amber-500/10 border-l-2 border-amber-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isSelected ? 'text-amber-400' : 'text-zinc-200'}`}>
                        {eth.name}
                      </span>
                      {eth.vestimentas && eth.vestimentas.length > 0 && (
                        <span className="text-[9px] text-zinc-500 font-mono flex items-center gap-1">
                          <Shield size={10} className="text-zinc-400" />
                          {eth.vestimentas.length > 1 ? `${eth.vestimentas.length} peças` : eth.vestimentas[0].nome}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-500 line-clamp-1">
                      {eth.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Campo Customizado quando aplicável */}
      {isCustom && (
        <div className="pt-1">
          <input
            type="text"
            value={value === 'Customizado' ? '' : value}
            onChange={(e) => onCustomNameChange(e.target.value)}
            placeholder="Nome da cultura ou povo customizado..."
            className="w-full bg-zinc-900/90 border border-zinc-800/80 rounded px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      )}

      {/* Painel de Detalhes da Etnia Selecionada */}
      {showDetails && activeEthnicity.id !== 'custom' && (
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-3 space-y-2.5 text-xs animate-in fade-in duration-200">
          <p className="text-[11px] text-zinc-400 leading-relaxed italic">
            "{activeEthnicity.description}"
          </p>

          {/* Bônus de Proficiência e Conhecimentos */}
          {(Object.keys(activeEthnicity.proficienciasModifiers || {}).length > 0 ||
            Object.keys(activeEthnicity.conhecimentosModifiers || {}).length > 0) && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                <Sparkles size={11} className="text-amber-500" />
                Modificadores Diretos
              </span>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(activeEthnicity.proficienciasModifiers || {}).map(([prof, val]) => (
                  <span
                    key={prof}
                    className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                      val >= 0
                        ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                        : 'bg-red-950/40 text-red-400 border border-red-800/40'
                    }`}
                  >
                    {prof}: {val > 0 ? `+${val}` : val}
                  </span>
                ))}
                {Object.entries(activeEthnicity.conhecimentosModifiers || {}).map(([kn, val]) => (
                  <span
                    key={kn}
                    className="text-[10px] px-2 py-0.5 rounded font-mono font-medium bg-cyan-950/40 text-cyan-400 border border-cyan-800/40"
                  >
                    Conhecimento ({kn}): +{val}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Habilidades Geradas */}
          {activeEthnicity.habilidades.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                <Award size={11} className="text-amber-500" />
                Habilidades Atribuídas
              </span>
              <div className="space-y-1">
                {activeEthnicity.habilidades.map((hab, i) => (
                  <div key={i} className="bg-zinc-950/60 p-2 rounded border border-zinc-800/50">
                    <span className="text-[11px] font-bold text-amber-400 block mb-0.5">
                      {hab.nome}
                    </span>
                    <span className="text-[10px] text-zinc-400 block leading-tight">
                      {hab.efeito}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vestimenta Inicial */}
          {activeEthnicity.vestimentas && activeEthnicity.vestimentas.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                <Shield size={11} className="text-amber-500" />
                Vestimentas e Peças Iniciais ({activeEthnicity.vestimentas.length})
              </span>
              <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                {activeEthnicity.vestimentas.map((vest, vIdx) => (
                  <div key={vIdx} className="bg-zinc-950/60 p-2 rounded border border-zinc-800/50 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-zinc-200">
                        {vest.nome}
                      </span>
                      <span className="text-[10px] text-amber-500 font-mono">
                        RD: {vest.reducaoDano}
                      </span>
                    </div>
                    <div className="text-[9px] text-zinc-400 flex flex-wrap gap-x-2 font-mono">
                      <span>Corte: {vest.corte}</span>
                      <span>Impacto: {vest.impacto}</span>
                      <span>Perf: {vest.perfuracao}</span>
                      <span>Dur: {vest.durabilidade}</span>
                      <span>Peso: {vest.peso}</span>
                      <span>Vol: {vest.volume}</span>
                    </div>
                    {vest.efeito && (
                      <span className="text-[9px] text-zinc-500 italic">
                        {vest.efeito}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
