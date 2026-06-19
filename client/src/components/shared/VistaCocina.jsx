import { useState, useEffect, useCallback } from 'react';
import { API_URL, fmtTimer } from '../../config';
import socket from '../../socket';

function useTimer(createdAt) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const start = new Date(createdAt.includes('Z') ? createdAt : createdAt + 'Z');
    const tick = () => setSecs(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt]);
  return secs;
}

function OrderCard({ order }) {
  const secs = useTimer(order.created_at);
  const mins = secs / 60;
  const timerColor = mins < 5 ? 'text-green-400' : mins < 10 ? 'text-yellow-400' : 'text-red-400';
  const borderColor = mins < 5 ? 'border-green-500' : mins < 10 ? 'border-yellow-400' : 'border-red-500';
  const STATUS = { PENDING: 'PENDIENTE', IN_PROGRESS: 'EN PREP.', COMPLETED: 'LISTO ✓' };
  const statusColor = { PENDING: 'text-yellow-400', IN_PROGRESS: 'text-blue-400', COMPLETED: 'text-green-400' };

  const label = order.table_number === 0 ? order.order_number : `MESA ${order.table_number}`;

  return (
    <div className={`border-4 ${borderColor} bg-gray-800 rounded-2xl p-5 flex flex-col gap-3`}>
      <div className="flex items-start justify-between">
        <h2 className="font-bebas text-4xl text-white tracking-widest">{label}</h2>
        <span className={`font-bebas text-2xl font-mono ${timerColor}`}>{fmtTimer(secs)}</span>
      </div>

      <span className={`text-xs font-bold uppercase tracking-widest ${statusColor[order.status]}`}>
        {STATUS[order.status]}
      </span>

      <ul className="flex-1 space-y-2">
        {order.items?.map((item, i) => (
          <li key={i} className={`rounded-xl px-3 py-2 leading-tight ${item.item_notes ? 'bg-yellow-500/20 border border-yellow-400/50' : ''}`}>
            <div className="flex items-baseline gap-2">
              <span className="text-brand-red font-bebas text-3xl leading-none">×{item.quantity}</span>
              <span className="text-white text-xl font-bold">{item.item_name}</span>
            </div>
            {item.item_notes && (
              <p className="text-yellow-300 font-bold text-base mt-1">⚠ {item.item_notes}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function VistaCocina() {
  const [orders, setOrders] = useState([]);

  const fetchOrders = useCallback(async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/orders/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setOrders(data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
    } catch {}
  }, []);

  useEffect(() => {
    fetchOrders();
    socket.connect();
    socket.on('order:new', fetchOrders);
    socket.on('order:started', fetchOrders);
    socket.on('order:updated', fetchOrders);
    socket.on('order:completed', fetchOrders);
    socket.on('order:cancelled', fetchOrders);
    return () => {
      socket.off('order:new'); socket.off('order:started'); socket.off('order:updated');
      socket.off('order:completed'); socket.off('order:cancelled');
    };
  }, [fetchOrders]);

  if (orders.length === 0) {
    return (
      <div className="bg-gray-900 min-h-64 rounded-xl flex items-center justify-center m-4">
        <p className="font-bebas text-4xl text-gray-600 tracking-widest">SIN PEDIDOS ACTIVOS</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 p-4 rounded-xl m-4">
      <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-4">
        Vista en tiempo real · {orders.length} pedido{orders.length !== 1 ? 's' : ''} activo{orders.length !== 1 ? 's' : ''}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {orders.map(order => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
    </div>
  );
}
