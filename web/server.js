var express = require('express');
var path = require('path');
var captureInfo = require('./middleware/capture');
var authRoutes = require('./routes/auth');
var callbackRoutes = require('./routes/callback');
var apiRoutes = require('./routes/api');

var app = express();

// trust proxy for correct IP detection behind reverse proxies
app.set('trust proxy', true);

// capture client info on every request
app.use(captureInfo);

// static files
app.use(express.static(path.join(__dirname, 'public')));

// routes
app.use('/auth', authRoutes);
app.use('/auth', callbackRoutes);
app.use('/api', apiRoutes);

// attach discord client reference (called from index.js)
app.attachClient = function(client) {
    callbackRoutes.setClient(client);
};

module.exports = app;
