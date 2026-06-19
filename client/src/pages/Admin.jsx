import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CONFIG } from '../config';
import FinanzasHoy from '../components/admin/FinanzasHoy';
import Graficas from '../components/admin/Graficas';
import TablaPedidos from '../components/admin/TablaPedidos';
import CalendarioHistorico from '../components/admin/CalendarioHistorico';
import Historico7Dias from '../components/admin/Historico7Dias';
import VistaCocina from '../components/shared/VistaCocina';
import PedidosCancelados from '../components/admin/PedidosCancelados';

const SECTIONS = [
  { id: 'finanzas', label: 'Finanzas Hoy' },
  { id: 'cocina', label: '🍳 Vista Cocina' },
  { id: 'cancelados', label: '🚫 Cancelados' },
  { id: 'graficas', label: 'Gráficas' },
  { id: 'tabla', label: 'Pedidos del Día' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'historico', label: '7 Días' },
];

export default function Admin() {
  const [section, setSection] = useState('finanzas');
  const navigate = useNavigate();

  function logout() {
    localStorage.clear();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-brand-red text-white px-6 py-3 flex items-center justify-between shadow-md">
        <h1 className="font-bebas text-3xl tracking-widest">{CONFIG.restaurantName} — Admin</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/cajero')}
            className="text-sm bg-white text-brand-red font-bold px-3 py-1 rounded-lg hover:bg-gray-100"
          >
            Cajero
          </button>
          <button
            onClick={logout}
            className="text-sm border border-white/50 px-3 py-1 rounded-lg hover:bg-white/10"
          >
            Salir
          </button>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200 px-6 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`px-5 py-4 font-bold text-sm border-b-2 transition-colors whitespace-nowrap ${
                section === s.id
                  ? 'border-brand-red text-brand-red'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 overflow-auto p-6">
        {section === 'finanzas' && <FinanzasHoy />}
        {section === 'cocina' && <div className="-mx-6 -mt-6"><VistaCocina /></div>}
        {section === 'cancelados' && <PedidosCancelados />}
        {section === 'graficas' && <Graficas />}
        {section === 'tabla' && <TablaPedidos />}
        {section === 'calendario' && <CalendarioHistorico />}
        {section === 'historico' && <Historico7Dias />}
      </main>
    </div>
  );
}
