import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { API_URL, fmtTimer, CONFIG } from '../config';
import { io } from 'socket.io-client';

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.55);
  } catch {}
}

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

function OrderCard({ order, onStart, onComplete, loading }) {
  const secs = useTimer(order.created_at);
  const mins = secs / 60;
  const timerColor = mins < CONFIG.semaphoreGreen ? 'text-green-400' : mins < CONFIG.semaphoreYellow ? 'text-yellow-400' : 'text-red-400';
  const borderColor = mins < CONFIG.semaphoreGreen ? 'border-green-500' : mins < CONFIG.semaphoreYellow ? 'border-yellow-400' : 'border-red-500';

  return (
    <div className={`border-4 ${borderColor} bg-gray-800 rounded-2xl p-6 flex flex-col gap-4 min-h-64`}>
      <div className="flex items-start justify-between">
        <h2 className="font-bebas text-5xl text-white tracking-widest">MESA {order.table_number}</h2>
        <span className={`font-bebas text-3xl ${timerColor} font-mono`}>{fmtTimer(secs)}</span>
      </div>

      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
        META: {CONFIG.targetPrepTimeMinutes} MIN
      </p>

      <ul className="flex-1 space-y-3">
        {order.items?.map((item, i) => (
          <li key={i} className={`rounded-xl px-3 py-2 leading-tight ${item.item_notes ? 'bg-yellow-500/20 border border-yellow-400/50' : ''}`}>
            <div className="flex items-baseline gap-2">
              <span className="text-brand-red font-bebas text-4xl leading-none">×{item.quantity}</span>
              <span className="text-white text-2xl font-bold">{item.item_name}</span>
            </div>
            {item.item_notes && (
              <p className="text-yellow-300 font-bold text-xl mt-1">⚠ {item.item_notes}</p>
            )}
          </li>
        ))}
      </ul>

      <div className="flex gap-3 mt-2">
        {order.status === 'PENDING' && (
          <button
            onClick={() => onStart(order.id)}
            className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bebas text-2xl py-4 rounded-xl tracking-widest min-h-[48px] transition-colors"
          >
            INICIAR
          </button>
        )}
        {(order.status === 'PENDING' || order.status === 'IN_PROGRESS') && (
          <button
            onClick={() => onComplete(order.id)}
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bebas text-2xl py-4 rounded-xl tracking-widest min-h-[48px] transition-colors"
          >
            {loading ? '...' : 'LISTO ✓'}
          </button>
        )}
      </div>

      {order.status === 'IN_PROGRESS' && (
        <span className="text-center text-blue-400 text-sm font-bold uppercase tracking-widest">
          EN PREPARACIÓN
        </span>
      )}
    </div>
  );
}

export default function Cocina() {
  const [orders, setOrders] = useState([]);
  const [flashing, setFlashing] = useState(false);
  const [loadingIds, setLoadingIds] = useState(new Set());
  const navigate = useNavigate();
  const socketRef = useRef(null);

  // Cocina uses its own pin stored locally
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState('');

  function checkPin(e) {
    e.preventDefault();
    if (pin === 'cocina123') setAuthed(true);
    else toast.error('PIN incorrecto');
  }

  const fetchOrders = useCallback(async () => {
    // Cocina doesn't need JWT — uses its own socket + public endpoint with cocina token
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/orders/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setOrders(data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
    } catch {}
  }, []);

  // Auto-login as cocina role if not logged in
  useEffect(() => {
    if (!authed) return;
    const existing = localStorage.getItem('token');
    if (!existing) {
      fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'cocina', password: 'cocina123' }),
      })
        .then(r => r.json())
        .then(data => {
          localStorage.setItem('token', data.token);
          localStorage.setItem('role', 'cocina');
          fetchOrders();
        });
    } else {
      fetchOrders();
    }
  }, [authed]);

  useEffect(() => {
    if (!authed) return;

    const socket = io(API_URL, { autoConnect: true });
    socketRef.current = socket;

    socket.on('order:new', (order) => {
      beep();
      setFlashing(true);
      setTimeout(() => setFlashing(false), 2000);
      setOrders(prev => {
        const exists = prev.find(o => o.id === order.id);
        if (exists) return prev;
        return [...prev, order].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      });
    });

    socket.on('order:completed', (order) => {
      setOrders(prev => prev.filter(o => o.id !== order.id));
    });

    socket.on('order:cancelled', (order) => {
      setOrders(prev => prev.filter(o => o.id !== order.id));
    });

    return () => socket.disconnect();
  }, [authed]);

  async function handleStart(id) {
    const token = localStorage.getItem('token');
    await fetch(`${API_URL}/api/orders/${id}/start`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'IN_PROGRESS' } : o));
  }

  async function handleComplete(id) {
    setLoadingIds(prev => new Set([...prev, id]));
    const token = localStorage.getItem('token');
    try {
      await fetch(`${API_URL}/api/orders/${id}/complete`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders(prev => prev.filter(o => o.id !== id));
    } catch {
      toast.error('Error al marcar listo');
    } finally {
      setLoadingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <form onSubmit={checkPin} className="bg-gray-800 rounded-2xl p-8 w-80 text-center">
          <h1 className="font-bebas text-5xl text-brand-red mb-6 tracking-widest">COCINA</h1>
          <input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="PIN"
            className="w-full bg-gray-700 text-white text-center text-2xl rounded-xl py-4 mb-4 focus:outline-none focus:ring-2 focus:ring-brand-red"
            autoFocus
          />
          <button
            type="submit"
            className="w-full bg-brand-red hover:bg-brand-dark text-white font-bebas text-2xl py-3 rounded-xl tracking-widest"
          >
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-900 p-4 transition-colors duration-300 ${flashing ? 'flash-red-screen' : ''}`}>
      <header className="flex items-center justify-between mb-6">
        <h1 className="font-bebas text-4xl text-brand-red tracking-widest">COCINA — LOS TRES PRIMOS</h1>
        <div className="flex items-center gap-3">
          <span className="font-bebas text-2xl text-gray-400">
            {orders.length} PEDIDOS
          </span>
          <button
            onClick={() => { localStorage.clear(); setAuthed(false); setPin(''); }}
            className="text-gray-500 hover:text-gray-300 text-sm border border-gray-600 px-3 py-1 rounded-lg"
          >
            Salir
          </button>
        </div>
      </header>

      {orders.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <p className="font-bebas text-4xl text-gray-600 tracking-widest">SIN PEDIDOS</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onStart={handleStart}
              onComplete={handleComplete}
              loading={loadingIds.has(order.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
