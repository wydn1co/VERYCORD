var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var captureInfo = require('./middleware/capture');
var callbackRoutes = require('./routes/callback');
var apiRoutes = require('./routes/api');
var verifiedRoutes = require('./routes/verified');
var dashboardRoutes = require('./routes/dashboard');
var dashboardApiRoutes = require('./routes/dashboard-api');

var app = express();

// trust proxy for correct IP detection behind reverse proxies
app.set('trust proxy', true);

// body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// capture client info on every request
app.use(captureInfo);

// static files
app.use(express.static(path.join(__dirname, 'public')));

// routes
app.use('/auth', callbackRoutes);
app.use('/', verifiedRoutes);
app.use('/api', apiRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/api/dashboard', dashboardApiRoutes);

// attach discord client reference (called from index.js)
app.attachClient = function(client) {
    callbackRoutes.setClient(client);
    verifiedRoutes.setClient(client);
    dashboardRoutes.setClient(client);
    dashboardApiRoutes.setClient(client);
};

module.exports = app;
