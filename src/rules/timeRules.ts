export type Season = 'Primavera' | 'Verão' | 'Outono' | 'Inverno';

export type MoonPhase = 'Nova' | 'Crescente' | 'Quarto Crescente' | 'Gibosa Crescente' | 'Cheia' | 'Gibosa Minguante' | 'Quarto Minguante' | 'Minguante';

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

export const getMoonPhase = (day: number): { name: string; icon: string; description: string } => {
  // Fantasy 28-day lunar cycle
  const cycleDay = (day % 28) || 28;
  
  if (cycleDay === 1 || cycleDay === 28) {
    return { name: "Lua Nova", icon: "🌑", description: "Céu escuro, ideal para furtividade." };
  }
  if (cycleDay >= 2 && cycleDay <= 6) {
    return { name: "Lua Crescente", icon: "🌒", description: "Fina foice de luz crescendo no céu." };
  }
  if (cycleDay === 7) {
    return { name: "Quarto Crescente", icon: "🌓", description: "Metade da face direita iluminada." };
  }
  if (cycleDay >= 8 && cycleDay <= 13) {
    return { name: "Gibosa Crescente", icon: "🌔", description: "Quase totalmente iluminada, noite clara." };
  }
  if (cycleDay === 14) {
    return { name: "Lua Cheia", icon: "🌕", description: "Brilho máximo! Criaturas noturnas ficam agitadas." };
  }
  if (cycleDay >= 15 && cycleDay <= 20) {
    return { name: "Gibosa Minguante", icon: "🌖", description: "O brilho começa a decrescer gradualmente." };
  }
  if (cycleDay === 21) {
    return { name: "Quarto Minguante", icon: "🌗", description: "Metade da face esquerda iluminada." };
  }
  return { name: "Lua Minguante", icon: "🌘", description: "A luz está quase se apagando no céu." };
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
