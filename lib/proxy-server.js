const BufferHelper = require('bufferhelper');
const httpProxy = require('http-proxy');

const { appendScript, changeEncoding } = require('./Utils');

const erudaScriptStr = `<script src="//cdn.bootcss.com/eruda/1.2.4/eruda.min.js"></script><script>eruda.init();</script>`;


const svc = {
  createProxyServer(agent) {
    let options = {};
    if (agent) {
      options.agent = agent;
    }
    let proxy = httpProxy.createProxyServer(options);

    proxy.on('proxyReq', (proxyReq, req, res, options) => {
    });

    proxy.on('error', (err, req, res) => {
      logger.info('err: ', err);

      res.writeHead(500, {
        'Content-Type': 'text/json'
      });
      res.end(JSON.stringify(err));
    });

    proxy.on('proxyRes', (proxyRes, req, res) => {
      svc.redirect(proxyRes);
      svc.setCookie(proxyRes, req, res);
      svc.erudaView(proxyRes, req, res);
    });

    return proxy;
  },
  redirect(proxyRes) {
    if (proxyRes.statusCode === 301 || proxyRes.statusCode === 302) {
      proxyRes.headers.location = '/url/' + encodeURIComponent(proxyRes.headers.location);
    }
  },
  setCookie(proxyRes, req, res) {
    let cookies = proxyRes.headers && proxyRes.headers['set-cookie'] || [];
    let originCookies = res._headers && res._headers['set-cookie'] || [];
    delete proxyRes.headers['set-cookie'];
    res.setHeader('Set-Cookie', cookies.concat(originCookies));
  },
  erudaView(proxyRes, req, res) {
    if (req.query.eruda !== '0'
      && proxyRes.headers
      && proxyRes.headers['content-type']
      && /text\/html/.test(proxyRes.headers['content-type'])) {

      let bufferHelper = new BufferHelper();

      let _end = res.end;
      let _writeHead = res.writeHead;
      let _write = res.write;

      res.writeHead = function () {
        if (proxyRes.headers && proxyRes.headers['content-length']) {
          res.setHeader(
            'content-length',
            parseInt(proxyRes.headers['content-length'], 10) + erudaScriptStr.length
          );
        }

        // This disables chunked encoding
        res.setHeader('transfer-encoding', '');

        // Disable cache for all http as well
        res.setHeader('cache-control', 'no-cache');

        _writeHead.apply(res, arguments);
      };

      res.write = function (data) {
        bufferHelper.concat(data);
      };

      res.end = function () {
        _write.call(res, appendScript(
          changeEncoding(bufferHelper.toBuffer()),
          erudaScriptStr,
        ));

        _end.apply(res, arguments);
      };
    }
  }
};

module.exports = svc;
