const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const userRoutes = require('./routes/userRoutes');
const ruleRoutes = require('./routes/ruleRoutes');
const orderRoutes = require('./routes/orderRoutes');
const configRoutes = require('./routes/configRoutes');

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Thermomix Service API is running' });
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/rules', ruleRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/config', configRoutes);
app.use('/api/dashboard', require('./routes/dashboardRoutes'));

const path = require('path');
app.use(express.static(path.join(__dirname, '../../frontend'), {
  setHeaders: (res, filepath) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
