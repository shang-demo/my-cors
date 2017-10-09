const http = require('http');
const cors = require('cors')();
const fs = require('fs');
const path = require('path');
const ProxyAgent = require('proxy-agent');
const url = require('url');

const indexViewStr = fs.readFileSync(path.join(__dirname, './index.html'));

const { getRedirectUrl } = require('./url-helper');
const { createProxyServer } = require('./proxy-server');

const server = http.createServer(function (req, res) {
  cors(req, res, function () {
    logger.info('req.url: ', req.url);
    if (req.url === '/') {
      res.writeHead(200, {
        'Content-Type': 'text/html'
      });
      if(CONFIG.env === 'development') {
        fs.createReadStream(path.join(__dirname, './index.html')).pipe(res);
      }
      else {
        res.end(indexViewStr);
      }

      return null;
    }

    // leancloud不使用云函数和Hook
    if (req.url === '/1.1/functions/_ops/metadatas') {
      res.writeHead(404, {
        'Content-Type': 'text/html'
      });
      return res.end('');
    }

    req.cookies = {};
    (req.headers.cookie && req.headers.cookie.split(';') || []).reduce(function (oldValue, Cookie) {
      let parts = Cookie.split('=');
      oldValue[parts[0].trim()] = decodeURIComponent(( parts[1] || '' ).trim());
      return oldValue;
    }, req.cookies);

    logger.info('req.cookies: ', req.cookies);
    req.query = url.parse(req.url, true).query;


    let redirectUrl = getRedirectUrl(req, res);
    logger.info('startUrl', redirectUrl);

    if (!redirectUrl || !/^http/.test(redirectUrl)) {
      res.writeHead(400, {
        'Content-Type': 'text/json'
      });

      return res.end(JSON.stringify({
        code: 400,
        msg: 'need start url'
      }));
    }

    // reset url to prevent node-http-proxy set path
    req.url = '';

    let isEruda = req.query.eruda !== '0';
    if (isEruda) {
      req.headers = req.headers || {};
      req.headers['accept-encoding'] = null;
    }

    let proxyUri = req.query.proxyUri;
    let proxyAgent;
    if (proxyUri) {
      logger.info('proxyUri: ', proxyUri);
      proxyAgent = new ProxyAgent(proxyUri);
    }

    let proxy = createProxyServer(proxyAgent);

    return proxy.web(req, res, {
      target: redirectUrl,
      changeOrigin: true,
      secure: false,
    });
  });
});

server.listen(CONFIG.port, CONFIG.ip);

