import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import socket from '../../socket';
import { API_URL, fmtTimer, fmtMoney, semaphoreBorderClass, fmt12h } from '../../config';

// ── Helpers ──────────────────────────────────────────────────────────

function authFetch(path, opts = {}) {
  const token = localStorage.getItem('token');
  return fetch(`${API_URL}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers },
  });
}

function useSeconds(createdAt) {
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

const STATUS_LABEL = { PENDING: 'PENDIENTE', IN_PROGRESS: 'EN PREP.', COMPLETED: 'LISTO' };
const STATUS_BADGE = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
};

// ── Mesa Card ─────────────────────────────────────────────────────────

function MesaCard({ number, order, flashing, onClick }) {
  const secs = useSeconds(order?.created_at || new Date().toISOString());
  const borderClass = order ? semaphoreBorderClass(secs) : 'border-gray-200';
  const timerColor = order
    ? (semaphoreBorderClass(secs).includes('green') ? 'text-green-600'
      : semaphoreBorderClass(secs).includes('yellow') ? 'text-yellow-600' : 'text-red-600')
    : 'text-gray-300';

  return (
    <div
      onClick={() => order && onClick(order)}
      className={`border-4 rounded-xl p-3 transition-all duration-300 ${
        order ? `${borderClass} cursor-pointer hover:shadow-lg hover:scale-[1.02] bg-white` : 'border-gray-200 bg-gray-50'
      } ${flashing ? 'flash-green' : ''}`}
    >
      <div className="flex items-start justify-between mb-1">
        <span className={`font-bebas text-2xl tracking-wide ${order ? 'text-brand-red' : 'text-gray-300'}`}>
          Mesa {number}
        </span>
        {order
          ? <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${STATUS_BADGE[order.status] || ''}`}>{STATUS_LABEL[order.status]}</span>
          : <span className="text-xs text-gray-300 font-semibold">Libre</span>
        }
      </div>

      {order ? (
        <>
          <p className="text-xs text-gray-400 mb-1">🕐 {fmt12h(order.created_at)}</p>
          <ul className="text-xs text-gray-700 space-y-0.5 max-h-16 overflow-hidden mb-2">
            {order.items?.slice(0, 3).map((it, i) => (
              <li key={i} className="truncate"><span className="font-bold">×{it.quantity}</span> {it.item_name}</li>
            ))}
            {order.items?.length > 3 && <li className="text-gray-400">+{order.items.length - 3} más</li>}
          </ul>
          <div className="flex items-center justify-between">
            <span className={`font-mono text-sm font-bold ${timerColor}`}>⏱ {fmtTimer(secs)}</span>
            {order.total_price != null && <span className="text-xs font-bold text-gray-500">{fmtMoney(order.total_price)}</span>}
          </div>
        </>
      ) : (
        <div className="h-14 flex items-center justify-center text-gray-300 text-xs font-semibold">—</div>
      )}
    </div>
  );
}

// ── Llevar Card ───────────────────────────────────────────────────────

function LlevarCard({ order, onClick }) {
  const secs = useSeconds(order.created_at);
  const borderClass = semaphoreBorderClass(secs);
  const timerColor = borderClass.includes('green') ? 'text-green-600'
    : borderClass.includes('yellow') ? 'text-yellow-600' : 'text-red-600';

  return (
    <div
      onClick={() => onClick(order)}
      className={`border-4 ${borderClass} bg-white rounded-xl p-3 cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all`}
    >
      <div className="flex items-start justify-between mb-1">
        <span className="font-bebas text-xl text-gray-800 tracking-wide">{order.order_number}</span>
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${STATUS_BADGE[order.status] || ''}`}>
          {STATUS_LABEL[order.status]}
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-1">🕐 {fmt12h(order.created_at)}</p>
      <ul className="text-xs text-gray-700 space-y-0.5 max-h-16 overflow-hidden mb-2">
        {order.items?.slice(0, 3).map((it, i) => (
          <li key={i} className="truncate"><span className="font-bold">×{it.quantity}</span> {it.item_name}</li>
        ))}
        {order.items?.length > 3 && <li className="text-gray-400">+{order.items.length - 3} más</li>}
      </ul>
      <div className="flex items-center justify-between">
        <span className={`font-mono text-sm font-bold ${timerColor}`}>⏱ {fmtTimer(secs)}</span>
        {order.total_price != null && <span className="text-xs font-bold text-gray-500">{fmtMoney(order.total_price)}</span>}
      </div>
    </div>
  );
}

// ── Cerrar Cuenta Modal ───────────────────────────────────────────────

function CuentaModal({ order, onClose, onEdit, onClosed }) {
  const [pago, setPago] = useState('');
  const [showPago, setShowPago] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cerrando, setCerrando] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const total = order.total_price || 0;
  const pagoNum = parseFloat(pago) || 0;
  const cambio = pagoNum >= total ? pagoNum - total : null;

  async function handleCerrar() {
    if (cambio === null) return toast.error('El pago no cubre el total');
    setCerrando(true);
    try {
      const res = await authFetch(`/api/orders/${order.id}/complete`, { method: 'PATCH' });
      if (!res.ok) throw new Error();
      toast.success(`Cuenta cerrada ✓  Cambio: ${fmtMoney(cambio)}`);
      onClosed();
    } catch { toast.error('Error al cerrar cuenta'); }
    finally { setCerrando(false); }
  }

  async function handleCancel() {
    setCancelError('');
    setCancelling(true);
    try {
      // Verify admin password
      const verifyRes = await fetch(`${API_URL}/api/auth/verify-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPass }),
      });
      if (!verifyRes.ok) { setCancelError('Contraseña incorrecta'); setCancelling(false); return; }
      // Cancel order
      const res = await authFetch(`/api/orders/${order.id}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ cancel_reason: cancelReason || null }),
      });
      if (!res.ok) throw new Error();
      toast.success('Pedido cancelado');
      onClosed();
    } catch { toast.error('Error al cancelar'); }
    finally { setCancelling(false); }
  }

  const title = order.table_number === 0 ? order.order_number : `Mesa ${order.table_number}`;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="bg-brand-red text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <h2 className="font-bebas text-4xl tracking-widest">{title}</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl font-bold leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-gray-400 font-semibold">Pedido a las {fmt12h(order.created_at)}</p>

          <div className="space-y-1">
            {order.items?.map((it, i) => (
              <div key={i} className="flex justify-between items-start py-1.5 border-b border-gray-100">
                <div>
                  <span className="font-bold text-gray-800 text-sm">×{it.quantity}</span>
                  <span className="ml-2 text-gray-800 text-sm">{it.item_name}</span>
                  {it.item_notes && <p className="text-xs text-yellow-600 ml-5">⚠ {it.item_notes}</p>}
                </div>
                {it.unit_price != null && (
                  <span className="font-mono text-gray-700 font-semibold text-sm ml-2 shrink-0">
                    {fmtMoney(it.unit_price * it.quantity)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {total > 0 && (
            <div className="flex justify-between items-center pt-2 border-t-2 border-gray-200">
              <span className="font-bebas text-2xl text-gray-800">TOTAL</span>
              <span className="font-bebas text-3xl text-brand-red">{fmtMoney(total)}</span>
            </div>
          )}

          {/* Panel cancelar */}
          {showCancel ? (
            <div className="space-y-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="font-bold text-red-700 text-sm">Cancelar pedido — requiere contraseña admin</p>
              <input type="text" value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                placeholder="Motivo (opcional)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
              <input type="password" value={adminPass} onChange={e => { setAdminPass(e.target.value); setCancelError(''); }}
                placeholder="Contraseña admin" autoFocus
                className={`w-full border-2 rounded-lg px-3 py-2 text-sm focus:outline-none ${cancelError ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-red-400'}`} />
              {cancelError && <p className="text-red-600 text-xs font-bold">{cancelError}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setShowCancel(false); setAdminPass(''); setCancelReason(''); setCancelError(''); }}
                  className="flex-1 border border-gray-200 text-gray-600 font-bold py-2 rounded-lg text-sm hover:bg-gray-50">
                  Atrás
                </button>
                <button onClick={handleCancel} disabled={cancelling || !adminPass}
                  className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bebas text-lg py-2 rounded-lg tracking-widest">
                  {cancelling ? 'Cancelando...' : 'CONFIRMAR'}
                </button>
              </div>
            </div>
          ) : !showPago ? (
            <div className="space-y-2 pt-1">
              <div className="flex gap-3">
                <button onClick={onEdit}
                  className="flex-1 border-2 border-brand-red text-brand-red font-bebas text-xl py-3 rounded-xl hover:bg-red-50 tracking-widest">
                  EDITAR
                </button>
                <button onClick={() => setShowPago(true)}
                  className="flex-1 bg-brand-red hover:bg-brand-dark text-white font-bebas text-xl py-3 rounded-xl tracking-widest">
                  COBRAR
                </button>
              </div>
              <button onClick={() => setShowCancel(true)}
                className="w-full border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 font-semibold text-sm py-2 rounded-xl transition-colors">
                Cancelar pedido
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">¿Cuánto te dan?</label>
                <input type="number" value={pago} onChange={e => setPago(e.target.value)}
                  placeholder="0.00" min={total} step="0.50" autoFocus
                  className="w-full border-2 border-gray-200 focus:border-brand-red rounded-xl px-4 py-3 text-2xl font-mono text-center focus:outline-none" />
              </div>

              {pagoNum > 0 && (
                <div className={`rounded-xl p-4 text-center ${cambio !== null ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  {cambio !== null ? (
                    <><p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-1">Cambio</p>
                      <p className="font-bebas text-4xl text-green-700">{fmtMoney(cambio)}</p></>
                  ) : (
                    <><p className="text-xs font-bold uppercase tracking-widest text-red-600 mb-1">Faltan</p>
                      <p className="font-bebas text-3xl text-red-600">{fmtMoney(total - pagoNum)}</p></>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setShowPago(false)}
                  className="flex-1 border-2 border-gray-200 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-50">
                  Atrás
                </button>
                <button onClick={handleCerrar} disabled={cerrando || cambio === null}
                  className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bebas text-xl py-3 rounded-xl tracking-widest">
                  {cerrando ? 'Cerrando...' : 'CERRAR CUENTA'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Formulario de orden (modal) ───────────────────────────────────────

const CATEGORIES = ['Burgers', 'Sides', 'Bebidas'];

let _uid = 0;
function nextUid() { return ++_uid; }

function OrdenFormModal({ mode, editingOrder, freeMesas, onClose, onSaved }) {
  // mode: 'mesa' | 'llevar' | 'edit'
  const isEdit = mode === 'edit';
  const [step, setStep] = useState(isEdit || mode === 'llevar' ? 'menu' : 'mesa');
  const [mesa, setMesa] = useState(isEdit ? editingOrder?.table_number : null);
  const [menuItems, setMenuItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState('Burgers');
  // cart = array de { uid, item, qty, note } — cada click crea una fila nueva
  const [cart, setCart] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    authFetch('/api/menu').then(r => r.json()).then(setMenuItems).catch(() => {});
  }, []);

  // Pre-fill cart when editing — una fila por item del pedido
  useEffect(() => {
    if (!isEdit || !menuItems.length) return;
    const rows = [];
    for (const oi of editingOrder.items) {
      const m = menuItems.find(x => x.name === oi.item_name);
      if (m) rows.push({ uid: nextUid(), item: m, qty: oi.quantity, note: oi.item_notes || '' });
    }
    setCart(rows);
  }, [isEdit, menuItems]);

  // Cada click agrega una fila nueva independiente
  function addItem(item) {
    setCart(prev => [...prev, { uid: nextUid(), item, qty: 1, note: '' }]);
  }
  function changeQty(uid, delta) {
    setCart(prev => prev.map(r => r.uid === uid ? { ...r, qty: r.qty + delta } : r).filter(r => r.qty > 0));
  }
  function removeRow(uid) {
    setCart(prev => prev.filter(r => r.uid !== uid));
  }
  function setNote(uid, note) {
    setCart(prev => prev.map(r => r.uid === uid ? { ...r, note } : r));
  }

  const total = cart.reduce((s, { item, qty }) => s + (item.price || 0) * qty, 0);
  function itemCount(itemId) { return cart.filter(r => r.item.id === itemId).reduce((s, r) => s + r.qty, 0); }

  async function handleSend() {
    if (!cart.length) return toast.error('Agrega al menos un ítem');
    const items = cart.map(({ item, qty, note }) => ({ menu_item_id: item.id, quantity: qty, notes: note }));
    setSending(true);
    try {
      let res;
      if (isEdit) {
        res = await authFetch(`/api/orders/${editingOrder.id}/items`, { method: 'PATCH', body: JSON.stringify({ items }) });
      } else {
        const table = mode === 'llevar' ? 0 : mesa;
        res = await authFetch('/api/orders', { method: 'POST', body: JSON.stringify({ table_number: table, items }) });
      }
      if (!res.ok) throw new Error((await res.json()).error);
      const label = isEdit ? `Mesa ${mesa} actualizada` : mode === 'llevar' ? 'Pedido para llevar enviado' : `Mesa ${mesa} enviada a cocina`;
      toast.success(label);
      onSaved();
    } catch (err) { toast.error(err.message || 'Error'); }
    finally { setSending(false); }
  }

  const categoryItems = menuItems.filter(i => i.category === activeCategory);
  const headerLabel = isEdit
    ? (editingOrder?.table_number === 0 ? editingOrder?.order_number : `Mesa ${editingOrder?.table_number}`)
    : mode === 'llevar' ? 'Para Llevar' : mesa ? `Mesa ${mesa}` : 'Nueva Mesa';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col"
        style={{ maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-brand-red text-white px-6 py-3 rounded-t-2xl flex items-center justify-between shrink-0">
          <h2 className="font-bebas text-3xl tracking-widest">{headerLabel}</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl font-bold leading-none">×</button>
        </div>

        {/* Step: seleccionar mesa */}
        {step === 'mesa' && (
          <div className="p-6">
            <p className="text-sm text-gray-500 mb-4 font-semibold">Selecciona una mesa libre:</p>
            <div className="grid grid-cols-5 gap-3">
              {freeMesas.map(n => (
                <button key={n} onClick={() => { setMesa(n); setStep('menu'); }}
                  className="aspect-square flex items-center justify-center bg-brand-red hover:bg-brand-dark text-white font-bebas text-4xl rounded-xl shadow transition-all hover:scale-105">
                  {n}
                </button>
              ))}
              {freeMesas.length === 0 && (
                <p className="col-span-5 text-center text-gray-400 py-8">Todas las mesas están ocupadas</p>
              )}
            </div>
          </div>
        )}

        {/* Step: menú */}
        {step === 'menu' && (
          <div className="flex flex-1 min-h-0 gap-0">
            {/* Menú */}
            <div className="flex-1 flex flex-col p-4 min-w-0 border-r border-gray-200">
              {mode === 'mesa' && !isEdit && (
                <button onClick={() => setStep('mesa')} className="text-brand-red text-sm font-bold hover:underline mb-3 text-left">
                  ← Cambiar mesa
                </button>
              )}
              <div className="flex gap-2 mb-3 shrink-0">
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-1.5 rounded-full font-bold text-sm transition-all ${
                      activeCategory === cat ? 'bg-brand-red text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 overflow-y-auto">
                {categoryItems.map(item => {
                  const count = itemCount(item.id);
                  return (
                    <button key={item.id} onClick={() => addItem(item)}
                      className="text-left p-3 border-2 border-gray-200 hover:border-brand-red rounded-xl transition-all hover:shadow group relative">
                      <p className="font-bold text-sm text-gray-900 group-hover:text-brand-red leading-tight">{item.name}</p>
                      {item.description && <p className="text-xs text-gray-400 mt-0.5 leading-tight">{item.description}</p>}
                      {item.price != null && <p className="text-sm font-bold text-brand-red mt-1">{fmtMoney(item.price)}</p>}
                      {count > 0 && (
                        <span className="absolute top-2 right-2 bg-brand-red text-white text-xs font-bold px-2 py-0.5 rounded-full">×{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Carrito */}
            <div className="w-72 flex flex-col p-4 shrink-0">
              <h3 className="font-bebas text-xl text-brand-red tracking-wide mb-3">Pedido</h3>
              <div className="flex-1 overflow-y-auto space-y-2">
                {cart.length === 0 && (
                  <p className="text-gray-400 text-sm text-center mt-6">Agrega ítems</p>
                )}
                {cart.map((row) => (
                  <div key={row.uid} className="bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-gray-900 flex-1 mr-1 leading-tight">{row.item.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => changeQty(row.uid, -1)} className="w-6 h-6 rounded-full bg-gray-200 hover:bg-red-100 text-brand-red font-bold flex items-center justify-center text-base leading-none">−</button>
                        <span className="w-4 text-center font-bold text-xs">{row.qty}</span>
                        <button onClick={() => changeQty(row.uid, +1)} className="w-6 h-6 rounded-full bg-gray-200 hover:bg-green-100 text-green-700 font-bold flex items-center justify-center text-base leading-none">+</button>
                        <button onClick={() => removeRow(row.uid)} className="w-6 h-6 rounded-full bg-gray-200 hover:bg-red-200 text-gray-400 hover:text-red-700 font-bold flex items-center justify-center text-base leading-none ml-0.5">×</button>
                      </div>
                    </div>
                    {row.item.price != null && (
                      <p className="text-xs text-gray-400 mb-1">{fmtMoney(row.item.price * row.qty)}</p>
                    )}
                    <input type="text" value={row.note} onChange={e => setNote(row.uid, e.target.value)}
                      placeholder="Nota especial..."
                      className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand-red" />
                  </div>
                ))}
              </div>

              {total > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between items-center">
                  <span className="font-bold text-sm text-gray-700">Total</span>
                  <span className="font-bebas text-xl text-brand-red">{fmtMoney(total)}</span>
                </div>
              )}

              <button onClick={handleSend} disabled={sending || !cart.length}
                className="mt-3 w-full bg-brand-red hover:bg-brand-dark disabled:opacity-50 text-white font-bebas text-lg py-3 rounded-xl tracking-widest transition-colors">
                {sending ? 'Guardando...' : isEdit ? 'Actualizar' : 'Enviar a Cocina'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────

export default function PedidosActivos() {
  const [orders, setOrders] = useState([]);
  const [flashMesas, setFlashMesas] = useState(new Set());
  const [cuentaOrder, setCuentaOrder] = useState(null);  // order para cobrar
  const [formMode, setFormMode] = useState(null);         // 'mesa' | 'llevar' | 'edit'
  const [formEditing, setFormEditing] = useState(null);   // order cuando mode='edit'

  const fetchActive = useCallback(async () => {
    try {
      const res = await authFetch('/api/orders/active');
      const data = await res.json();
      setOrders(data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
      // Sync cuenta modal
      setCuentaOrder(prev => {
        if (!prev) return null;
        return data.find(o => o.id === prev.id) || null;
      });
    } catch {}
  }, []);

  useEffect(() => {
    fetchActive();
    socket.connect();
    socket.on('order:new', fetchActive);
    socket.on('order:started', fetchActive);
    socket.on('order:updated', fetchActive);
    socket.on('order:cancelled', () => { fetchActive(); setCuentaOrder(null); });
    socket.on('order:completed', (o) => {
      setFlashMesas(prev => new Set([...prev, o.table_number]));
      fetchActive();
      setTimeout(() => setFlashMesas(prev => { const n = new Set(prev); n.delete(o.table_number); return n; }), 60000);
    });
    return () => {
      socket.off('order:new'); socket.off('order:started'); socket.off('order:updated');
      socket.off('order:cancelled'); socket.off('order:completed');
    };
  }, [fetchActive]);

  const mesaOrders = orders.filter(o => o.table_number > 0);
  const llevarOrders = orders.filter(o => o.table_number === 0);
  const tableMap = {};
  for (const o of mesaOrders) tableMap[o.table_number] = o;
  const occupiedMesas = new Set(Object.keys(tableMap).map(Number));
  const freeMesas = Array.from({ length: 10 }, (_, i) => i + 1).filter(n => !occupiedMesas.has(n));

  function openEdit(order) {
    setCuentaOrder(null);
    setFormEditing(order);
    setFormMode('edit');
  }

  function closeForm() { setFormMode(null); setFormEditing(null); }

  function onFormSaved() { closeForm(); fetchActive(); }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bebas text-4xl text-brand-red tracking-wide">Pedidos Activos</h2>
        <div className="flex gap-2">
          <button onClick={() => setFormMode('mesa')}
            className="bg-brand-red hover:bg-brand-dark text-white font-bebas text-lg px-5 py-2.5 rounded-xl tracking-widest transition-colors shadow">
            + Nueva Mesa
          </button>
          <button onClick={() => setFormMode('llevar')}
            className="bg-gray-800 hover:bg-gray-700 text-white font-bebas text-lg px-5 py-2.5 rounded-xl tracking-widest transition-colors shadow">
            + Para Llevar
          </button>
        </div>
      </div>

      {/* Mesas grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <MesaCard key={n} number={n} order={tableMap[n] || null}
            flashing={flashMesas.has(n)} onClick={setCuentaOrder} />
        ))}
      </div>

      {/* Para Llevar */}
      {llevarOrders.length > 0 && (
        <div>
          <h3 className="font-bebas text-2xl text-gray-700 tracking-wide mb-3 flex items-center gap-2">
            🛍 Para Llevar
            <span className="bg-gray-200 text-gray-700 text-sm font-bold px-2 py-0.5 rounded-full font-sans">{llevarOrders.length}</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {llevarOrders.map(o => (
              <LlevarCard key={o.id} order={o} onClick={setCuentaOrder} />
            ))}
          </div>
        </div>
      )}

      {orders.length === 0 && (
        <div className="text-center py-16 text-gray-300">
          <p className="font-bebas text-4xl tracking-wide">Sin pedidos activos</p>
          <p className="text-sm mt-2">Usa los botones de arriba para crear un pedido</p>
        </div>
      )}

      {/* Modales */}
      {cuentaOrder && (
        <CuentaModal
          order={cuentaOrder}
          onClose={() => setCuentaOrder(null)}
          onEdit={() => openEdit(cuentaOrder)}
          onClosed={() => { setCuentaOrder(null); fetchActive(); }}
        />
      )}

      {formMode && (
        <OrdenFormModal
          mode={formMode}
          editingOrder={formEditing}
          freeMesas={freeMesas}
          onClose={closeForm}
          onSaved={onFormSaved}
        />
      )}
    </div>
  );
}
