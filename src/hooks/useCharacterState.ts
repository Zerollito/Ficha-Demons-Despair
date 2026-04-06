import { useState, useEffect, useMemo, useCallback } from 'react';
import { Character, AppState } from '../types';
import { createEmptyCharacter } from '../lib/character';
import { calculateInventoryTotals, getLoadPenalties } from '../rules/inventoryRules';
import { getVidaMaxima, getManaMaxima, getCargaMaxima, getDeslocamentoBase } from '../rules/statusRules';

const STORAGE_KEY = 'rpg_system_x_chars';

export function useCharacterState() {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.characters.length > 0) return parsed;
      } catch (e) {
        console.error("Error loading characters", e);
      }
    }
    const initialChar = createEmptyCharacter();
    return {
      characters: [initialChar],
      activeCharacterId: initialChar.id
    };
  });

  const [clipboard, setClipboard] = useState<any>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const activeChar = useMemo(() => 
    state.characters.find(c => c.id === state.activeCharacterId) || state.characters[0],
    [state.characters, state.activeCharacterId]
  );

  const updateChar = useCallback((updates: Partial<Character>) => {
    setState(prev => ({
      ...prev,
      characters: prev.characters.map(c => 
        c.id === prev.activeCharacterId ? { ...c, ...updates } : c
      )
    }));
  }, []);

  const stats = activeChar.stats;
  const vidaMax = getVidaMaxima(stats.CON);
  const manaMax = getManaMaxima(stats.APR);
  const cargaMax = getCargaMaxima(stats.RES);
  const deslocamentoBase = getDeslocamentoBase(stats.DEX);

  const { peso: pesoTotal, volume: volumeTotal } = useMemo(() => 
    calculateInventoryTotals(activeChar.compartimentos),
    [activeChar.compartimentos]
  );

  const penalties = useMemo(() => 
    getLoadPenalties(pesoTotal, cargaMax),
    [pesoTotal, cargaMax]
  );

  const deslocamentoFinal = Math.max(1, deslocamentoBase + penalties.deslocamentoPenalty);

  const addCharacter = useCallback(() => {
    const newChar = createEmptyCharacter();
    setState(prev => ({
      characters: [...prev.characters, newChar],
      activeCharacterId: newChar.id
    }));
  }, []);

  const deleteCharacter = useCallback(() => {
    if (state.characters.length <= 1) return;
    setState(prev => {
      const newChars = prev.characters.filter(c => c.id !== prev.activeCharacterId);
      return {
        characters: newChars,
        activeCharacterId: newChars[0].id
      };
    });
  }, [state.characters.length]);

  const copyCharacter = useCallback(() => {
    const newChar = { ...activeChar, id: crypto.randomUUID(), nome: `${activeChar.nome} (Cópia)` };
    setState(prev => ({
      characters: [...prev.characters, newChar],
      activeCharacterId: newChar.id
    }));
  }, [activeChar]);

  const copyToClipboard = useCallback((item: any) => {
    setClipboard(item);
  }, []);

  return {
    state,
    setState,
    activeChar,
    updateChar,
    stats,
    vidaMax,
    manaMax,
    cargaMax,
    deslocamentoBase,
    pesoTotal,
    volumeTotal,
    penalties,
    deslocamentoFinal,
    addCharacter,
    deleteCharacter,
    copyCharacter,
    copyToClipboard,
    clipboard,
    setClipboard
  };
}
