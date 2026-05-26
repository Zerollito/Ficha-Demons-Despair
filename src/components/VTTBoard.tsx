import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { Stage, Layer, Image as KonvaImage, Rect, Circle, Line, Text, Group, RegularPolygon, Shape } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import { TableToken, TableConfig, Character, MonsterAction, NegativeEffect } from '../types';
import { updateTokenPosition, addCombatLog, subscribeToCombatLogs } from '../services/vttService';
import { saveCharacterToFirestore } from '../services/characterService';
import { Shield, User, Trash2, Plus, Settings, ZoomIn, ZoomOut, Maximize, Eye, EyeOff, Upload, ChevronLeft, ChevronRight, Skull, Info, Heart, Minus, FileText, Zap, Dices, Swords, AlertTriangle, RefreshCw, Calendar, Clock, Sun, Cloud, Wind, Snowflake, Target, X, Package } from 'lucide-react';
import { randomInt, randomElement, generateId, secureRandom } from '../lib/random';
import { cn } from '../lib/utils';
import { doc, getDoc, updateDoc, setDoc, arrayUnion, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Bestiary } from './Bestiary';
import { BestiaryMonster } from '../types';
import { EnemyGenerator } from './EnemyGenerator';
import { calculateProficiencyBonus, Stats } from '../rules/proficiencyRules';
import { calculateWeaponDamageBonus } from '../rules/combatRules';
import { getNegativeEffectPenalties, getDeslocamentoBase, getVidaMaxima } from '../rules/statusRules';
import { getSurvivalPenalties } from '../rules/survivalRules';
import { Season, getSeason, getSeasonIcon } from '../rules/timeRules';
import { compressImageDataUrl } from '../lib/imageUtils';
import { DiceImage } from './ui/DiceImage';


import { MaterialData } from '../data/materials';


interface VTTBoardProps {
  campaignId: string;
  isMaster: boolean;
  tokens: TableToken[];
  config: TableConfig;
  availableCharacters: Character[];
  activeCharacterId: string | null;
  customMaterials?: MaterialData[];
  onAddToken?: (token: TableToken) => void;
  onAddCharacter?: (char: Character) => void;
  onRemoveToken?: (tokenId: string) => void;
  onUpdateConfig?: (config: Partial<TableConfig>) => void;
  onRollResult?: (res: any) => void;
  showToast: (message: string, type?: "error" | "success" | "info") => void;
  onUpdateCharacter?: (updatesOrFn: any, id?: string) => void;
}

// Hex constants
const HEX_RATIO = 1.1547005; // 2 / sqrt(3)

const GRID_COLORS = [
  { name: 'Branco', value: '#ffffff' },
  { name: 'Preto', value: '#000000' },
  { name: 'Cinza', value: '#6b7280' },
  { name: 'Bege', value: '#f5f5dc' },
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Verde', value: '#22c55e' },
  { name: 'Amarelo', value: '#eab308' },
  { name: 'Vermelho', value: '#ef4444' },
];

const Token = React.memo(({ token, gridSize, onDragEnd, onClick, isAttacker, isTarget, isMaster, availableCharacters, fetchedCharacters }: { 
  token: TableToken; 
  gridSize: number; 
  onDragEnd: (id: string, x: number, y: number) => void;
  onClick?: () => void;
  isAttacker?: boolean;
  isTarget?: boolean;
  isMaster?: boolean;
  availableCharacters: Character[];
  fetchedCharacters?: Record<string, Character>;
}) => {
  const [image] = useImage(token.imageUrl || '');
  const radius = (token.size * gridSize) / 2;
  const [dragDist, setDragDist] = useState(0);
  const lastPos = useRef({ x: token.x, y: token.y });
  const char = token.characterId ? (availableCharacters.find(c => c.id === token.characterId) || fetchedCharacters?.[token.characterId]) : null;
  const currentHp = char ? (char.vidaAtual ?? 0) : (token.hp ?? 0);
  const maxHp = Math.max(1, char ? getVidaMaxima(char.stats.CON) : (token.maxHp ?? 10));
  const isDead = currentHp <= 0;

  const maxMovement = char 
    ? getDeslocamentoBase(char.stats.DEX, char.efeitosNegativos, char.fome, char.sede, char.clima, 0)
    : (token.deslocamento || 6);

  // Players can only move their own tokens (tokens with characterId)
  // Creatures/Generic tokens (no characterId or monster type) can only be moved by master
  const canMove = isMaster || (token.type === 'character');

  return (
    <Group
      draggable={canMove}
      x={token.x}
      y={token.y}
      offsetX={radius}
      offsetY={radius}
      onDragStart={(e) => {
        lastPos.current = { x: e.target.x(), y: e.target.y() };
        setDragDist(0);
      }}
      onDragMove={(e) => {
        const nx = e.target.x();
        const ny = e.target.y();
        const dx = nx - lastPos.current.x;
        const dy = ny - lastPos.current.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        
        if (d > 1) { // Threshold to avoid noise
          setDragDist(prev => prev + (d / gridSize));
          lastPos.current = { x: nx, y: ny };
        }
      }} 
      onDragEnd={(e) => {
        setDragDist(0);
        onDragEnd(token.id, e.target.x(), e.target.y());
      }}
      onClick={(e) => {
        if (e) e.cancelBubble = true;
        console.log(`[VTT] Token ${token.name} clicked. ID: ${token.id}`);
        if (onClick) onClick();
      }}
      onTap={(e) => {
        if (e) e.cancelBubble = true;
        console.log(`[VTT] Token ${token.name} tapped. ID: ${token.id}`);
        if (onClick) onClick();
      }}
    >
      {(isAttacker || isTarget) && (
        <Circle
          x={radius}
          y={radius}
          radius={radius + 8}
          stroke={isAttacker ? "#3b82f6" : "#ef4444"}
          strokeWidth={4}
          dash={[10, 5]}
        />
      )}
      <Group clipFunc={(ctx) => { ctx.arc(radius, radius, radius, 0, Math.PI * 2, false); }}>
        {image ? (
          <KonvaImage
            image={image}
            width={token.size * gridSize}
            height={token.size * gridSize}
            filters={isDead ? [Konva.Filters.Grayscale] : []}
            onBeforeRender={(e) => {
               if (isDead) e.target.cache();
            }}
          />
        ) : (
          <Rect
            width={token.size * gridSize}
            height={token.size * gridSize}
            fill={isDead ? '#444' : (token.color || (token.type === 'character' ? '#3b82f6' : '#ef4444'))}
          />
        )}

        {isDead && (
          <Group x={0} y={0}>
             <Rect 
               width={token.size * gridSize} 
               height={token.size * gridSize} 
               fill="rgba(239, 68, 68, 0.2)" 
             />
          </Group>
        )}
      </Group>
      
      {/* Token Border */}
      <Circle
        x={radius}
        y={radius}
        radius={radius}
        stroke={isDead ? '#444' : (token.type === 'character' ? '#3b82f6' : '#ef4444')}
        strokeWidth={3}
        shadowBlur={10}
        shadowColor="black"
      />

      {isDead && (
        <Text
          text="☠"
          fontSize={radius * 1.2}
          fill="#ef4444"
          align="center"
          width={token.size * gridSize}
          x={0}
          y={radius - radius * 0.6}
          shadowColor="black"
          shadowBlur={10}
          opacity={0.9}
        />
      )}

      {dragDist > 0 && (
        <Text
          text={`${dragDist.toFixed(1)}m`}
          fontSize={16}
          fontStyle="bold"
          fill={dragDist > maxMovement ? "#ef4444" : "#3b82f6"}
          align="center"
          width={120}
          x={radius - 60}
          y={-60}
          shadowColor="black"
          shadowBlur={4}
        />
      )}

      <Text
        text={token.name}
        fontSize={12}
        fontStyle="bold"
        fill="white"
        align="center"
        width={120}
        x={radius - 60}
        y={(token.size * gridSize) + 12}
        shadowColor="black"
        shadowBlur={4}
        wrap="none"
      />

      {token.isDefending && (
        <Group x={radius - 12} y={-25}>
          <Circle 
            radius={12} 
            fill={token.defenseType === 'Shield' ? "rgba(59, 130, 246, 0.9)" : "rgba(161, 161, 170, 0.9)"} 
            shadowBlur={5}
            shadowColor="black"
          />
          <Text 
            text={token.defenseType === 'Shield' ? "🛡️" : "⚔️"}
            fontSize={12}
            x={-7}
            y={-6}
            fill="white"
          />
        </Group>
      )}

      {(() => {
        const effects = char ? (char.efeitosNegativos || []) : (token.efeitosNegativos || []);
        if (effects.some(e => e.isUnusable)) {
          return (
            <Group x={token.size * gridSize - 15} y={0}>
              <Circle radius={10} fill="#ef4444" shadowBlur={5} shadowColor="black" />
              <Text text="☠" fontSize={14} fill="white" x={-6} y={-7} fontStyle="bold" />
            </Group>
          );
        }
        return null;
      })()}

      {currentHp !== undefined && maxHp !== undefined && (
        <Group x={0} y={-10}>
          <Rect
            width={token.size * gridSize}
            height={4}
            fill="#333"
            cornerRadius={2}
          />
          <Rect
            width={Math.max(0, Math.min(1, currentHp / maxHp)) * (token.size * gridSize)}
            height={4}
            fill="#ef4444"
            cornerRadius={2}
          />
        </Group>
      )}
    </Group>
  );
});

export const VTTBoard: React.FC<VTTBoardProps> = React.memo(({ 
  campaignId, 
  isMaster, 
  tokens, 
  config,
  availableCharacters,
  activeCharacterId,
  customMaterials,
  onAddToken,
  onAddCharacter,
  onRemoveToken,
  onUpdateConfig,
  onRollResult,
  showToast,
  onUpdateCharacter
}) => {
  const [mapImage, mapImageStatus] = useImage(config.mapUrl || '', 'anonymous');
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 0.7 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const hasBeenCentered = useRef(false);
  
  // UI states
  const [showLeftSidebar, setShowLeftSidebar] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showCreatureModal, setShowCreatureModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);
  const [viewingCreatureId, setViewingCreatureId] = useState<string | null>(null);
  const [lootingCharId, setLootingCharId] = useState<string | null>(null);
  const [fetchedCharacters, setFetchedCharacters] = useState<Record<string, Character>>({});
  const fetchingIdsRef = useRef<Set<string>>(new Set());

  const sanitizeLocalCharacter = (char: any): Character => {
    if (!char || typeof char !== 'object') return char;
    const ensureArray = (arr: any) => Array.isArray(arr) ? arr : [];
    return {
      ...char,
      dinheiro: char.dinheiro || { C: 0, B: 0, P: 0, O: 0 },
      armas: ensureArray(char.armas || []),
      catalisadores: ensureArray(char.catalisadores || []),
      armaduras: ensureArray(char.armaduras || []),
      acessorios: ensureArray(char.acessorios || []),
      compartimentos: ensureArray(char.compartimentos || []).map((comp: any) => ({
        ...comp,
        itens: ensureArray(comp.itens || [])
      }))
    } as Character;
  };

  useEffect(() => {
    tokens.forEach(async (token) => {
      const cid = token.characterId;
      if (cid && !availableCharacters.some(c => c.id === cid) && !fetchedCharacters[cid] && !fetchingIdsRef.current.has(cid)) {
        fetchingIdsRef.current.add(cid);
        try {
          console.log(`🔍 [VTTBoard] Auto-buscando ficha ausente para o token ${token.name} (${cid})`);
          const charDoc = await getDoc(doc(db, 'characters', cid));
          if (charDoc.exists()) {
            const data = sanitizeLocalCharacter(charDoc.data());
            setFetchedCharacters(prev => ({ ...prev, [cid]: data }));
          }
        } catch (err) {
          console.error(`Erro ao buscar ficha ${cid} para token ${token.name}:`, err);
        } finally {
          fetchingIdsRef.current.delete(cid);
        }
      }
    });
  }, [tokens, availableCharacters, fetchedCharacters]);
  
  const [inputMapUrl, setInputMapUrl] = useState(config.mapUrl || '');
  const [inputGridSize, setInputGridSize] = useState(config.gridSize?.toString() || '50');
  const [inputCreatureName, setInputCreatureName] = useState('');
  const [inputCreatureIcon, setInputCreatureIcon] = useState('');
  const [inputCreatureHP, setInputCreatureHP] = useState('10');
  const [inputCreatureSize, setInputCreatureSize] = useState(1);

  const TOKEN_SIZES = [
    { label: 'Pequeno', value: 0.5 },
    { label: 'Médio', value: 1.0 },
    { label: 'Grande', value: 2.0 },
    { label: 'Gigante', value: 4.0 },
  ];

  // Combat and Selection State
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [isAttackingMode, setIsAttackingMode] = useState(false);
  const [attackerId, setAttackerId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [weaponSelectTokenId, setWeaponSelectTokenId] = useState<string | null>(null);
  const [selectedAmmoWeaponId, setSelectedAmmoWeaponId] = useState<string | null>(null);
  
  const ammoSelectWeapon = useMemo(() => {
    if (!selectedAmmoWeaponId || !weaponSelectTokenId) return null;
    const attacker = tokens.find(t => t.id === weaponSelectTokenId);
    const char = attacker?.characterId ? availableCharacters.find(c => c.id === attacker.characterId) : null;
    if (!char) return null;
    return char.armas.find((w: any) => w.id === selectedAmmoWeaponId) || 
           char.compartimentos?.flatMap((c: any) => c.itens || []).find((i: any) => i.id === selectedAmmoWeaponId);
  }, [selectedAmmoWeaponId, weaponSelectTokenId, tokens, availableCharacters]);

  const [selectedAmmoId, setSelectedAmmoId] = useState<string | null>(null);
  const [ammoOptions, setAmmoOptions] = useState<any[]>([]);
  const [chosenAttackType, setChosenAttackType] = useState<'Corte' | 'Perfuração' | 'Impacto' | null>(null);
  const [combatLog, setCombatLog] = useState<{
    msg: string, 
    type: 'success' | 'error' | 'info',
    rolls?: {val: number, sides: number}[],
    location?: string,
    locationRoll?: number,
    id?: string
  }[]>([]);

  // Subscribe to shared combat logs
  useEffect(() => {
    if (!campaignId) return;
    const unsub = subscribeToCombatLogs(campaignId, (logs) => {
      setCombatLog(logs);
    });
    return unsub;
  }, [campaignId]);
  const [sidebarTab, setSidebarTab] = useState<'creatures' | 'combat' | 'initiative' | 'generator'>('creatures');

  // Time handling functions
  // Helper to calculate Esquiva bonus for any token
  const calculateTokenEsquiva = (token: TableToken) => {
    if (token.type === 'creature') {
      return (token.stats?.esquiva || 0);
    } else if (token.type === 'character') {
      const char = availableCharacters.find(c => c.id === token.characterId);
      if (char) {
        const climateProf = calculateProficiencyBonus(char.stats, "Clima", ["ADP"], char.fome ?? 100, char.sede ?? 100, char.cansaco, undefined, undefined, 0, char.efeitosNegativos);
        return calculateProficiencyBonus(char.stats, "Esquiva", ["DEX", "ADP"], char.fome ?? 100, char.sede ?? 100, char.cansaco, char.clima, climateProf, char.bonusProficiencias?.["Esquiva"] || 0, char.efeitosNegativos);
      }
    }
    return 0;
  };

  const handleTokenHpUpdate = async (tokenId: string, newHp: number) => {
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return;

    // 1. Update Token in VTT collection
    await updateTokenPosition(campaignId, tokenId, { hp: newHp });

    // 2. If it's linked to a character, update that character's document too
    if (token.characterId) {
      const charRef = doc(db, 'characters', token.characterId);
      await updateDoc(charRef, { 
        vidaAtual: newHp,
        updatedAt: serverTimestamp()
      });
    }
  };

  const handleRollInitiative = async () => {
    if (!isMaster) return;
    await addCombatLog(campaignId, { msg: "Iniciando rodada de iniciativa...", type: 'info' });
    const results: string[] = [];
    for (const token of tokens) {
      const bonus = calculateTokenEsquiva(token);
      const roll = randomInt(1, 20);
      const total = roll + bonus;
      updateTokenPosition(campaignId, token.id, { initiative: total } as any);
      results.push(`${token.name}: ${total}`);
    }
    await addCombatLog(campaignId, { msg: `Iniciativa concluída: ${results.join(' | ')}`, type: 'success' });
  };

  const clearInitiative = async () => {
    if (!isMaster) return;
    for (const token of tokens) {
      updateTokenPosition(campaignId, token.id, { initiative: null } as any);
    }
    setCombatLog(prev => [{ msg: "Iniciativa limpa.", type: 'info' }, ...prev]);
  };

  const handleNextTurn = async () => {
    if (!isMaster) return;

    setCombatLog(prev => [{ msg: "--- INÍCIO DE NOVO TURNO ---", type: 'info' }, ...prev]);

    const batch = writeBatch(db);
    let anyChanges = false;

    // Iterate all tokens
    for (const token of tokens) {
      const tokenUpdates: any = {};
      const charUpdates: any = {};
      let hasTokenChanges = false;
      let hasCharChanges = false;

      // 1. Handle defense rounds
      if (token.isDefending) {
        const rounds = token.defenseRounds || 1;
        if (rounds > 1) {
          tokenUpdates.defenseRounds = rounds - 1;
          hasTokenChanges = true;
        } else {
          tokenUpdates.isDefending = false;
          tokenUpdates.defenseType = null;
          tokenUpdates.defenseWeaponId = null;
          tokenUpdates.defenseRounds = 0;
          hasTokenChanges = true;
        }
      }

      // 2. Bleeding damage
      const effects = token.efeitosNegativos || [];
      const penalties = getNegativeEffectPenalties(effects);
      if (penalties.bleedingDamage > 0) {
        const newHp = Math.max(0, (token.hp || 0) - penalties.bleedingDamage);
        tokenUpdates.hp = newHp;
        hasTokenChanges = true;
        
        // If it's a character, prepare Character doc update
        if (token.type === 'character' && token.characterId) {
          charUpdates.vidaAtual = newHp;
          hasCharChanges = true;
        }

        setCombatLog(prev => [{ 
          msg: `${token.name} sofreu ${penalties.bleedingDamage} de dano por SANGRAMENTO acumulado!`, 
          type: 'error' 
        }, ...prev]);
      }

      if (hasTokenChanges) {
        const tokenRef = doc(db, 'campaigns', campaignId, 'tokens', token.id);
        batch.update(tokenRef, tokenUpdates);
        anyChanges = true;
      }

      if (hasCharChanges && token.characterId) {
        const charRef = doc(db, 'characters', token.characterId);
        batch.update(charRef, charUpdates);
        anyChanges = true;
      }
    }

    if (anyChanges) {
      await batch.commit();
      setCombatLog(prev => [{ msg: "Turno processado com sucesso.", type: 'success' }, ...prev]);
    }
  };

  // Initiative and HP monitoring
  useEffect(() => {
    if (!isMaster) return;
    
    const deadTokensInInitiative = tokens.filter(t => {
      const char = t.characterId ? availableCharacters.find(c => c.id === t.characterId) : null;
      const hp = char ? (char.vidaAtual ?? 0) : (t.hp ?? 0);
      return hp <= 0 && (t.initiative !== null && t.initiative !== undefined);
    });
    
    if (deadTokensInInitiative.length > 0) {
      deadTokensInInitiative.forEach(token => {
        updateTokenPosition(campaignId, token.id, { initiative: null } as any);
      });
      setCombatLog(prev => [{ msg: `Unidades abatidas removidas da iniciativa`, type: 'info' }, ...prev]);
    }
  }, [tokens, isMaster, campaignId, availableCharacters]);

  const handleSetDefense = async (tokenId: string, type: 'Weapon' | 'Shield') => {
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return;

    if (token.type === 'creature' && !token.characterId) {
       await addCombatLog(campaignId, { msg: "Criaturas não podem usar Postura de Defesa.", type: 'error' });
       return;
    }

    const tokenUpdates = { 
      isDefending: true, 
      defenseType: type, 
      defenseRounds: 2,
      defendedAt: Date.now()
    };
    
    await updateTokenPosition(campaignId, tokenId, tokenUpdates);
    await addCombatLog(campaignId, { msg: `${token.name} entrou em postura de defesa (${type === 'Shield' ? 'Escudo' : 'Esquiva/Parada'})`, type: 'info' });
  };

  const handleReload = async (charId: string, weaponId: string, ammoId: string) => {
    const char = availableCharacters.find(c => c.id === charId);
    if (!char) return;

    let weapon = char.armas.find(w => w.id === weaponId);
    const inventoryItems = char.compartimentos?.flatMap(c => c.itens || []) || [];
    if (!weapon) {
      weapon = inventoryItems.find(i => i.id === weaponId) as any;
    }

    if (!weapon) return;

    const ammo = inventoryItems.find(i => i.id === ammoId);
    if (!ammo || (ammo.quantidade || 0) <= 0) {
      await addCombatLog(campaignId, { msg: "Você não possui munição!", type: 'error' });
      return;
    }

    const currentMagazine = (weapon as any).magazineAmmo || [];
    const maxCapacity = (weapon as any).capacidadePente || 6;
    
    if (currentMagazine.length >= maxCapacity) {
      await addCombatLog(campaignId, { msg: "O pente já está cheio!", type: 'error' });
      return;
    }

    const charUpdates: any = {};
    const newMagazine = [...currentMagazine, { ...ammo as any, quantidade: 1 }];

    // Update weapon
    charUpdates.armas = char.armas.map(w => w.id === weaponId ? { ...w, municaoCarregada: newMagazine.length, magazineAmmo: newMagazine } : w);
    
    // Update ammo quantity in compartments
    charUpdates.compartimentos = char.compartimentos.map(comp => ({
      ...comp,
      itens: comp.itens.map(it => it.id === ammoId ? { ...it, quantidade: Math.max(0, (it.quantidade || 1) - 1) } : it)
    }));

    // If weapon is in compartment
    const weaponInComp = char.compartimentos.some(c => c.itens.some(i => i.id === weaponId));
    if (weaponInComp) {
      charUpdates.compartimentos = charUpdates.compartimentos.map((comp: any) => ({
        ...comp,
        itens: comp.itens.map((it: any) => it.id === weaponId ? { ...it, municaoCarregada: newMagazine.length, magazineAmmo: newMagazine } : it)
      }));
    }

    await updateDoc(doc(db, 'characters', char.id), { ...charUpdates, updatedAt: serverTimestamp() });
    await addCombatLog(campaignId, { msg: `${char.nome} recarregou 1 munição (${ammo.nome}) em ${weapon.nome}.`, type: 'info' });
  };

  const handleReloadAll = async (charId: string, weaponId: string, ammoId: string) => {
    const char = availableCharacters.find(c => c.id === charId);
    if (!char) return;

    let weapon = char.armas.find(w => w.id === weaponId);
    const inventoryItems = char.compartimentos?.flatMap(c => c.itens || []) || [];
    if (!weapon) {
      weapon = inventoryItems.find(i => i.id === weaponId) as any;
    }

    if (!weapon) return;

    const ammo = inventoryItems.find(i => i.id === ammoId);
    if (!ammo || (ammo.quantidade || 0) <= 0) {
      await addCombatLog(campaignId, { msg: "Você não possui munição!", type: 'error' });
      return;
    }

    const currentMagazine = (weapon as any).magazineAmmo || [];
    const maxCapacity = (weapon as any).capacidadePente || 6;
    
    if (currentMagazine.length >= maxCapacity) {
      await addCombatLog(campaignId, { msg: "O pente já está cheio!", type: 'error' });
      return;
    }

    const needed = maxCapacity - currentMagazine.length;
    const amountToLoad = Math.min(ammo.quantidade || 0, needed);
    
    const charUpdates: any = {};
    const ammoToAdd = Array.from({ length: amountToLoad }, () => ({ ...ammo as any, id: generateId(), quantidade: 1 }));
    const newMagazine = [...currentMagazine, ...ammoToAdd];

    // Update weapon
    charUpdates.armas = char.armas.map(w => w.id === weaponId ? { ...w, municaoCarregada: newMagazine.length, magazineAmmo: newMagazine } : w);
    
    // Update ammo quantity in compartments
    charUpdates.compartimentos = char.compartimentos.map(comp => ({
      ...comp,
      itens: comp.itens.map(it => it.id === ammoId ? { ...it, quantidade: Math.max(0, (it.quantidade || 0) - amountToLoad) } : it)
    }));

    // If weapon is in compartment
    const weaponInComp = char.compartimentos.some(c => c.itens.some(i => i.id === weaponId));
    if (weaponInComp) {
      charUpdates.compartimentos = charUpdates.compartimentos.map((comp: any) => ({
        ...comp,
        itens: comp.itens.map((it: any) => it.id === weaponId ? { ...it, municaoCarregada: newMagazine.length, magazineAmmo: newMagazine } : it)
      }));
    }

    await updateDoc(doc(db, 'characters', char.id), { ...charUpdates, updatedAt: serverTimestamp() });
    await addCombatLog(campaignId, { msg: `${char.nome} recarregou ${amountToLoad} munições (${ammo.nome}) em ${weapon.nome}.`, type: 'info' });
  };

  const [clipBoardItem, setClipBoardItem] = useState<{item: any, sourceId: string, charId: string, type: 'cut' | 'copy'} | null>(null);

  const deepCleanData = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(deepCleanData);
    
    // Only recurse into plain objects to avoid breaking Firestore-specific types (Timestamp, FieldValue, etc.)
    const proto = Object.getPrototypeOf(obj);
    if (proto !== null && proto !== Object.prototype) return obj;

    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, deepCleanData(v)])
    );
  };

  const updateCharacterState = async (charId: string, updates: any) => {
    // 1. Always update our locally cached fetchedCharacters FIRST so the UI updates instantly
    setFetchedCharacters(prev => {
      const existing = prev[charId] || availableCharacters.find(c => c.id === charId);
      if (existing) {
        return {
          ...prev,
          [charId]: { ...existing, ...updates }
        };
      }
      return prev;
    });

    // 2. Check if the character is a private player character created and owned by us (not a Monster/NPC)
    const isOwn = availableCharacters.some(c => 
      c.id === charId && 
      c.etnia !== 'Monstro' && 
      c.userId !== 'monster' && 
      (c.userId === auth.currentUser?.uid || c.userEmail === auth.currentUser?.email)
    );
    
    if (isOwn && onUpdateCharacter) {
      console.log(`[VTT] Updating own character ${charId} locally and trigger sync.`, updates);
      onUpdateCharacter(updates, charId);
    } else {
      // 3. Otherwise update directly via Firestore (e.g. NPC or monster campaign sheet)
      console.log(`[VTT] Updating character ${charId} directly in Firestore.`, updates);
      const cleanUpdate = deepCleanData({ ...updates, updatedAt: serverTimestamp() });
      const charRef = doc(db, 'characters', charId);
      
      try {
        // Use setDoc with { merge: true } to prevent "document not found" errors when creating on-the-fly
        await setDoc(charRef, cleanUpdate, { merge: true });
        console.log(`✅ [VTT] Sincronização direta Firestore concluída para ${charId}.`);
      } catch (fError) {
        console.warn(`[VTT] setDoc falhou para ${charId}, tentando updateDoc fallback:`, fError);
        try {
          await updateDoc(charRef, cleanUpdate);
          console.log(`✅ [VTT] Sincronização de backup updateDoc direta concluída para ${charId}.`);
        } catch (uError) {
          console.warn(`⚠️ [VTT] Falha ao sincronizar ficha diretamente em Firestore (pode ser restrição de permissão de saque para jogadores):`, uError);
          // Do not rethrow so that local looting / state works perfectly without throwing exception
        }
      }
    }
  };

  const handleCutItem = (charId: string, sourceId: string, item: any) => {
    setClipBoardItem({ item, sourceId, charId, type: 'cut' });
    setCombatLog(prev => [{ msg: `Item "${item.nome}" recortado.`, type: 'info' }, ...prev]);
  };

  const handlePasteItem = async (targetCharId: string, targetCompId?: string) => {
    if (!clipBoardItem) return;

    const sourceChar = fetchedCharacters[clipBoardItem.charId] || availableCharacters.find(c => c.id === clipBoardItem.charId);
    const targetChar = fetchedCharacters[targetCharId] || availableCharacters.find(c => c.id === targetCharId);

    if (!sourceChar || !targetChar) {
       console.error("Paste error: Source or Target character not found", { sourceId: clipBoardItem.charId, targetId: targetCharId });
       return;
    }

    const charUpdates: any = {};
    
    // 1. Remove from source
    if (clipBoardItem.type === 'cut') {
       if (clipBoardItem.sourceId === 'armas') {
          charUpdates.armas = (sourceChar.armas || []).filter(i => i.id !== clipBoardItem.item.id);
       } else if (clipBoardItem.sourceId === 'catalisadores') {
          charUpdates.catalisadores = (sourceChar.catalisadores || []).filter(i => i.id !== clipBoardItem.item.id);
       } else if (clipBoardItem.sourceId === 'armaduras') {
          charUpdates.armaduras = (sourceChar.armaduras || []).filter(i => i.id !== clipBoardItem.item.id);
       } else if (clipBoardItem.sourceId === 'acessorios') {
          charUpdates.acessorios = (sourceChar.acessorios || []).filter(i => i.id !== clipBoardItem.item.id);
       } else {
          charUpdates.compartimentos = (sourceChar.compartimentos || []).map(comp => ({
            ...comp,
            itens: (comp.itens || []).filter(i => i.id !== clipBoardItem.item.id)
          }));
       }
    }

    // 2. Add to target
    const targetUpdates: any = (sourceChar.id === targetChar.id) ? charUpdates : {};
    const finalTargetChar = (sourceChar.id === targetChar.id) ? { ...targetChar, ...charUpdates } : targetChar;

    if (clipBoardItem.sourceId === 'armas') {
      targetUpdates.armas = [...(finalTargetChar.armas || []), clipBoardItem.item];
    } else if (clipBoardItem.sourceId === 'catalisadores') {
      targetUpdates.catalisadores = [...(finalTargetChar.catalisadores || []), clipBoardItem.item];
    } else if (clipBoardItem.sourceId === 'armaduras') {
      targetUpdates.armaduras = [...(finalTargetChar.armaduras || []), clipBoardItem.item];
    } else if (clipBoardItem.sourceId === 'acessorios') {
      targetUpdates.acessorios = [...(finalTargetChar.acessorios || []), clipBoardItem.item];
    } else {
      // Use provided compartment ID or fallback to the first one available
      const destinationCompId = targetCompId || (finalTargetChar.compartimentos?.length > 0 ? finalTargetChar.compartimentos[0].id : null);

      if (!destinationCompId) {
         console.error("Paste error: No target compartment found for character", targetChar.nome);
         return;
      }

      targetUpdates.compartimentos = (finalTargetChar.compartimentos || []).map(comp => {
        if (comp.id === destinationCompId) {
          return { ...comp, itens: [...(comp.itens || []), clipBoardItem.item] };
        }
        return comp;
      });
    }

    try {
      if (sourceChar.id === targetChar.id) {
         await updateCharacterState(sourceChar.id, targetUpdates);
      } else {
         // Primeiro atualiza o destino (nossa própria ficha, garantido)
         await updateCharacterState(targetChar.id, targetUpdates);
         
         // Depois atualiza a origem (ficha alheia ou criatura, lidando de forma amigável se falhar por permissão)
         try {
           await updateCharacterState(sourceChar.id, charUpdates);
         } catch (sourceError) {
           console.warn("⚠️ Falha amigável ao atualizar origem durante transferência de item (Paste/Cut):", sourceError);
         }
      }
      
      const itemName = clipBoardItem.item.nome || "Item";
      await addCombatLog(campaignId, { 
        msg: `${targetChar.nome} saqueou "${itemName}" de ${sourceChar.nome}.`, 
        type: 'success' 
      });
      
      setClipBoardItem(null);
    } catch (error) {
      console.error("Error during item paste/transfer:", error);
      await addCombatLog(campaignId, { msg: "Erro técnico ao transferir item. Tente novamente.", type: 'error' });
    }
  };

  const handleTransferItem = async (sourceCharId: string, targetCharId: string, sourceCategory: string, item: any) => {
    try {
      console.log(`[Loot] Transferring item ${item.nome} from ${sourceCharId} to ${targetCharId}`);
      const sourceChar = fetchedCharacters[sourceCharId] || availableCharacters.find(c => c.id === sourceCharId);
      const targetChar = fetchedCharacters[targetCharId] || availableCharacters.find(c => c.id === targetCharId);

      if (!sourceChar || !targetChar) {
        console.error("Transfer error: Source or Target character not found", { sourceId: sourceCharId, targetId: targetCharId });
        return;
      }

      const charUpdates: any = {};
      
      // 1. Remove from source
      if (sourceCategory === 'armas') {
        charUpdates.armas = (sourceChar.armas || []).filter(i => i.id !== item.id);
      } else if (sourceCategory === 'catalisadores') {
        charUpdates.catalisadores = (sourceChar.catalisadores || []).filter(i => i.id !== item.id);
      } else if (sourceCategory === 'armaduras') {
        charUpdates.armaduras = (sourceChar.armaduras || []).filter(i => i.id !== item.id);
      } else if (sourceCategory === 'acessorios') {
        charUpdates.acessorios = (sourceChar.acessorios || []).filter(i => i.id !== item.id);
      } else if (sourceCategory.startsWith('comp_')) {
        const compId = sourceCategory.replace('comp_', '');
        charUpdates.compartimentos = (sourceChar.compartimentos || []).map(comp => {
          if (comp.id === compId) {
            return { ...comp, itens: (comp.itens || []).filter(i => i.id !== item.id) };
          }
          return comp;
        });
      }

      // 2. Add to target
      const targetUpdates: any = (sourceChar.id === targetChar.id) ? charUpdates : {};
      const finalTargetChar = (sourceChar.id === targetChar.id) ? { ...targetChar, ...charUpdates } : targetChar;

      if (sourceChar.id === targetChar.id) {
        // Moving internally within the same character: keep the existing category lists
        if (sourceCategory === 'armas') {
          targetUpdates.armas = [...(finalTargetChar.armas || []), item];
        } else if (sourceCategory === 'catalisadores') {
          targetUpdates.catalisadores = [...(finalTargetChar.catalisadores || []), item];
        } else if (sourceCategory === 'armaduras') {
          targetUpdates.armaduras = [...(finalTargetChar.armaduras || []), item];
        } else if (sourceCategory === 'acessorios') {
          targetUpdates.acessorios = [...(finalTargetChar.acessorios || []), item];
        } else {
          const destinationCompId = finalTargetChar.compartimentos?.length > 0 ? finalTargetChar.compartimentos[0].id : null;
          if (!destinationCompId) {
            showToast(`Mover falhou: ${targetChar.nome} não possui compartimentos.`, "error");
            return;
          }
          targetUpdates.compartimentos = (finalTargetChar.compartimentos || []).map(comp => {
            if (comp.id === destinationCompId) {
              return { ...comp, itens: [...(comp.itens || []), item] };
            }
            return comp;
          });
        }
      } else {
        // Saque do inimigo para nossa mochila (must go to backpack/compartimentos!)
        const destinationCompId = finalTargetChar.compartimentos?.length > 0 ? finalTargetChar.compartimentos[0].id : null;

        if (!destinationCompId) {
          showToast(`Saque falhou: ${targetChar.nome} não possui compartimentos.`, "error");
          return;
        }

        // Convert the equipment (Weapon, Catalyst, Armor, Accessory) to a generic Item in the backpack
        let mappedItem = { ...item };
        
        if (sourceCategory === 'armas') {
          mappedItem = {
            id: item.id || generateId(),
            nome: item.nome || "Arma Saqueada",
            peso: item.peso || 0,
            volume: item.volume || 0,
            quantidade: 1,
            tipo: 'Arma',
            durabilidade: item.durabilidade ?? 100,
            maxDurabilidade: item.maxDurabilidade ?? 100,
            descricao: item.descricao || item.efeito || '',
            dano: item.dano,
            acerto: item.acerto,
            escala: item.escala,
            atributoBase: item.atributoBase,
            corte: item.corte,
            impacto: item.impacto,
            perfuracao: item.perfuracao,
            resistencia: item.resistencia
          };
        } else if (sourceCategory === 'catalisadores') {
          mappedItem = {
            id: item.id || generateId(),
            nome: item.nome || "Catalisador Saqueado",
            peso: item.peso || 0,
            volume: item.volume || 0,
            quantidade: 1,
            tipo: 'Catalisador',
            durabilidade: item.durabilidade ?? 100,
            maxDurabilidade: item.maxDurabilidade ?? 100,
            descricao: item.descricao || '',
            feitico: item.feitico,
            elemental: item.elemental,
            magiaNegra: item.magiaNegra,
            potencial: item.potencial
          };
        } else if (sourceCategory === 'armaduras') {
          mappedItem = {
            id: item.id || generateId(),
            nome: item.nome || "Armadura Saqueada",
            peso: item.peso || 0,
            volume: item.volume || 0,
            quantidade: 1,
            tipo: 'Armadura',
            durabilidade: item.durabilidade ?? 100,
            maxDurabilidade: item.durabilidade ?? 100,
            descricao: item.descricao || item.efeito || '',
            reducaoDano: item.reducaoDano,
            efeito: item.efeito,
            corte: item.corte,
            impacto: item.impacto,
            perfuracao: item.perfuracao
          };
        } else if (sourceCategory === 'acessorios') {
          mappedItem = {
            id: item.id || generateId(),
            nome: item.nome || "Acessório Saqueado",
            peso: item.peso || 0,
            volume: item.volume || 0,
            quantidade: 1,
            tipo: 'Acessório',
            durabilidade: item.durabilidade ?? 100,
            maxDurabilidade: item.durabilidade ?? 100,
            descricao: item.descricao || item.efeito || '',
            efeito: item.efeito
          };
        } else {
          mappedItem.quantidade = mappedItem.quantidade || 1;
        }

        targetUpdates.compartimentos = (finalTargetChar.compartimentos || []).map(comp => {
          if (comp.id === destinationCompId) {
            return { ...comp, itens: [...(comp.itens || []), mappedItem] };
          }
          return comp;
        });
      }

      if (sourceChar.id === targetChar.id) {
        await updateCharacterState(sourceChar.id, targetUpdates);
      } else {
        // Primeiro atualiza o destino (nossa própria ficha, garantido)
        await updateCharacterState(targetChar.id, targetUpdates);
        
        // Depois atualiza a origem (ficha alheia ou criatura, lidando de forma amigável se falhar por permissão)
        try {
          await updateCharacterState(sourceChar.id, charUpdates);
        } catch (sourceError) {
          console.warn("⚠️ Falha amigável ao atualizar origem durante saque (Transfer):", sourceError);
        }
      }

      await addCombatLog(campaignId, { 
        msg: `${targetChar.nome} saqueou "${item.nome || 'item'}" de ${sourceChar.nome}.`, 
        type: 'success' 
      });
    } catch (error) {
      console.error("Error during transfer:", error);
      showToast("Erro ao saquear item.", "error");
    }
  };

  const synthesizeCharacterFromToken = (token: TableToken, campaignId: string): Character => {
    const charId = token.characterId || generateId();
    
    const parseNum = (val: any) => {
      const num = parseInt(val?.toString());
      return isNaN(num) ? 0 : num;
    };

    const armas = (token.acoes || []).map((action) => ({
      id: generateId(),
      nome: action.name || "Aquelecorte",
      tipo: action.type || "Major",
      dano: action.dano || "1d6",
      acerto: typeof action.acerto === 'number' ? action.acerto : parseNum(action.acerto),
      atributoBase: 'Força',
      escala: '0',
      peso: 0,
      volume: 0,
      durabilidade: 100,
      maxDurabilidade: 100,
      corte: action.categoria === 'Corte' ? 4 : 0,
      perfuracao: action.categoria === 'Perfuração' ? 4 : 0,
      impacto: action.categoria === 'Impacto' ? 4 : 0,
      resistencia: 0,
      efeito: action.description || ''
    }));

    return {
      id: charId,
      userId: auth.currentUser?.uid || 'monster',
      nome: token.name || 'Criatura',
      etnia: 'Monstro',
      campaignId: campaignId,
      dinheiro: { C: 0, B: 0, P: 0, O: 0 },
      vidaAtual: token.hp || 10,
      manaAtual: 0,
      sanidadeAtual: 0,
      fome: 100,
      sede: 100,
      cansaco: 8,
      defesa: {
        "Cabeça": parseNum(token.stats?.defesa?.corte),
        "Tronco": parseNum(token.stats?.defesa?.feitico),
        "Braço Esquerdo": parseNum(token.stats?.defesa?.perfuracao),
        "Braço Direito": parseNum(token.stats?.defesa?.impacto),
        "Pernas": parseNum(token.stats?.defesa?.feitico)
      },
      clima: 0,
      stats: {
        CON: parseNum(token.stats?.defesa?.impacto) || 10,
        RES: parseNum(token.stats?.defesa?.feitico) || 10,
        ADP: 0,
        MEN: 0,
        APR: 0,
        FOR: parseNum(token.stats?.ataque?.corte) || 10,
        DEX: parseNum(token.stats?.ataque?.perfuracao) || 10,
        INT: parseNum(token.stats?.ataque?.feitico) || 10,
        RIT: parseNum(token.stats?.ataque?.potencial) || 10
      },
      statsXP: { CON: 0, RES: 0, ADP: 0, MEN: 0, APR: 0, FOR: 0, DEX: 0, INT: 0, RIT: 0 },
      joias: [],
      imagem: token.imageUrl || '',
      armas: armas as any[],
      catalisadores: [],
      habilidades: [],
      magias: [],
      armaduras: [],
      acessorios: [],
      compartimentos: [
        { id: generateId(), nome: "Espólios", volumeMax: 100, itens: [], externo: false },
        { id: generateId(), nome: "Mochila de Viagem", volumeMax: 50, itens: [], externo: false },
        { id: generateId(), nome: "Bolsa de Cinto", volumeMax: 3, itens: [], externo: false }
      ],
      conhecimentos: [],
      escalas: [],
      efeitosNegativos: token.efeitosNegativos || [],
      anotacoes: [],
      dadosCustomizados: [],
      imagens: [],
      itens: []
    };
  };

  const handleLoot = async (token: TableToken) => {
    console.log("🔥 [Loot] Iniciando saque para token:", token.name, "ID da Ficha:", token.characterId);
    
    if (!token.characterId) {
       console.warn("⚠️ [Loot] Token sem characterId vinculado.");
       showToast(`O token "${token.name}" não possui uma ficha vinculada.`, "error");
       return;
    }

    let targetChar = fetchedCharacters[token.characterId] || availableCharacters.find(c => c.id === token.characterId);
    
    if (!targetChar) {
       try {
         const charDoc = await getDoc(doc(db, 'characters', token.characterId));
         if (charDoc.exists()) {
           const data = sanitizeLocalCharacter(charDoc.data());
           setFetchedCharacters(prev => ({ ...prev, [token.characterId!]: data }));
           targetChar = data;
         }
       } catch (err) {
         console.error("Erro ao buscar ficha diretamente no saque:", err);
       }
    }

    // Se ainda não encontrou, aguarda propagação no banco (retry único de 800ms)
    if (!targetChar) {
       console.log("⏳ [Loot] Ficha não encontrada de primeira. Aguardando 800ms para propagação e tentando novamente...");
       await new Promise(resolve => setTimeout(resolve, 800));
       
       targetChar = fetchedCharacters[token.characterId] || availableCharacters.find(c => c.id === token.characterId);
       if (!targetChar) {
          try {
            const charDoc = await getDoc(doc(db, 'characters', token.characterId));
            if (charDoc.exists()) {
              const data = sanitizeLocalCharacter(charDoc.data());
              setFetchedCharacters(prev => ({ ...prev, [token.characterId!]: data }));
              targetChar = data;
            }
          } catch (err) {
            console.error("Erro na segunda tentativa de buscar ficha:", err);
          }
       }
    }
    
    // Auto-sintetizar se continuar nula, garantindo que o saque nunca trave ou falte ficha!
    if (!targetChar) {
       console.log("⚠️ [Loot] Ficha não encontrada após retries. Sintetizando ficha de backup em tempo real...");
       const tempChar = synthesizeCharacterFromToken(token, campaignId);
       setFetchedCharacters(prev => ({ ...prev, [token.characterId!]: tempChar }));
       targetChar = tempChar;
       
       saveCharacterToFirestore(tempChar)
         .then(() => console.log(`✅ [Loot] Ficha sintetizada com sucesso para ${tempChar.nome}.`))
         .catch(err => console.error(`[Loot] Erro ao sincronizar ficha sintetizada:`, err));
    } else {
       // Garante que a ficha está registrada no estado de cache local de saque com os dados mais recentes
       setFetchedCharacters(prev => ({ ...prev, [token.characterId!]: targetChar }));
    }

    console.log("✅ [Loot] Ficha encontrada/sintetizada:", targetChar.nome);
    setLootingCharId(targetChar.id);
    setSelectedTokenId(null); 
    showToast(`Vasculhando espólios de ${token.name}...`, "info");
  };

  const handleLootMoney = async (sourceCharId: string) => {
    if (!activeCharacterId) {
      await addCombatLog(campaignId, { msg: "Você precisa estar com uma ficha aberta para saquear dinheiro.", type: 'error' });
      return;
    }

    const sourceChar = fetchedCharacters[sourceCharId] || availableCharacters.find(c => c.id === sourceCharId);
    const targetChar = fetchedCharacters[activeCharacterId] || availableCharacters.find(c => c.id === activeCharacterId);
    
    if (!sourceChar || !targetChar) return;

    const totalMoney = (sourceChar.dinheiro?.C || 0) + (sourceChar.dinheiro?.B || 0) + (sourceChar.dinheiro?.P || 0) + (sourceChar.dinheiro?.O || 0);
    if (totalMoney === 0) {
      await addCombatLog(campaignId, { msg: "Não há dinheiro para saquear.", type: 'info' });
      return;
    }

    const targetDinheiro = {
      C: (targetChar.dinheiro?.C || 0) + (sourceChar.dinheiro?.C || 0),
      B: (targetChar.dinheiro?.B || 0) + (sourceChar.dinheiro?.B || 0),
      P: (targetChar.dinheiro?.P || 0) + (sourceChar.dinheiro?.P || 0),
      O: (targetChar.dinheiro?.O || 0) + (sourceChar.dinheiro?.O || 0),
    };

    const sourceDinheiro = { C: 0, B: 0, P: 0, O: 0 };

    // Primeiro atualiza o destino (nossa própria ficha, garantido)
    await updateCharacterState(targetChar.id, { dinheiro: targetDinheiro });

    // Depois atualiza a origem (ficha alheia ou criatura, lidando de forma amigável se falhar por permissão)
    try {
      await updateCharacterState(sourceChar.id, { dinheiro: sourceDinheiro });
    } catch (sourceError) {
      console.warn("⚠️ Falha amigável ao atualizar moedas da origem durante saque:", sourceError);
    }

    await addCombatLog(campaignId, { 
      msg: `${targetChar.nome} saqueou todas as moedas de ${sourceChar.nome}.`, 
      type: 'success' 
    });
  };

  // Helper to map UI names to property keys
  const getMapKey = (cat: string) => {
    if (!cat) return 'corte';
    const c = cat.toLowerCase();
    
    if (c.includes('corte')) return 'corte';
    if (c.includes('perfu') || c.includes('perf')) return 'perfuracao';
    if (c.includes('imp') || c.includes('impacto')) return 'impacto';
    if (c.includes('feit') || c.includes('feitiço')) return 'feitico';
    if (c.includes('elem') || c.includes('elemental')) return 'elemental';
    if (c.includes('magia') || c.includes('negra')) return 'magiaNegra';
    
    return 'corte';
  };

  const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const isWithinReach = (t1: TableToken, t2: TableToken, grid: number) => {
    const dist = getDistance(t1, t2);
    const r1 = (t1.size * grid) / 2;
    const r2 = (t2.size * grid) / 2;
    return dist <= (r1 + r2 + grid * 0.5); // Add 0.5 grid buffer for "close"
  };

  const checkAdvantage = (attacker: TableToken, target: TableToken, allTokens: TableToken[], grid: number) => {
    const targetEffects = target.efeitosNegativos || [];
    const hasVulnerableEffect = targetEffects.some(e => ['Caído', 'Tonto', 'Preso Parcialmente'].includes(e.type));
    if (hasVulnerableEffect) return true;

    // Both characters and creatures can flank
    const alliesOfAttacker = allTokens.filter(t => t.id !== attacker.id && t.type === attacker.type);
    const flankingAllies = alliesOfAttacker.filter(allied => {
      const distMeters = getDistance(allied, target) / grid;
      return distMeters <= 2.0; // "flanquear funciona se os dois personagens estiverem a pelo menos 2 metros do alvo" (interpreting as within 2m)
    });
    
    if (flankingAllies.length >= 1) return true; 

    return false;
  };

  const lastCenter = useRef<any>(null);
  const lastDist = useRef<number>(0);

  // Effect to sync map url and grid size inputs with config
  useEffect(() => {
    if (config.mapUrl) {
      setInputMapUrl(config.mapUrl);
    }
  }, [config.mapUrl]);

  useEffect(() => {
    if (config.gridSize) {
      setInputGridSize(config.gridSize.toString());
    }
  }, [config.gridSize]);

  // Handle centering
  useEffect(() => {
    hasBeenCentered.current = false;
  }, [config.mapUrl]);

  useEffect(() => {
    if (dimensions.width > 100 && !hasBeenCentered.current) {
      if (mapImageStatus === 'loaded' && mapImage) {
        setViewport({
          x: dimensions.width / 2 - (mapImage.width / 2) * viewport.scale,
          y: dimensions.height / 2 - (mapImage.height / 2) * viewport.scale,
          scale: viewport.scale
        });
        hasBeenCentered.current = true;
      } else if (mapImageStatus === 'failed' || !config.mapUrl) {
        const gridSize = config.gridSize || 50;
        const gridWidth = 40 * (gridSize * 1.1547 * 0.75);
        const gridHeight = 40 * gridSize;
        setViewport({
          x: dimensions.width / 2 - (gridWidth / 2) * viewport.scale,
          y: dimensions.height / 2 - (gridHeight / 2) * viewport.scale,
          scale: viewport.scale
        });
        hasBeenCentered.current = true;
      }
    }
  }, [mapImageStatus, mapImage, dimensions, viewport.scale, config.mapUrl, config.gridSize]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          console.log("[VTT] Resize observed:", entry.contentRect.width, entry.contentRect.height);
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleDragEnd = (id: string, x: number, y: number) => {
    const token = tokens.find(t => t.id === id);
    if (token) {
      updateTokenPosition(campaignId, id, { x, y, prevX: token.x, prevY: token.y });
    }
  };

  const handleUndoMove = () => {
    if (!selectedTokenId) return;
    const token = tokens.find(t => t.id === selectedTokenId);
    if (token && token.prevX !== undefined && token.prevY !== undefined) {
      updateTokenPosition(campaignId, token.id, { x: token.prevX, y: token.prevY });
    }
  };

  const handleDefend = (type: 'Shield' | 'Weapon', weaponId?: string) => {
    if (!selectedTokenId) return;
    const token = tokens.find(t => t.id === selectedTokenId);
    if (!token) return;

    // Toggle logic: if already defending with this item, clear it
    if (token.isDefending && token.defenseType === type && token.defenseWeaponId === weaponId) {
      updateTokenPosition(campaignId, selectedTokenId, { 
        isDefending: false, 
        defenseType: null, 
        defenseWeaponId: null,
        defenseRounds: 0
      });
      setCombatLog(prev => [{ msg: `Postura de defesa de ${token.name} cancelada`, type: 'info' }, ...prev]);
    } else {
      updateTokenPosition(campaignId, selectedTokenId, { 
          isDefending: true, 
          defenseType: type, 
          defenseWeaponId: weaponId,
          defendedAt: Date.now(),
          defenseRounds: 2 // Lasts current + next turn
      });
      setCombatLog(prev => [{ msg: `${token.name} preparou postura de defesa (${type === 'Shield' ? 'Escudo' : 'Arma'})`, type: 'info' }, ...prev]);
    }

    setSelectedTokenId(null);
  };

  const handleTokenClick = (tokenId: string) => {
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return;

    if (isAttackingMode && attackerId && tokenId !== attackerId) {
      setTargetId(tokenId);
      setWeaponSelectTokenId(attackerId);
      return;
    }

    const char = token.characterId ? availableCharacters.find(c => c.id === token.characterId) : null;
    const isOwner = char && (char.userEmail === auth.currentUser?.email || isMaster);
    
    console.log(`[VTT] Clicked token: ${token.name}. Type: ${token.type}. CharId: ${token.characterId}. FoundChar: ${!!char}. IsOwner: ${isOwner}`);
    
    // Always allow clicking to open menu if it's a creature or character (for loot/info)
    setSelectedTokenId(tokenId === selectedTokenId ? null : tokenId);
  };

  const startAttack = (tokenId: string) => {
    setIsAttackingMode(true);
    setAttackerId(tokenId);
    setCombatLog([{ msg: "Selecione o alvo do ataque...", type: 'info' }]);
  };

  const resolveCombat = async (actionOrWeapon: any, forcedType?: 'Corte' | 'Perfuração' | 'Impacto') => {
    const getVal = (obj: any, key: string) => {
      if (!obj) return 0;
      const k = key.toLowerCase();
      
      // First try to find exact property with variations in casing
      const keys = Object.keys(obj);
      const exactMatch = keys.find(xk => xk.toLowerCase() === k);
      if (exactMatch && typeof obj[exactMatch] === 'number') return obj[exactMatch];

      // Handle specific mappings
      if (k.includes('corte')) {
        return Number(obj.corte ?? obj.Corte ?? obj.CorteC ?? obj.corteC ?? obj.Corte_C ?? obj.corte_c ?? 0);
      }
      if (k.includes('perfur')) {
        return Number(obj.perfuracao ?? obj.perfuração ?? obj.Perfuracao ?? obj.Perfuração ?? obj.Perfuraçãoc ?? obj.perfuraçãoc ?? obj.Perfuração_c ?? obj.perfuração_c ?? 0);
      }
      if (k.includes('impacto')) {
        return Number(obj.impacto ?? obj.Impacto ?? obj.ImpactoC ?? obj.impactoC ?? obj.Impacto_c ?? obj.impacto_c ?? 0);
      }
      if (k.includes('fogo') || k.includes('elemental')) {
        return Number(obj.elemental ?? obj.Fogo ?? obj.fogo ?? obj.fogoC ?? obj.FogoC ?? 0);
      }
      if (k.includes('magia') || k.includes('feitico')) {
        return Number(obj.feitico ?? obj.magia ?? obj.Magia ?? obj.magiaC ?? obj.MagiaC ?? 0);
      }
      
      // Fallback to searching for partial key
      const partialMatch = keys.find(xk => xk.toLowerCase().includes(k));
      if (partialMatch) return Number(obj[partialMatch] ?? 0);

      return Number(obj[key] ?? 0);
    };

    try {
      if (!attackerId || !targetId) return;

      const attacker = tokens.find(t => t.id === attackerId);
      const target = tokens.find(t => t.id === targetId);
      const attackerChar = availableCharacters.find(c => c.id === attacker?.characterId) || (attacker?.characterId ? fetchedCharacters[attacker.characterId] : undefined);
      const targetChar = availableCharacters.find(c => c.id === target?.characterId) || (target?.characterId ? fetchedCharacters[target.characterId] : undefined);
      
      if (!attacker || !target) return;

      const defenseClear = { 
        isDefending: false, 
        defenseType: null, 
        defenseWeaponId: null, 
        defenseRounds: 0 
      };

      // Hydrate weapon/spell data if possible
      let hydratedAction = { ...actionOrWeapon };
      if (attackerChar) {
        const inventoryItems = attackerChar.compartimentos?.flatMap(c => c.itens || []) || [];
        const weapon = attackerChar.armas.find(w => w.id === actionOrWeapon.id);
        const spell = attackerChar.magias.find(s => s.id === actionOrWeapon.id);
        const ability = (attackerChar.habilidades || []).find(h => h.id === actionOrWeapon.id);
        const item = inventoryItems.find(i => i.id === actionOrWeapon.id);

        if (weapon) hydratedAction = { ...weapon, type: 'weapon' };
        else if (spell) hydratedAction = { ...spell, type: 'spell' };
        else if (ability) hydratedAction = { ...ability, type: 'ability' };
        else if (item) hydratedAction = { ...item, type: 'item' };
      }
      const action = hydratedAction;

      // 0. Ammo/Quantity Check
      const isFirearm = (action.categoria === 'Arma de Fogo');
      const isBow = (action.categoria === 'Arco');
      
      let actingBullet: any = null;
      if (isFirearm && action.magazineAmmo && action.magazineAmmo.length > 0) {
        actingBullet = action.magazineAmmo[0];
      }

      if (isFirearm) {
        if ((action.municaoCarregada || 0) <= 0) {
          setCombatLog(prev => [{ msg: `A arma "${action.nome}" está descarregada!`, type: 'error' }, ...prev]);
          setIsAttackingMode(false);
          setAttackerId(null);
          setTargetId(null);
          return;
        }
        if ((action.durabilidade || 0) <= 0 && (action.maxDurabilidade || 0) <= 0) {
          setCombatLog(prev => [{ msg: `A arma "${action.nome}" está quebrada e não pode mais disparar!`, type: 'error' }, ...prev]);
          setIsAttackingMode(false);
          setAttackerId(null);
          setTargetId(null);
          return;
        }
      }

      if (action.quantidade !== undefined && action.quantidade <= 0) {
        setCombatLog(prev => [{ msg: `Você não possui mais unidades de "${action.nome}"!`, type: 'error' }, ...prev]);
        setIsAttackingMode(false);
        setAttackerId(null);
        setTargetId(null);
        return;
      }

      // 1. Identify Attack Type, Level and Resistance/Potential
      let attackType: 'Corte' | 'Perfuração' | 'Impacto' | 'Elemental' | 'Magia Negra' = 'Corte';
      let attackLevel = 0;
      let attackerResonance = 0;
      
      const isPhysical = (type: string) => ['Corte', 'Perfuração', 'Impacto'].includes(type);

      if (attacker.type === 'creature' && attacker.stats) {
        const v: any = { 
          'Corte': getVal(action, 'Corte'), 
          'Perfuração': getVal(action, 'Perfuração'), 
          'Impacto': getVal(action, 'Impacto') 
        };
        const maxV = Math.max(v.Corte, v.Perfuração, v.Impacto);

        if (maxV > 0) {
          if (forcedType && v[forcedType] > 0) attackType = forcedType;
          else if (chosenAttackType && (v as any)[chosenAttackType] > 0) attackType = chosenAttackType as any;
          else attackType = Object.entries(v).reduce((a: any, b: any) => a[1] > b[1] ? a : b)[0] as any;
          attackLevel = v[attackType];
          attackerResonance = Number(action.resistencia) || 0;
        } else {
          attackType = forcedType || chosenAttackType || action.categoria || 'Corte';
          const key = getMapKey(attackType);
          attackLevel = (attacker.stats.ataque as any)[key] || 0;
          attackerResonance = isPhysical(attackType) 
            ? (attacker.stats.ataque.resistencia || 0) 
            : (attacker.stats.ataque.potencial || 0);
        }
      } else if (attacker.type === 'character' && attackerChar) {
        if (action.escola) {
          attackType = forcedType || action.escola;
          const inventoryItems = attackerChar.compartimentos?.flatMap(c => c.itens || []) || [];
          const inventoryCatalysts = inventoryItems.filter(i => (i as any).tipo === 'Catalisador' || (i as any).feitico || (i as any).elemental || (i as any).magiaNegra);
          const allCatalysts = [...attackerChar.catalisadores, ...inventoryCatalysts];
          const katKey = getMapKey(attackType);
          const bestCatalyst = allCatalysts.reduce((best, curr) => {
            if (!best) return curr;
            const bestVal = (best as any)[katKey] || 0;
            const currVal = (curr as any)[katKey] || 0;
            return currVal > bestVal ? curr : best;
          }, null as any);
          attackLevel = bestCatalyst ? ((bestCatalyst as any)[katKey] || 0) : 0;
          attackerResonance = bestCatalyst ? (bestCatalyst.potencial || 0) : 0;
        } else {
          let v: any = { 
            'Corte': getVal(action, 'Corte'), 
            'Perfuração': getVal(action, 'Perfuração'), 
            'Impacto': getVal(action, 'Impacto'),
            'Elemental': getVal(action, 'Elemental') || getVal(action, 'Fogo')
          };

          // Fallback for monster actions that don't have level properties but follow a category
          const monsterAction = action as MonsterAction;
          if (v.Corte === 0 && v['Perfuração'] === 0 && v.Impacto === 0) {
            if (attacker.stats?.ataque) {
              v = {
                'Corte': Number(attacker.stats.ataque.corte) || 0,
                'Perfuração': Number(attacker.stats.ataque.perfuracao) || 0,
                'Impacto': Number(attacker.stats.ataque.impacto) || 0,
                'Elemental': Number(attacker.stats.ataque.elemental) || 0
              };
            }
          }

          // If action has a category, prefer it
          if (monsterAction.categoria && v[monsterAction.categoria] !== undefined) {
            attackType = monsterAction.categoria as any;
          } else if (forcedType && v[forcedType] > 0) {
            attackType = forcedType;
          } else if (chosenAttackType) {
            const found = Object.keys(v).find(k => k.toLowerCase() === (typeof chosenAttackType === 'string' ? chosenAttackType.toLowerCase() : ''));
            if (found && v[found] > 0) attackType = found as any;
            else attackType = Object.entries(v).reduce((a: any, b: any) => a[1] > b[1] ? a : b)[0] as any;
          } else {
            attackType = Object.entries(v).reduce((a: any, b: any) => a[1] > b[1] ? a : b)[0] as any;
          }

          attackLevel = v[attackType] || 0;
          attackerResonance = Number(action.resistencia) || 0;

          if (isFirearm && actingBullet) {
            const bv = {
              'Corte': getVal(actingBullet, 'Corte'),
              'Perfuração': getVal(actingBullet, 'Perfuração'),
              'Impacto': getVal(actingBullet, 'Impacto')
            };
            const maxBV = Math.max(bv.Corte, bv['Perfuração'], bv.Impacto);
            if (maxBV > 0) {
                attackType = Object.entries(bv).reduce((a: any, b: any) => a[1] > b[1] ? a : b)[0] as any;
                attackLevel = bv[attackType];
                attackerResonance = Number(actingBullet.resistencia) || 0;
            }
          }
        }
      }

      // 2. Accuracy Roll Calculation
      const hasAdvantage = checkAdvantage(attacker, target, tokens, config.gridSize);
      const hasShieldDisadvantage = target.isDefending && target.defenseType === 'Shield';
      
      let diceRolls: number[] = [];
      let attackerRawDiceTotal = 0;

      const roll3d8Value = () => {
        let r: number[] = [];
        let t = 0;
        for (let i = 0; i < 3; i++) {
          const val = randomInt(1, 8);
          r.push(val);
          t += val;
        }
        return { rolls: r, total: t };
      };

      const attackRoll1 = roll3d8Value();
      const attackRoll2 = roll3d8Value();

      if (hasAdvantage && !hasShieldDisadvantage) {
        if (attackRoll1.total >= attackRoll2.total) { diceRolls = attackRoll1.rolls; attackerRawDiceTotal = attackRoll1.total; }
        else { diceRolls = attackRoll2.rolls; attackerRawDiceTotal = attackRoll2.total; }
      } else if (hasShieldDisadvantage && !hasAdvantage) {
        if (attackRoll1.total <= attackRoll2.total) { diceRolls = attackRoll1.rolls; attackerRawDiceTotal = attackRoll1.total; }
        else { diceRolls = attackRoll2.rolls; attackerRawDiceTotal = attackRoll2.total; }
      } else {
        diceRolls = attackRoll1.rolls; attackerRawDiceTotal = attackRoll1.total;
      }

      const hasOneInAttack = diceRolls.includes(1);
      const hasEightInAttack = diceRolls.includes(8);
      const isCriticalErrorTrigger = hasOneInAttack;
    
      // 4. Hit Location Roll
      const unusableLocationsList = (target.efeitosNegativos || []).filter(e => e.isUnusable).map(e => e.location);
      const HIT_LOCATIONS_BASE = ["Braço Esquerdo", "Braço Direito", "Perna Esquerda", "Perna Direita", "Tronco", "Cabeça"];
      const locRoll = randomInt(1, 6);
      let locationName = HIT_LOCATIONS_BASE[locRoll - 1];
      
      // If location is unusable, find next available or tronco
      if (unusableLocationsList.includes(locationName)) {
        locationName = HIT_LOCATIONS_BASE.find(loc => !unusableLocationsList.includes(loc)) || "Tronco";
      }

      // 5. Accuracy Test
      const baseAcerto = typeof actionOrWeapon.acerto === 'number' ? actionOrWeapon.acerto : parseInt(actionOrWeapon.acerto) || 12;
      let attackerAcuracia = 0;
      let targetEsquiva = 0;

      if (attacker.type === 'creature' && attacker.stats) {
        attackerAcuracia = attacker.stats.acuracia || 0;
      } else if (attacker.type === 'character' && attackerChar) {
        attackerAcuracia = calculateProficiencyBonus(attackerChar.stats, "Acurácia", ["FOR", "DEX"], attackerChar.fome, attackerChar.sede, attackerChar.cansaco, attackerChar.clima, 0, attackerChar.bonusProficiencias?.["Acurácia"], attackerChar.efeitosNegativos);
      }

      if (target.type === 'creature' && target.stats) {
        targetEsquiva = target.stats.esquiva || 0;
      } else if (target.type === 'character' && targetChar) {
        targetEsquiva = calculateProficiencyBonus(targetChar.stats, "Esquiva", ["DEX", "ADP"], targetChar.fome, targetChar.sede, targetChar.cansaco, targetChar.clima, 0, targetChar.bonusProficiencias?.["Esquiva"], targetChar.efeitosNegativos);
      }

      const totalHitRoll = attackerRawDiceTotal + attackerAcuracia - targetEsquiva;
      const isCriticalHit = totalHitRoll >= 20;
      const hitBaseCheckOk = totalHitRoll >= baseAcerto;

    // --- DEFENSE CALCULATION ---
    let blockSuccessful = false;
    let damageMultiplier = 1.0;
    let attackerWeaponDurabilityDown = false;
    let targetArmorDurabilityDown = false;
    let targetDefenseItemDurabilityDown = false;
    let defenseLog = "";
    let targetDefenseDiceRolls: number[] = [];
    let targetDefenseDiceTotal = 0;

    const key = getMapKey(attackType);
    const isRangedOrMagic = 
      ['projetil', 'feitiço', 'elemental', 'magia negra'].some(t => attackType.toLowerCase().includes(t.toLowerCase())) ||
      ['arco', 'besta', 'projetil', 'arremesso', 'shuriken', 'fogo', 'arma de fogo', 'pistola', 'mosquete', 'rifle'].some(t => {
        const cat = (actionOrWeapon.categoria || "").toLowerCase();
        const nome = (actionOrWeapon.nome || "").toLowerCase();
        return cat.includes(t) || nome.includes(t);
      });

    // Passive Defense (Level comparison)
    let targetDefenseLevel = 0;
    let targetDefenseResist = 0;
    let armorItemToDegrade: any = null;

    if (targetChar) {
      const kws = {
        "Cabeça": ["elmo", "capacete", "capuz", "máscara"],
        "Tronco": ["tronco", "peitoral", "armadura", "gibão", "túnica", "cota", "peitoral parcial", "gambeson", "placa"],
        "Braço": ["braço", "braçadeira", "rebraço", "cota", "ombreira", "manopla"],
        "Perna": ["perna", "greva", "perneira", "bota", "perneiras"]
      };

      const locL = locationName.toLowerCase();
      let activeKws: string[] = [];
      if (locL.includes("cabeça")) activeKws = kws.Cabeça;
      else if (locL.includes("tronco")) activeKws = kws.Tronco;
      else if (locL.includes("braço")) activeKws = kws.Braço;
      else if (locL.includes("perna")) activeKws = kws.Perna;

      // Filter armor pieces by keyword, but prefer more specific ones if possible
      // First, try to find an item that specifically matches the location in its name
      armorItemToDegrade = targetChar.armaduras.find(arm => {
        const n = arm.nome.toLowerCase();
        return activeKws.some(k => n.includes(k.toLowerCase()));
      });

      // Special case: if we are hitting arms/legs but only have a full armor or cota, use that
      if (!armorItemToDegrade && (locL.includes("braço") || locL.includes("perna"))) {
        armorItemToDegrade = targetChar.armaduras.find(arm => {
          const n = arm.nome.toLowerCase();
          return ["armadura", "cota", "peitoral", "gibão"].some(k => n.includes(k));
        });
      }

      if (armorItemToDegrade) {
        targetDefenseLevel = getVal(armorItemToDegrade, key);
        targetDefenseResist = Number(armorItemToDegrade.resistencia) || 0;
      }
    } else if (target.stats) {
      targetDefenseLevel = getVal(target.stats.defesa, key);
      targetDefenseResist = Number(target.stats.ataque?.resistencia) || 0;
    }

    if (hitBaseCheckOk || isCriticalHit) {
      if (attackLevel >= targetDefenseLevel) {
        defenseLog = ` (Dano Direto - Nível ${attackLevel} vs ${targetDefenseLevel})`;
      } else if (attackLevel + attackerResonance >= targetDefenseLevel) {
        defenseLog = ` (Dano por Resistência - Nível ${attackLevel}+${attackerResonance} vs ${targetDefenseLevel})`;
        attackerWeaponDurabilityDown = true;
      } else {
        blockSuccessful = true;
        attackerWeaponDurabilityDown = true;
        defenseLog = ` (Bloqueio por Nível - Nível ${attackLevel}+${attackerResonance} vs ${targetDefenseLevel})`;
      }
    }

    // Active Defense (Weapon Block)
    if (!blockSuccessful && target.isDefending && target.defenseType === 'Weapon' && !isRangedOrMagic) {
      const defR = roll3d8Value();
      targetDefenseDiceRolls = defR.rolls;
      targetDefenseDiceTotal = defR.total;

      if (defR.total >= attackerRawDiceTotal + 4) {
        const defWeapon = targetChar ? [...targetChar.armas, ...targetChar.compartimentos.flatMap(c => c.itens)].find(i => i.id === target.defenseWeaponId) : null;
        let defCompLevel = 0;
        let defCompResist = 0;
        if (defWeapon) {
          defCompLevel = (defWeapon as any)[key] || 0;
          defCompResist = (defWeapon as any).resistencia || 0;
        } else if (target.type === 'creature' && target.stats) {
          defCompLevel = (target.stats.defesa as any)[key] || 0;
          defCompResist = Number(target.stats.ataque?.resistencia) || 0;
        }

        if (defCompLevel >= attackLevel) {
          blockSuccessful = true;
          defenseLog = ` (Bloqueado com Arma! ${defR.total} vs ${attackerRawDiceTotal}+4)`;
        } else if (defCompLevel + defCompResist >= attackLevel) {
          blockSuccessful = true;
          targetDefenseItemDurabilityDown = true;
          defenseLog = ` (Bloqueado com Resistência da Arma! ${defR.total} vs ${attackerRawDiceTotal}+4. Defesa Perde Durabilidade)`;
        } else {
          damageMultiplier = 0.5;
          targetDefenseItemDurabilityDown = true;
          defenseLog = ` (Defesa Falhou por Nível! Recebe Meio Dano. Defesa Perde Durabilidade)`;
        }
      }
    }

    if (isCriticalErrorTrigger) attackerWeaponDurabilityDown = true;
    if (hitBaseCheckOk && !blockSuccessful) targetArmorDurabilityDown = true;

    // 6. Damage Calculation
    let hitSucceeded = (hitBaseCheckOk && !blockSuccessful) || isCriticalHit || (damageMultiplier < 1.0);
    let damage = 0;
    let damageFormula = "";
    let dmgDiceRolls: number[] = [];
    
    // Improved parseAndRollDice logic for VTT
    const rollDano = (formula: string) => {
      const danoStr = (formula || "1d4").toString().toLowerCase().replace(/\s+/g, "").replace(/-/g, "+-");
      const parts = danoStr.split('+').filter(p => p.length > 0);
      let total = 0;
      let rolls: number[] = [];
      parts.forEach(part => {
        const isNegative = part.startsWith('-');
        const cleanPart = isNegative ? part.substring(1) : part;
        if (cleanPart.includes('d')) {
          const [dNumStr, dSidesStr] = cleanPart.split('d');
          const dNum = Math.min(20, parseInt(dNumStr) || 1);
          const dSides = parseInt(dSidesStr) || 4;
          for (let i = 0; i < dNum; i++) {
            const r = randomInt(1, dSides);
            if (isNegative) { total -= r; rolls.push(-r); }
            else { total += r; rolls.push(r); }
          }
        } else {
          const val = parseInt(part) || 0;
          total += val;
        }
      });
      return { total, rolls };
    };

    // Calculate scaling bonus: spells use INT, weapons use their atributoBase
    let scalingBonus = 0;
    if (attackerChar) {
      let statKey: keyof Stats = "FOR";
      if (action.escola) {
        statKey = "INT"; // Spells scale with INT/Mentalidade logic in this system
      } else {
        const attr = action.atributoBase || "Força";
        if (attr === "Destreza") statKey = "DEX";
        else if (attr === "Inteligência") statKey = "INT";
        else if (attr === "Ritual") statKey = "RIT";
      }
      scalingBonus = calculateWeaponDamageBonus(action as any, attackerChar.stats[statKey] || 0) || 0;
    }

    if (hitSucceeded) {
      if (isCriticalHit) {
        // Max damage calculation
        const danoStr = (action.dano || "1d4").toString().toLowerCase().replace(/\s+/g, "").replace(/-/g, "+-");
        const parts = danoStr.split('+').filter(p => p.length > 0);
        let maxVal = 0;
        parts.forEach(p => {
           const isNeg = p.startsWith('-');
           const clean = isNeg ? p.substring(1) : p;
           if (clean.includes('d')) {
             const [n, s] = clean.split('d');
             const val = (parseInt(n) || 1) * (parseInt(s) || 4);
             if (isNeg) maxVal -= val; else maxVal += val;
           } else {
             const val = parseInt(p) || 0;
             maxVal += val;
           }
        });
        damage = maxVal + scalingBonus;
        damageFormula = `Crítico! (Máximo ${maxVal} + Escala ${scalingBonus})`;
        dmgDiceRolls = []; // No rolls for direct max damage
      } else {
        const rollRes = rollDano(action.dano || "1d4");
        dmgDiceRolls = rollRes.rolls;
        damage = rollRes.total + scalingBonus;
        damageFormula = `${action.dano} (${rollRes.total}) + Escala ${scalingBonus}`;
      }

      // 5. HP & Reductions Calculation
      const currentTargetHp = targetChar ? (targetChar.vidaAtual ?? 0) : (target.hp ?? 0);
      
      // Apply Reductions
      let extraDamageTakenFromEffects = 0;
      const currentEffects = targetChar ? (targetChar.efeitosNegativos || []) : (target.efeitosNegativos || []);
      currentEffects.forEach(eff => {
        if (eff.location === locationName) {
          if (eff.type === 'Ossos Quebrados') extraDamageTakenFromEffects += 3;
          if (eff.type === 'Hemorragia') extraDamageTakenFromEffects += 2;
        }
      });

      // Defense of location
      let locDefVal = 0;
      if (targetChar) {
        const locKey = locationName.includes('Braço') ? 'Braços' : (locationName.includes('Perna') ? 'Pernas' : locationName);
        locDefVal = (targetChar.defesa as any)[locKey] || 0;
      } else if (target.stats) {
        locDefVal = (target.stats.defesa as any)[locationName] || (target.stats.defesa as any).Tronco || 0;
      }

      damage = Math.max(0, Math.floor((damage + extraDamageTakenFromEffects - locDefVal) * damageMultiplier));
      damageFormula += ` + Efeitos ${extraDamageTakenFromEffects} - Defesa Local ${locDefVal}`;
      if (damageMultiplier !== 1) damageFormula += ` x${damageMultiplier}`;

      // 7. Success Actions
      const triggerEffect = (hasEightInAttack && !hasOneInAttack) || isCriticalHit;
      let effectInfo = "";
      let resProf = 0;
      let resRoll = 0;

      if (triggerEffect && isPhysical(attackType)) {
        resProf = targetChar 
          ? calculateProficiencyBonus(targetChar.stats, "Resistência", ["RES"], targetChar.fome, targetChar.sede, targetChar.cansaco, targetChar.clima, 0, targetChar.bonusProficiencias?.["Resistência"], targetChar.efeitosNegativos) 
          : (Number(target.stats?.ataque?.resistencia) || 0);
        
        resRoll = randomInt(1, 100);
        const totalSave = resRoll + resProf;

        if (totalSave < 70 || isCriticalHit) {
          effectInfo = isCriticalHit ? " [CRÍTICO!]" : ` (Falhou: ${resRoll}+${resProf}=${totalSave})`;
          const effectTypeMap: any = { 'Impacto': 'Ossos Quebrados', 'Corte': 'Sangramento', 'Perfuração': 'Hemorragia' };
          const newEffect: NegativeEffect = {
            id: generateId(),
            type: effectTypeMap[attackType] || 'Sangramento',
            location: locationName,
            stacks: 1,
            treated: false,
            daysRemaining: attackType === 'Impacto' ? 4 : (attackType === 'Corte' ? 2 : 3)
          };
          
          let finalEffects = [...currentEffects];
          let effectAlreadyExists = false;
          let fatalHemorrhage = false;

          finalEffects = finalEffects.map(eff => {
            if (eff.type === newEffect.type && eff.location === newEffect.location) {
              effectAlreadyExists = true;
              const newStacks = (eff.stacks || 1) + 1;
              if (eff.type === 'Sangramento' && newStacks >= 4 && !locationName.includes('Tronco') && !locationName.includes('Cabeça')) {
                 effectInfo = " [MEMBRO ARRANCADO!]";
                 return { ...eff, stacks: newStacks, isUnusable: true };
              }
              if (eff.type === 'Hemorragia' && newStacks >= 4) {
                 effectInfo = " [HEMORRAGIA FATAL!]";
                 fatalHemorrhage = true;
              }
              return { ...eff, stacks: newStacks };
            }
            return eff;
          });

          if (!effectAlreadyExists) {
            finalEffects.push(newEffect);
            effectInfo = ` [Novo Efeito: ${newEffect.type}]`;
          }
          
          if (fatalHemorrhage) damage = 999;

          const currentHpBeforeDmg = targetChar ? (targetChar.vidaAtual ?? 0) : (target.hp ?? 0);
          const newHp = Math.max(0, currentHpBeforeDmg - damage);
          
          await updateTokenPosition(campaignId, target.id, { hp: newHp, efeitosNegativos: finalEffects, ...defenseClear });
          if (targetChar) {
            await updateDoc(doc(db, 'characters', targetChar.id), { vidaAtual: newHp, efeitosNegativos: finalEffects, ...defenseClear, updatedAt: serverTimestamp() });
          }
        } else {
          effectInfo = ` (Resistiu: ${resRoll}+${resProf}=${resRoll+resProf})`;
          const currentHpBeforeDmg = targetChar ? (targetChar.vidaAtual ?? 0) : (target.hp ?? 0);
          const newHp = Math.max(0, currentHpBeforeDmg - damage);
          await updateTokenPosition(campaignId, target.id, { hp: newHp, ...defenseClear });
          if (targetChar) await updateDoc(doc(db, 'characters', targetChar.id), { vidaAtual: newHp, ...defenseClear, updatedAt: serverTimestamp() });
        }
      } else {
        const currentHpBeforeDmg = targetChar ? (targetChar.vidaAtual ?? 0) : (target.hp ?? 0);
        const newHp = Math.max(0, currentHpBeforeDmg - damage);
        await updateTokenPosition(campaignId, target.id, { hp: newHp, ...defenseClear });
        if (targetChar) await updateDoc(doc(db, 'characters', targetChar.id), { vidaAtual: newHp, ...defenseClear, updatedAt: serverTimestamp() });
      }

      await addCombatLog(campaignId, { 
        msg: `${attacker.name} atingiu ${target.name} no(a) ${locationName}! ${damage} de dano [${damageFormula}].${defenseLog}${effectInfo}`, 
        type: 'success',
        rolls: dmgDiceRolls.map(v => ({val:v, sides:8})), // Example sides if needed or pass full info
        location: locationName,
        locationRoll: locRoll
      });

      if (onRollResult) {
        onRollResult({
          isCombat: true,
          attackerName: attacker.name,
          targetName: target.name,
          armaNome: actionOrWeapon.nome,
          combatNote: (isCriticalHit ? "CRÍTICO! " : "") + (effectInfo || defenseLog || ""),
          hitResult: totalHitRoll,
          hitFormula: `${attackerRawDiceTotal} (dados) + ${attackerAcuracia} (bônus) - ${targetEsquiva} (esquiva) [vs ${baseAcerto}]`,
          hitRolls: diceRolls,
          hitBonus: attackerAcuracia - targetEsquiva,
          hitLocation: locationName,
          locationRoll: locRoll,
          hitSucceeded: true,
          damage,
          dmgResult: damage,
          dmgFormula: damageFormula,
          dmgRolls: dmgDiceRolls,
          dmgBonus: scalingBonus,
          defenseRolls: targetDefenseDiceRolls,
          defenseResult: targetDefenseDiceTotal,
          resRoll: triggerEffect && isPhysical(attackType) ? resRoll : undefined,
          resProf: triggerEffect && isPhysical(attackType) ? resProf : undefined,
          attackType,
          attackLevel,
          targetDefenseLevel,
          isRangedOrMagic
        });
      }

    } else {
      const msg = blockSuccessful 
        ? `${attacker.name} atingiu o(a) ${locationName}, mas foi bloqueado por ${target.name}.${defenseLog}`
        : `${attacker.name} errou o ataque no(a) ${locationName} contra ${target.name}.${defenseLog}`;
      
      await addCombatLog(campaignId, { msg, type: 'error' });

      if (target.isDefending) {
        await updateTokenPosition(campaignId, target.id, defenseClear);
        if (targetChar) {
          await updateDoc(doc(db, 'characters', targetChar.id), { ...defenseClear, updatedAt: serverTimestamp() });
        }
      }

      if (onRollResult) {
        onRollResult({
          isCombat: true,
          attackerName: attacker.name,
          targetName: target.name,
          armaNome: actionOrWeapon.nome,
          combatNote: blockSuccessful ? "BLOQUEADO! " + defenseLog : "ERROU! " + defenseLog,
          hitResult: totalHitRoll,
          hitFormula: `${attackerRawDiceTotal} (dados) + ${attackerAcuracia} (bônus) - ${targetEsquiva} (esquiva) [vs ${baseAcerto}]`,
          hitRolls: diceRolls,
          hitBonus: attackerAcuracia - targetEsquiva,
          hitLocation: locationName,
          locationRoll: locRoll,
          hitSucceeded: false,
          damage: 0,
          dmgResult: 0,
          defenseRolls: targetDefenseDiceRolls,
          defenseResult: targetDefenseDiceTotal,
          attackType,
          attackLevel,
          targetDefenseLevel,
          isRangedOrMagic
        });
      }
    }

    // 8. Durability Decay Processing
    if (attackerChar) {
      const item = [...attackerChar.armas, ...attackerChar.catalisadores, ...attackerChar.compartimentos.flatMap(c => c.itens)].find(i => i.id === actionOrWeapon.id);
      if (item) {
        let updatedArmas = [...attackerChar.armas];
        let updatedCatalisadores = [...attackerChar.catalisadores];
        let charUpdates: any = {};
        let itemProcessed = false;

        if (isFirearm) {
          // Firearms always lose 1 point per shot
          charUpdates.armas = attackerChar.armas.map(w => {
            if (w.id === item.id) {
              itemProcessed = true;
              let newDur = w.durabilidade || 0;
              let newMaxDur = w.maxDurabilidade || 0;
              if (newDur > 0) newDur -= 1;
              else if (newMaxDur > 0) newMaxDur -= 1;
              
              const currentMag = (w as any).magazineAmmo || [];
              const newMag = currentMag.slice(1);

              return { 
                ...w, 
                durabilidade: newDur, 
                maxDurabilidade: newMaxDur,
                municaoCarregada: newMag.length,
                magazineAmmo: newMag
              };
            }
            return w;
          });

          if (!itemProcessed) {
            charUpdates.compartimentos = attackerChar.compartimentos.map(c => ({
              ...c,
              itens: c.itens.map(i => {
                if (i.id === item.id) {
                  itemProcessed = true;
                  let newDur = (i as any).durabilidade || 0;
                  let newMaxDur = (i as any).maxDurabilidade || 0;
                  if (newDur > 0) newDur -= 1;
                  else if (newMaxDur > 0) newMaxDur -= 1;
                  const currentMag = (i as any).magazineAmmo || [];
                  const newMag = currentMag.slice(1);

                  return {
                    ...i,
                    durabilidade: newDur,
                    maxDurabilidade: newMaxDur,
                    municaoCarregada: newMag.length,
                    magazineAmmo: newMag
                  };
                }
                return i;
              })
            }));
          }
        } else {
          // Standard Durability for Melee/Catalyst
          if (attackerWeaponDurabilityDown) {
            charUpdates.armas = attackerChar.armas.map(w => {
               if (w.id === item.id) {
                 itemProcessed = true;
                 return { ...w, durabilidade: Math.max(0, w.durabilidade - 1) };
               }
               return w;
            });
            charUpdates.catalisadores = attackerChar.catalisadores.map(c => {
               if ((c as any).id === item.id) {
                 itemProcessed = true;
                 return { ...c, durabilidade: Math.max(0, ((c as any).durabilidade || 0) - 1) };
               }
               return c;
            });
            
            if (!itemProcessed) {
              charUpdates.compartimentos = attackerChar.compartimentos.map(c => ({
                ...c,
                itens: c.itens.map(i => {
                  if (i.id === item.id) {
                    itemProcessed = true;
                    return { ...i, durabilidade: Math.max(0, ((i as any).durabilidade || 0) - 1) };
                  }
                  return i;
                })
              }));
            }
          }

          // Quantity consumption for throwables/bows (if categorized as such)
          const nameLowerStr = (actionOrWeapon.nome || "").toLowerCase();
          const categoryLower = (actionOrWeapon.categoria || "").toLowerCase();
          const isConsumable = actionOrWeapon.quantidade !== undefined;
          const isDistance = nameLowerStr.includes('arremesso') || nameLowerStr.includes('shuriken') || 
                           categoryLower.includes('projetil') || categoryLower.includes('arco') || categoryLower.includes('besta');

          if (isConsumable && isDistance) {
            charUpdates.armas = (charUpdates.armas || attackerChar.armas).map(w => w.id === actionOrWeapon.id ? { ...w, quantidade: Math.max(0, (w.quantidade || 1) - 1) } : w);
            
            // Check compartments if not in weapons
            const inWeapons = attackerChar.armas.some(w => w.id === actionOrWeapon.id);
            if (!inWeapons) {
              charUpdates.compartimentos = (charUpdates.compartimentos || attackerChar.compartimentos).map(c => ({
                ...c,
                itens: c.itens.map(i => i.id === actionOrWeapon.id ? { ...i, quantidade: Math.max(0, ((i as any).quantidade || 1) - 1) } : i)
              }));
            }
          }
        }

        if (Object.keys(charUpdates).length > 0) {
          await updateDoc(doc(db, 'characters', attackerChar.id), { ...charUpdates, updatedAt: serverTimestamp() });
        }
      }
    }
    if (targetChar && targetArmorDurabilityDown && armorItemToDegrade) {
      const updatedArmaduras = targetChar.armaduras.map(a => a.id === armorItemToDegrade.id ? { ...a, durabilidade: Math.max(0, a.durabilidade - 1) } : a);
      await updateDoc(doc(db, 'characters', targetChar.id), { armaduras: updatedArmaduras, updatedAt: serverTimestamp() });
    }
    if (targetChar && targetDefenseItemDurabilityDown && target.defenseWeaponId) {
      const updatedArmas = targetChar.armas.map(w => w.id === target.defenseWeaponId ? { ...w, durabilidade: Math.max(0, w.durabilidade - 1) } : w);
      const updatedArmaduras = targetChar.armaduras.map(a => a.id === target.defenseWeaponId ? { ...a, durabilidade: Math.max(0, a.durabilidade - 1) } : a);
      await updateDoc(doc(db, 'characters', targetChar.id), { armas: updatedArmas, armaduras: updatedArmaduras, updatedAt: serverTimestamp() });
    }

    } catch (error) {
      console.error("Combat resolution error:", error);
      setCombatLog(prev => [{ msg: "Erro ao resolver combate. Verifique os dados da criatura/arma.", type: 'error' }, ...prev]);
    } finally {
      // Handle VTT Cleanup
      setIsAttackingMode(false);
      setAttackerId(null);
      setTargetId(null);
      setWeaponSelectTokenId(null);
    }
  };

  const getCenter = (p1: any, p2: any) => {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };
  };

  const containerRect = useRef<DOMRect | null>(null);

  // Update container rect on mount and resize
  useEffect(() => {
    const updateRect = () => {
      if (containerRef.current) {
        containerRect.current = containerRef.current.getBoundingClientRect();
      }
    };
    updateRect();
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, []);

  const handleTouchStart = (e: any) => {
    const touch1 = e.evt.touches[0];
    const touch2 = e.evt.touches[1];

    if (touch1 && touch2) {
      const p1 = { x: touch1.clientX, y: touch1.clientY };
      const p2 = { x: touch2.clientX, y: touch2.clientY };
      lastDist.current = getDistance(p1, p2);
      lastCenter.current = getCenter(p1, p2);
    }
  };

  const handleTouchMove = (e: any) => {
    if (e.evt.cancelable) e.evt.preventDefault();
    
    const touch1 = e.evt.touches[0];
    const touch2 = e.evt.touches[1];

    if (touch1 && touch2) {
      
      const stage = e.target.getStage();
      if (stage.isDragging()) {
        stage.stopDrag();
      }

      const p1 = { x: touch1.clientX, y: touch1.clientY };
      const p2 = { x: touch2.clientX, y: touch2.clientY };

      const newDist = getDistance(p1, p2);
      const newCenter = getCenter(p1, p2);

      if (!lastCenter.current || lastDist.current === 0) {
        lastCenter.current = newCenter;
        lastDist.current = newDist;
        return;
      }

      const oldScale = stage.scaleX();
      const currentX = stage.x();
      const currentY = stage.y();

      const rect = containerRect.current;
      const relCenter = {
        x: newCenter.x - (rect?.left || 0),
        y: newCenter.y - (rect?.top || 0),
      };

      const pointTo = {
        x: (relCenter.x - currentX) / oldScale,
        y: (relCenter.y - currentY) / oldScale,
      };

      let scale = oldScale * (newDist / lastDist.current);
      scale = Math.max(0.05, Math.min(scale, 10));
      
      setViewport({
        scale: scale,
        x: relCenter.x - pointTo.x * scale,
        y: relCenter.y - pointTo.y * scale,
      });

      lastDist.current = newDist;
      lastCenter.current = newCenter;
    }
  };

  const handleTouchEnd = () => {
    lastCenter.current = null;
    lastDist.current = 0;
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    let newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    newScale = Math.max(0.05, Math.min(newScale, 10));

    setViewport({
      scale: newScale,
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  // Prevent middle-click autoscroll which can break the layout or cause black screens
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 1) {
        const target = e.target as HTMLElement;
        // Only prevent if clicking inside the Konva container to avoid global interference
        if (target.closest('.konvajs-content')) {
          e.preventDefault();
        }
      }
    };
    window.addEventListener('mousedown', handleMouseDown);
    return () => window.removeEventListener('mousedown', handleMouseDown);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpdateConfig) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          // Map is large, but still needs to stay below 1MB (base64)
          // 1920px at 0.7 is a good ceiling for full maps
          const compressed = await compressImageDataUrl(reader.result as string, 1920, 0.7);
          onUpdateConfig({ mapUrl: compressed });
          setInputMapUrl(compressed);
        } catch (error) {
          console.error("Compression error:", error);
          onUpdateConfig({ mapUrl: reader.result as string });
          setInputMapUrl(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreatureImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          // Token icons can be small
          const compressed = await compressImageDataUrl(reader.result as string, 512, 0.7);
          setInputCreatureIcon(compressed);
        } catch (error) {
          console.error("Compression error:", error);
          setInputCreatureIcon(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const gridSize = config.gridSize || 50;
  const hexRadius = gridSize / Math.sqrt(3);
  const width = gridSize * 2 / Math.sqrt(3);
  const height = gridSize;
  const horiz = width * 0.75;
  const vert = height;

  const hexGrid = useMemo(() => {
    if (!config.showGrid) return null;
    return (
      <Shape
        x={0}
        y={0}
        width={4000}
        height={4000}
        sceneFunc={(context, shape) => {
          const gSize = config.gridSize || 50;
          if (gSize < 10) return;

          const radius = gSize / Math.sqrt(3);
          const horizDist = gSize; 
          const vertDist = gSize * 0.866; 

          const mapW = (mapImage && mapImageStatus === 'loaded') ? Math.min(mapImage.width, 4000) : 2000;
          const mapH = (mapImage && mapImageStatus === 'loaded') ? Math.min(mapImage.height, 4000) : 2000;
          
          const cols = Math.ceil(mapW / horizDist); 
          const rows = Math.ceil(mapH / vertDist);

          context.beginPath();

          for (let r = 0; r <= rows; r++) {
            const offsetY = r * vertDist;
            const offsetX = (r % 2 === 0) ? 0 : horizDist / 2;
            
            for (let q = 0; q <= cols; q++) {
              const centerX = q * horizDist + offsetX;
              const centerY = offsetY;
              
              for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 180) * (i * 60 + 30);
                const px = centerX + radius * Math.cos(angle);
                const py = centerY + radius * Math.sin(angle);
                if (i === 0) {
                  context.moveTo(px, py);
                } else {
                  context.lineTo(px, py);
                }
              }
              context.closePath();
            }
          }
          context.fillStrokeShape(shape);
        }}
        stroke={config.gridColor || "#ffffff"}
        strokeWidth={1}
        opacity={1}
        listening={false}
        perfectDrawEnabled={false}
        strokeScaleEnabled={false}
      />
    );
  }, [config.showGrid, config.gridSize, config.gridColor, mapImage, mapImageStatus]);

  // Bloqueio de gestos do navegador (pull-to-refresh)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Impedir apenas o comportamento padrão do navegador em movimentos
    const handleTouchMove = (e: TouchEvent) => {
      // Se tivermos mais de um toque (pinch), ou se estivermos tentando arrastar o "nada" no mobile
      // o navegador pode tentar dar zoom ou scroll. Bloqueamos apenas se o evento for cancelável.
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    // Usamos o container específico do VTT para não quebrar o resto do app
    container.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      container.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  return (
    <div 
      className="flex flex-col h-full bg-[#09090b] relative overflow-hidden overscroll-none"
    >
      {/* Loading State */}
      {mapImageStatus === 'loading' && config.mapUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/50 z-50 pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em]">Sincronizando Grade e Mapa...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {mapImageStatus === 'failed' && config.mapUrl && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-red-600/20 border border-red-600/50 backdrop-blur-md text-red-400 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-2xl animate-in fade-in slide-in-from-top-4">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs font-bold">Falha ao carregar o mapa. Verifique o link ou formato do arquivo.</span>
        </div>
      )}

      {/* Left Sidebar Toggle (Master Only) */}
      {isMaster && (
        <button 
          onClick={() => setShowLeftSidebar(!showLeftSidebar)}
          className={cn(
            "absolute top-4 z-50 p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all shadow-xl duration-300 flex items-center justify-center",
            showLeftSidebar ? "left-[260px]" : "left-4"
          )}
          title={showLeftSidebar ? "Fechar Configurações" : "Configurações da Mesa"}
        >
          {showLeftSidebar ? <ChevronLeft size={20} /> : <Settings size={20} />}
        </button>
      )}

      {/* Left Sidebar Content (Master Only) */}
      {isMaster && (
        <aside className={cn(
          "absolute top-0 left-0 h-full w-[250px] bg-zinc-900/95 backdrop-blur-xl border-r border-zinc-800 z-40 transition-transform duration-300 ease-in-out flex flex-col shadow-2xl",
          showLeftSidebar ? "translate-x-0" : "-translate-x-full"
        )}>
        <div className="flex-1 flex flex-col overflow-y-auto p-4 pb-24 gap-6 custom-scrollbar scroll-smooth">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
            <Settings size={16} className="text-blue-500" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Configurações da Mesa</span>
          </div>

          {/* Camera Controls */}
          <div className="space-y-3">
            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest px-1">Câmera e Visualização</span>
            <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-800 flex items-center justify-between gap-2 shadow-inner">
               <div className="flex items-center gap-1">
                  <button onClick={() => setViewport(v => ({ ...v, scale: v.scale * 1.1 }))} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors" title="Zoom In"><ZoomIn size={16} /></button>
                  <button onClick={() => setViewport(v => ({ ...v, scale: v.scale / 1.1 }))} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors" title="Zoom Out"><ZoomOut size={16} /></button>
               </div>
               <button onClick={() => setViewport({ scale: 1, x: 0, y: 0 })} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors" title="Reset Camera"><Maximize size={16} /></button>
            </div>
          </div>

          {/* Master Settings */}
          {isMaster && (
            <>
              {/* Token Tools Section */}
              <div className="space-y-3">
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest px-1">Gestão de Tokens</span>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => setIsCharacterModalOpen(true)}
                    className="w-full flex items-center gap-2 p-3 bg-blue-600/10 border border-blue-500/30 hover:bg-blue-600/20 text-blue-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    <User size={14} /> Add Personagem
                  </button>
                  <button 
                    onClick={() => setShowCreatureModal(true)}
                    className="w-full flex items-center gap-2 p-3 bg-amber-600/10 border border-amber-500/30 hover:bg-amber-600/20 text-amber-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    <Skull size={14} /> Add Criatura
                  </button>
                </div>
              </div>

              {/* Map Image Section */}
              <div className="space-y-3">
                <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest px-1">Mapa de Fundo</span>
                <div className="space-y-2">
                  <div className="relative group">
                    <input 
                      type="file" 
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      accept="image/*"
                    />
                    <div className="w-full bg-zinc-950 border border-dashed border-zinc-800 rounded-xl p-4 text-center group-hover:border-blue-500 transition-colors">
                      <Upload size={20} className="mx-auto text-zinc-600 mb-1 group-hover:text-blue-500" />
                      <span className="block text-[8px] font-bold text-zinc-500 uppercase">Upload Imagem</span>
                    </div>
                  </div>
                  <input 
                    value={inputMapUrl ?? ""}
                    onChange={(e) => setInputMapUrl(e.target.value)}
                    placeholder="OU URL do Mapa..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-[10px] text-white focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        if (onUpdateConfig) onUpdateConfig({ mapUrl: inputMapUrl });
                      }}
                      className="flex-1 p-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-500 rounded-lg text-[8px] font-black uppercase transition-all"
                    >
                      Aplicar URL
                    </button>
                    {config.mapUrl && (
                      <button 
                        onClick={() => {
                          onUpdateConfig?.({ mapUrl: "" });
                          setInputMapUrl("");
                        }}
                        className="p-2 bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 text-red-500 rounded-lg transition-all"
                        title="Remover Mapa"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Grid Settings Section */}
              <div className="space-y-3">
                <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest px-1">Sistema de Grade</span>
                <div className="space-y-3 bg-zinc-950 p-3 rounded-2xl border border-zinc-800 shadow-inner">
                  {/* Grid Toggle and Size */}
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => onUpdateConfig?.({ showGrid: !config.showGrid })}
                      className={cn(
                        "flex-1 p-2 rounded-xl text-[8px] font-black transition-all border",
                        config.showGrid ? "bg-amber-600/10 border-amber-500 text-amber-400" : "bg-zinc-900 border-zinc-800 text-zinc-600"
                      )}
                    >
                      GRADE: {config.showGrid ? "ON" : "OFF"}
                    </button>
                    <div className="w-16">
                      <input 
                        type="text"
                        inputMode="numeric"
                        value={inputGridSize}
                        onChange={(e) => setInputGridSize(e.target.value.replace(/[^0-9]/g, ''))}
                        onBlur={() => {
                          const num = parseInt(inputGridSize) || 50;
                          onUpdateConfig?.({ gridSize: num });
                          setInputGridSize(num.toString());
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-[10px] text-center text-white focus:outline-none focus:border-amber-500"
                        title="Tamanho da Grade"
                      />
                    </div>
                  </div>

                  {/* Grid Color */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {GRID_COLORS.map(color => (
                      <button
                        key={color.value}
                        onClick={() => onUpdateConfig?.({ gridColor: color.value })}
                        className={cn(
                          "h-6 rounded-md border flex items-center justify-center transition-all",
                          (config.gridColor || '#ffffff') === color.value 
                            ? "border-white scale-110 shadow-lg" 
                            : "border-transparent opacity-60 hover:opacity-100"
                        )}
                        style={{ backgroundColor: color.value }}
                      >
                        {(config.gridColor || '#ffffff') === color.value && (
                          <div className={cn("w-1 h-1 rounded-full", color.value === '#ffffff' ? 'bg-black' : 'bg-white')} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
      )}

      {/* Clock Overlay */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
        <div className="flex items-center gap-3 px-6 py-2 bg-zinc-950/80 backdrop-blur-md border border-zinc-800 rounded-2xl shadow-2xl">
          <div className="flex flex-col items-center">
            <span className="text-xl font-mono font-black text-white leading-none tracking-wider">
              {config.time ? `${config.time.hour.toString().padStart(2, '0')}:${config.time.minute.toString().padStart(2, '0')}` : '00:00'}
            </span>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
              {config.date ? `${config.date.day}/${config.date.month}/${config.date.year}` : '1/1/2024'}
            </span>
          </div>
          <div className="w-px h-8 bg-zinc-800" />
          <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-2xl shadow-inner border border-zinc-800/50">
            {getSeasonIcon(getSeason(config.date?.month || 1))}
          </div>
          <div className="flex flex-col items-start pr-2">
             <span className="text-[10px] font-black text-amber-500 uppercase tracking-tighter">
                {config.weather || "Limpo"}
             </span>
             <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                {getSeason(config.date?.month || 1)}
             </span>
          </div>
        </div>
      </div>

      {/* Clear Grid Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowClearConfirm(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-6"
            >
              <div className="flex items-center gap-4 text-red-500">
                <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
                  <Trash2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Limpar Grid?</h3>
                  <p className="text-[10px] text-red-500/60 font-black uppercase tracking-[0.2em]">Ação Irreversível</p>
                </div>
              </div>
              
              <div className="bg-zinc-950/50 border border-zinc-800 p-4 rounded-2xl">
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Você está prestes a remover <span className="text-white font-bold">{tokens.length}</span> tokens da mesa de combate. Esta ação não poderá ser desfeita.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all text-[10px] font-black uppercase tracking-widest border border-zinc-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    for (const t of tokens) {
                      onRemoveToken?.(t.id);
                    }
                    setShowClearConfirm(false);
                    setCombatLog(prev => [{ msg: "O mestre limpou o campo de batalha.", type: 'info' }, ...prev]);
                  }}
                  className="px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 border border-red-500/50"
                >
                  <Trash2 className="w-4 h-4" />
                  Limpar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Character Modal */}
      {isCharacterModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl w-full max-w-md shadow-2xl space-y-6">
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <User className="text-blue-500" /> Adicionar Personagem
              </h3>
              
              <div className="space-y-1.5 w-full max-w-xs">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider px-1">Tamanho do Token</label>
                <div className="grid grid-cols-4 gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                  {TOKEN_SIZES.map(size => (
                    <button
                      key={size.value}
                      onClick={() => setInputCreatureSize(size.value)}
                      className={cn(
                        "py-2 rounded-lg text-[9px] font-black uppercase transition-all",
                        inputCreatureSize === size.value ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
              {availableCharacters.length > 0 ? (
                availableCharacters.map(char => (
                  <div 
                    key={char.id}
                    className="w-full bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex items-center gap-3 hover:bg-zinc-800 hover:border-blue-500 transition-all text-left group"
                  >
                    <div className="w-10 h-10 bg-blue-600/20 rounded-full flex items-center justify-center border border-blue-500 group-hover:bg-blue-600 transition-colors overflow-hidden">
                      {char.imagem ? (
                        <img src={char.imagem} alt={char.nome} className="w-full h-full object-cover" />
                      ) : (
                        <User size={20} className="text-blue-400 group-hover:text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{char.nome}</p>
                      {char.userEmail && <p className="text-[9px] text-amber-500/60 font-medium truncate">{char.userEmail}</p>}
                      <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">{char.etnia}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onAddToken) {
                            const centerX = (dimensions.width / 2 - viewport.x) / viewport.scale;
                            const centerY = (dimensions.height / 2 - viewport.y) / viewport.scale;
                            onAddToken({
                              id: crypto.randomUUID(),
                              name: char.nome,
                              imageUrl: char.imagem,
                              x: centerX || 100,
                              y: centerY || 100,
                              size: inputCreatureSize,
                              type: 'character',
                              characterId: char.id,
                              hp: char.vidaAtual || 1,
                              maxHp: getVidaMaxima(char.stats.CON),
                              color: '#3b82f6',
                              efeitosNegativos: char.efeitosNegativos || [],
                              deslocamento: getDeslocamentoBase(char.stats.DEX, char.efeitosNegativos, char.fome, char.sede, char.clima, 0)
                            });
                          }
                          setIsCharacterModalOpen(false);
                        }}
                        className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-500 hover:text-white rounded text-[8px] font-black uppercase transition-all"
                      >
                        Player
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onAddToken) {
                            const centerX = (dimensions.width / 2 - viewport.x) / viewport.scale;
                            const centerY = (dimensions.height / 2 - viewport.y) / viewport.scale;
                            onAddToken({
                              id: crypto.randomUUID(),
                              name: `${char.nome} (Inimigo)`,
                              imageUrl: char.imagem,
                              x: centerX || 100,
                              y: centerY || 100,
                              size: inputCreatureSize,
                              type: 'creature',
                              characterId: char.id,
                              hp: char.vidaAtual || 1,
                              maxHp: getVidaMaxima(char.stats.CON),
                              color: '#ef4444',
                              efeitosNegativos: char.efeitosNegativos || [],
                              deslocamento: getDeslocamentoBase(char.stats.DEX, char.efeitosNegativos, char.fome, char.sede, char.clima, 0)
                            });
                          }
                          setIsCharacterModalOpen(false);
                        }}
                        className="px-2 py-1 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white rounded text-[8px] font-black uppercase transition-all"
                      >
                        Inimigo
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 bg-zinc-950 rounded-2xl border border-zinc-800/50">
                  <p className="text-zinc-500 text-sm">Nenhum personagem encontrado nesta campanha.</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setIsCharacterModalOpen(false)}
                className="flex-1 p-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Creature Modal / Bestiary */}
      {showCreatureModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-hidden">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                  <Skull className="text-red-500" /> Bestiário
                </h3>
                
                <div className="space-y-1.5 w-full max-w-xs">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider px-1">Tamanho do Token</label>
                  <div className="grid grid-cols-4 gap-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
                    {TOKEN_SIZES.map(size => (
                      <button
                        key={size.value}
                        onClick={() => setInputCreatureSize(size.value)}
                        className={cn(
                          "py-1.5 rounded-lg text-[9px] font-black uppercase transition-all",
                          inputCreatureSize === size.value ? "bg-red-600 text-white shadow-lg shadow-red-600/20" : "text-zinc-500 hover:text-zinc-300"
                        )}
                      >
                        {size.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setShowCreatureModal(false)}
                className="shrink-0 p-2 bg-zinc-900 text-zinc-500 hover:text-white rounded-xl transition-all"
              >
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <Bestiary 
                isSelectionMode={true} 
                onMonsterSelect={(monster) => {
                  if (onAddToken) {
                    const centerX = (dimensions.width / 2 - viewport.x) / viewport.scale;
                    const centerY = (dimensions.height / 2 - viewport.y) / viewport.scale;
                    const parseNum = (val: any) => parseInt(val?.toString()) || 0;
                    
                    const monsterId = generateId();
                    
                    // Create a character sheet for the monster so it's lootable
                    const monsterChar: Character = {
                      id: monsterId,
                      campaignId: campaignId,
                      userId: auth.currentUser?.uid || 'monster',
                      nome: monster.name,
                      etnia: 'Monstro',
                      imagem: monster.imageUrl,
                      vidaAtual: parseNum(monster.maxHp),
                      manaAtual: 0,
                      sanidadeAtual: 0,
                      fome: 100,
                      sede: 100,
                      cansaco: 100,
                      clima: 0,
                      stats: {
                        FOR: parseNum(monster.ataque.corte),
                        DEX: parseNum(monster.ataque.perfuracao),
                        CON: parseNum(monster.ataque.impacto),
                        INT: parseNum(monster.ataque.feitico),
                        RES: parseNum(monster.ataque.resistencia),
                        ADP: 0,
                        MEN: 0,
                        APR: 0,
                        RIT: parseNum(monster.ataque.potencial)
                      },
                      statsXP: { FOR: 0, DEX: 0, CON: 0, INT: 0, RES: 0, ADP: 0, MEN: 0, APR: 0, RIT: 0 },
                      dinheiro: { C: 0, B: 0, P: 0, O: 0 },
                      defesa: {
                         "Cabeça": parseNum(monster.defesa.corte),
                         "Tronco": parseNum(monster.defesa.feitico),
                         "Braço Esquerdo": parseNum(monster.defesa.perfuracao),
                         "Braço Direito": parseNum(monster.defesa.impacto),
                         "Pernas": parseNum(monster.defesa.elemental)
                      },
                      armas: monster.acoes ? monster.acoes.map(a => ({
                        id: generateId(),
                        nome: a.name,
                        tipo: a.type,
                        dano: a.dano,
                        acerto: typeof a.acerto === 'number' ? a.acerto : 0,
                        atributoBase: 'Força',
                        escala: '0',
                        peso: 0,
                        volume: 0,
                        durabilidade: 100,
                        maxDurabilidade: 100,
                        corte: a.categoria === 'Corte' ? 4 : 0,
                        perfuracao: a.categoria === 'Perfuração' ? 4 : 0,
                        impacto: a.categoria === 'Impacto' ? 4 : 0,
                        resistencia: 0,
                        efeito: a.description
                      })) : [],
                      catalisadores: [],
                      habilidades: [],
                      magias: [],
                      armaduras: [],
                      acessorios: [],
                      compartimentos: [
                        { id: 'inventory', nome: 'Espólios', volumeMax: 100, itens: [] }
                      ],
                      conhecimentos: [],
                      efeitosNegativos: [],
                      anotacoes: [],
                      escalas: [],
                      dadosCustomizados: [],
                      imagens: [],
                      itens: [],
                      joias: []
                    };

                    if (onAddCharacter) {
                      onAddCharacter({ ...monsterChar, campaignId });
                    }

                    // Direct Firestore redundancy write
                    saveCharacterToFirestore({ ...monsterChar, campaignId }).catch(err => {
                      console.error("Erro ao salvar personagem do Bestiário diretamente:", err);
                    });

                    onAddToken({
                      id: generateId(),
                      name: monster.name,
                      x: centerX,
                      y: centerY,
                      size: inputCreatureSize,
                      imageUrl: monster.imageUrl,
                      type: 'creature',
                      characterId: monsterId,
                      hp: parseNum(monster.maxHp),
                      maxHp: parseNum(monster.maxHp),
                      description: monster.informacoes,
                      deslocamento: parseNum(monster.deslocamento),
                      stats: {
                        acuracia: parseNum(monster.acuracia),
                        esquiva: parseNum(monster.esquiva),
                        ataque: {
                          corte: parseNum(monster.ataque.corte),
                          perfuracao: parseNum(monster.ataque.perfuracao),
                          impacto: parseNum(monster.ataque.impacto),
                          resistencia: parseNum(monster.ataque.resistencia),
                          feitico: parseNum(monster.ataque.feitico),
                          elemental: parseNum(monster.ataque.elemental),
                          magiaNegra: parseNum(monster.ataque.magiaNegra),
                          potencial: parseNum(monster.ataque.potencial),
                        },
                        defesa: {
                          corte: parseNum(monster.defesa.corte),
                          perfuracao: parseNum(monster.defesa.perfuracao),
                          impacto: parseNum(monster.defesa.impacto),
                          feitico: parseNum(monster.defesa.feitico),
                          elemental: parseNum(monster.defesa.elemental),
                          magiaNegra: parseNum(monster.defesa.magiaNegra),
                        }
                      },
                      acoes: (monster.acoes || []).map(a => ({
                        ...a,
                        description: a.description || ''
                      }))
                    });
                  }
                  setShowCreatureModal(false);
                }} 
              />
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-end">
               <button 
                onClick={() => setShowCreatureModal(false)}
                className="px-6 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div 
        ref={containerRef} 
        className="flex-1 cursor-grab active:cursor-grabbing overflow-hidden touch-none"
        style={{ 
          touchAction: 'none', 
          overscrollBehavior: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none'
        }}
      >
        {/* Combat Status Bar */}
        <AnimatePresence>
          {isAttackingMode && (
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
            >
              <div className="bg-amber-600 border-2 border-amber-400 p-3 rounded-2xl shadow-2xl flex items-center gap-4">
                <div className="flex items-center gap-2 text-white">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                    <Target size={18} />
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] font-black uppercase opacity-80 leading-none">Modo de Combate</div>
                    <div className="text-xs font-bold leading-tight">Selecione o Alvo</div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsAttackingMode(false);
                    setAttackerId(null);
                    setTargetId(null);
                    setSelectedAmmoWeaponId(null);
                    setWeaponSelectTokenId(null);
                  }}
                  className="bg-black/20 hover:bg-black/40 text-white p-2 px-4 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2"
                >
                  <X size={14} /> Cancelar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Stage
          width={dimensions.width}
          height={dimensions.height}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          x={viewport.x}
          y={viewport.y}
          draggable={true}
          onClick={(e) => {
            // Click on empty space (not a token) to cancel attack mode
            if (e.target === e.target.getStage() && isAttackingMode) {
              setIsAttackingMode(false);
              setAttackerId(null);
              setTargetId(null);
              setWeaponSelectTokenId(null);
              setSelectedAmmoWeaponId(null);
            }
          }}
          onDragStart={(e) => {
            // Disable drag if multi-touch detected in the native event
            if (e.evt && 'touches' in e.evt && (e.evt as any).touches.length > 1) {
              const stage = e.target.getStage();
              if (stage) stage.stopDrag();
            }
          }}
          onDragEnd={(e) => {
            if (e.target === e.target.getStage()) {
              setViewport(prev => ({
                ...prev,
                x: e.target.x(),
                y: e.target.y()
              }));
            }
          }}
        >
          <Layer>
            {/* Background for the infinite void - using a smaller but sufficient size */}
            <Rect 
              x={-5000} 
              y={-5000} 
              width={10000} 
              height={10000} 
              fill="#09090b" 
            />
            
            {mapImage && (
              <KonvaImage
                image={mapImage}
                width={mapImage.width}
                height={mapImage.height}
                x={0}
                y={0}
                opacity={mapImageStatus === 'loaded' ? 1 : 0.5}
              />
            )}
            
            {hexGrid}
            
            {tokens.map(token => (
              <Token
                key={token.id}
                token={token}
                gridSize={gridSize}
                onDragEnd={handleDragEnd}
                onClick={() => handleTokenClick(token.id)}
                isAttacker={attackerId === token.id}
                isTarget={targetId === token.id}
                isMaster={isMaster}
                availableCharacters={availableCharacters}
                fetchedCharacters={fetchedCharacters}
              />
            ))}
          </Layer>
        </Stage>
      </div>

      {/* Retractable Sidebar Toggle (Master Only) */}
      {isMaster && (
        <button 
          onClick={() => setShowSidebar(!showSidebar)}
          className={cn(
            "absolute top-4 z-50 p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all shadow-xl duration-300 flex items-center justify-center",
            showSidebar ? "right-[260px]" : "right-2"
          )}
          title={showSidebar ? "Fechar Painel" : "Abrir Painel"}
        >
          {showSidebar ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      )}

      {isMaster && (
        <aside className={cn(
          "absolute top-0 right-0 h-full w-[250px] bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-800 z-40 transition-transform duration-300 ease-in-out flex flex-col shadow-2xl",
          showSidebar ? "translate-x-0" : "translate-x-full"
        )}>
        {/* Sidebar Tabs Selector */}
        <div className="flex bg-zinc-950 p-1 border-b border-zinc-800">
          <button 
            onClick={() => setSidebarTab('creatures')}
            className={cn(
              "flex-1 flex flex-col items-center justify-center p-2 rounded-lg transition-all",
              sidebarTab === 'creatures' ? "bg-zinc-900 text-blue-500 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
            )}
            title="Inimigos"
          >
            <Skull size={18} />
            <span className="text-[8px] font-black uppercase mt-1">Inimigos</span>
          </button>
          <button 
            onClick={() => setSidebarTab('initiative')}
            className={cn(
              "flex-1 flex flex-col items-center justify-center p-2 rounded-lg transition-all",
              sidebarTab === 'initiative' ? "bg-zinc-900 text-amber-500 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
            )}
            title="Iniciativa"
          >
            <Zap size={18} />
            <span className="text-[8px] font-black uppercase mt-1">Iniciativa</span>
          </button>
          <button 
            onClick={() => setSidebarTab('combat')}
            className={cn(
              "flex-1 flex flex-col items-center justify-center p-2 rounded-lg transition-all",
              sidebarTab === 'combat' ? "bg-zinc-900 text-red-500 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
            )}
            title="Combate"
          >
            <FileText size={18} />
            <span className="text-[8px] font-black uppercase mt-1">Combate</span>
          </button>
          <button 
            onClick={() => setSidebarTab('generator')}
            className={cn(
              "flex-1 flex flex-col items-center justify-center p-2 rounded-lg transition-all",
              sidebarTab === 'generator' ? "bg-zinc-900 text-purple-500 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
            )}
            title="Gerador"
          >
            <Plus size={18} />
            <span className="text-[8px] font-black uppercase mt-1">Gerador</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
          {sidebarTab === 'creatures' && (
            <>
              {/* Info Panel Title */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-blue-500" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Painel de Inimigos</span>
                </div>
                {isMaster && (
                  <div className="flex gap-1.5">
                    <button 
                      onClick={() => setIsCharacterModalOpen(true)}
                      className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-zinc-950 rounded-lg text-[8px] font-black uppercase transition-all border border-amber-500/20"
                    >
                      <Plus size={10} /> Add Inimigo
                    </button>
                    {tokens.length > 0 && (
                      <button 
                        onClick={() => setShowClearConfirm(true)}
                        className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg text-[8px] font-black uppercase transition-all shadow-lg border border-red-500/20"
                      >
                        <Trash2 size={10} /> Limpar
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              {/* Creatures List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1 custom-scrollbar scroll-smooth text-left">
                {tokens.filter(t => t.type === 'creature').map(token => (
                  <div key={token.id} className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3 group hover:border-red-500/30 transition-all shadow-lg">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center bg-zinc-900">
                          {token.imageUrl ? (
                            <img src={token.imageUrl} alt={token.name} className="w-full h-full object-cover" />
                          ) : (
                            <User size={16} className="text-zinc-600" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-black text-white truncate uppercase tracking-widest">{token.name}</div>
                        <div className="flex items-center gap-1.5 mt-1 text-[8px] font-bold text-zinc-500 uppercase tracking-tighter">
                          <Heart size={8} className="text-red-500" /> 
                          <input 
                            type="number"
                            value={(() => {
                              const char = token.characterId ? availableCharacters.find(c => c.id === token.characterId) : null;
                              return char ? (char.vidaAtual ?? 0) : (token.hp ?? 0);
                            })()}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              handleTokenHpUpdate(token.id, val);
                            }}
                            className="w-10 bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[8px] font-black text-white focus:outline-none focus:border-red-500/50 text-center"
                          />
                          / {(() => {
                            const char = token.characterId ? availableCharacters.find(c => c.id === token.characterId) : null;
                            const mhp = Math.max(1, char ? getVidaMaxima(char.stats.CON) : (token.maxHp ?? 10));
                            return mhp;
                          })()} HP
                        </div>
                      </div>
                      <div className="flex gap-1 transition-all">
                        <button 
                          onClick={() => setViewingCreatureId(token.id === viewingCreatureId ? null : token.id)}
                          className={cn("p-1.5 rounded transition-all", viewingCreatureId === token.id ? "bg-amber-500 text-zinc-950" : "hover:bg-amber-500/10 text-amber-500")}
                        >
                          <Info size={12} />
                        </button>
                        <button 
                          onClick={() => onRemoveToken?.(token.id)}
                          className="p-1.5 hover:bg-red-500/10 hover:text-red-500 text-zinc-600 rounded transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* HP Controls */}
                    <div className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded-xl border border-zinc-800">
                      <button 
                        onClick={() => {
                          const char = token.characterId ? availableCharacters.find(c => c.id === token.characterId) : null;
                          const currentHp = char ? (char.vidaAtual ?? 0) : (token.hp ?? 0);
                          const newHp = Math.max(0, currentHp - 1);
                          handleTokenHpUpdate(token.id, newHp);
                        }}
                        className="p-1.5 hover:bg-zinc-800 text-zinc-500 hover:text-red-500 rounded-lg transition-colors border border-transparent hover:border-zinc-700"
                      >
                        <Minus size={12} />
                      </button>
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-red-500 transition-all shadow-[0_0_8px_rgba(239,68,68,0.3)]" 
                          style={{ 
                            width: (() => {
                              const char = token.characterId ? availableCharacters.find(c => c.id === token.characterId) : null;
                              const chp = char ? (char.vidaAtual ?? 0) : (token.hp ?? 0);
                              const mhp = Math.max(1, char ? getVidaMaxima(char.stats.CON) : (token.maxHp ?? 10));
                              return `${(chp / mhp) * 100}%`;
                            })()
                          }}
                        />
                      </div>
                      <button 
                        onClick={() => {
                          const char = token.characterId ? availableCharacters.find(c => c.id === token.characterId) : null;
                          const chp = char ? (char.vidaAtual ?? 0) : (token.hp ?? 0);
                          const mhp = Math.max(1, char ? getVidaMaxima(char.stats.CON) : (token.maxHp ?? 10));
                          const newHp = Math.min(mhp, chp + 1);
                          handleTokenHpUpdate(token.id, newHp);
                        }}
                        className="p-1.5 hover:bg-zinc-800 text-zinc-500 hover:text-green-500 rounded-lg transition-colors border border-transparent hover:border-zinc-700"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    {/* Monster description expand */}
                    <AnimatePresence>
                      {viewingCreatureId === token.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mt-2 space-y-4 shadow-inner">
                            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                               <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                                 <FileText size={10} /> Ficha Técnica
                               </div>
                               <div className="text-[8px] font-bold text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded-full border border-zinc-800">
                                 Size: {token.size}x{token.size}
                               </div>
                            </div>

                            {/* Stats Summaries... */}
                            {token.description && (
                              <div className="space-y-1">
                                <span className="text-[8px] font-black text-zinc-600 uppercase">Informações</span>
                                <p className="text-[10px] text-zinc-400 leading-relaxed italic whitespace-pre-wrap bg-zinc-950/30 p-2 rounded-xl border border-zinc-800/50">
                                  {token.description}
                                </p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
                {tokens.filter(t => t.type === 'creature').length === 0 && (
                  <div className="flex flex-col items-center justify-center py-6 px-4 bg-zinc-950/30 border border-dashed border-zinc-800 rounded-2xl">
                    <Skull size={24} className="text-zinc-800 mb-2" />
                    <div className="text-[10px] text-zinc-600 italic text-center">Nenhum demônio invocado</div>
                  </div>
                )}
              </div>
            </>
          )}

          {sidebarTab === 'initiative' && (
            <>
              {/* Initiative Title */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-amber-500" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Iniciativa</span>
                </div>
                {isMaster && (
                   <button 
                    onClick={clearInitiative}
                    className="text-[8px] font-black text-zinc-500 hover:text-red-400 uppercase tracking-tighter"
                   >
                     Limpar
                   </button>
                )}
              </div>

              {/* Master Controls */}
              {isMaster && (
                <div className="space-y-2">
                  <button 
                    onClick={handleRollInitiative}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600/20 border border-amber-500/30 hover:bg-amber-600/30 text-amber-500 rounded-xl transition-all group"
                  >
                    <Dices size={16} className="group-hover:rotate-12 transition-transform" />
                    <span className="text-xs font-black uppercase tracking-widest">Rolar Iniciativa</span>
                  </button>
                  <button 
                    onClick={handleNextTurn}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 text-blue-500 rounded-xl transition-all group"
                  >
                    <RefreshCw size={16} className="group-hover:rotate-180 transition-transform duration-500" />
                    <span className="text-xs font-black uppercase tracking-widest">Próximo Turno</span>
                  </button>
                </div>
              )}

              {/* Initiative List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 py-1 custom-scrollbar">
                {[...tokens]
                  .filter(t => t.initiative !== undefined && t.initiative !== null)
                  .filter(t => {
                    const char = t.characterId ? availableCharacters.find(c => c.id === t.characterId) : null;
                    const hp = char ? (char.vidaAtual ?? 0) : (t.hp ?? 0);
                    return hp > 0;
                  })
                  .sort((a, b) => (b.initiative || 0) - (a.initiative || 0))
                  .map((token, idx) => (
                    <motion.div 
                      key={token.id}
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className={cn(
                        "flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded-2xl relative overflow-hidden",
                        idx === 0 && "border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.1)]"
                      )}
                    >
                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 shrink-0">
                        {token.imageUrl ? (
                          <img src={token.imageUrl} alt={token.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600">
                            <User size={12} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-black text-white truncate uppercase tracking-tighter text-left">{token.name}</div>
                        <div className="text-[8px] font-bold text-zinc-500 uppercase text-left">{token.type === 'character' ? 'Jogador' : 'Inimigo'}</div>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                        <span className="text-xs font-black text-amber-500">{token.initiative}</span>
                      </div>
                    </motion.div>
                  ))}

                {tokens.every(t => t.initiative === undefined || t.initiative === null) && (
                   <div className="flex flex-col items-center justify-center py-12 text-center opacity-30">
                     <Dices size={32} className="mb-2" />
                     <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">
                       Iniciativa ainda<br/>não rolada
                     </p>
                   </div>
                )}
              </div>
            </>
          )}

          {sidebarTab === 'combat' && (
            <>
              {/* Combat Log Title */}
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                <FileText size={16} className="text-red-500" />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Log de Combate</span>
              </div>

              {/* Combat Log List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-10 custom-scrollbar">
                {isAttackingMode && (
                  <button 
                    onClick={() => {
                      setIsAttackingMode(false);
                      setAttackerId(null);
                      setTargetId(null);
                      setWeaponSelectTokenId(null);
                      setCombatLog(prev => [{ msg: "Ataque cancelado", type: 'info' }, ...prev]);
                    }}
                    className="w-full py-2 bg-red-600 hover:bg-red-500 text-white text-[10px] uppercase font-black rounded-lg transition-colors border border-red-400/20"
                  >
                    Cancelar Ataque
                  </button>
                )}
                {combatLog.map((log, i) => (
                  <div key={i} className={cn(
                    "text-[10px] px-2 py-1.5 rounded-lg border text-left flex flex-col gap-1.5",
                    log.type === 'success' ? "bg-green-500/10 border-green-500/30 text-green-400" :
                    log.type === 'error' ? "bg-red-500/10 border-red-500/30 text-red-400" :
                    "bg-blue-500/10 border-blue-500/30 text-blue-400"
                  )}>
                    <div className="leading-tight">{log.msg}</div>
                    {(log.rolls || log.locationRoll) && (
                      <div className="flex items-center gap-2 mt-0.5">
                        {log.rolls && (
                          <div className="flex gap-1">
                            {log.rolls.map((r, ri) => (
                              <div key={ri} className="relative w-5 h-5 flex items-center justify-center bg-zinc-900/50 rounded border border-white/5">
                                <DiceImage sides={r.sides} className="w-3.5 h-3.5 opacity-80" />
                                <span className="absolute inset-0 flex items-center justify-center text-[7px] font-black text-white mix-blend-difference drop-shadow-md">{r.val}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {log.locationRoll && (
                          <div className="flex items-center gap-1 pl-2 border-l border-white/10">
                            <span className="text-[7px] font-black opacity-50 uppercase tracking-tighter">Loc:</span>
                            <div className="relative w-5 h-5 flex items-center justify-center bg-amber-500/10 rounded border border-amber-500/20">
                              <DiceImage sides={6} className="w-3.5 h-3.5 opacity-80" />
                              <span className="absolute inset-0 flex items-center justify-center text-[7px] font-black text-white mix-blend-difference drop-shadow-md">{log.locationRoll}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {combatLog.length === 0 && (
                  <div className="text-[10px] text-zinc-600 italic text-center py-4">Sem registros de combate</div>
                )}
              </div>
            </>
          )}

          {sidebarTab === 'generator' && (
            <div className="flex-1 overflow-y-auto pr-1">
              <EnemyGenerator 
                customMaterials={customMaterials}
                onEnemyGenerated={async (enemy: Character) => {
                  const enemyWithCam = { ...enemy, campaignId };
                  if (onAddCharacter) {
                    onAddCharacter(enemyWithCam);
                  }
                  
                  // Direct Firestore redundancy write
                  saveCharacterToFirestore(enemyWithCam).catch(err => {
                    console.error("Erro ao salvar inimigo gerado diretamente:", err);
                  });
                  
                  if (onAddToken) {
                    const newToken: TableToken = {
                      id: generateId(),
                      name: enemy.nome,
                      x: 250, 
                      y: 250,
                      size: 1,
                      type: 'creature',
                      characterId: enemy.id,
                      hp: enemy.vidaAtual,
                      maxHp: getVidaMaxima(enemy.stats.CON),
                      imageUrl: enemy.imagem || 'https://images.unsplash.com/photo-1599508704512-2f19efd1e35f?w=128&h=128&fit=crop',
                      deslocamento: 6,
                      isDefending: false,
                      // We don't necessarily need to populate stats and acoes anymore since it's linked to a characterId
                      // But we can still keep them for quick reference if the VTT doesn't find the character
                      stats: {
                        acuracia: calculateProficiencyBonus(enemy.stats, 'Acurácia', ['FOR', 'DEX']),
                        esquiva: calculateProficiencyBonus(enemy.stats, 'Esquiva', ['DEX']),
                        ataque: { 
                          corte: enemy.stats.FOR > enemy.stats.DEX ? 4 : 2, 
                          perfuracao: enemy.stats.DEX >= enemy.stats.FOR ? 4 : 2, 
                          impacto: 2, 
                          resistencia: 0,
                          feitico: enemy.stats.INT > 10 ? 2 : 0, 
                          elemental: 0, 
                          magiaNegra: 0, 
                          potencial: 0
                        },
                        defesa: { 
                          corte: 0, perfuracao: 0, impacto: 0,
                          feitico: 0, elemental: 0, magiaNegra: 0
                        }
                      },
                      acoes: enemy.armas.map(a => ({
                          ...a, // Spread all weapon fields including corte/perfuracao/impacto
                          id: a.id,
                          name: a.nome,
                          type: 'Major',
                          categoria: a.corte > a.perfuracao ? 'Corte' : 'Perfuração',
                          acerto: a.acerto,
                          dano: a.dano,
                          description: a.efeito || ''
                      })),
                      efeitosNegativos: enemy.efeitosNegativos || []
                    };
                    onAddToken(newToken);
                    setCombatLog(prev => [{ msg: `Inimigo ${enemy.nome} adicionado ao mapa e lista de fichas!`, type: 'info' }, ...prev]);
                  }
                }}
              />
            </div>
          )}
        </div>
      </aside>
      )}
      {selectedTokenId && !isAttackingMode && (
        <div 
          className="absolute z-[100] bg-zinc-950/95 border border-zinc-800 rounded-2xl shadow-2xl p-4 w-72 backdrop-blur-xl transition-all"
          style={{ 
            left: (() => {
              const token = tokens.find(t => t.id === selectedTokenId);
              if (!token) return 0;
              const sidebarWidth = isMaster && showSidebar ? 250 : 0;
              const tokenX = viewport.x + token.x * viewport.scale;
              const tokenW = token.size * gridSize * viewport.scale;
              
              let left = tokenX + tokenW / 2 + 20;
              
              // If menu would overflow right (considering sidebar)
              if (left + 300 > window.innerWidth - sidebarWidth) {
                left = tokenX - tokenW / 2 - 300;
              }
              
              // Final clamp to screen boundaries
              return Math.max(10, Math.min(window.innerWidth - sidebarWidth - 300, left));
            })(),
            top: Math.max(20, Math.min(window.innerHeight - 450, viewport.y + (tokens.find(t => t.id === selectedTokenId)?.y || 0) * viewport.scale - 100))
          }}
        >
          {(() => {
            const token = tokens.find(t => t.id === selectedTokenId);
            if (!token) return null;
            const char = token.characterId ? availableCharacters.find(c => c.id === token.characterId) : null;
            const currentHp = char ? (char.vidaAtual ?? 0) : (token.hp ?? 0);
            const maxHp = char ? getVidaMaxima(char.stats.CON) : (token.maxHp ?? 10);
            const isDead = currentHp <= 0;
            const isMasterOrOwner = isMaster || (token.type === 'character' && token.userId === auth.currentUser?.uid);
            // Loot button should show for enemies or if the token is dead
            const isEnemy = token.type === 'creature' || (token.type === 'character' && token.userId !== auth.currentUser?.uid);

            return (
              <div className="space-y-4 text-left">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-xl border border-zinc-800 flex-shrink-0 overflow-hidden bg-zinc-900 shadow-inner">
                      {token.imageUrl ? <img src={token.imageUrl} className="w-full h-full object-cover" /> : <User size={16} className="text-zinc-700 m-auto mt-2" />}
                      {isDead && (
                        <div className="absolute inset-0 bg-red-950/20 flex items-center justify-center">
                          <Skull size={18} className="text-red-500 animate-pulse" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase text-zinc-100 leading-none mb-1">{token.name}</h3>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none">
                        {token.type === 'character' ? 'Jogador' : 'Inimigo'}
                      </p>
                    </div>
                  </div>
                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSelectedTokenId(null)} 
                    className="text-zinc-600 hover:text-zinc-400 p-1"
                  >
                    <X size={16} />
                  </motion.button>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest px-1">
                    <span className="text-zinc-500">Integridade</span>
                    <span className={cn("text-amber-500 font-black", isDead && "text-red-500")}>
                      {currentHp} / {maxHp}
                    </span>
                  </div>
                  <div className="h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800 shadow-inner">
                    <motion.div 
                      className={cn(
                        "h-full transition-all duration-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]",
                        (currentHp / maxHp) < 0.3 ? "bg-red-600" : 
                        (currentHp / maxHp) < 0.6 ? "bg-amber-500" : 
                        "bg-green-500"
                      )}
                      style={{ width: `${(currentHp / maxHp) * 100}%` }}
                    />
                  </div>
                  
                  {isMaster && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <input 
                        type="number"
                        value={currentHp}
                        onChange={(e) => handleTokenHpUpdate(token.id, parseInt(e.target.value) || 0)}
                        className="w-16 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs font-black text-white focus:outline-none focus:border-red-500/50 text-center shadow-inner"
                      />
                      <div className="flex gap-1 flex-1">
                        <button 
                          onClick={() => handleTokenHpUpdate(token.id, Math.max(0, currentHp - 5))}
                          className="flex-1 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-500 text-[10px]"
                        >
                          -5
                        </button>
                        <button 
                          onClick={() => handleTokenHpUpdate(token.id, Math.max(0, currentHp - 1))}
                          className="flex-1 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-500 text-[10px]"
                        >
                          -1
                        </button>
                        <button 
                          onClick={() => handleTokenHpUpdate(token.id, Math.min(maxHp, currentHp + 1))}
                          className="flex-1 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-500 text-[10px]"
                        >
                          +1
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  {isMasterOrOwner && (
                    <button 
                      onClick={() => startAttack(token.id)}
                      className="col-span-2 flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-500 text-white border border-red-400/20 rounded-xl transition-all group font-black uppercase text-xs tracking-widest shadow-lg shadow-red-600/20"
                    >
                      <Swords size={16} className="group-hover:rotate-12 transition-transform" />
                      Combate / Ações
                    </button>
                  )}

                  {(token.type === 'character' || (token.characterId && char && char.etnia !== 'Monstro' && char.etnia !== 'Criatura')) && isMasterOrOwner && (
                    <button 
                      className={cn(
                        "flex items-center justify-center gap-2 py-2.5 border rounded-xl transition-all group font-black uppercase text-[10px] tracking-widest shadow-sm",
                        token.isDefending ? "bg-blue-600 text-white border-blue-400" : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700"
                      )}
                      onClick={() => {
                        if (token.isDefending) {
                          updateTokenPosition(campaignId, token.id, { isDefending: false, defenseType: null, defenseWeaponId: null, defenseRounds: 0 });
                        } else {
                          const targetChar = availableCharacters.find(c => c.id === token.characterId);
                          const hasShield = targetChar?.compartimentos?.some((c: any) => c.itens?.some((e: any) => e.tipo === 'Escudo'));
                          handleSetDefense(token.id, hasShield ? 'Shield' : 'Weapon');
                        }
                      }}
                    >
                      <Shield size={14} className={cn("transition-transform", token.isDefending && "animate-pulse")} />
                      Defesa
                    </button>
                  )}

                  {isMaster && (
                    <button 
                      onClick={() => onRemoveToken?.(token.id)}
                      className="flex items-center justify-center gap-2 py-2.5 bg-zinc-900 shadow-inner text-zinc-600 border border-zinc-800 rounded-xl hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition-all font-black uppercase text-[10px] tracking-widest"
                    >
                      <Trash2 size={14} />
                      Remover
                    </button>
                  )}

                  {isMasterOrOwner && token.characterId && (
                    <button 
                       onClick={() => {
                         const char = availableCharacters.find(c => c.id === token.characterId);
                         if (char) {
                            setViewingCreatureId(char.id);
                            setIsCharacterModalOpen(true);
                         }
                       }}
                       className="flex items-center justify-center gap-2 py-2.5 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-all font-black uppercase text-[10px] tracking-widest shadow-sm"
                    >
                      <FileText size={14} />
                      Ver Ficha
                    </button>
                  )}

                  {isMaster && !token.characterId && (
                    <div className="col-span-2 p-2 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2">
                       <p className="text-[9px] font-black text-red-500 uppercase text-center">Sem Ficha Vinculada</p>
                       <select 
                        onChange={(e) => {
                          if (e.target.value) {
                            updateTokenPosition(campaignId, token.id, { characterId: e.target.value });
                          }
                        }}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg text-[9px] font-bold text-zinc-400 p-1.5 focus:outline-none"
                       >
                         <option value="">Vincular Ficha...</option>
                         {availableCharacters.filter(c => c.etnia === 'Monstro' || c.etnia === 'Criatura' || c.etnia === 'Inimigo').map(c => (
                           <option key={c.id} value={c.id}>{c.nome}</option>
                         ))}
                       </select>
                    </div>
                  )}

                  {(isEnemy || isMaster || token.type === 'creature' || isDead) && (
                    <button 
                      onClick={() => handleLoot(token)}
                      className="col-span-2 flex items-center justify-center gap-2 py-3 bg-amber-500 text-zinc-950 border border-amber-400 rounded-xl hover:bg-amber-400 transition-all group font-black uppercase text-xs tracking-widest shadow-lg shadow-amber-500/20"
                    >
                      <Package size={16} className="group-hover:scale-110 transition-transform" />
                      Saquear
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Weapon Select Modal */}
      {weaponSelectTokenId && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setWeaponSelectTokenId(null)}
        >
          <div 
            className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">Escolha o Ataque</h3>
              <button onClick={() => setWeaponSelectTokenId(null)} className="text-zinc-500 hover:text-white p-1 hover:bg-zinc-800 rounded-full transition-colors">
                <Plus className="rotate-45" size={20} />
              </button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto space-y-2 custom-scrollbar">
              {(() => {
                const attacker = tokens.find(t => t.id === weaponSelectTokenId);
                const attackerChar = availableCharacters.find(c => c.id === attacker?.characterId);
                const weapons = attackerChar?.armas || [];
                const catalysts = attackerChar?.catalisadores || [];
                const spells = attackerChar?.magias || [];
                // If it has a character sheet, hide generic monster actions to avoid duplicates
                const monsterActions = attackerChar ? [] : (attacker?.acoes || []);
                
                const inventoryItems = attackerChar?.compartimentos?.flatMap(c => c.itens || []) || [];
                const inventoryWeapons = inventoryItems.filter(i => (i.tipo === 'Arma' || i.corte || i.perfuracao || i.impacto) && i.tipo !== 'Munição' && i.tipo !== 'municao') as any[];
                const inventoryCatalysts = inventoryItems.filter(i => i.tipo === 'Catalisador' || i.feitico || i.elemental || i.magiaNegra) as any[];
                
                const allWeapons: any[] = [...weapons];
                inventoryWeapons.forEach(iw => {
                  if (!allWeapons.some(w => w.nome === iw.nome)) {
                    allWeapons.push(iw);
                  }
                });

                return (
                  <>
                    {ammoSelectWeapon ? (
                      <div className="space-y-3 px-1">
                        <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex items-center justify-between shadow-inner">
                           <div>
                              <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Arma Selecionada</div>
                              <div className="text-sm font-black text-white">{ammoSelectWeapon.nome}</div>
                              <div className="text-[8px] text-amber-500 font-black mt-0.5">Pente: {ammoSelectWeapon.municaoCarregada || 0} / {ammoSelectWeapon.capacidadePente || 6}</div>
                           </div>
                           <button 
                            onClick={() => setSelectedAmmoWeaponId(null)} 
                            className="p-1 px-3 bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-400 font-bold rounded-lg transition-colors border border-zinc-700"
                           >
                            Trocar
                           </button>
                        </div>
                        
                        {ammoSelectWeapon.categoria === 'Arma de Fogo' ? (
                          <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Recarregar Bala</div>
                              <div className="flex gap-1 shrink-0">
                                <button 
                                  onClick={async () => {
                                    const attacker = tokens.find(t => t.id === weaponSelectTokenId);
                                    if (attacker?.characterId && selectedAmmoId) {
                                      await handleReload(attacker.characterId, ammoSelectWeapon.id, selectedAmmoId);
                                    }
                                  }}
                                  disabled={!selectedAmmoId}
                                  className="py-1 px-2 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/40 text-amber-500 rounded-lg text-[8px] font-black uppercase transition-all"
                                >
                                  +1
                                </button>
                                <button 
                                  onClick={async () => {
                                    const attacker = tokens.find(t => t.id === weaponSelectTokenId);
                                    if (attacker?.characterId && selectedAmmoId) {
                                      await handleReloadAll(attacker.characterId, ammoSelectWeapon.id, selectedAmmoId);
                                    }
                                  }}
                                  disabled={!selectedAmmoId}
                                  className="py-1 px-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-30 text-white rounded-lg text-[8px] font-black uppercase transition-all"
                                >
                                  Tudo
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-1.5 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                              {attackerChar?.compartimentos?.flatMap(comp => comp.itens).filter(i => (i as any).tipo === 'Munição' && i.nome.toLowerCase().includes('bala')).map(ammo => (
                                <button
                                  key={ammo.id}
                                  onClick={() => setSelectedAmmoId(ammo.id)}
                                  className={cn(
                                    "p-2 rounded-lg border text-left transition-all",
                                    selectedAmmoId === ammo.id ? "bg-amber-600/10 border-amber-500" : "bg-zinc-900 border-zinc-800"
                                  )}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-white">{ammo.nome}</span>
                                    <span className="text-[9px] text-zinc-500">Qtd: {ammo.quantidade || 0}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                            
                            <button 
                              onClick={() => resolveCombat(ammoSelectWeapon)}
                              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
                            >
                               <Swords size={16} /> Atirar
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                             <div className="flex items-center gap-2 px-1">
                               <Target size={12} className="text-amber-500" />
                               <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Escolher Munição</div>
                             </div>

                             <div className="space-y-2">
                               {(attackerChar?.compartimentos?.filter(comp => !comp.externo).flatMap(comp => comp.itens || [])
                                 .filter(i => {
                                   const isBow = ammoSelectWeapon.nome.toLowerCase().includes('arco') || ammoSelectWeapon.nome.toLowerCase().includes('besta') || ammoSelectWeapon.categoria === 'Arco';
                                   if (isBow) return i.nome.toLowerCase().includes('flecha') || i.tipo === 'Munição' || i.tipo === 'municao';
                                   return i.tipo === 'Munição' || i.tipo === 'municao';
                                 }).length || 0) > 0 ? (
                                   attackerChar?.compartimentos?.filter(comp => !comp.externo).flatMap(comp => comp.itens || [])
                                   .filter(i => {
                                     const isBow = ammoSelectWeapon.nome.toLowerCase().includes('arco') || ammoSelectWeapon.nome.toLowerCase().includes('besta') || ammoSelectWeapon.categoria === 'Arco';
                                     if (isBow) return i.nome.toLowerCase().includes('flecha') || i.tipo === 'Munição' || i.tipo === 'municao';
                                     return i.tipo === 'Munição' || i.tipo === 'municao';
                                   }).map((ammo, idx) => {
                                     const availTypes = [
                                       { type: 'Perfuração', val: ammo.perfuracao || 0 },
                                       { type: 'Impacto', val: ammo.impacto || 0 }
                                     ].filter(t => t.val > 0);

                                     return (
                                       <div key={`${ammo.id}-${idx}`} className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden group shadow-lg">
                                         <div className="p-3 flex items-center justify-between bg-zinc-950/50">
                                           <div className="text-left">
                                             <div className="text-xs font-bold text-white group-hover:text-amber-500 transition-colors">{ammo.nome}</div>
                                             <div className="text-[10px] text-zinc-500 font-medium">Estoque: {ammo.quantidade || 0} unidades</div>
                                           </div>
                                         </div>
                                         <div className="flex bg-zinc-900/30 border-t border-zinc-800/50">
                                           {availTypes.map(t => (
                                             <button
                                               key={t.type}
                                               onClick={async () => {
                                                  if (attackerChar) {
                                                    const charRef = doc(db, 'characters', attackerChar.id);
                                                    const updatedCompartimentos = attackerChar.compartimentos.map(comp => ({
                                                      ...comp,
                                                      itens: comp.itens.map(item => {
                                                        if (item.id === ammo.id) {
                                                          return { ...item, quantidade: Math.max(0, (item.quantidade || 1) - 1) };
                                                        }
                                                        return item;
                                                      })
                                                    }));
                                                    await updateDoc(charRef, { compartimentos: updatedCompartimentos });
                                                  }
                                                  
                                                  resolveCombat({
                                                    ...ammoSelectWeapon,
                                                    corte: 0,
                                                    perfuracao: ammo.perfuracao || 0,
                                                    impacto: ammo.impacto || 0,
                                                    resistencia: ammo.resistencia || 0
                                                  }, t.type as any);
                                                  setSelectedAmmoWeaponId(null);
                                               }}
                                               className="flex-1 py-2.5 text-[9px] font-black uppercase text-zinc-400 hover:text-white hover:bg-amber-600/20 border-r last:border-r-0 border-zinc-800 transition-all flex flex-col items-center"
                                             >
                                               <span>{t.type}</span>
                                               <span className="text-amber-500">Nível {t.val}</span>
                                             </button>
                                           ))}
                                         </div>
                                       </div>
                                     );
                                   })
                                 ) : (
                                   <div className="p-8 text-center bg-zinc-950/20 border border-dashed border-zinc-800 rounded-2xl">
                                     <Skull size={24} className="text-zinc-800 mx-auto mb-2 opacity-50" />
                                     <div className="text-[10px] text-zinc-500 uppercase font-black">Sem Munição Restante</div>
                                     <div className="text-[8px] text-zinc-700 mt-1 italic leading-relaxed">
                                       Você precisa de flechas ou balas guardadas em<br/>compartimentos que não sejam externos.
                                     </div>
                                   </div>
                                 )
                               }
                             </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {allWeapons.map((weapon, idx) => {
                           const isRanged = weapon.nome.toLowerCase().includes('arco') || 
                                           weapon.nome.toLowerCase().includes('besta') || 
                                           weapon.nome.toLowerCase().includes('pistola') || 
                                           weapon.nome.toLowerCase().includes('rifle') ||
                                           weapon.categoria === 'Arco' ||
                                           weapon.categoria === 'Arma de Fogo';

                           const availTypes = [
                             { type: 'Corte', val: weapon.corte || 0 },
                             { type: 'Perfuração', val: weapon.perfuracao || 0 },
                             { type: 'Impacto', val: weapon.impacto || 0 }
                           ].filter(t => t.val > 0);

                           return (
                             <div key={`${weapon.id}-${idx}`} className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-lg hover:border-zinc-700 transition-colors">
                               <div className="p-3 border-b border-zinc-900/50 flex items-center justify-between bg-zinc-950/50">
                                 <div className="text-left">
                                   <div className="text-xs font-bold text-white">{weapon.nome}</div>
                                   <div className="text-[10px] text-zinc-500">
                                     Acerto Mín: {weapon.acerto} | Dano: {weapon.dano}
                                   </div>
                                 </div>
                                 <div className="text-[8px] font-black bg-blue-600/10 text-blue-500 px-1.5 py-0.5 rounded border border-blue-500/20 uppercase shrink-0">
                                   Res {weapon.resistencia || 0}
                                 </div>
                               </div>
                               <div className="flex bg-zinc-900/30">
                                 {isRanged ? (
                                   <button
                                     onClick={() => setSelectedAmmoWeaponId(weapon.id)}
                                     className="flex-1 py-3 text-[9px] font-black uppercase text-blue-500 hover:text-white hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
                                   >
                                     <Target size={12}/> Preparar Munir e Atacar
                                   </button>
                                 ) : availTypes.length > 0 ? availTypes.map(t => (
                                   <button
                                     key={t.type}
                                     onClick={() => {
                                       resolveCombat(weapon, t.type as any);
                                     }}
                                     className="flex-1 py-2 text-[9px] font-black uppercase text-zinc-400 hover:text-white hover:bg-blue-600/20 border-r last:border-r-0 border-zinc-800 transition-all flex flex-col items-center gap-0.5"
                                   >
                                     <span className="opacity-50">{t.type}</span>
                                     <span className="text-blue-500">Lvl {t.val}</span>
                                   </button>
                                 )) : (
                                   <button
                                     onClick={() => resolveCombat(weapon)}
                                     className="flex-1 py-2 text-[9px] font-black uppercase text-zinc-400 hover:text-white hover:bg-blue-600/20 transition-all"
                                   >
                                     Desferir Ataque
                                   </button>
                                 )}
                               </div>
                             </div>
                           );
                        })}

                        {[...catalysts, ...inventoryCatalysts].map((catalyst, idx) => (
                      <button
                        key={`${catalyst.id}-${idx}`}
                        onClick={() => resolveCombat(catalyst)}
                        className="w-full flex items-center justify-between p-3 bg-zinc-950 border border-purple-900/30 hover:border-purple-500/50 rounded-xl transition-all group shadow-md"
                      >
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <div className="text-xs font-bold text-purple-400">{catalyst.nome}</div>
                            <span className="text-[8px] font-black bg-purple-600/10 text-purple-500 px-1.5 py-0.5 rounded border border-purple-500/20 uppercase">
                              Lvl {Math.max(catalyst.feitico || 0, catalyst.elemental || 0, catalyst.magiaNegra || 0)} | Pot {catalyst.potencial || 0}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-500 font-medium">
                             Catalisador | Durab: {catalyst.durabilidade}/{catalyst.maxDurabilidade}
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-purple-400 border border-zinc-800 shrink-0 group-hover:scale-110 transition-transform shadow-inner">
                          <Zap size={14} />
                        </div>
                      </button>
                    ))}

                    {spells.map(spell => (
                      <button
                        key={spell.id}
                        onClick={() => resolveCombat({...spell, categoria: spell.escola})}
                        className="w-full flex flex-col p-3 bg-zinc-950 border border-indigo-900/30 hover:border-indigo-500/50 rounded-xl transition-all group shadow-md"
                      >
                         <div className="flex items-center justify-between w-full">
                          <div className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                            <Zap size={10} className="animate-pulse" /> {spell.nome}
                          </div>
                          <div className="text-[8px] font-black bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 text-zinc-500 uppercase">
                            {spell.escola} | Acerto: {spell.acerto}
                          </div>
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-1 font-medium">Dano: {spell.dano} | Custo: {spell.mana} Mana</div>
                      </button>
                    ))}

                    {/* Monster Specialized Actions */}
                    {monsterActions.map(action => {
                      const availTypes = [
                        { type: 'Corte', val: attacker?.stats?.ataque ? (attacker.stats.ataque as any).corte : 0 },
                        { type: 'Perfuração', val: attacker?.stats?.ataque ? (attacker.stats.ataque as any).perfuracao : 0 },
                        { type: 'Impacto', val: attacker?.stats?.ataque ? (attacker.stats.ataque as any).impacto : 0 }
                      ].filter(t => t.val > 0);

                      const isActionPhysical = ['Corte', 'Perfuração', 'Impacto'].includes(action.categoria);

                      return (
                        <div key={action.id} className="bg-zinc-950 border border-red-900/30 rounded-xl overflow-hidden shadow-lg hover:border-red-500/30 transition-colors">
                          <div className="p-3 border-b border-zinc-900/50 flex items-center justify-between bg-zinc-950/50">
                            <div className="text-left">
                              <div className="text-xs font-black text-red-500 flex items-center gap-1.5 capitalize tracking-tighter">
                                <Skull size={10} /> {action.name}
                              </div>
                              <div className="text-[10px] text-zinc-300 font-bold">
                                Acerto: {Number(action.acerto) >= 0 ? '+' : ''}{action.acerto} | Dano: {action.dano}
                              </div>
                            </div>
                            <div className="text-[8px] font-black bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 text-zinc-500 uppercase shrink-0">
                               {action.type}
                            </div>
                          </div>
                          
                          <div className="flex bg-zinc-900/20">
                            {isActionPhysical ? (
                              availTypes.map(t => (
                                <button
                                  key={t.type}
                                  onClick={() => {
                                    resolveCombat(action, t.type as any);
                                  }}
                                  className="flex-1 py-2 text-[9px] font-black uppercase text-zinc-500 hover:text-white hover:bg-red-600/20 border-r last:border-r-0 border-zinc-800 transition-all flex flex-col items-center"
                                >
                                  <span>{t.type}</span>
                                  <span className="text-red-500">Lvl {t.val}</span>
                                </button>
                              ))
                            ) : (
                               <button
                                onClick={() => resolveCombat(action)}
                                className="flex-1 py-3 text-[10px] font-black uppercase text-zinc-500 hover:text-white hover:bg-red-600 border-zinc-800 transition-all"
                              >
                                Executar {action.categoria}
                              </button>
                            )}
                          </div>
                          {action.description && (
                            <div className="p-2.5 text-[8px] text-zinc-500 italic border-t border-zinc-900/50 text-left bg-black/20">
                              {action.description}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Basic Attack fallback */}
                    {weapons.length === 0 && monsterActions.length === 0 && (
                      <button
                        onClick={() => resolveCombat({ nome: "Soco/Ataque Básico", acerto: 0, dano: "1d4+0" })}
                        className="w-full flex items-center justify-between p-4 bg-zinc-950 border border-dashed border-zinc-800 hover:border-blue-500/50 rounded-2xl transition-all group"
                      >
                        <div className="text-left">
                          <div className="text-xs font-bold text-white group-hover:text-blue-400 capitalize">Combate Desarmado</div>
                          <div className="text-[10px] text-zinc-500 mt-1 font-medium">Acerto Mín: 0 | Dano: 1d4</div>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-600 group-hover:text-blue-500 transition-colors border border-zinc-800 group-hover:border-blue-500/20">
                          <Shield size={16} />
                        </div>
                      </button>
                    )}
                  </>
                )}
              </>
            );
          })()}
        </div>
            <div className="p-3 bg-zinc-950/50 border-t border-zinc-800">
               <button 
                onClick={() => setWeaponSelectTokenId(null)}
                className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-all uppercase tracking-widest"
               >
                 Cancelar / Sair
               </button>
            </div>
          </div>
        </div>
      )}

      {lootingCharId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                    <Package className="text-amber-500" size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Baú de Espólios</h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">
                      {fetchedCharacters[lootingCharId]?.nome || availableCharacters.find(c => c.id === lootingCharId)?.nome || 'Aguardando...'}
                    </p>
                  </div>
               </div>
               <button 
                onClick={() => setLootingCharId(null)}
                className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-all focus:outline-none"
               >
                 <X size={24} />
               </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {(() => {
                const char = fetchedCharacters[lootingCharId] || availableCharacters.find(c => c.id === lootingCharId);
                if (!char) {
                  return (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                      <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">Sincronizando espólios...</p>
                    </div>
                  );
                }
                
                const totalMoney = (char.dinheiro?.C || 0) + (char.dinheiro?.B || 0) + (char.dinheiro?.P || 0) + (char.dinheiro?.O || 0);
                const hasItems = (char.armas?.length || 0) > 0 || 
                                 (char.catalisadores?.length || 0) > 0 || 
                                 (char.armaduras && char.armaduras.length > 0) || 
                                 (char.acessorios && char.acessorios.length > 0) || 
                                 (char.compartimentos || []).some(comp => comp.itens && comp.itens.length > 0) ||
                                 totalMoney > 0;
                
                if (!hasItems) return (
                  <div className="text-center py-12 px-6 bg-zinc-950/50 border border-dashed border-zinc-800 rounded-2xl">
                    <Package size={32} className="mx-auto text-zinc-800 mb-2" />
                    <p className="text-xs text-zinc-500 italic">O inventário está vazio.</p>
                  </div>
                );

                return (
                  <div className="space-y-6">
                    {/* Money Section */}
                    {totalMoney > 0 && (
                      <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-3">
                         <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
                              <Zap size={12} /> Moedas e Tesouros
                            </h4>
                            <button 
                              onClick={() => handleLootMoney(char.id)}
                              className="px-3 py-1.5 bg-amber-500 text-zinc-950 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20"
                            >
                              Saquear Todas
                            </button>
                         </div>
                         <div className="grid grid-cols-4 gap-2">
                            {[
                              { label: 'C', val: char.dinheiro?.C, color: 'text-orange-400' },
                              { label: 'B', val: char.dinheiro?.B, color: 'text-zinc-400' },
                              { label: 'P', val: char.dinheiro?.P, color: 'text-zinc-200' },
                              { label: 'O', val: char.dinheiro?.O, color: 'text-amber-400' },
                            ].map(coin => (
                              <div key={coin.label} className="bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50 text-center">
                                <span className={`text-[10px] font-black ${coin.label} mr-1`}>{coin.label}</span>
                                <span className="text-xs font-bold text-white">{coin.val || 0}</span>
                              </div>
                            ))}
                         </div>
                      </div>
                    )}

                    {/* Weapons Section */}
                    {char.armas.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Armas</h4>
                        <div className="grid grid-cols-1 gap-1.5">
                          {char.armas.map(arma => (
                            <div key={arma.id} className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-amber-500/30 transition-all group shadow-sm">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-white truncate">{arma.nome}</div>
                                <div className="text-[8px] text-zinc-500 font-medium uppercase mt-0.5">{arma.categoria} | Dano: {arma.dano}</div>
                              </div>
                              <button 
                                onClick={() => {
                                  if (activeCharacterId) {
                                    handleTransferItem(char.id, activeCharacterId, 'armas', arma);
                                  } else {
                                    handleCutItem(char.id, 'armas', arma);
                                  }
                                }}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all",
                                  clipBoardItem?.item.id === arma.id 
                                    ? "bg-zinc-800 text-zinc-500" 
                                    : "bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-zinc-950"
                                )}
                              >
                                {clipBoardItem?.item.id === arma.id ? 'Recortado' : activeCharacterId ? 'Saquear' : 'Recortar'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Catalysts Section */}
                    {char.catalisadores.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Catalisadores</h4>
                        <div className="grid grid-cols-1 gap-1.5">
                          {char.catalisadores.map(cat => (
                            <div key={cat.id} className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-cyan-500/30 transition-all group shadow-sm">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-white truncate">{cat.nome}</div>
                                <div className="text-[8px] text-zinc-500 font-medium uppercase mt-0.5">Feitiço: {cat.feitico} | Elem: {cat.elemental} | Pot: {cat.potencial}</div>
                              </div>
                              <button 
                                onClick={() => {
                                  if (activeCharacterId) {
                                    handleTransferItem(char.id, activeCharacterId, 'catalisadores', cat);
                                  } else {
                                    handleCutItem(char.id, 'catalisadores', cat);
                                  }
                                }}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all",
                                  clipBoardItem?.item.id === cat.id 
                                    ? "bg-zinc-800 text-zinc-500" 
                                    : "bg-cyan-500/10 hover:bg-cyan-500 text-cyan-500 hover:text-zinc-950"
                                )}
                              >
                                {clipBoardItem?.item.id === cat.id ? 'Recortado' : activeCharacterId ? 'Saquear' : 'Recortar'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Armor Section */}
                    {char.armaduras && char.armaduras.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Armaduras</h4>
                        <div className="grid grid-cols-1 gap-1.5">
                          {char.armaduras.map(arm => (
                            <div key={arm.id} className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-blue-500/30 transition-all group shadow-sm">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-white truncate">{arm.nome}</div>
                                <div className="text-[8px] text-zinc-500 font-medium uppercase mt-0.5">RD: {arm.reducaoDano} | Peso: {arm.peso}</div>
                              </div>
                              <button 
                                onClick={() => {
                                  if (activeCharacterId) {
                                    handleTransferItem(char.id, activeCharacterId, 'armaduras', arm);
                                  } else {
                                    handleCutItem(char.id, 'armaduras', arm);
                                  }
                                }}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all",
                                  clipBoardItem?.item.id === arm.id 
                                    ? "bg-zinc-800 text-zinc-500" 
                                    : "bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-zinc-950"
                                )}
                              >
                                {clipBoardItem?.item.id === arm.id ? 'Recortado' : activeCharacterId ? 'Saquear' : 'Recortar'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Accessories Section */}
                    {char.acessorios && char.acessorios.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Acessórios</h4>
                        <div className="grid grid-cols-1 gap-1.5">
                          {char.acessorios.map(ace => (
                            <div key={ace.id} className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-purple-500/30 transition-all group shadow-sm">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-white truncate">{ace.nome}</div>
                                <div className="text-[8px] text-zinc-500 font-medium uppercase mt-0.5">Efeito: {ace.efeito || 'N/A'}</div>
                              </div>
                              <button 
                                onClick={() => {
                                  if (activeCharacterId) {
                                    handleTransferItem(char.id, activeCharacterId, 'acessorios', ace);
                                  } else {
                                    handleCutItem(char.id, 'acessorios', ace);
                                  }
                                }}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all",
                                  clipBoardItem?.item.id === ace.id 
                                    ? "bg-zinc-800 text-zinc-500" 
                                    : "bg-purple-500/10 hover:bg-purple-500 text-purple-500 hover:text-zinc-950"
                                )}
                              >
                                {clipBoardItem?.item.id === ace.id ? 'Recortado' : activeCharacterId ? 'Saquear' : 'Recortar'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inventory Compartments */}
                    {char.compartimentos.map(comp => (
                      comp.itens && comp.itens.length > 0 && (
                        <div key={comp.id} className="space-y-2">
                          <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">{comp.nome}</h4>
                          <div className="grid grid-cols-1 gap-1.5">
                            {comp.itens.map(item => (
                              <div key={item.id} className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-all group shadow-sm">
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-bold text-white truncate">{item.nome}</div>
                                  <div className="text-[8px] text-zinc-500 font-medium uppercase mt-0.5">Peso: {item.peso} | Vol: {item.volume}</div>
                                </div>
                                <button 
                                  onClick={() => {
                                    if (activeCharacterId) {
                                      handleTransferItem(char.id, activeCharacterId, `comp_${comp.id}`, item);
                                    } else {
                                      handleCutItem(char.id, comp.id, item);
                                    }
                                  }}
                                  className={cn(
                                    "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all",
                                    clipBoardItem?.item.id === item.id 
                                      ? "bg-zinc-800 text-zinc-500" 
                                      : "bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-zinc-950"
                                  )}
                                >
                                  {clipBoardItem?.item.id === item.id ? 'Recortado' : activeCharacterId ? 'Saquear' : 'Recortar'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                );
              })()}
            </div>
            
            <div className="p-4 bg-zinc-950/50 border-t border-zinc-800 flex flex-col gap-2">
               <div className="text-[9px] text-zinc-500 text-center italic mb-1">
                 Selecione os itens para "Recortar". Eles sumirão da ficha original ao serem colados em outra.
               </div>
               <button 
                onClick={() => setLootingCharId(null)}
                className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
               >
                 Fechar Inventário
               </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
});

