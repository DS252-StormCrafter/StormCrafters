// backend/src/server.js (merge into your existing server)
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const adminRouter = require('./routes/admin');
// other routers...
const app = express();

app.use(express.json());

// mount admin router
app.use('/api/admin', adminRouter);

// existing routers e.g. auth, driver, route, vehicle
// app.use('/api/auth', authRouter);
// app.use('/api/driver', driverRouter);

const PORT = process.env.PORT || 5000;
const MONGO = process.env.MONGO_URI;

mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Mongo connected');
    app.listen(PORT, () => console.log('Server running on port', PORT));
  })
  .catch(err => {
    console.error('Mongo connection error', err);
  });

module.exports = app; // export for tests (supertest)
