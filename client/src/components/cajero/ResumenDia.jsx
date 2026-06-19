import { useState, useEffect } from 'react';
import { API_URL, fmtTime } from '../../config';

export default function ResumenDia() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/api/stats/cajero-today`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <div className="p-6 text-gray-400">Cargando...</div>;

  const completed = data.statusMap?.COMPLETED || 0;
  const pending = data.statusMap?.PENDING || 0;
  const inProgress = data.statusMap?.IN_PROGRESS || 0;
  const cancelled = data.statusMap?.CANCELLED || 0;
  const total = completed + pending + inProgress + cancelled;

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="font-bebas text-4xl text-brand-red mb-6 tracking-wide">Resumen del Día</h2>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Stat label="Total Pedidos Hoy" value={total} big />
        <Stat label="Completados" value={completed} color="text-green-600" />
        <Stat label="En Curso" value={pending + inProgress} color="text-yellow-600" />
        <Stat label="Cancelados" value={cancelled} color="text-red-500" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-1">Pedido más rápido</p>
          <p className="font-bebas text-3xl text-green-700">{fmtTime(data.fastest)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-red-700 mb-1">Pedido más lento</p>
          <p className="font-bebas text-3xl text-red-700">{fmtTime(data.slowest)}</p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, big, color = 'text-gray-900' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">{label}</p>
      <p className={`font-bebas tracking-wide ${big ? 'text-5xl text-brand-red' : `text-4xl ${color}`}`}>
        {value}
      </p>
    </div>
  );
}
