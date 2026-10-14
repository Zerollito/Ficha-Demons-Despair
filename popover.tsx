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
