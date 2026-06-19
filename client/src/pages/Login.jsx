import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { API_URL, CONFIG } from '../config';

export default function Login() {
  const [role, setRole] = useState('cajero');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      if (data.role === 'cocina') navigate('/cocina');
      else if (data.role === 'admin') navigate('/admin');
      else navigate('/cajero');
    } catch (err) {
      toast.error(err.message || 'Contraseña incorrecta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-red flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        {/* Logo / Name */}
        <div className="text-center mb-8">
          <h1 className="font-bebas text-6xl text-brand-red leading-none tracking-wide">
            {CONFIG.restaurantName}
          </h1>
          <p className="text-gray-500 text-sm mt-1 tracking-widest uppercase">Sistema POS</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
              Rol
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['cajero', 'admin', 'cocina'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`py-2 rounded-lg font-bold text-sm uppercase transition-all ${
                    role === r
                      ? 'bg-brand-red text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-lg focus:outline-none focus:border-brand-red transition-colors"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-red hover:bg-brand-dark text-white font-bebas text-2xl py-3 rounded-lg transition-colors disabled:opacity-60 tracking-widest"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
