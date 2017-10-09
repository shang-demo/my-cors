process.on('uncaughtException', function (err) {
  console.error('Error caught in uncaughtException event:', err);
});


try {
  global.logger = require('pino')();
}
catch (e) {
  global.logger = console;
}


global.CONFIG = {
  port: process.env.PORT || 1337,
  ip: process.env.IP,
  env: (process.env.NODE_ENV || 'development').trim(),
};