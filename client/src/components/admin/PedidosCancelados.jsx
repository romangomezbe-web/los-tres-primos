import { useState, useEffect } from 'react';
import { API_URL, fmtMoney, fmt12h } from '../../config';

function authFetch(path) {
  const token = localStorage.getItem('token');
  return fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
}

export default function PedidosCancelados() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch('/api/orders/today')
      .then(r => r.json())
      .then(data => {
        const cancelled = data.filter(o => o.status === 'CANCELLED');
        setOrders(cancelled.sort((a, b) => new Date(b.cancelled_at || b.created_at) - new Date(a.cancelled_at || a.created_at)));
      })
      .finally(() => setLoading(false));
  }, []);

  const totalPerdido = orders.reduce((s, o) => s + (o.total_price || 0), 0);

  if (loading) return <p className="text-gray-400 text-center py-12">Cargando...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-bebas text-3xl text-gray-800 tracking-wide">Pedidos Cancelados Hoy</h2>
          <p className="text-sm text-gray-500 mt-0.5">{orders.length} cancelado{orders.length !== 1 ? 's' : ''}</p>
        </div>
        {orders.length > 0 && (
          <div className="text-right bg-red-50 border border-red-200 rounded-xl px-4 py-2">
            <p className="text-xs font-bold uppercase tracking-widest text-red-500">Total cancelado</p>
            <p className="font-bebas text-2xl text-red-600">{fmtMoney(totalPerdido)}</p>
          </div>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 text-gray-300">
          <p className="font-bebas text-4xl tracking-wide">Sin cancelaciones hoy</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const label = order.table_number === 0 ? order.order_number : `Mesa ${order.table_number}`;
            return (
              <div key={order.id} className="bg-white border border-red-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-bebas text-2xl text-gray-800 tracking-wide">{label}</span>
                      <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">CANCELADO</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">
                      Pedido: {fmt12h(order.created_at)}
                      {order.cancelled_at && <> · Cancelado: {fmt12h(order.cancelled_at)}</>}
                    </p>

                    <ul className="text-sm text-gray-700 space-y-0.5">
                      {order.items?.map((it, i) => (
                        <li key={i} className="flex items-baseline gap-2">
                          <span className="font-bold text-gray-500">×{it.quantity}</span>
                          <span>{it.item_name}</span>
                          {it.item_notes && <span className="text-yellow-600 text-xs">⚠ {it.item_notes}</span>}
                        </li>
                      ))}
                    </ul>

                    {order.cancel_reason && (
                      <p className="mt-2 text-xs text-red-500 font-semibold">
                        Motivo: {order.cancel_reason}
                      </p>
                    )}
                  </div>

                  {order.total_price != null && (
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Total</p>
                      <p className="font-bebas text-2xl text-gray-500 line-through">{fmtMoney(order.total_price)}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
