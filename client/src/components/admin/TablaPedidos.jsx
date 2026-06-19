import { useState, useEffect } from 'react';
import { API_URL, fmtMoney, fmtTime, fmt12h } from '../../config';

function rowColor(secs) {
  if (secs == null) return '';
  const m = secs / 60;
  if (m < 8) return 'bg-green-50';
  if (m <= 12) return 'bg-yellow-50';
  return 'bg-red-50';
}

export default function TablaPedidos() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/api/orders/today`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setOrders)
      .catch(() => {});
  }, []);

  function exportCSV() {
    const header = ['Mesa', 'Ítems', 'Hora Enviado', 'Hora Completado', 'Tiempo Prep', 'Total MXN'];
    const rows = orders.map(o => [
      o.table_number,
      o.items?.map(i => `${i.item_name} x${i.quantity}`).join('; ') || '',
      fmt12h(o.created_at),
      fmt12h(o.completed_at),
      fmtTime(o.prep_time_seconds),
      o.total_price?.toFixed(2) || '0.00',
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bebas text-4xl text-brand-red tracking-wide">Pedidos del Día</h2>
        <button
          onClick={exportCSV}
          className="bg-brand-red hover:bg-brand-dark text-white font-bold text-sm px-4 py-2 rounded-lg transition-colors"
        >
          Exportar CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['#', 'Mesa', 'Ítems', 'Hora Enviado', 'Hora Completado', 'Tiempo Prep', 'Total', 'Estado'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-400">Sin pedidos hoy</td>
              </tr>
            )}
            {orders.map((o, idx) => (
              <tr key={o.id} className={rowColor(o.prep_time_seconds)}>
                <td className="px-4 py-3 font-mono text-gray-500">{idx + 1}</td>
                <td className="px-4 py-3 font-bold text-brand-red font-bebas text-xl">{o.table_number}</td>
                <td className="px-4 py-3 max-w-xs">
                  {o.items?.map((item, i) => (
                    <span key={i} className="inline-block bg-gray-100 rounded px-1 text-xs mr-1 mb-1">
                      {item.item_name} ×{item.quantity}
                    </span>
                  ))}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{fmt12h(o.created_at)}</td>
                <td className="px-4 py-3 font-mono text-xs">{fmt12h(o.completed_at)}</td>
                <td className="px-4 py-3 font-mono text-xs">{fmtTime(o.prep_time_seconds)}</td>
                <td className="px-4 py-3 font-mono font-bold">{fmtMoney(o.total_price)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    COMPLETED: ['bg-green-100 text-green-800', 'Completado'],
    PENDING: ['bg-yellow-100 text-yellow-800', 'Pendiente'],
    IN_PROGRESS: ['bg-blue-100 text-blue-800', 'En Prep.'],
    CANCELLED: ['bg-red-100 text-red-800', 'Cancelado'],
  };
  const [cls, label] = map[status] || ['bg-gray-100 text-gray-800', status];
  return <span className={`text-xs font-bold px-2 py-1 rounded-full ${cls}`}>{label}</span>;
}
