import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { API_URL, fmtMoney } from '../../config';

export default function Historico7Dias() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/api/stats/week`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setRows)
      .catch(() => {});
  }, []);

  const data = rows.map(r => ({
    date: r.date.slice(5),
    revenue: r.total_revenue,
    orders: r.total_orders,
    avgPrep: r.avg_prep_time_seconds ? Math.round(r.avg_prep_time_seconds / 60) : 0,
  }));

  return (
    <div className="space-y-6">
      <h2 className="font-bebas text-4xl text-brand-red tracking-wide">Histórico 7 Días</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Ingresos por Día (MXN)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={v => fmtMoney(v)} />
              <Line type="monotone" dataKey="revenue" stroke="#E31E24" strokeWidth={2} dot={{ fill: '#E31E24' }} name="Ingresos" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Pedidos por Día">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="orders" stroke="#B01519" strokeWidth={2} dot={{ fill: '#B01519' }} name="Pedidos" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Tiempo Promedio de Preparación (min)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} unit=" min" />
              <Tooltip formatter={v => `${v} min`} />
              <ReferenceLine y={12} stroke="#E31E24" strokeDasharray="4 4" label={{ value: 'Meta 12 min', fill: '#E31E24', fontSize: 11 }} />
              <Bar dataKey="avgPrep" fill="#B01519" radius={[4, 4, 0, 0]} name="Tiempo Prom." />
            </BarChart>
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
