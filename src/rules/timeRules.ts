export type Season = 'Primavera' | 'Verão' | 'Outono' | 'Inverno';

export const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const getDaysInMonth = (month: number, year: number) => {
  if (month === 2) {
    // Basic leap year logic
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    return isLeap ? 29 : 28;
  }
  return DAYS_IN_MONTH[month - 1];
};

export const getSeason = (month: number): Season => {
  // Southern Hemisphere Logic
  if (month === 12 || month === 1 || month === 2) return 'Verão';
  if (month >= 3 && month <= 5) return 'Outono';
  if (month >= 6 && month <= 8) return 'Inverno';
  return 'Primavera';
};

export const getSeasonIcon = (season: Season) => {
  switch (season) {
    case 'Primavera': return '🌸';
    case 'Verão': return '☀️';
    case 'Outono': return '🍂';
    case 'Inverno': return '❄️';
  }
};

export const formatTime = (hour: number, minute: number) => {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
};

export const WEATHER_TYPES = [
  'Céu limpo',
  'Céu nublado',
  'Chuvoso',
  'Onda de calor',
  'Neve'
];

export const generateWeather = (season: Season): string => {
  const rand = Math.random() * 100;
  
  if (season === 'Primavera') {
    if (rand < 35) return 'Céu limpo';
    if (rand < 65) return 'Céu nublado';
    if (rand < 90) return 'Chuvoso';
    if (rand < 95) return 'Onda de calor';
    return 'Neve';
  }
  
  if (season === 'Verão') {
    if (rand < 60) return 'Céu limpo';
    if (rand < 75) return 'Céu nublado';
    if (rand < 90) return 'Chuvoso';
    return 'Onda de calor';
  }
  
  if (season === 'Outono') {
    if (rand < 25) return 'Céu limpo';
    if (rand < 60) return 'Céu nublado';
    if (rand < 90) return 'Chuvoso';
    if (rand < 92) return 'Onda de calor';
    return 'Neve';
  }
  
  // Inverno
  if (rand < 15) return 'Céu limpo';
  if (rand < 55) return 'Céu nublado';
  if (rand < 75) return 'Chuvoso';
  return 'Neve';
};

export const formatDate = (day: number, month: number, year: number) => {
  return `${day.toString().padStart(2, '0')} de ${MONTHS[month - 1]}, ${year}`;
};

export interface MoonPhaseInfo {
  name: string;
  description: string;
  icon: string;
}

export const getMoonPhase = (day: number, month: number = 1, year: number = 2024): MoonPhaseInfo => {
  const cycleDay = ((Math.abs(day || 1) - 1) % 28) + 1;
  if (cycleDay <= 3) {
    return { name: "Lua Nova", description: "Céu escuro, escuridão densa", icon: "🌑" };
  } else if (cycleDay <= 7) {
    return { name: "Lua Crescente", description: "A luz lunar começa a retornar", icon: "🌒" };
  } else if (cycleDay <= 10) {
    return { name: "Quarto Crescente", description: "Meia face iluminada", icon: "🌓" };
  } else if (cycleDay <= 14) {
    return { name: "Gibosa Crescente", description: "Quase cheia, noites claras", icon: "🌔" };
  } else if (cycleDay <= 17) {
    return { name: "Lua Cheia", description: "Noite intensamente iluminada", icon: "🌕" };
  } else if (cycleDay <= 21) {
    return { name: "Gibosa Minguante", description: "A luz começa a esmaecer", icon: "🌖" };
  } else if (cycleDay <= 24) {
    return { name: "Quarto Minguante", description: "Meia face escura", icon: "🌗" };
  } else {
    return { name: "Lua Minguante", description: "Último fio de prata antes do breu", icon: "🌘" };
  }
};

export const dateToAbsoluteDays = (day: number, month: number, year: number = 0): number => {
  let totalDays = (year || 0) * 365;
  totalDays += Math.floor((year || 0) / 4);
  const m = Math.max(1, Math.min(12, month || 1));
  for (let i = 0; i < m - 1; i++) {
    totalDays += DAYS_IN_MONTH[i];
  }
  totalDays += (day || 1);
  return totalDays;
};
