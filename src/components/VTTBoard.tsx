import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { Stage, Layer, Image as KonvaImage, Rect, Circle, Line, Text, Group, RegularPolygon, Shape } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import { TableToken, TableConfig, Character, MonsterAction } from '../types';
import { updateTokenPosition } from '../services/vttService';
import { Shield, User, Trash2, Plus, Settings, ZoomIn, ZoomOut, Maximize, Eye, EyeOff, Upload, ChevronLeft, ChevronRight, Skull, Info, Heart, Minus, FileText, Zap, Dices, Swords } from 'lucide-react';
import { cn } from '../lib/utils';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Bestiary } from './Bestiary';
import { BestiaryMonster } from '../types';
import { calculateProficiencyBonus } from '../rules/proficiencyRules';

import { compressImageDataUrl } from '../lib/imageUtils';

interface VTTBoardProps {
  campaignId: string;
  isMaster: boolean;
  tokens: TableToken[];
  config: TableConfig;
  availableCharacters: Character[];
  onAddToken?: (token: TableToken) => void;
  onRemoveToken?: (tokenId: string) => void;
  onUpdateConfig?: (config: Partial<TableConfig>) => void;
  onRollResult?: (res: any) => void;
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

const Token = React.memo(({ token, gridSize, onDragEnd, onClick, isAttacker, isTarget, isMaster }: { 
  token: TableToken; 
  gridSize: number; 
  onDragEnd: (id: string, x: number, y: number) => void;
  onClick?: () => void;
  isAttacker?: boolean;
  isTarget?: boolean;
  isMaster?: boolean;
}) => {
  const [image] = useImage(token.imageUrl || '');
  const radius = (token.size * gridSize) / 2;
  const [dragDist, setDragDist] = useState(0);
  const lastPos = useRef({ x: token.x, y: token.y });
  const isDead = token.hp !== undefined && token.hp <= 0;

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
      onClick={onClick}
      onTap={onClick}
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
          fill="#3b82f6"
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

      {token.hp !== undefined && token.maxHp !== undefined && (
        <Group x={-radius} y={-10}>
          <Rect
            width={token.size * gridSize}
            height={4}
            fill="#333"
            cornerRadius={2}
          />
          <Rect
            width={(token.hp / token.maxHp) * (token.size * gridSize)}
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
  onAddToken,
  onRemoveToken,
  onUpdateConfig,
  onRollResult
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
  const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);
  const [viewingCreatureId, setViewingCreatureId] = useState<string | null>(null);
  
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
  const [combatLog, setCombatLog] = useState<{msg: string, type: 'success' | 'error' | 'info'}[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'creatures' | 'combat' | 'initiative'>('creatures');

  // Helper to calculate Esquiva bonus for any token
  const calculateTokenEsquiva = (token: TableToken) => {
    if (token.type === 'creature') {
      return (token.stats?.esquiva || 0);
    } else if (token.type === 'character') {
      const char = availableCharacters.find(c => c.id === token.characterId);
      if (char) {
        const climateProf = calculateProficiencyBonus(char.stats, "Clima", ["ADP"], char.fome, char.sede);
        return calculateProficiencyBonus(char.stats, "Esquiva", ["DEX", "ADP"], char.fome, char.sede, char.cansaco, char.clima, climateProf, char.bonusProficiencias?.["Esquiva"] || 0);
      }
    }
    return 0;
  };

  const handleRollInitiative = async () => {
    if (!isMaster) return;
    setCombatLog(prev => [{ msg: "Iniciando rodada de iniciativa...", type: 'info' }, ...prev]);
    const results: string[] = [];
    for (const token of tokens) {
      const bonus = calculateTokenEsquiva(token);
      const roll = Math.floor(Math.random() * 20) + 1;
      const total = roll + bonus;
      updateTokenPosition(campaignId, token.id, { initiative: total } as any);
      results.push(`${token.name}: ${total}`);
    }
    setCombatLog(prev => [{ msg: `Iniciativa concluída: ${results.join(' | ')}`, type: 'success' }, ...prev]);
  };

  const clearInitiative = async () => {
    if (!isMaster) return;
    for (const token of tokens) {
      updateTokenPosition(campaignId, token.id, { initiative: null } as any);
    }
    setCombatLog(prev => [{ msg: "Iniciativa limpa.", type: 'info' }, ...prev]);
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
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        setDimensions({ width: w, height: h });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
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

  const handleTokenClick = (tokenId: string) => {
    if (isAttackingMode && attackerId && tokenId !== attackerId) {
      setTargetId(tokenId);
      setWeaponSelectTokenId(attackerId);
      return;
    }
    
    setSelectedTokenId(tokenId === selectedTokenId ? null : tokenId);
  };

  const startAttack = (tokenId: string) => {
    setIsAttackingMode(true);
    setAttackerId(tokenId);
    setCombatLog([{ msg: "Selecione o alvo do ataque...", type: 'info' }]);
  };

  const resolveCombat = async (actionOrWeapon: any) => {
    try {
      if (!attackerId || !targetId) return;
      
      const attacker = tokens.find(t => t.id === attackerId);
      const target = tokens.find(t => t.id === targetId);
      const attackerChar = availableCharacters.find(c => c.id === attacker?.characterId);
      
      if (!attacker || !target) return;

    // 1. Identify Attack Type, Level and Resistance/Potential
    let attackType = 'Corte';
    let attackLevel = 0;
    let attackerResonance = 0; // Resistance or Potential
    
    const isPhysical = (type: string) => ['Corte', 'Perfuração', 'Impacto'].includes(type);

    if (attacker.type === 'creature' && attacker.stats) {
      // Monster attacking
      attackType = actionOrWeapon.categoria || 'Corte';
      const key = getMapKey(attackType);
      attackLevel = (attacker.stats.ataque as any)[key] || 0;
      attackerResonance = isPhysical(attackType) 
        ? (attacker.stats.ataque.resistencia || 0) 
        : (attacker.stats.ataque.potencial || 0);
    } else if (attacker.type === 'character' && attackerChar) {
      // Character attacking
      if (actionOrWeapon.escola) {
        // It's a Spell? (from Magias list)
        attackType = actionOrWeapon.escola;
        
        // Find best catalyst (equipped or in inventory)
        const inventoryItems = attackerChar.compartimentos?.flatMap(c => c.itens || []) || [];
        const inventoryCatalysts = inventoryItems.filter(i => i.tipo === 'Catalisador' || i.feitico || i.elemental || i.magiaNegra);
        const allCatalysts = [...attackerChar.catalisadores, ...inventoryCatalysts];
        
        const key = getMapKey(attackType);
        // Find the one with highest level for this school
        const bestCatalyst = allCatalysts.reduce((best, curr) => {
          if (!best) return curr;
          const bestVal = (best as any)[key] || 0;
          const currVal = (curr as any)[key] || 0;
          return currVal > bestVal ? curr : best;
        }, null as any);

        attackLevel = bestCatalyst ? ((bestCatalyst as any)[key] || 0) : 0;
        attackerResonance = bestCatalyst ? (bestCatalyst.potencial || 0) : 0;
      } else if (attackerChar.catalisadores.some(c => c.id === actionOrWeapon.id) || (attackerChar.compartimentos?.some(comp => comp.itens.some(i => i.id === actionOrWeapon.id)))) {
        // Catalyst used directly?
        const catalyst = actionOrWeapon;
        const key = getMapKey(catalyst.tipo);
        attackType = catalyst.tipo;
        attackLevel = (catalyst as any)[key] || 0;
        attackerResonance = catalyst.potencial || 0;
      } else {
        // It's a Weapon
        const v = {
          Corte: actionOrWeapon.corte || 0,
          Perfuração: actionOrWeapon.perfuracao || 0,
          Impacto: actionOrWeapon.impacto || 0
        };
        const best = Object.entries(v).reduce((a, b) => a[1] > b[1] ? a : b);
        attackType = best[0];
        attackLevel = best[1];
        attackerResonance = actionOrWeapon.resistencia || 0;
      }
    }

    // 2. Identify Target Defense Level
    let targetDefLevel = 0;
    if (target.type === 'character') {
      const char = availableCharacters.find(c => c.id === target.characterId);
      if (char) {
        const key = getMapKey(attackType);
        targetDefLevel = char.armaduras.reduce((max, arm) => Math.max(max, (arm as any)[key] || 0), 0);
      }
    } else if (target.type === 'creature' && target.stats) {
      const key = getMapKey(attackType);
      targetDefLevel = (target.stats.defesa as any)[key] || 0;
    }

    // 3. Logic Check
    const attackHasHigherLevel = attackLevel >= targetDefLevel;
    const attackerTotalPower = attackLevel + attackerResonance;
    const attackCanPierce = attackerTotalPower >= targetDefLevel;
    
    // Durability reduces only if Attack Level < Defense Level
    const losesDurability = attackLevel < targetDefLevel;
    // Damage is caused if Attack Level >= Defense OR (Attack+Res >= Defense)
    const canDamage = attackHasHigherLevel || attackCanPierce;
    
    // 4. Accuracy Check (3d8 + Acuracia - Esquiva >= Base Acerto)
    let diceRolls: number[] = [];
    let totalDice = 0;
    let formula = "";

    // Both Characters and Creatures use 3d8 for accuracy in this system
    for (let i = 0; i < 3; i++) {
      const r = Math.floor(Math.random() * 8) + 1;
      diceRolls.push(r);
      totalDice += r;
    }
    formula = `3d8 (${diceRolls.join('+')})`;

    const accuracyRoll = totalDice; 
    
    // Base Acerto from weapon/action
    let baseAcerto = 10;
    if (typeof actionOrWeapon.acerto === 'number') {
      baseAcerto = actionOrWeapon.acerto;
    } else if (typeof actionOrWeapon.acerto === 'string') {
      baseAcerto = parseInt(actionOrWeapon.acerto) || 10;
    }

    // Get stats for modifiers
    let attackerAcuracia = 0;
    let targetEsquiva = 0;

    if (attacker.type === 'creature' && attacker.stats) {
      attackerAcuracia = attacker.stats.acuracia || 0;
    } else if (attacker.type === 'character' && attackerChar) {
      const attackerClimateProf = calculateProficiencyBonus(
        attackerChar.stats,
        "Clima",
        ["ADP"],
        attackerChar.fome,
        attackerChar.sede
      );

      attackerAcuracia = calculateProficiencyBonus(
        attackerChar.stats,
        "Acurácia",
        ["FOR", "DEX"],
        attackerChar.fome,
        attackerChar.sede,
        attackerChar.cansaco,
        attackerChar.clima,
        attackerClimateProf,
        attackerChar.bonusProficiencias?.["Acurácia"] || 0
      );
    }

    if (target.type === 'creature' && target.stats) {
      targetEsquiva = target.stats.esquiva || 0;
    } else if (target.type === 'character') {
      const char = availableCharacters.find(c => c.id === target.characterId);
      if (char) {
        const targetClimateProf = calculateProficiencyBonus(
          char.stats,
          "Clima",
          ["ADP"],
          char.fome,
          char.sede
        );
        
        targetEsquiva = calculateProficiencyBonus(
          char.stats,
          "Esquiva",
          ["DEX", "ADP"],
          char.fome,
          char.sede,
          char.cansaco,
          char.clima,
          targetClimateProf,
          char.bonusProficiencias?.["Esquiva"] || 0
        );
      }
    }

    const totalHitRoll = accuracyRoll + attackerAcuracia - targetEsquiva;
    const hitSucceeded = totalHitRoll >= baseAcerto;

    // 5. Apply Results
    let damage = 0;
    let damageDiceRolls: number[] = [];
    let damageFormula = "";
    let damageBonus = 0;
    const HIT_LOCATIONS = ["Braço Esquerdo", "Braço Direito", "Perna Esquerda", "Perna Direita", "Tronco", "Cabeça"];
    const locationIdx = Math.floor(Math.random() * 6);
    const locationName = HIT_LOCATIONS[locationIdx];

    if (hitSucceeded) {
      if (canDamage) {
        try {
          const rawDano = actionOrWeapon.dano || "1d4";
          // Use a robust parser logic similar to the App-wide utility
          const danoStr = rawDano.toString().toLowerCase().replace(/\s+/g, "").replace(/-/g, "+-");
          const parts = danoStr.split('+').filter(p => p.length > 0);
          
          damage = 0;
          damageDiceRolls = [];
          damageBonus = 0;
          const formulaParts: string[] = [];

          parts.forEach(part => {
             const isNegative = part.startsWith('-');
             const cleanPart = isNegative ? part.substring(1) : part;

             if (cleanPart.includes('d')) {
               const [dNumStr, dSidesStr] = cleanPart.split('d');
               const dNum = Math.min(20, parseInt(dNumStr) || 1);
               const dSides = parseInt(dSidesStr) || 6;
               let partTotal = 0;
               const rolls: number[] = [];
               for (let i = 0; i < dNum; i++) {
                 const r = Math.floor(Math.random() * dSides) + 1;
                 rolls.push(r);
                 partTotal += r;
               }
               
               if (isNegative) {
                 damage -= partTotal;
                 damageDiceRolls.push(...rolls.map(r => -r));
                 formulaParts.push(`-${dNum}d${dSides} (${rolls.map(r => -r).join('+')})`);
               } else {
                 damage += partTotal;
                 damageDiceRolls.push(...rolls);
                 formulaParts.push(`${dNum}d${dSides} (${rolls.join('+')})`);
               }
             } else {
               const val = parseInt(part) || 0;
               damage += val;
               damageBonus += val;
               if (val !== 0) {
                 formulaParts.push(val > 0 ? `+${val}` : `${val}`);
               }
             }
          });
          
          // Clean formula segments
          if (formulaParts.length > 0 && formulaParts[0].startsWith('+')) {
            formulaParts[0] = formulaParts[0].substring(1);
          }
          damageFormula = formulaParts.join(' ');

          // Final data for the popup and history
          if (onRollResult) {
            onRollResult({
              isCombat: true,
              armaNome: actionOrWeapon.nome || actionOrWeapon.name || "Ataque",
              hitResult: totalHitRoll,
              totalHitBonus: attackerAcuracia - targetEsquiva,
              hitFormula: `${formula}${attackerAcuracia > 0 ? ` + ${attackerAcuracia}` : ''}${targetEsquiva > 0 ? ` - ${targetEsquiva}` : ''}`,
              hitRolls: diceRolls,
              hitBonus: attackerAcuracia - targetEsquiva,
              hitSucceeded: true,
              dmgResult: damage,
              dmgFormula: damageFormula,
              dmgRolls: damageDiceRolls,
              dmgBonus: damageBonus, 
              hitLocation: locationName,
              result: totalHitRoll,
              formula: `Atq: ${accuracyRoll} vs ${baseAcerto} | Dano: ${damage}`
            });
          }

        } catch (e) { 
          console.error("Dano parse error:", e);
          damage = 1;
          if (onRollResult) {
            onRollResult({
              isCombat: true,
              armaNome: actionOrWeapon.nome || actionOrWeapon.name || "Ataque",
              hitResult: totalHitRoll,
              hitSucceeded: true,
              dmgResult: 1,
              dmgFormula: "Fixo: 1",
              dmgRolls: [],
              dmgBonus: 0,
              hitLocation: locationName,
              result: totalHitRoll,
              formula: `Atq: ${accuracyRoll} vs ${baseAcerto} | Dano: 1`
            });
          }
        }

        const newHp = Math.max(0, (target.hp || 0) - damage);
        const tokenRef = doc(db, 'campaigns', campaignId, 'tokens', target.id);
        await updateDoc(tokenRef, { hp: newHp });

        if (target.type === 'character' && target.characterId) {
          const char = availableCharacters.find(c => c.id === target.characterId);
          if (char) {
            const charRef = doc(db, 'characters', char.id);
            await updateDoc(charRef, { vidaAtual: newHp });
          }
        }

        const resLabel = isPhysical(attackType) ? 'Res' : 'Pot';
        setCombatLog(prev => [{ 
          msg: `${attackHasHigherLevel ? 'DANO DIRETO!' : 'DANO P/ RESISTÊNCIA!'} (${accuracyRoll} + ${attackerAcuracia} - ${targetEsquiva} = ${totalHitRoll} vs Mín: ${baseAcerto}). Lvl Atq ${attackLevel} ${!attackHasHigherLevel ? `(+ ${attackerResonance} ${resLabel})` : ''} vs Lvl Def ${targetDefLevel}. Dano: ${damage}`, 
          type: attackHasHigherLevel ? 'success' : 'info'
        }, ...prev]);
      } else {
        const resLabel = isPhysical(attackType) ? 'Resistencia' : 'Potencial';
        setCombatLog(prev => [{ 
          msg: `BLOQUEADO! Nível de Ataque (${attackLevel}) + ${resLabel} (${attackerResonance}) insuficiente contra Defesa (${targetDefLevel}). Perdeu Durabilidade. (Acerto: ${totalHitRoll} vs ${baseAcerto})`, 
          type: 'error' 
        }, ...prev]);

        // Still show popup for blocked hits that "hit" but caused 0 damage
        if (onRollResult) {
          onRollResult({
            isCombat: true,
            armaNome: actionOrWeapon.nome || actionOrWeapon.name || "Ataque",
            hitResult: totalHitRoll,
            totalHitBonus: attackerAcuracia - targetEsquiva,
            hitFormula: `${formula}${attackerAcuracia > 0 ? ` + ${attackerAcuracia}` : ''}${targetEsquiva > 0 ? ` - ${targetEsquiva}` : ''}`,
            hitRolls: diceRolls,
            hitBonus: attackerAcuracia - targetEsquiva,
            hitSucceeded: true,
            dmgResult: 0,
            dmgFormula: "Bloqueado",
            dmgRolls: [],
            dmgBonus: 0, 
            hitLocation: locationName,
            result: totalHitRoll,
            formula: `Atq: ${accuracyRoll} vs ${baseAcerto} | Bloqueado`
          });
        }
      }
    } else {
      // ERROU case: still show result popup without damage/location
      if (onRollResult) {
        onRollResult({
          isCombat: true,
          armaNome: actionOrWeapon.nome || actionOrWeapon.name || "Ataque",
          hitResult: totalHitRoll,
          totalHitBonus: attackerAcuracia - targetEsquiva,
          hitFormula: `${formula}${attackerAcuracia > 0 ? ` + ${attackerAcuracia}` : ''}${targetEsquiva > 0 ? ` - ${targetEsquiva}` : ''}`,
          hitRolls: diceRolls,
          hitBonus: attackerAcuracia - targetEsquiva,
          hitSucceeded: false,
          dmgResult: 0,
          dmgFormula: "Errou",
          dmgRolls: [],
          dmgBonus: 0, 
          hitLocation: undefined,
          result: totalHitRoll,
          formula: `Atq: ${accuracyRoll} vs ${baseAcerto} | ERROU`
        });
      }

      setCombatLog(prev => [{ 
        msg: `ERROU! O ataque não atingiu o alvo. (Resultado: ${accuracyRoll} + ${attackerAcuracia} - ${targetEsquiva} = ${totalHitRoll} vs Mínimo: ${baseAcerto}).`, 
        type: 'error' 
      }, ...prev]);
    }

    // 6. Handle Durability Loss (if attacker is character)
    if (attacker.type === 'character' && attackerChar && losesDurability) {
       // Find if it was a weapon
       const isWeapon = attackerChar.armas.some(w => w.id === actionOrWeapon.id);
       const isCatalyst = attackerChar.catalisadores.some(c => c.id === actionOrWeapon.id);
       
       if (isWeapon || isCatalyst) {
          const charRef = doc(db, 'characters', attackerChar.id);
          const updatedArmas = attackerChar.armas.map(w => {
            if (w.id === actionOrWeapon.id) {
               return { ...w, durabilidade: Math.max(0, w.durabilidade - 1) };
            }
            return w;
          });
          const updatedCatalisadores = attackerChar.catalisadores.map(c => {
            if (c.id === actionOrWeapon.id) {
               return { ...c, durabilidade: Math.max(0, c.durabilidade - 1) };
            }
            return c;
          });
          
          await updateDoc(charRef, { 
            armas: updatedArmas, 
            catalisadores: updatedCatalisadores 
          });
          
          if (isWeapon) {
             const weapon = updatedArmas.find(w => w.id === actionOrWeapon.id);
             if (weapon && weapon.durabilidade === 0) {
                setCombatLog(prev => [{ msg: `ALERTA: Sua arma "${weapon.nome}" quebrou!`, type: 'error' }, ...prev]);
             }
          }
       }
    }

    } catch (error) {
      console.error("Combat resolution error:", error);
      setCombatLog(prev => [{ msg: "Erro ao resolver combate. Verifique os dados da criatura/arma.", type: 'error' }, ...prev]);
    } finally {
      setIsAttackingMode(false);
      setAttackerId(null);
      setTargetId(null);
      setWeaponSelectTokenId(null);
    }
  };

  const getDistance = (p1: any, p2: any) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
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
          const compressed = await compressImageDataUrl(reader.result as string, 2048, 0.7);
          onUpdateConfig({ mapUrl: compressed });
          setInputMapUrl(compressed);
        } catch (error) {
          console.error("Compression error:", error);
          // Fallback to original if compression fails (though it shouldn't)
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
                  <button 
                    key={char.id}
                    onClick={() => {
                       if (onAddToken) {
                        const stage = containerRef.current;
                        const centerX = stage ? (dimensions.width / 2 - viewport.x) / viewport.scale : 100;
                        const centerY = stage ? (dimensions.height / 2 - viewport.y) / viewport.scale : 100;
                        
                        onAddToken({
                          id: char.id,
                          name: char.nome,
                          imageUrl: char.imagem,
                          x: centerX,
                          y: centerY,
                          size: inputCreatureSize,
                          type: 'character',
                          characterId: char.id,
                          hp: char.vidaAtual,
                          maxHp: 100, // Default max HP or calculate if possible
                          color: '#3b82f6'
                        });
                      }
                      setIsCharacterModalOpen(false);
                    }}
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
                    <Plus size={16} className="text-zinc-600 group-hover:text-blue-500" />
                  </button>
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
                    
                    onAddToken({
                      id: Math.random().toString(36).substring(2, 11),
                      name: monster.name,
                      x: centerX,
                      y: centerY,
                      size: inputCreatureSize,
                      imageUrl: monster.imageUrl,
                      type: 'creature',
                      hp: parseNum(monster.maxHp),
                      maxHp: parseNum(monster.maxHp),
                      description: monster.informacoes,
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
            title="Criaturas"
          >
            <Skull size={18} />
            <span className="text-[8px] font-black uppercase mt-1">Criaturas</span>
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
        </div>

        <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
          {sidebarTab === 'creatures' && (
            <>
              {/* Info Panel Title */}
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                <Shield size={16} className="text-blue-500" />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Painel de Criaturas</span>
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
                          <Heart size={8} className="text-red-500" /> {token.hp} / {token.maxHp} HP
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
                          const newHp = Math.max(0, (token.hp || 0) - 1);
                          updateTokenPosition(campaignId, token.id, { hp: newHp });
                        }}
                        className="p-1.5 hover:bg-zinc-800 text-zinc-500 hover:text-red-500 rounded-lg transition-colors border border-transparent hover:border-zinc-700"
                      >
                        <Minus size={12} />
                      </button>
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-red-500 transition-all shadow-[0_0_8px_rgba(239,68,68,0.3)]" 
                          style={{ width: `${((token.hp || 0) / (token.maxHp || 1)) * 100}%` }}
                        />
                      </div>
                      <button 
                        onClick={() => {
                          const newHp = Math.min(token.maxHp || 100, (token.hp || 0) + 1);
                          updateTokenPosition(campaignId, token.id, { hp: newHp });
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
                <button 
                  onClick={handleRollInitiative}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600/20 border border-amber-500/30 hover:bg-amber-600/30 text-amber-500 rounded-xl transition-all group"
                >
                  <Dices size={16} className="group-hover:rotate-12 transition-transform" />
                  <span className="text-xs font-black uppercase tracking-widest">Rolar Iniciativa</span>
                </button>
              )}

              {/* Initiative List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 py-1 custom-scrollbar">
                {[...tokens]
                  .filter(t => t.initiative !== undefined && t.initiative !== null)
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
                    "text-[10px] px-2 py-1.5 rounded-lg border text-left",
                    log.type === 'success' ? "bg-green-500/10 border-green-500/30 text-green-400" :
                    log.type === 'error' ? "bg-red-500/10 border-red-500/30 text-red-400" :
                    "bg-blue-500/10 border-blue-500/30 text-blue-400"
                  )}>
                    {log.msg}
                  </div>
                ))}
                {combatLog.length === 0 && (
                  <div className="text-[10px] text-zinc-600 italic text-center py-4">Sem registros de combate</div>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
      )}
      {selectedTokenId && !isAttackingMode && (
        <div className="absolute top-1/2 right-4 -translate-y-1/2 z-20 w-48 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 p-3 rounded-2xl shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-white uppercase tracking-widest">
              {tokens.find(t => t.id === selectedTokenId)?.name}
            </span>
            <button onClick={() => setSelectedTokenId(null)} className="text-zinc-500 hover:text-white"><Plus className="rotate-45" size={14} /></button>
          </div>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => startAttack(selectedTokenId)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-colors"
            >
              <Shield size={14} /> Atacar
            </button>
            <button 
              onClick={handleUndoMove}
              className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold transition-colors"
            >
              <Maximize className="rotate-45" size={14} /> Refazer Movimento
            </button>

            {/* Specialized Actions / Spells / Weapons Quick List */}
            {(() => {
              const token = tokens.find(t => t.id === selectedTokenId);
              const char = token?.characterId ? availableCharacters.find(c => c.id === token.characterId) : null;
              
              const hasMonsterActions = token?.acoes && token.acoes.length > 0;
              const hasSpells = char?.magias && char.magias.length > 0;
              const hasWeapons = char?.armas && char.armas.length > 0;
              const inventoryItems = char?.compartimentos?.flatMap(c => c.itens || []) || [];
              const inventoryWeapons = inventoryItems.filter(i => i.tipo === 'Arma' || i.corte || i.perfuracao || i.impacto);
              const inventoryCatalysts = inventoryItems.filter(i => i.tipo === 'Catalisador' || i.feitico || i.elemental || i.magiaNegra);

              if (hasMonsterActions || hasSpells || hasWeapons || inventoryWeapons.length > 0 || inventoryCatalysts.length > 0) {
                return (
                  <div className="mt-2 pt-2 border-t border-zinc-800 space-y-2">
                    <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest pl-1">Ações Rápidas</span>
                    <div className="grid gap-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                      {/* Character Weapons (Equipped) */}
                      {char?.armas?.map(weapon => (
                        <button 
                          key={weapon.id}
                          onClick={() => {
                            if (isAttackingMode && targetId) {
                               resolveCombat(weapon);
                            } else {
                               startAttack(selectedTokenId);
                            }
                          }}
                          className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-blue-500/50 rounded p-1.5 transition-all text-left group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-zinc-200 group-hover:text-blue-400 truncate">{weapon.nome}</span>
                            <span className="text-[7px] text-zinc-500 font-black uppercase opacity-50 shrink-0">Arma</span>
                          </div>
                          <div className="text-[8px] font-bold text-zinc-400">Dano: {weapon.dano}</div>
                        </button>
                      ))}

                      {/* Inventory Weapons */}
                      {inventoryWeapons.map(weapon => (
                        <button 
                          key={weapon.id}
                          onClick={() => {
                            if (isAttackingMode && targetId) {
                               resolveCombat(weapon);
                            } else {
                               startAttack(selectedTokenId);
                            }
                          }}
                          className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 border-dashed hover:border-blue-500/50 rounded p-1.5 transition-all text-left group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-zinc-400 group-hover:text-blue-300 truncate">{weapon.nome}</span>
                            <span className="text-[7px] text-zinc-600 font-black uppercase opacity-50 shrink-0">Inv.</span>
                          </div>
                          <div className="text-[8px] font-bold text-zinc-500">Dano: {weapon.dano}</div>
                        </button>
                      ))}

                      {/* Character Spells */}
                      {char?.magias?.map(spell => (
                        <button 
                          key={spell.id}
                          onClick={() => {
                            if (isAttackingMode && targetId) {
                               resolveCombat({...spell, categoria: spell.escola});
                            } else {
                               startAttack(selectedTokenId);
                            }
                          }}
                          className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-indigo-500/50 rounded p-1.5 transition-all text-left group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-zinc-200 group-hover:text-indigo-400 truncate">{spell.nome}</span>
                            <span className="text-[7px] text-zinc-500 font-black uppercase opacity-50 shrink-0">Magia</span>
                          </div>
                          <div className="text-[8px] font-bold text-zinc-400">Dano: {spell.dano} | Mana: {spell.mana}</div>
                        </button>
                      ))}

                      {/* Catalysts in Inventory */}
                      {inventoryCatalysts.map(catalyst => (
                        <button 
                          key={catalyst.id}
                          onClick={() => {
                            if (isAttackingMode && targetId) {
                               resolveCombat(catalyst);
                            } else {
                               startAttack(selectedTokenId);
                            }
                          }}
                          className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 border-dashed hover:border-purple-500/50 rounded p-1.5 transition-all text-left group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-zinc-400 group-hover:text-purple-300 truncate">{catalyst.nome}</span>
                            <span className="text-[7px] text-zinc-600 font-black uppercase opacity-50 shrink-0">Cat.</span>
                          </div>
                        </button>
                      ))}

                      {/* Monster Actions */}
                      {token?.acoes?.map(action => (
                        <button 
                          key={action.id}
                          onClick={() => {
                            if (isAttackingMode && targetId) {
                               resolveCombat(action);
                            } else {
                               startAttack(selectedTokenId);
                            }
                          }}
                          className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-red-500/50 rounded p-1.5 transition-all text-left group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-zinc-200 group-hover:text-red-400 truncate">{action.name}</span>
                            <span className="text-[7px] text-zinc-500 font-black uppercase opacity-50 shrink-0">{action.type}</span>
                          </div>
                          <div className="text-[8px] font-bold text-zinc-400">Acento: +{action.acerto} | Dano: {action.dano}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {isMaster && (
              <button 
                onClick={() => { onRemoveToken?.(selectedTokenId); setSelectedTokenId(null); }}
                className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-red-900/30 hover:text-red-400 text-zinc-500 rounded-lg text-xs font-bold transition-colors"
              >
                <Trash2 size={14} /> Remover
              </button>
            )}
          </div>
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
                const monsterActions = attacker?.acoes || [];
                
                const inventoryItems = attackerChar?.compartimentos?.flatMap(c => c.itens || []) || [];
                const inventoryWeapons = inventoryItems.filter(i => i.tipo === 'Arma' || i.corte || i.perfuracao || i.impacto);
                const inventoryCatalysts = inventoryItems.filter(i => i.tipo === 'Catalisador' || i.feitico || i.elemental || i.magiaNegra);
                
                return (
                  <>
                    {[...weapons, ...inventoryWeapons].map((weapon, idx) => (
                      <button
                        key={`${weapon.id}-${idx}`}
                        onClick={() => resolveCombat(weapon)}
                        className="w-full flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 hover:border-blue-500/50 rounded-xl transition-all group"
                      >
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <div className="text-xs font-bold text-white group-hover:text-blue-400">{weapon.nome}</div>
                            <span className="text-[8px] font-black bg-blue-600/10 text-blue-500 px-1.5 py-0.5 rounded border border-blue-500/20 uppercase">
                              Lvl {Math.max(weapon.corte || 0, weapon.perfuracao || 0, weapon.impacto || 0)} | Res {weapon.resistencia || 0}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-500">
                             Acerto Mín: {weapon.acerto} | Dano: {weapon.dano} | Durab: {weapon.durabilidade}/{weapon.maxDurabilidade}
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-400 border border-zinc-800 shrink-0">
                          <Shield size={14} />
                        </div>
                      </button>
                    ))}

                    {[...catalysts, ...inventoryCatalysts].map((catalyst, idx) => (
                      <button
                        key={`${catalyst.id}-${idx}`}
                        onClick={() => resolveCombat(catalyst)}
                        className="w-full flex items-center justify-between p-3 bg-zinc-950 border border-purple-900/30 hover:border-purple-500/50 rounded-xl transition-all group"
                      >
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <div className="text-xs font-bold text-purple-400">{catalyst.nome}</div>
                            <span className="text-[8px] font-black bg-purple-600/10 text-purple-500 px-1.5 py-0.5 rounded border border-purple-500/20 uppercase">
                              Lvl {Math.max(catalyst.feitico || 0, catalyst.elemental || 0, catalyst.magiaNegra || 0)} | Pot {catalyst.potencial || 0}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-500">
                             Tipo: {catalyst.tipo} | Durab: {catalyst.durabilidade}/{catalyst.maxDurabilidade}
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-purple-400 border border-zinc-800 shrink-0">
                          <Zap size={14} />
                        </div>
                      </button>
                    ))}

                    {spells.map(spell => (
                      <button
                        key={spell.id}
                        onClick={() => resolveCombat({...spell, categoria: spell.escola})}
                        className="w-full flex flex-col p-3 bg-zinc-950 border border-indigo-900/30 hover:border-indigo-500/50 rounded-xl transition-all group"
                      >
                         <div className="flex items-center justify-between w-full">
                          <div className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                            <Zap size={10} /> {spell.nome}
                          </div>
                          <div className="text-[8px] font-black bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 text-zinc-500 uppercase">
                            {spell.escola} | Acerto Mín: {spell.acerto}
                          </div>
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-1">Dano: {spell.dano} | Mana: {spell.mana}</div>
                      </button>
                    ))}

                    {/* Monster Specialized Actions */}
                    {monsterActions.map(action => (
                      <button
                        key={action.id}
                        onClick={() => resolveCombat(action)}
                        className="w-full flex flex-col p-3 bg-zinc-950 border border-red-900/30 hover:border-red-500/50 rounded-xl transition-all group"
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="text-xs font-black text-red-500 group-hover:text-red-400 flex items-center gap-1.5 capitalize">
                            <Zap size={10} /> {action.name}
                          </div>
                          <div className="text-[8px] font-black bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 text-zinc-500 uppercase tracking-tighter">
                            {action.type} | {action.categoria} | Lvl {
                              attacker?.stats?.ataque ? (attacker.stats.ataque as any)[getMapKey(action.categoria)] || 0 : 0
                            } | {['Feitiço', 'Elemental', 'Magia Negra'].includes(action.categoria) ? 'Pot' : 'Res'} {
                              attacker?.stats?.ataque ? (['Feitiço', 'Elemental', 'Magia Negra'].includes(action.categoria) ? attacker.stats.ataque.potencial : attacker.stats.ataque.resistencia) : 0
                            } | Acerto: {action.acerto}
                          </div>
                        </div>
                        <div className="text-[10px] text-zinc-300 font-bold mt-1">
                           Acerto: {Number(action.acerto) >= 0 ? '+' : ''}{action.acerto} | Dano: {action.dano}
                        </div>
                        <div className="text-[9px] text-zinc-500 mt-0.5 italic leading-tight text-left">
                           {action.description}
                        </div>
                      </button>
                    ))}

                    {/* Basic Attack fallback */}
                    {weapons.length === 0 && monsterActions.length === 0 && (
                      <button
                        onClick={() => resolveCombat({ nome: "Soco/Ataque Básico", acerto: 0, dano: "1d4+0" })}
                        className="w-full flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 hover:border-blue-500/50 rounded-xl transition-all group"
                      >
                        <div className="text-left">
                          <div className="text-xs font-bold text-white group-hover:text-blue-400">Soco / Ataque Básico</div>
                          <div className="text-[10px] text-zinc-500">Acerto: +0 | Dano: 1d4</div>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-400">
                          <Shield size={14} />
                        </div>
                      </button>
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

    </div>
  );
});

