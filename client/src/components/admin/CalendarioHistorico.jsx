import { useState, useEffect } from 'react';
import { API_URL, fmtMoney, fmtTime } from '../../config';

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay();
}

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

export default function CalendarioHistorico() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [summaries, setSummaries] = useState({});
  const [modal, setModal] = useState(null);
  const [modalData, setModalData] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/api/stats/calendar?year=${year}&month=${month + 1}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(rows => {
        const map = {};
        for (const row of rows) map[row.date] = row;
        setSummaries(map);
      })
      .catch(() => {});
  }, [year, month]);

  function openDay(date) {
    const token = localStorage.getItem('token');
    setModal(date);
    setModalData(null);
    fetch(`${API_URL}/api/stats/calendar/${date}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setModalData)
      .catch(() => {});
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const days = getDaysInMonth(year, month);
  const startDay = getFirstDayOfWeek(year, month);

  return (
    <div className="space-y-4">
      <h2 className="font-bebas text-4xl text-brand-red tracking-wide">Calendario Histórico</h2>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        {/* Nav */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 font-bold">←</button>
          <h3 className="font-bebas text-2xl tracking-wide">{MONTHS_ES[month]} {year}</h3>
          <button onClick={nextMonth} className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 font-bold">→</button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS_ES.map(d => (
            <div key={d} className="text-center text-xs font-bold text-gray-400 uppercase py-1">{d}</div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startDay }, (_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: days }, (_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const s = summaries[dateStr];
            let bg = 'bg-gray-50 hover:bg-gray-100';
            if (s?.total_orders > 0) {
              bg = (s.avg_prep_time_seconds || 0) <= 720
                ? 'bg-green-100 hover:bg-green-200 cursor-pointer'
                : 'bg-red-100 hover:bg-red-200 cursor-pointer';
            }
            return (
              <div
                key={day}
                onClick={() => s?.total_orders > 0 && openDay(dateStr)}
                className={`rounded-lg p-1.5 min-h-[60px] ${bg} transition-colors`}
              >
                <p className="text-xs font-bold text-gray-700">{day}</p>
                {s?.total_orders > 0 && (
                  <>
                    <p className="text-xs text-gray-600 font-mono leading-tight">{fmtMoney(s.total_revenue)}</p>
                    <p className="text-xs text-gray-500">{s.total_orders} ped.</p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bebas text-3xl text-brand-red tracking-wide">{modal}</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-700 text-2xl font-bold">×</button>
            </div>

            {!modalData ? (
              <p className="text-gray-400">Cargando...</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <Stat label="Ingresos" value={fmtMoney(modalData.summary?.total_revenue || 0)} />
                  <Stat label="Pedidos" value={modalData.summary?.total_orders || 0} />
                  <Stat label="Tiempo Prom." value={fmtTime(modalData.summary?.avg_prep_time_seconds)} />
                </div>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 text-xs text-gray-500 uppercase">Mesa</th>
                      <th className="text-left py-2 text-xs text-gray-500 uppercase">Ítems</th>
                      <th className="text-left py-2 text-xs text-gray-500 uppercase">Tiempo</th>
                      <th className="text-left py-2 text-xs text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.orders?.map(o => (
                      <tr key={o.id} className="border-b border-gray-100">
                        <td className="py-2 font-bold text-brand-red font-bebas text-xl">{o.table_number}</td>
                        <td className="py-2 text-xs text-gray-600">{o.items_summary}</td>
                        <td className="py-2 font-mono text-xs">{fmtTime(o.prep_time_seconds)}</td>
                        <td className="py-2 font-mono font-bold">{fmtMoney(o.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
      <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">{label}</p>
      <p className="font-bebas text-2xl text-gray-800">{value}</p>
    </div>
  );
}
