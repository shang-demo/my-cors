require('./config/init.js');

var cors = require('cors')();
var http = require('http');
var url = require('url');

var httpProxy = require('./framework/http-proxy/index.js');

var proxy = httpProxy.createProxyServer({});
proxy.on('proxyReq', function(proxyReq, req, res, options) {
});

proxy.on('proxyRes', function (proxyRes, req, res) {
});

var server = http.createServer(function(req, res) {
  var queryObject = url.parse(req.url, true).query;
  cors(req, res, function() {
    if(!queryObject.proxyTo) {
      res.writeHead(400, {
        'Content-Type': 'text/json'
      });
      return res.end(JSON.stringify({
        code: 400,
        msg: 'need query proxyTo'
      }));
    }

    // reset url to prevent node-http-proxy set path
    req.url = '';

    console.log('method:', req.method, 'proxyTo: ', queryObject.proxyTo);
    if(!queryObject.type) {
      return proxy.web(req, res, {
        target: queryObject.proxyTo,
        changeOrigin: true,
        secure: false
      });
    }

    // TODO: 根据type 加入代理
    return proxy.web(req, res, {
      target: 'http://120.26.89.195:80',
      changeOrigin: true,
      secure: false,
      proxyTo: queryObject.proxyTo
    });
  });
});

proxy.on('error', function(err, req, res) {
  res.writeHead(500, {
    'Content-Type': 'text/json'
  });
  res.end(JSON.stringify(err));
});


var port = config.env.port || 9000;
var ip = config.env.ip || 'localhost';
server.listen(port, ip);