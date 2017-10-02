
process.on('uncaughtException', function (err) {
  console.error('Error caught in uncaughtException event:', err);
});


global.CONFIG = {
  port: process.env.PORT || 1337,
  ip: process.env.IP,
};

global.logger = console;