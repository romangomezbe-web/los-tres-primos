const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'los-tres-primos-secret';

const CREDENTIALS = {
  cajero: 'caja123',
  admin: 'admin123',
  cocina: 'cocina123',
};

router.post('/verify-admin', (req, res) => {
  const { password } = req.body;
  if (password === CREDENTIALS.admin) return res.json({ ok: true });
  res.status(401).json({ ok: false, error: 'Contraseña incorrecta' });
});

router.post('/login', (req, res) => {
  const { role, password } = req.body;
  if (!role || !CREDENTIALS[role]) {
    return res.status(400).json({ error: 'Rol inválido' });
  }
  if (CREDENTIALS[role] !== password) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }
  const token = jwt.sign({ role }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, role });
});

module.exports = router;
