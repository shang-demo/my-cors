require('./lib/init');
require('./lib/server');


logger.info('server listen on: ', 'http://' + (CONFIG.ip || 'localhost') + ':' + CONFIG.port);
