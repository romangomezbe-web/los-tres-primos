export const CONFIG = {
  totalInvested: 14000,
  targetPrepTimeMinutes: 12,
  semaphoreGreen: 7,
  semaphoreYellow: 12,
  restaurantName: 'Los Tres Primos',
};

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function fmtMoney(n) {
  return `$${Number(n).toFixed(2)} MXN`;
}

export function fmtTime(seconds) {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function fmtTimer(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function semaphoreColor(seconds) {
  const mins = seconds / 60;
  if (mins < CONFIG.semaphoreGreen) return 'green';
  if (mins < CONFIG.semaphoreYellow) return 'yellow';
  return 'red';
}

export function semaphoreBorderClass(seconds) {
  const c = semaphoreColor(seconds);
  if (c === 'green') return 'border-green-500';
  if (c === 'yellow') return 'border-yellow-400';
  return 'border-red-500';
}

export function fmt12h(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr.includes('Z') ? dateStr : dateStr + 'Z');
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
}
