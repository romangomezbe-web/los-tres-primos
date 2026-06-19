import { useState, useEffect } from 'react';
import { API_URL, fmtMoney, fmtTime, CONFIG } from '../../config';

export default function FinanzasHoy() {
  const [data, setData] = useState(null);

  function load() {
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/api/stats/today`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  if (!data) return <div className="p-4 text-gray-400">Cargando...</div>;

  const { summary, statusMap, accumulated } = data;
  const pct = Math.min(100, (accumulated / CONFIG.totalInvested) * 100);

  return (
    <div className="space-y-6">
      <h2 className="font-bebas text-4xl text-brand-red tracking-wide">Finanzas Hoy</h2>

      {/* Big metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <BigStat label="Total Vendido" value={fmtMoney(summary.total_revenue)} red />
        <BigStat label="Pedidos Hoy" value={summary.total_orders} />
        <BigStat label="Ticket Promedio" value={fmtMoney(summary.avg_ticket)} />
        <BigStat label="Tiempo Promedio" value={fmtTime(Math.round(summary.avg_prep_seconds))} />
      </div>

      {/* Status counts */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Completados', key: 'COMPLETED', color: 'bg-green-50 border-green-200 text-green-700' },
          { label: 'Pendientes', key: 'PENDING', color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
          { label: 'En Prep.', key: 'IN_PROGRESS', color: 'bg-blue-50 border-blue-200 text-blue-700' },
          { label: 'Cancelados', key: 'CANCELLED', color: 'bg-red-50 border-red-200 text-red-700' },
        ].map(({ label, key, color }) => (
          <div key={key} className={`border rounded-xl p-3 ${color}`}>
            <p className="text-xs font-bold uppercase tracking-widest mb-1">{label}</p>
            <p className="font-bebas text-4xl">{statusMap[key] || 0}</p>
          </div>
        ))}
      </div>

      {/* Best/worst */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-1">Pedido más rápido</p>
          <p className="font-bebas text-3xl text-green-700">{fmtTime(summary.fastest_seconds)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-red-700 mb-1">Pedido más lento</p>
          <p className="font-bebas text-3xl text-red-700">{fmtTime(summary.slowest_seconds)}</p>
        </div>
      </div>

      {/* Investment recovery bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <p className="font-bold text-sm text-gray-700">Recuperación de Inversión</p>
          <p className="text-sm font-mono text-gray-500">{fmtMoney(accumulated)} / {fmtMoney(CONFIG.totalInvested)}</p>
        </div>
        <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-red rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-right text-xs text-gray-500 mt-1">{pct.toFixed(1)}%</p>
      </div>
    </div>
  );
}

function BigStat({ label, value, red }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">{label}</p>
      <p className={`font-bebas tracking-wide text-3xl ${red ? 'text-brand-red' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
