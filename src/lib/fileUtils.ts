import React from 'react';
import { Character, AppState } from '../types';

export const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (img: string) => void) => {
  const file = e.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onloadend = () => {
      callback(reader.result as string);
    };
    reader.readAsDataURL(file);
  }
};

export const exportJSON = (state: AppState) => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", `rpg_chars_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};

export const importJSON = (e: React.ChangeEvent<HTMLInputElement>, callback: (state: AppState) => void) => {
  const file = e.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.characters && json.activeCharacterId) {
          callback(json);
        }
      } catch (err) {
        console.error("Error importing JSON", err);
        alert("Arquivo JSON inválido.");
      }
    };
    reader.readAsText(file);
  }
};
