import React, { useMemo } from 'react';
import { Character, Stats } from '../types';
import { calculateProficiencyBonus, PROFICIENCIES } from '../rules/proficiencyRules';
import { calculateWeaponDamageBonus } from '../rules/combatRules';
import { getArmorWeight } from '../rules/inventoryRules';
import { X, Printer } from 'lucide-react';

interface PrintSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: Character | null;
  stats: Stats;
  vidaMax: number;
  manaMax: number;
  sanidadeMax: number;
  cargaMax: number;
  deslocamentoFinal: number;
  pesoTotal: number;
  climateProficiency: number;
}

export const PrintSheetModal: React.FC<PrintSheetModalProps> = ({
  isOpen,
  onClose,
  character,
  stats,
  vidaMax,
  manaMax,
  sanidadeMax,
  cargaMax,
  deslocamentoFinal,
  pesoTotal,
  climateProficiency,
}) => {
  if (!isOpen || !character) return null;

  // Calculate proficiencies
  const computedProficiencies = useMemo(() => {
    return PROFICIENCIES.map((prof) => {
      const bonus = calculateProficiencyBonus(
        stats,
        prof.name,
        prof.stats as (keyof Stats)[],
        character.fome,
        character.sede,
        character.cansaco,
        character.clima,
        climateProficiency,
        character.bonusProficiencias?.[prof.name] || 0,
        character.efeitosNegativos || [],
        character.sanidadeAtual,
        sanidadeMax
      );
      return {
        name: prof.name,
        stats: prof.stats,
        total: bonus,
      };
    });
  }, [character, stats, climateProficiency, sanidadeMax]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[500] flex flex-col bg-zinc-950/80 backdrop-blur-sm p-4 md:p-8 overflow-y-auto no-print" id="print-sheet-modal-root">
      {/* Control bar */}
      <div className="max-w-4xl w-full mx-auto bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between mb-4 shadow-xl no-print">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
            <Printer size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">Visualização de Impressão</h2>
            <p className="text-[10px] text-zinc-400">Ficha otimizada para papel e economia de tinta (Preto e Branco)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-zinc-950 text-xs font-black uppercase tracking-wider rounded-lg transition-all shadow-md"
          >
            <Printer size={14} /> Imprimir / PDF
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Printable Sheet Container */}
      <div className="max-w-4xl w-full mx-auto bg-white text-zinc-950 p-8 md:p-12 rounded-2xl shadow-2xl print-area font-sans border border-zinc-200 overflow-visible relative">
        
        {/* Style block for printing page setup */}
        <style>{`
          @media print {
            body {
              background: white !important;
              color: black !important;
              font-family: 'Times New Roman', Times, serif;
            }
            #root, .no-print, [id^="headlessui"], .fixed {
              display: none !important;
            }
            #print-sheet-modal-root {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              height: auto !important;
              background: white !important;
              padding: 0 !important;
              margin: 0 !important;
              display: block !important;
              overflow: visible !important;
              z-index: auto !important;
            }
            .print-area {
              display: block !important;
              width: 100% !important;
              max-width: 100% !important;
              border: none !important;
              box-shadow: none !important;
              padding: 0 !important;
              margin: 0 !important;
              background: white !important;
              color: black !important;
            }
            @page {
              size: A4;
              margin: 1.5cm;
            }
          }
        `}</style>

        {/* Outer classic ornamental border */}
        <div className="border-4 border-double border-zinc-900 p-6 md:p-8 min-h-[1050px] flex flex-col justify-between">
          <div>
            {/* Header / Brand */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b-2 border-zinc-950 pb-6 mb-6 gap-4">
              <div>
                <h1 className="text-3xl font-serif font-extrabold tracking-widest text-zinc-950 uppercase">DEMONS DESPAIR</h1>
                <p className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase mt-0.5">Ficha Oficial de Personagem e Sobrevivência</p>
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                <div className="border border-zinc-900 px-3 py-1.5 rounded bg-zinc-50 min-w-[140px]">
                  <span className="text-[9px] uppercase font-bold text-zinc-500 block">Nome do Personagem</span>
                  <span className="font-serif font-black text-sm text-zinc-900">{character.nome}</span>
                </div>
                <div className="border border-zinc-900 px-3 py-1.5 rounded bg-zinc-50 min-w-[120px]">
                  <span className="text-[9px] uppercase font-bold text-zinc-500 block">Etnia / Origem</span>
                  <span className="font-serif font-black text-sm text-zinc-900">{character.etnia || 'Desconhecida'}</span>
                </div>
                <div className="border border-zinc-900 px-3 py-1.5 rounded bg-zinc-50 min-w-[100px]">
                  <span className="text-[9px] uppercase font-bold text-zinc-500 block">Moedas (C / B / P / O)</span>
                  <span className="font-mono font-black text-sm text-zinc-900">
                    {character.dinheiro?.C || 0} / {character.dinheiro?.B || 0} / {character.dinheiro?.P || 0} / {character.dinheiro?.O || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Grid Layout: Attributes, Vitals, Combat */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start mb-6">
              
              {/* Left Column: Attributes (3 cols) */}
              <div className="md:col-span-4 border border-zinc-900 rounded p-4 bg-zinc-50">
                <h3 className="text-xs font-black uppercase tracking-widest text-center border-b border-zinc-900 pb-2 mb-4 text-zinc-900">
                  Atributos Base
                </h3>
                <div className="space-y-3">
                  {Object.entries(stats).map(([name, val]) => {
                    const bonus = Math.floor(val / 2);
                    return (
                      <div key={name} className="flex items-center justify-between border-b border-zinc-200 pb-1.5 last:border-0">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase text-zinc-600">{name}</span>
                          <span className="text-[8px] text-zinc-400 uppercase -mt-0.5">
                            {name === 'CON' && 'Constituição'}
                            {name === 'RES' && 'Resistência'}
                            {name === 'ADP' && 'Adaptabilidade'}
                            {name === 'MEN' && 'Mentalidade'}
                            {name === 'APR' && 'Apreço'}
                            {name === 'FOR' && 'Força'}
                            {name === 'DEX' && 'Destreza'}
                            {name === 'INT' && 'Inteligência'}
                            {name === 'RIT' && 'Ritual'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 border border-zinc-900 flex items-center justify-center font-mono font-black text-zinc-900 bg-white rounded-md shadow-inner">
                            {val}
                          </div>
                          <div className="w-10 h-7 border border-zinc-900/40 flex items-center justify-center font-mono text-xs font-bold text-zinc-700 bg-zinc-100/50 rounded">
                            {bonus >= 0 ? `+${bonus}` : bonus}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Vitals & Combat (8 cols) */}
              <div className="md:col-span-8 space-y-6">
                
                {/* Vitals Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* HP */}
                  <div className="border border-zinc-900 rounded p-3 bg-zinc-50 relative overflow-hidden">
                    <span className="text-[9px] uppercase font-black text-zinc-600 block">Vida Física (PV)</span>
                    <div className="flex items-baseline gap-1.5 my-1">
                      <span className="text-2xl font-serif font-black text-zinc-900">{character.vidaAtual}</span>
                      <span className="text-xs text-zinc-500">/ {vidaMax}</span>
                    </div>
                    {/* Wounds boxes for paper play */}
                    <div className="flex gap-1.5 mt-2 justify-between">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="w-3 h-3 border border-zinc-400 bg-white rounded-sm" title="Marcar dano" />
                      ))}
                    </div>
                  </div>

                  {/* MANA */}
                  <div className="border border-zinc-900 rounded p-3 bg-zinc-50">
                    <span className="text-[9px] uppercase font-black text-zinc-600 block">Reserva de Mana</span>
                    <div className="flex items-baseline gap-1.5 my-1">
                      <span className="text-2xl font-serif font-black text-zinc-900">{character.manaAtual}</span>
                      <span className="text-xs text-zinc-500">/ {manaMax}</span>
                    </div>
                    {/* Mana slots */}
                    <div className="flex gap-1.5 mt-2 justify-between">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="w-3 h-3 border border-zinc-400 bg-white rounded-sm" title="Marcar mana gasta" />
                      ))}
                    </div>
                  </div>

                  {/* SANIDADE */}
                  <div className="border border-zinc-900 rounded p-3 bg-zinc-50">
                    <span className="text-[9px] uppercase font-black text-zinc-600 block">Mentalidade / Sanidade</span>
                    <div className="flex items-baseline gap-1.5 my-1">
                      <span className="text-2xl font-serif font-black text-zinc-900">{character.sanidadeAtual}</span>
                      <span className="text-xs text-zinc-500">/ {sanidadeMax}</span>
                    </div>
                    {/* Sanity trackers */}
                    <div className="flex gap-1.5 mt-2 justify-between">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="w-3 h-3 border border-zinc-400 bg-white rounded-sm" title="Marcar sanidade perdida" />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Survival Parameters (Fome, Sede, Cansaço) */}
                <div className="border border-zinc-900 rounded p-4 bg-zinc-50">
                  <h3 className="text-xs font-black uppercase tracking-widest border-b border-zinc-900 pb-1.5 mb-3 text-zinc-900">
                    Indicadores de Sobrevivência
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex flex-col">
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="font-bold text-zinc-700">Fome:</span>
                        <span className="font-mono font-bold text-zinc-900">{character.fome}%</span>
                      </div>
                      <div className="h-2 bg-zinc-200 rounded border border-zinc-400 overflow-hidden">
                        <div className="h-full bg-zinc-700" style={{ width: `${character.fome}%` }} />
                      </div>
                      <p className="text-[8px] text-zinc-500 mt-1">{"< 50%: -1 Dano, -1 Desl. | < 5%: -1 todas prof"}</p>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="font-bold text-zinc-700">Sede:</span>
                        <span className="font-mono font-bold text-zinc-900">{character.sede}%</span>
                      </div>
                      <div className="h-2 bg-zinc-200 rounded border border-zinc-400 overflow-hidden">
                        <div className="h-full bg-zinc-700" style={{ width: `${character.sede}%` }} />
                      </div>
                      <p className="text-[8px] text-zinc-500 mt-1">{"< 50%: -1 Dano, -1 Desl. | < 5%: -1 todas prof"}</p>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="font-bold text-zinc-700">Cansaço (Vigor):</span>
                        <span className="font-mono font-bold text-zinc-900">{character.cansaco}/5</span>
                      </div>
                      <div className="flex gap-1.5 mt-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-4 h-4 border border-zinc-900 flex items-center justify-center font-mono text-[9px] font-bold rounded-sm ${
                              i < character.cansaco ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-950'
                            }`}
                          >
                            {i + 1}
                          </div>
                        ))}
                      </div>
                      <p className="text-[8px] text-zinc-500 mt-1">Cansaço menor que 3 impõe -1 em sobrevivência</p>
                    </div>
                  </div>
                </div>

                {/* Combat Statistics: Movement, Load, Armor Protection, Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Movement & Carry */}
                  <div className="border border-zinc-900 rounded p-4 bg-zinc-50 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest border-b border-zinc-900 pb-1 mb-2 text-zinc-900">
                        Movimento e Peso
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                        <div className="border border-zinc-200 p-2 rounded bg-white text-center">
                          <span className="text-[9px] font-bold text-zinc-500 block uppercase">Deslocamento</span>
                          <span className="font-serif font-black text-lg text-zinc-900">{deslocamentoFinal}m</span>
                        </div>
                        <div className="border border-zinc-200 p-2 rounded bg-white text-center">
                          <span className="text-[9px] font-bold text-zinc-500 block uppercase">Carga Atual</span>
                          <span className="font-serif font-black text-lg text-zinc-900">{pesoTotal.toFixed(1)} / {cargaMax.toFixed(1)} kg</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-[8px] text-zinc-500 leading-normal">
                      * Carga acima do limite reduz o deslocamento em 50% e impõe penalidade de -2 em Acerto.
                    </p>
                  </div>

                  {/* Body Protection (Armor Slots) & 1d6 Hit Location Table */}
                  <div className="border border-zinc-900 rounded p-4 bg-zinc-50">
                    <h4 className="text-xs font-black uppercase tracking-widest border-b border-zinc-900 pb-1 mb-2 text-zinc-900">
                      Defesas Corporais e Alvos
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Defesas por membro */}
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between items-center border-b border-zinc-200 pb-0.5">
                          <span className="font-bold text-zinc-700">Cabeça:</span>
                          <span className="font-mono font-black text-zinc-900">+{character.defesa?.["Cabeça"] || 0}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-zinc-200 pb-0.5">
                          <span className="font-bold text-zinc-700">Tronco:</span>
                          <span className="font-mono font-black text-zinc-900">+{character.defesa?.["Tronco"] || 0}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-zinc-200 pb-0.5">
                          <span className="font-bold text-zinc-700">Braço Esq:</span>
                          <span className="font-mono font-black text-zinc-900">+{character.defesa?.["Braço Esquerdo"] || 0}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-zinc-200 pb-0.5">
                          <span className="font-bold text-zinc-700">Braço Dir:</span>
                          <span className="font-mono font-black text-zinc-900">+{character.defesa?.["Braço Direito"] || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-zinc-700">Pernas:</span>
                          <span className="font-mono font-black text-zinc-900">+{character.defesa?.["Pernas"] || 0}</span>
                        </div>
                      </div>

                      {/* 1d6 Hit Location Table */}
                      <div className="border border-zinc-900/30 p-2 bg-white rounded text-[10px] leading-tight flex flex-col justify-between">
                        <div>
                          <p className="font-bold text-center border-b border-zinc-200 pb-1 mb-1 text-zinc-800">Localização de Dano (1d6)</p>
                          <div className="grid grid-cols-6 text-center font-bold text-zinc-600 border-b border-zinc-100 pb-0.5 mb-1">
                            <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span>
                          </div>
                          <div className="grid grid-cols-1 font-mono text-[8px] text-zinc-600 gap-0.5">
                            <div>1: Braço Esquerdo</div>
                            <div>2: Braço Direito</div>
                            <div>3: Perna Esquerda</div>
                            <div>4: Perna Direita</div>
                            <div>5: Tronco | 6: Cabeça</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Proficiências Block (Full Width, Compact 4x4 or 3x5 Grid) */}
            <div className="border border-zinc-900 rounded p-4 bg-zinc-50 mb-6">
              <h3 className="text-xs font-black uppercase tracking-widest border-b border-zinc-900 pb-2 mb-4 text-zinc-900">
                Proficiências Atuais
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                {computedProficiencies.map((prof) => (
                  <div key={prof.name} className="flex justify-between items-center border-b border-zinc-200 pb-1">
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold truncate text-zinc-800">{prof.name}</span>
                      <span className="text-[8px] font-mono text-zinc-400 uppercase tracking-tight">{prof.stats.join(" + ")}</span>
                    </div>
                    <span className="font-mono font-black text-zinc-900 bg-white border border-zinc-300 px-1.5 py-0.5 rounded shadow-sm text-center min-w-[28px]">
                      {prof.total >= 0 ? `+${prof.total}` : prof.total}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Armas & Equipamentos de Combate */}
            <div className="border border-zinc-900 rounded p-4 bg-zinc-50 mb-6">
              <h3 className="text-xs font-black uppercase tracking-widest border-b border-zinc-900 pb-2 mb-3 text-zinc-900">
                Equipamentos de Combate (Armas)
              </h3>
              {character.armas && character.armas.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-900 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                        <th className="py-2">Arma</th>
                        <th className="py-2">Tipo / Atrib.</th>
                        <th className="py-2">Nível Acerto</th>
                        <th className="py-2">Dano Base</th>
                        <th className="py-2">Bônus Dano</th>
                        <th className="py-2">Durabilidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {character.armas.map((arma) => {
                        const baseStatValue = stats[arma.atributoBase as keyof Stats] || 0;
                        const damageBonus = calculateWeaponDamageBonus(arma, baseStatValue) || 0;
                        return (
                          <tr key={arma.id} className="border-b border-zinc-200 last:border-0 hover:bg-zinc-100/50">
                            <td className="py-2.5 font-bold text-zinc-900">{arma.nome}</td>
                            <td className="py-2.5 font-mono text-zinc-600 text-[10px] uppercase">
                              {arma.categoria} ({arma.atributoBase})
                            </td>
                            <td className="py-2.5 font-mono font-black text-zinc-900">
                              3d8 {arma.acerto >= 0 ? `+${arma.acerto}` : arma.acerto}
                            </td>
                            <td className="py-2.5 font-mono text-zinc-800 font-bold">{arma.dano || "1d6"}</td>
                            <td className="py-2.5 font-mono text-zinc-800">
                              {damageBonus >= 0 ? `+${damageBonus}` : damageBonus}
                            </td>
                            <td className="py-2.5 font-mono text-zinc-700">
                              {arma.durabilidade}/{arma.maxDurabilidade || 10}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-zinc-400 italic text-center py-4">Nenhuma arma equipada. Preencha à mão se necessário.</p>
              )}
            </div>

            {/* Magias, Catalisadores e Habilidades */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              
              {/* Magias */}
              <div className="border border-zinc-900 rounded p-4 bg-zinc-50">
                <h3 className="text-xs font-black uppercase tracking-widest border-b border-zinc-900 pb-2 mb-3 text-zinc-900">
                  Magias, Milagres e Rituais
                </h3>
                {character.magias && character.magias.length > 0 ? (
                  <div className="space-y-3">
                    {character.magias.map((spell) => (
                      <div key={spell.id} className="border-b border-zinc-200 pb-2 last:border-0">
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-xs font-black text-zinc-900">{spell.nome}</span>
                          <span className="text-[9px] font-mono font-bold text-zinc-600 bg-zinc-200/50 px-1.5 py-0.5 rounded uppercase">
                            {spell.escola} | Custo: {spell.mana} PM
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-600 leading-normal italic">{spell.efeito}</p>
                        {spell.dano && (
                          <p className="text-[9px] font-mono font-bold text-zinc-800 mt-0.5">
                            Dano/Efeito: {spell.dano} (Escala {spell.escala})
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-400 italic text-center py-4">Nenhuma magia memorizada.</p>
                )}
              </div>

              {/* Habilidades passivas ou especiais */}
              <div className="border border-zinc-900 rounded p-4 bg-zinc-50">
                <h3 className="text-xs font-black uppercase tracking-widest border-b border-zinc-900 pb-2 mb-3 text-zinc-900">
                  Habilidades & Conhecimentos
                </h3>
                <div className="space-y-4">
                  {/* Abilities list */}
                  {character.habilidades && character.habilidades.length > 0 ? (
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">Habilidades Ativas / Passivas</span>
                      {character.habilidades.map((habil) => (
                        <div key={habil.id} className="text-xs">
                          <strong className="text-zinc-900 block">{habil.nome}</strong>
                          <span className="text-zinc-600 text-[10px] leading-normal">{habil.efeito}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-zinc-400 italic text-[10px] text-center">Nenhuma habilidade listada.</p>
                  )}
                  
                  {/* Knowledges */}
                  {character.conhecimentos && character.conhecimentos.length > 0 && (
                    <div className="border-t border-zinc-200 pt-3 space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">Conhecimentos Desbloqueados</span>
                      <div className="flex flex-wrap gap-1.5">
                        {character.conhecimentos.map((k, idx) => (
                          <span key={idx} className="border border-zinc-400 bg-white px-2 py-0.5 rounded text-[10px] font-medium text-zinc-800">
                            {k.name} (Nível {k.nivel})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Inventário e Compartimentos */}
            <div className="border border-zinc-900 rounded p-4 bg-zinc-50 mb-6">
              <h3 className="text-xs font-black uppercase tracking-widest border-b border-zinc-900 pb-2 mb-3 text-zinc-900">
                Compartimentos e Inventário Geral
              </h3>
              {character.compartimentos && character.compartimentos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {character.compartimentos.map((comp) => {
                    const compItems = comp.itens || [];
                    return (
                      <div key={comp.id} className="border border-zinc-200 p-2.5 rounded bg-white">
                        <span className="font-bold text-zinc-900 uppercase text-[10px] border-b border-zinc-200 pb-0.5 block mb-1.5 flex justify-between items-center">
                          <span>{comp.nome}</span>
                          {comp.externo && <span className="text-[8px] font-mono bg-zinc-200 px-1 rounded text-zinc-700">EXTERNO</span>}
                        </span>
                        {compItems.length > 0 ? (
                          <ul className="space-y-1 text-[10px] text-zinc-700">
                            {compItems.map((it) => (
                              <li key={it.id} className="flex justify-between items-center border-b border-zinc-100 pb-0.5 last:border-0">
                                <span>{it.nome} {it.quantidade > 1 ? `x${it.quantidade}` : ''}</span>
                                <span className="font-mono text-zinc-400">
                                  {((it.peso || 0) * it.quantidade).toFixed(1)}kg | {((it.volume || 0) * it.quantidade).toFixed(1)}L
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-zinc-400 italic text-[10px]">Compartimento vazio</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-zinc-400 italic text-center py-4 text-xs">Nenhum compartimento ativo no inventário.</p>
              )}
            </div>

            {/* Efeitos Negativos / Status */}
            {character.efeitosNegativos && character.efeitosNegativos.length > 0 && (
              <div className="border border-zinc-900 rounded p-4 bg-zinc-50 mb-6">
                <h3 className="text-xs font-black uppercase tracking-widest border-b border-zinc-900 pb-2 mb-3 text-red-950">
                  Efeitos Negativos / Sequelas Sombrias
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {character.efeitosNegativos.map((eff) => (
                    <div key={eff.id} className="border border-red-300 p-3 rounded bg-red-50/50 flex flex-col justify-between">
                      <div className="flex justify-between items-start mb-1">
                        <strong className="text-red-900 uppercase text-[10px] tracking-wide">{eff.type}</strong>
                        <span className="text-[9px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                          {eff.location}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-700 leading-normal mt-1">
                        {eff.type === 'Sangramento' && `Dano contínuo de Sangramento Nível ${eff.stacks || 1} por turno. Amputação ao atingir Nível 3!`}
                        {eff.type === 'Ossos Quebrados' && '+3 de dano extra recebido no local atingido. Membro inutilizável.'}
                        {eff.type === 'Hemorragia' && 'Dano +2 no local. Esquiva/Movimento reduzidos em 1/3, -1 de Acurácia, -2 de Defesa com Arma.'}
                        {(!['Sangramento', 'Ossos Quebrados', 'Hemorragia'].includes(eff.type)) && 'Efeito ativo de deboche corporal/mental.'}
                      </p>
                      <div className="flex justify-between items-center mt-2.5 border-t border-red-200/50 pt-1.5 text-[9px] font-mono text-zinc-500">
                        <span>Restantes: {eff.daysRemaining} dias</span>
                        <div className="flex items-center gap-1">
                          <div className={`w-3 h-3 border border-zinc-400 bg-white rounded-sm ${eff.treated ? 'bg-zinc-800' : ''}`} />
                          <span>Tratado?</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes / Anotações */}
            <div className="border border-zinc-900 rounded p-4 bg-zinc-50">
              <h3 className="text-xs font-black uppercase tracking-widest border-b border-zinc-900 pb-2 mb-3 text-zinc-900">
                Anotações do Viajante e Diário de Campanha
              </h3>
              {character.anotacoes && character.anotacoes.length > 0 ? (
                <div className="space-y-4 text-xs">
                  {character.anotacoes.map((note) => (
                    <div key={note.id} className="border-b border-zinc-200 pb-3 last:border-0">
                      <strong className="text-zinc-900 block font-serif text-sm mb-1">{note.titulo}</strong>
                      <p className="text-zinc-700 leading-relaxed font-sans text-xs whitespace-pre-line mb-2">{note.conteudo}</p>
                      {note.imagens && note.imagens.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {note.imagens.map((img, imgIdx) => (
                            <img key={imgIdx} src={img} alt="Anexo" className="w-20 h-20 object-cover rounded border border-zinc-300 shadow-sm" />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 border border-dashed border-zinc-300 rounded text-center text-zinc-400 italic text-xs">
                  Nenhuma anotação vinculada. Espaço reservado para seu diário de papel.
                </div>
              )}
            </div>

          </div>

          {/* Footer of the page */}
          <div className="border-t border-zinc-400 pt-4 mt-8 flex justify-between items-center text-[9px] text-zinc-400 uppercase font-mono tracking-wider">
            <span>FORJADO PELO HEFESTO (AI AGENT ENGINE)</span>
            <span>RPG DEMONS DESPAIR - REGRA DA FICHA DE PAPEL</span>
          </div>
        </div>

      </div>
    </div>
  );
};
