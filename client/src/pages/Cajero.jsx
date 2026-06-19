import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CONFIG } from '../config';
import PedidosActivos from '../components/cajero/PedidosActivos';
import ResumenDia from '../components/cajero/ResumenDia';
import VistaCocina from '../components/shared/VistaCocina';

const TABS = [
  { id: 'activos', label: 'Pedidos Activos' },
  { id: 'cocina', label: '🍳 Vista Cocina' },
  { id: 'resumen', label: 'Resumen del Día' },
];

export default function Cajero() {
  const [tab, setTab] = useState('activos');
  const navigate = useNavigate();
  const role = localStorage.getItem('role');

  function logout() {
    localStorage.clear();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-brand-red text-white px-6 py-3 flex items-center justify-between shadow-md">
        <h1 className="font-bebas text-3xl tracking-widest">{CONFIG.restaurantName}</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm opacity-80 capitalize">{role}</span>
          {role === 'admin' && (
            <button onClick={() => navigate('/admin')} className="text-sm bg-white text-brand-red font-bold px-3 py-1 rounded-lg hover:bg-gray-100">
              Admin
            </button>
          )}
          <button onClick={logout} className="text-sm border border-white/50 px-3 py-1 rounded-lg hover:bg-white/10">
            Salir
          </button>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-6 py-4 font-bold text-sm border-b-2 transition-colors ${
                tab === t.id ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 overflow-auto">
        {tab === 'activos' && <PedidosActivos />}
        {tab === 'cocina' && <VistaCocina />}
        {tab === 'resumen' && <ResumenDia />}
      </main>
    </div>
  );
}
