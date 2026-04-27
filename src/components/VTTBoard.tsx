import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Circle, Line, Text, Group, RegularPolygon, Shape } from 'react-konva';
import useImage from 'use-image';
import { TableToken, TableConfig, Character } from '../types';
import { updateTokenPosition } from '../services/vttService';
import { Shield, User, Trash2, Plus, Settings, ZoomIn, ZoomOut, Maximize, Eye, EyeOff, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

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

const Token = ({ token, gridSize, onDragEnd, onClick, isAttacker, isTarget }: { 
  token: TableToken; 
  gridSize: number; 
  onDragEnd: (id: string, x: number, y: number) => void;
  onClick?: () => void;
  isAttacker?: boolean;
  isTarget?: boolean;
}) => {
  const [image] = useImage(token.imageUrl || '');
  const radius = (token.size * gridSize) / 2;
  const [dragDist, setDragDist] = useState(0);
  const lastPos = useRef({ x: token.x, y: token.y });

  return (
    <Group
      draggable
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
          />
        ) : (
          <Rect
            width={token.size * gridSize}
            height={token.size * gridSize}
            fill={token.color || (token.type === 'character' ? '#3b82f6' : '#ef4444')}
          />
        )}
      </Group>
      
      {/* Token Border */}
      <Circle
        x={radius}
        y={radius}
        radius={radius}
        stroke={token.type === 'character' ? '#3b82f6' : '#ef4444'}
        strokeWidth={3}
        shadowBlur={10}
        shadowColor="black"
      />

      {dragDist > 0 && (
        <Text
          text={`${dragDist.toFixed(1)}m`}
          fontSize={16}
          fontStyle="bold"
          fill="#3b82f6"
          align="center"
          width={token.size * gridSize}
          x={0}
          y={-60}
          shadowColor="black"
          shadowBlur={4}
          offsetX={radius}
        />
      )}

      <Text
        text={token.name}
        fontSize={12}
        fontStyle="bold"
        fill="white"
        align="center"
        width={token.size * gridSize}
        x={0}
        y={(token.size * gridSize) + 12}
        shadowColor="black"
        shadowBlur={4}
        offsetX={radius}
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
};

export const VTTBoard: React.FC<VTTBoardProps> = ({ 
  campaignId, 
  isMaster, 
  tokens, 
  config,
  availableCharacters,
  onAddToken,
  onRemoveToken,
  onUpdateConfig
}) => {
  const [mapImage, mapImageStatus] = useImage(config.mapUrl || '', 'anonymous');
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 0.7 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const hasBeenCentered = useRef(false);
  
  // UI states
  const [showUI, setShowUI] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showCreatureModal, setShowCreatureModal] = useState(false);
  const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);
  
  const [inputMapUrl, setInputMapUrl] = useState(config.mapUrl || '');
  const [inputGridSize, setInputGridSize] = useState(config.gridSize?.toString() || '50');
  const [inputCreatureName, setInputCreatureName] = useState('');
  const [inputCreatureIcon, setInputCreatureIcon] = useState('');
  const [inputCreatureHP, setInputCreatureHP] = useState('10');
  const [inputCreatureSize, setInputCreatureSize] = useState('1');

  // Combat and Selection State
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [isAttackingMode, setIsAttackingMode] = useState(false);
  const [attackerId, setAttackerId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [weaponSelectTokenId, setWeaponSelectTokenId] = useState<string | null>(null);
  const [combatLog, setCombatLog] = useState<{msg: string, type: 'success' | 'error' | 'info'}[]>([]);

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
    const gridSize = config.gridSize || 50;
    const horizDist = gridSize;
    const vertDist = gridSize * 0.866;

    const r = Math.round(y / vertDist);
    const offsetY = (r % 2 === 0) ? 0 : horizDist / 2;
    const q = Math.round((x - offsetY) / horizDist);

    const snapX = q * horizDist + offsetY;
    const snapY = r * vertDist;

    const token = tokens.find(t => t.id === id);
    if (token) {
      updateTokenPosition(campaignId, id, snapX, snapY, token.x, token.y);
    }
  };

  const handleUndoMove = () => {
    if (!selectedTokenId) return;
    const token = tokens.find(t => t.id === selectedTokenId);
    if (token && token.prevX !== undefined && token.prevY !== undefined) {
      updateTokenPosition(campaignId, token.id, token.prevX, token.prevY);
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

  const resolveCombat = async (weapon: any) => {
    if (!attackerId || !targetId) return;
    
    const attacker = tokens.find(t => t.id === attackerId);
    const target = tokens.find(t => t.id === targetId);
    const attackerChar = availableCharacters.find(c => c.id === attacker?.characterId);
    
    if (!attacker || !target) return;

    // Roll d20 for attack
    const d20 = Math.floor(Math.random() * 20) + 1;
    const hitBonus = weapon.acerto || 0;
    const totalHit = d20 + hitBonus;
    
    // Resolve target defense
    let targetDefense = 10;
    if (target.type === 'character') {
      const char = availableCharacters.find(c => c.id === target.characterId);
      if (char) targetDefense = (char.defesa.Torso || 10);
    }

    const hitSucceeded = totalHit >= targetDefense;
    
    if (hitSucceeded) {
      let damage = 5;
      try {
        const fullDano = weapon.dano.toLowerCase();
        if (fullDano.includes('d')) {
          const parts = fullDano.split('+');
          const dicePart = parts[0];
          const flatBonus = parts[1] ? parseInt(parts[1]) : 0;
          const [numStr, sidesStr] = dicePart.split('d');
          const num = parseInt(numStr) || 1;
          const sides = parseInt(sidesStr) || 4;
          
          damage = flatBonus;
          for (let i = 0; i < num; i++) {
            damage += Math.floor(Math.random() * sides) + 1;
          }
        } else {
          damage = parseInt(fullDano) || 1;
        }
      } catch (e) { 
        console.error("Dano parse error", e);
        damage = 1;
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

      setCombatLog(prev => [{ msg: `Acerto! (${d20}+${hitBonus}=${totalHit} vs ${targetDefense}). Dano: ${damage}`, type: 'success' }, ...prev]);
    } else {
      setCombatLog(prev => [{ msg: `Errou! (${d20}+${hitBonus}=${totalHit} vs ${targetDefense})`, type: 'error' }, ...prev]);
    }

    setIsAttackingMode(false);
    setAttackerId(null);
    setTargetId(null);
    setWeaponSelectTokenId(null);
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

    // Impedir que eventos de toque "vazem" para o body do sistema
    // Usamos capture: true para interceptar antes de qualquer outro lugar
    const handleCapture = (e: TouchEvent) => {
      if (e.cancelable) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    container.addEventListener('touchstart', handleCapture, { passive: false, capture: true });
    container.addEventListener('touchmove', handleCapture, { passive: false, capture: true });
    container.addEventListener('touchend', (e) => {
      // Opcional: pode ser necessário para alguns ambientes
    }, { passive: false, capture: true });

    return () => {
      container.removeEventListener('touchstart', handleCapture, { capture: true });
      container.removeEventListener('touchmove', handleCapture, { capture: true });
    };
  }, []);

  return (
    <div 
      className="flex flex-col h-full bg-[#09090b] relative overflow-hidden overscroll-none vtt-lock-box"
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

      {/* HUD Toggle */}
      <button 
        onClick={() => setShowUI(!showUI)}
        className="absolute top-4 right-16 z-20 p-3 bg-zinc-900/90 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all shadow-xl"
        title={showUI ? "Esconder Interface" : "Mostrar Interface"}
      >
        {showUI ? <Eye size={20} /> : <EyeOff size={20} />}
      </button>

      {/* Controls Overlay */}
      {showUI && (
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          <div className="bg-zinc-900/90 backdrop-blur border border-zinc-800 p-2 rounded-xl flex items-center gap-2 shadow-2xl">
            <button onClick={() => setViewport(v => ({ ...v, scale: v.scale * 1.1 }))} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors" title="Zoom In"><ZoomIn size={18} /></button>
            <button onClick={() => setViewport(v => ({ ...v, scale: v.scale / 1.1 }))} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors" title="Zoom Out"><ZoomOut size={18} /></button>
            <div className="w-px h-4 bg-zinc-800 mx-1" />
            <button onClick={() => setViewport({ scale: 1, x: 0, y: 0 })} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors" title="Reset Camera"><Maximize size={18} /></button>
          </div>

          {isMaster && (
            <div className="bg-zinc-900/90 backdrop-blur border border-zinc-800 p-2 rounded-xl flex flex-col gap-2 shadow-2xl">
              <button 
                onClick={() => setShowMapModal(true)} 
                className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider"
              >
                <Settings size={18} className="text-zinc-500" /> Configurar Mesa
              </button>
              <button 
                onClick={() => setShowCreatureModal(true)} 
                className="p-2 hover:bg-zinc-800 rounded-lg text-amber-500 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider transition-colors"
              >
                <Plus size={18} /> Add Criatura
              </button>
              <button 
                onClick={() => setIsCharacterModalOpen(true)} 
                className="p-2 hover:bg-zinc-800 rounded-lg text-blue-500 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider transition-colors"
              >
                <User size={18} /> Add Personagem
              </button>
            </div>
          )}
        </div>
      )}

      {/* Character Modal */}
      {isCharacterModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl w-full max-w-md shadow-2xl space-y-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <User className="text-blue-500" /> Adicionar Personagem
            </h3>
            
            <div className="space-y-4 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
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
                          size: 1,
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

      {/* Map Modal */}
      {showMapModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl w-full max-w-md shadow-2xl space-y-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Settings className="text-blue-500" /> Configurações da Mesa
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Imagem do Mapa</label>
                <div className="grid grid-cols-1 gap-2">
                  <div className="relative group">
                    <input 
                      type="file" 
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      accept="image/*"
                    />
                    <div className="w-full bg-zinc-950 border-2 border-dashed border-zinc-800 rounded-xl p-6 text-center group-hover:border-blue-500 transition-colors">
                      <Upload size={24} className="mx-auto text-zinc-600 mb-2 group-hover:text-blue-500" />
                      <span className="text-xs font-bold text-zinc-500">Clique ou arraste um arquivo</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-zinc-800" />
                    <span className="text-[10px] text-zinc-600 font-bold">OU URL</span>
                    <div className="h-px flex-1 bg-zinc-800" />
                  </div>
                  <input 
                    value={inputMapUrl ?? ""}
                    onChange={(e) => setInputMapUrl(e.target.value)}
                    placeholder="https://exemplo.com/mapa.jpg"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                  {config.mapUrl && (
                    <button 
                      onClick={() => {
                        onUpdateConfig?.({ mapUrl: "" });
                        setInputMapUrl("");
                      }}
                      className="flex items-center justify-center gap-2 p-2 mt-1 transition-all border text-red-500 bg-red-950/30 border-red-900/50 hover:bg-red-900/50 rounded-xl text-[10px] font-black uppercase tracking-wider"
                    >
                      <Trash2 size={14} /> Apagar Mapa
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Cor da Grade</label>
                <div className="grid grid-cols-4 gap-2">
                  {GRID_COLORS.map(color => (
                    <button
                      key={color.value}
                      onClick={() => onUpdateConfig?.({ gridColor: color.value })}
                      className={cn(
                        "h-8 rounded-lg border-2 flex items-center justify-center transition-all",
                        (config.gridColor || '#ffffff') === color.value 
                          ? "border-blue-500 scale-105" 
                          : "border-transparent hover:border-zinc-700"
                      )}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    >
                      {(config.gridColor || '#ffffff') === color.value && (
                        <div className={cn("w-1.5 h-1.5 rounded-full", color.value === '#ffffff' ? 'bg-black' : 'bg-white')} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Tamanho Grade</label>
                  <input 
                    type="text"
                    inputMode="numeric"
                    value={inputGridSize}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setInputGridSize(val);
                    }}
                    onBlur={() => {
                      const num = parseInt(inputGridSize) || 50;
                      onUpdateConfig?.({ gridSize: num });
                      setInputGridSize(num.toString());
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Grade (Hex)</label>
                  <button 
                    onClick={() => onUpdateConfig?.({ showGrid: !config.showGrid })}
                    className={cn(
                      "w-full p-3 rounded-xl font-bold transition-all border text-sm",
                      config.showGrid ? "bg-blue-600/10 border-blue-500 text-blue-400 shadow-[0_0_15px_-5px_rgba(59,130,246,0.5)]" : "bg-zinc-950 border-zinc-800 text-zinc-500"
                    )}
                  >
                    {config.showGrid ? "ATIVO" : "INATIVO"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setShowMapModal(false)}
                className="flex-1 p-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-colors"
              >
                Fechar
              </button>
              <button 
                onClick={() => {
                  if (onUpdateConfig) onUpdateConfig({ mapUrl: inputMapUrl });
                  setShowMapModal(false);
                }}
                className="flex-1 p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors shadow-lg shadow-blue-600/20"
              >
                Aplicar Mapa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Creature Modal */}
      {showCreatureModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Plus className="text-amber-500" /> Nova Criatura
            </h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Nome</label>
                <input 
                  value={inputCreatureName ?? ""}
                  onChange={(e) => setInputCreatureName(e.target.value)}
                  placeholder="Lobo Atroz, Goblin, etc..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Icone da Criatura</label>
                <div className="grid grid-cols-1 gap-2">
                  <div className="relative group">
                    <input 
                      type="file" 
                      onChange={handleCreatureImageUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      accept="image/*"
                    />
                    <div className={cn(
                      "w-full bg-zinc-950 border-2 border-dashed rounded-xl p-4 text-center transition-colors",
                      inputCreatureIcon ? "border-amber-500 bg-amber-500/5" : "border-zinc-800 hover:border-amber-500"
                    )}>
                      {inputCreatureIcon ? (
                        <img src={inputCreatureIcon} alt="Preview" className="mx-auto w-12 h-12 rounded-full object-cover mb-2 border-2 border-amber-500" />
                      ) : (
                        <Upload size={20} className="mx-auto text-zinc-600 mb-1 group-hover:text-amber-500" />
                      )}
                      <span className="text-[10px] font-bold text-zinc-500">{inputCreatureIcon ? "Imagem Carregada" : "Carregar Token"}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">URL (Opcional)</label>
                <input 
                  value={inputCreatureIcon ?? ""}
                  onChange={(e) => setInputCreatureIcon(e.target.value)}
                  placeholder="https://exemplo.com/token.png"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Vida (HP)</label>
                  <input 
                    type="text"
                    inputMode="numeric"
                    value={inputCreatureHP}
                    onChange={(e) => setInputCreatureHP(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="10"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Tamanho (Tiles)</label>
                  <input 
                    type="text"
                    inputMode="numeric"
                    value={inputCreatureSize}
                    onChange={(e) => setInputCreatureSize(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="1"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setShowCreatureModal(false)}
                className="flex-1 p-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  if (inputCreatureName && onAddToken) {
                    const stage = containerRef.current;
                    const centerX = stage ? (dimensions.width / 2 - viewport.x) / viewport.scale : 100;
                    const centerY = stage ? (dimensions.height / 2 - viewport.y) / viewport.scale : 100;
                    
                    onAddToken({
                      id: Math.random().toString(36).substring(7),
                      name: inputCreatureName,
                      imageUrl: inputCreatureIcon,
                      x: centerX,
                      y: centerY,
                      size: parseInt(inputCreatureSize) || 1,
                      type: 'creature',
                      hp: parseInt(inputCreatureHP) || 10,
                      maxHp: parseInt(inputCreatureHP) || 10
                    });
                  }
                  setInputCreatureName('');
                  setInputCreatureIcon('');
                  setInputCreatureHP('10');
                  setInputCreatureSize('1');
                  setShowCreatureModal(false);
                }}
                className="flex-1 p-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold transition-colors shadow-lg shadow-amber-600/20"
              >
                Adicionar
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
              />
            ))}
          </Layer>
        </Stage>
      </div>

      {/* Retractable Sidebar Toggle */}
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

      {/* Sidebar Content */}
      <aside className={cn(
        "absolute top-0 right-0 h-full w-[250px] bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-800 z-40 transition-transform duration-300 ease-in-out p-4 flex flex-col gap-6 shadow-2xl",
        showSidebar ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex flex-col gap-4 overflow-hidden h-full">
          {/* Info Panel Title */}
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
            <Shield size={16} className="text-blue-500" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Painel de Criaturas</span>
          </div>
          
          {/* Creatures List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
             {tokens.filter(t => t.type === 'creature').map(token => (
              <div key={token.id} className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-3 flex items-center gap-3 group hover:border-blue-500/30 transition-all">
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-zinc-800 flex items-center justify-center">
                    {token.imageUrl ? (
                      <img src={token.imageUrl} alt={token.name} className="w-full h-full object-cover" />
                    ) : (
                      <User size={16} className="text-zinc-600" />
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-blue-500 text-[8px] font-black w-4 h-4 rounded flex items-center justify-center text-white">
                    {token.size}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-black text-white truncate uppercase tracking-wider">{token.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-500 transition-all" 
                        style={{ width: `${((token.hp || 0) / (token.maxHp || 100)) * 100}%` }}
                      />
                    </div>
                    <span className="text-[8px] font-black text-zinc-500">{token.hp}/{token.maxHp}</span>
                  </div>
                </div>
                <button 
                  onClick={() => onRemoveToken?.(token.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 hover:text-red-500 text-zinc-600 rounded transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {tokens.filter(t => t.type === 'creature').length === 0 && (
              <div className="text-[10px] text-zinc-600 italic text-center py-4">Nenhuma criatura no mapa</div>
            )}
          </div>

          {/* Combat Log Title */}
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 mt-4">
            <Maximize size={16} className="text-red-500" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Log de Combate</span>
          </div>

          {/* Combat Log List */}
          <div className="h-48 overflow-y-auto space-y-2 pr-1">
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
                "text-[10px] px-2 py-1.5 rounded-lg border",
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
        </div>
      </aside>

      {/* Token Context Menu */}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">Escolha a Arma</h3>
              <button onClick={() => setWeaponSelectTokenId(null)} className="text-zinc-500 hover:text-white"><Plus className="rotate-45" size={20} /></button>
            </div>
            <div className="p-4 max-h-64 overflow-y-auto space-y-2">
              {(() => {
                const attacker = tokens.find(t => t.id === weaponSelectTokenId);
                const attackerChar = availableCharacters.find(c => c.id === attacker?.characterId);
                const weapons = attackerChar?.armas || [];
                
                return (
                  <>
                    {weapons.map(weapon => (
                      <button
                        key={weapon.id}
                        onClick={() => resolveCombat(weapon)}
                        className="w-full flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 hover:border-blue-500/50 rounded-xl transition-all group"
                      >
                        <div className="text-left">
                          <div className="text-xs font-bold text-white group-hover:text-blue-400">{weapon.nome}</div>
                          <div className="text-[10px] text-zinc-500">Acerto: +{weapon.acerto} | Dano: {weapon.dano}</div>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-400">
                          <Shield size={14} />
                        </div>
                      </button>
                    ))}
                    {/* Basic Attack if no weapons OR always show if it's a creature */}
                    {(weapons.length === 0 || attacker?.type === 'creature') && (
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
          </div>
        </div>
      )}

    </div>
  );
};

