import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Cajero from './pages/Cajero';
import Admin from './pages/Admin';
import Cocina from './pages/Cocina';

function getAuth() {
  try {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (!token || !role) return null;
    return { token, role };
  } catch {
    return null;
  }
}

function ProtectedRoute({ children, allowedRoles }) {
  const auth = getAuth();
  if (!auth) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(auth.role)) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cocina" element={<Cocina />} />
      <Route
        path="/cajero"
        element={
          <ProtectedRoute allowedRoles={['cajero', 'admin']}>
            <Cajero />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Admin />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
