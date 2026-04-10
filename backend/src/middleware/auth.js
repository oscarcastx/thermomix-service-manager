const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyToken = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });

  try {
    // Expected format: "Bearer <token>"
    const tokenPart = token.split(' ')[1] || token;
    const verified = jwt.verify(tokenPart, process.env.JWT_SECRET);
    req.user = verified; // Should contain { id, rol }
    next();
  } catch (err) {
    res.status(400).json({ error: 'Token inválido.' });
  }
};

const verifyRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'Acceso denegado. Rol no autorizado.' });
    }
    next();
  };
};

module.exports = { verifyToken, verifyRole };
