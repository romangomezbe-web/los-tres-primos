import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { API_URL, fmtMoney } from '../../config';

const PIE_COLORS = ['#E31E24', '#B01519', '#f87171', '#fca5a5', '#fecaca'];

function fmtHour(h) {
  const n = parseInt(h, 10);
  const ampm = n >= 12 ? 'PM' : 'AM';
  const h12 = n % 12 || 12;
  return `${h12}${ampm}`;
}

export default function Graficas() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/api/stats/today`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <div className="p-4 text-gray-400">Cargando...</div>;

  const { byHour, topItems, byCategory } = data;

  const hourlyRevenue = byHour.map(h => ({
    hour: fmtHour(h.hour),
    revenue: h.revenue,
  }));

  const hourlyOrders = byHour.map(h => ({
    hour: fmtHour(h.hour),
    pedidos: h.order_count,
  }));

  const pieItems = topItems.slice(0, 5).map(i => ({
    name: i.item_name,
    value: i.total_qty,
  }));

  const pieRevenue = byCategory.map(c => ({
    name: c.category,
    value: parseFloat(c.revenue.toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      <h2 className="font-bebas text-4xl text-brand-red tracking-wide">Gráficas del Día</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Ventas por Hora (MXN)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={v => fmtMoney(v)} />
              <Bar dataKey="revenue" fill="#E31E24" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Pedidos por Hora">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourlyOrders}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="pedidos" fill="#B01519" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Ítem más Pedido (cantidad)">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieItems} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}>
                {pieItems.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Ingresos por Categoría (MXN)">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieRevenue} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {pieRevenue.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => fmtMoney(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <h3 className="font-bold text-gray-700 text-sm mb-4 uppercase tracking-widest">{title}</h3>
      {children}
    </div>
  );
}
