import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { API_URL, fmtMoney } from '../../config';

const CATEGORIES = ['Burgers', 'Sides', 'Bebidas'];

function authFetch(path, opts = {}) {
  const token = localStorage.getItem('token');
  return fetch(`${API_URL}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers },
  });
}

let uidCounter = 0;
function uid() { return ++uidCounter; }

export default function NuevoPedido({ editingOrder, onDone }) {
  const isEditing = !!editingOrder;

  const [step, setStep] = useState(isEditing ? 'menu' : 'mesa');
  const [mesa, setMesa] = useState(isEditing ? editingOrder.table_number : null);
  const [menuItems, setMenuItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState('Burgers');
  // cart is an array: [{ uid, item, qty, note }]
  const [cart, setCart] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    authFetch('/api/menu').then(r => r.json()).then(setMenuItems).catch(() => {});
  }, []);

  // Pre-populate cart when editing — one row per order_item
  useEffect(() => {
    if (!isEditing || !menuItems.length) return;
    const rows = [];
    for (const oi of editingOrder.items) {
      const menuItem = menuItems.find(m => m.name === oi.item_name);
      if (menuItem) rows.push({ uid: uid(), item: menuItem, qty: oi.quantity, note: oi.item_notes || '' });
    }
    setCart(rows);
  }, [isEditing, menuItems]);

  function selectMesa(n) { setMesa(n); setStep('menu'); setCart([]); }

  // Each click adds a NEW row (separate entry with its own note)
  function addItem(item) {
    setCart(prev => [...prev, { uid: uid(), item, qty: 1, note: '' }]);
  }

  function changeQty(rowUid, delta) {
    setCart(prev => prev
      .map(r => r.uid === rowUid ? { ...r, qty: r.qty + delta } : r)
      .filter(r => r.qty > 0)
    );
  }

  function removeRow(rowUid) {
    setCart(prev => prev.filter(r => r.uid !== rowUid));
  }

  function setNote(rowUid, note) {
    setCart(prev => prev.map(r => r.uid === rowUid ? { ...r, note } : r));
  }

  const total = cart.reduce((sum, { item, qty }) => sum + (item.price || 0) * qty, 0);

  // Count total quantity of an item across all rows (for badge on menu card)
  function itemCount(itemId) {
    return cart.filter(r => r.item.id === itemId).reduce((s, r) => s + r.qty, 0);
  }

  async function sendOrder() {
    if (!cart.length) return toast.error('Agrega al menos un ítem');
    const items = cart.map(({ item, qty, note }) => ({ menu_item_id: item.id, quantity: qty, notes: note }));
    setSending(true);
    try {
      let res;
      if (isEditing) {
        res = await authFetch(`/api/orders/${editingOrder.id}/items`, { method: 'PATCH', body: JSON.stringify({ items }) });
      } else {
        res = await authFetch('/api/orders', { method: 'POST', body: JSON.stringify({ table_number: mesa, items }) });
      }
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(isEditing ? `Mesa ${mesa} actualizada` : `¡Mesa ${mesa} enviada a cocina!`);
      if (isEditing && onDone) { onDone(); return; }
      setStep('mesa'); setMesa(null); setCart([]);
    } catch (err) {
      toast.error(err.message || 'Error');
    } finally {
      setSending(false);
    }
  }

  // ── SELECCIONA MESA ──────────────────────────────────────────────
  if (step === 'mesa') {
    return (
      <div className="p-6">
        <h2 className="font-bebas text-4xl text-brand-red mb-6 tracking-wide">Selecciona Mesa</h2>
        <div className="grid grid-cols-5 gap-4 max-w-2xl">
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
            <button key={n} onClick={() => selectMesa(n)}
              className="aspect-square flex items-center justify-center bg-brand-red hover:bg-brand-dark text-white font-bebas text-5xl rounded-xl shadow-md transition-all hover:scale-105">
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── MENÚ ─────────────────────────────────────────────────────────
  const categoryItems = menuItems.filter(i => i.category === activeCategory);

  return (
    <div className="flex gap-4 p-4" style={{ minHeight: 'calc(100vh - 120px)' }}>
      {/* Panel menú */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-4 mb-4">
          {!isEditing
            ? <button onClick={() => setStep('mesa')} className="text-brand-red font-bold hover:underline text-sm">← Cambiar mesa</button>
            : <button onClick={onDone} className="text-gray-500 font-bold hover:underline text-sm">← Volver</button>
          }
          <h2 className="font-bebas text-3xl text-brand-red tracking-wide">
            {isEditing ? `Editando Mesa ${mesa}` : `Mesa ${mesa}`}
          </h2>
        </div>

        <div className="flex gap-2 mb-4">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2 rounded-full font-bold text-sm transition-all ${
                activeCategory === cat ? 'bg-brand-red text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto">
          {categoryItems.map(item => {
            const count = itemCount(item.id);
            return (
              <button key={item.id} onClick={() => addItem(item)}
                className="text-left p-4 border-2 border-gray-200 hover:border-brand-red rounded-xl transition-all hover:shadow-md group relative">
                <p className="font-bold text-gray-900 group-hover:text-brand-red leading-tight">{item.name}</p>
                {item.description && <p className="text-xs text-gray-500 mt-1">{item.description}</p>}
                {item.price != null && <p className="text-sm font-bold text-brand-red mt-2">{fmtMoney(item.price)}</p>}
                {count > 0 && (
                  <span className="absolute top-2 right-2 bg-brand-red text-white text-xs font-bold px-2 py-0.5 rounded-full">×{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel pedido */}
      <div className="w-80 flex flex-col bg-gray-50 rounded-xl p-4 border border-gray-200">
        <h3 className="font-bebas text-2xl text-brand-red tracking-wide mb-3">
          {isEditing ? `Editando — Mesa ${mesa}` : `Pedido — Mesa ${mesa}`}
        </h3>

        <div className="flex-1 overflow-y-auto space-y-2">
          {cart.length === 0 && (
            <p className="text-gray-400 text-sm text-center mt-8">Agrega ítems del menú</p>
          )}
          {cart.map((row) => (
            <div key={row.uid} className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-gray-900 leading-tight flex-1 mr-2">{row.item.name}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => changeQty(row.uid, -1)}
                    className="w-7 h-7 rounded-full bg-gray-100 hover:bg-red-100 text-brand-red font-bold flex items-center justify-center text-lg leading-none">−</button>
                  <span className="w-5 text-center font-bold text-sm">{row.qty}</span>
                  <button onClick={() => changeQty(row.uid, +1)}
                    className="w-7 h-7 rounded-full bg-gray-100 hover:bg-green-100 text-green-700 font-bold flex items-center justify-center text-lg leading-none">+</button>
                  <button onClick={() => removeRow(row.uid)}
                    className="w-7 h-7 rounded-full bg-gray-100 hover:bg-red-200 text-gray-400 hover:text-red-700 font-bold flex items-center justify-center text-base leading-none ml-1">×</button>
                </div>
              </div>
              {row.item.price != null && (
                <p className="text-xs text-gray-400 mb-1">
                  {fmtMoney(row.item.price)} c/u — <span className="font-bold text-gray-700">{fmtMoney(row.item.price * row.qty)}</span>
                </p>
              )}
              <input type="text" value={row.note} onChange={e => setNote(row.uid, e.target.value)}
                placeholder="Nota especial (sin cebolla, etc.)"
                className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-brand-red" />
            </div>
          ))}
        </div>

        {cart.length > 0 && total > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
            <span className="font-bold text-gray-700">Total</span>
            <span className="font-bebas text-2xl text-brand-red">{fmtMoney(total)}</span>
          </div>
        )}

        <button onClick={sendOrder} disabled={sending || !cart.length}
          className="mt-3 w-full bg-brand-red hover:bg-brand-dark disabled:opacity-50 text-white font-bebas text-xl py-3 rounded-xl tracking-widest transition-colors">
          {sending ? 'Guardando...' : isEditing ? 'Actualizar Pedido' : 'Enviar a Cocina'}
        </button>
      </div>
    </div>
  );
}
