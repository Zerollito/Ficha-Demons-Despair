import { jsPDF } from 'jspdf';
import { Character } from '../types';
import { getVidaMaxima, getManaMaxima, getCargaMaxima, getDeslocamentoBase } from '../rules/statusRules';
import { calculateInventoryTotals, getLoadPenalties } from '../rules/inventoryRules';

export const exportPDF = (activeChar: Character) => {
  const doc = new jsPDF();
  const stats = activeChar.stats;
  const vidaMax = getVidaMaxima(stats.CON);
  const manaMax = getManaMaxima(stats.APR);
  const cargaMax = getCargaMaxima(stats.RES);
  const { peso: pesoTotal } = calculateInventoryTotals(activeChar.compartimentos);
  const penalties = getLoadPenalties(pesoTotal, cargaMax);
  const deslocamentoBase = getDeslocamentoBase(stats.DEX);
  const deslocamentoFinal = Math.max(0, Math.floor(deslocamentoBase * penalties.deslocamentoMult));

  doc.setFontSize(22);
  doc.text(activeChar.nome, 20, 20);
  doc.setFontSize(12);
  doc.text(`Etnia: ${activeChar.etnia}`, 20, 30);
  doc.text(`Vida: ${activeChar.vidaAtual}/${vidaMax}`, 20, 40);
  doc.text(`Mana: ${activeChar.manaAtual}/${manaMax}`, 20, 50);
  doc.text(`Deslocamento: ${deslocamentoFinal}m`, 20, 60);

  let y = 80;
  doc.text("Status:", 20, y);
  y += 10;
  Object.entries(stats).forEach(([stat, val]) => {
    doc.text(`${stat}: ${val}`, 30, y);
    y += 7;
  });

  y += 10;
  doc.text("Armas:", 20, y);
  y += 10;
  activeChar.armas.forEach(w => {
    doc.text(`${w.nome} - Dano: ${w.dano}`, 30, y);
    y += 7;
  });

  doc.save(`${activeChar.nome}_ficha.pdf`);
};
