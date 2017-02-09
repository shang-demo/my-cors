require('./config/init.js');

const BufferHelper = require('bufferhelper');
const cors = require('cors')();
const fs = require('fs');
const http = require('http');
const path = require('path');
const url = require('url');

const indexHTML = fs.readFileSync(path.join(__dirname, './index.html'));
const utilities = require('./utilities.js');
const httpProxy = require('./framework/http-proxy/index.js');

process.on('uncaughtException', function (err) {
  console.error('Error caught in uncaughtException event:', err);
});

const erudaScript = '<script src="//static.xinshangshangxin.com/eruda/1.0.5/eruda.min.js"></script><script>eruda.init();</script>';

const proxy = httpProxy.createProxyServer({});
proxy.on('proxyReq', function (proxyReq, req, res, options) {
});

proxy.on('proxyRes', function (proxyRes, req, res) {
  if (proxyRes.statusCode === 301 || proxyRes.statusCode === 302) {
    proxyRes.headers.location = '/url/' + encodeURIComponent(proxyRes.headers.location);
  }

  let cookies = proxyRes.headers && proxyRes.headers['set-cookie'] || [];
  let originCookies = res._headers && res._headers['set-cookie'] || [];
  delete proxyRes.headers['set-cookie'];
  res.setHeader('Set-Cookie', cookies.concat(originCookies));

  if (!req.query.disableDebug
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
          parseInt(proxyRes.headers['content-length'], 10) + erudaScript.length
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
      _write.call(res, modifyHtml(utilities.changeEncoding(bufferHelper.toBuffer())));
      _end.apply(res, arguments);
    };
  }
});


// /url/:url

const server = http.createServer(function (req, res) {
  cors(req, res, function () {
    console.log('\n');
    if (req.url === '/') {
      res.writeHead(200, {
        'Content-Type': 'text/html'
      });
      return res.end(indexHTML);
    }

    // leancloud不使用云函数和Hook
    if (req.url === '/1.1/functions/_ops/metadatas') {
      res.writeHead(404, {
        'Content-Type': 'text/html'
      });
      return res.end('');
    }

    let redirectAbsoluteUrl = getStartUrl(req, res);
    console.log('startUrl', redirectAbsoluteUrl);
    if (!redirectAbsoluteUrl || !/^http/.test(redirectAbsoluteUrl)) {
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

    if (!req.query.disableDebug) {
      req.headers = req.headers || {};
      req.headers['accept-encoding'] = null;
    }

    return proxy.web(req, res, {
      target: redirectAbsoluteUrl,
      changeOrigin: true,
      secure: false
    });

    // // TODO: 加入代理
    // return proxy.web(req, res, {
    //   target: 'http://120.26.89.195:80',
    //   changeOrigin: true,
    //   secure: false,
    //   proxyTo: queryObject.proxyTo
    // });
  });
});

proxy.on('error', function (err, req, res) {
  res.writeHead(500, {
    'Content-Type': 'text/json'
  });
  res.end(JSON.stringify(err));
});


function modifyHtml(str) {
  if (/(<head.*?>)/.test(str)) {
    console.log('modifyHtml head match');
    str = str.replace(RegExp.$1, RegExp.$1 + erudaScript);
  }
  else if (/<body.*?>/.test(str)) {
    console.log('modifyHtml body match');
    str = str.replace(RegExp.$1, RegExp.$1 + erudaScript);
  }
  else if (/<html.*?>/.test(str)) {
    console.log('modifyHtml html match');
    str = str.replace(RegExp.$1, RegExp.$1 + erudaScript);
  }
  else {
    console.log('not find html or body');
  }
  return str;
}

function getAbsUrl(url, base) {
  if (!base) {
    return url;
  }

  if (!url) {
    return base;
  }
  else if (/^[a-z][-+\.a-z0-9]*:/i.test(url)) {
    // The scheme actually could contain any kind of alphanumerical unicode
    // character, but JavaScript regular expressions don't support unicode
    // character classes. Maybe /^[^:]+:/ or even /^.*:/ would be sufficient?
    return url;
  }
  else if (url.slice(0, 2) === '//') {
    return /^[^:]+:/.exec(base)[0] + url;
  }

  let ch = url.charAt(0);
  if (ch === '/') {
    if (/^file:/i.test(base)) {
      // file scheme has no hostname
      return 'file://' + url;
    }
    else {
      return /^[^:]+:\/*[^\/]+/i.exec(base)[0] + url;
    }
  }
  else if (ch === '#') {
    // assume "#" only occures at the end indicating the fragment
    return base.replace(/#.*$/, '') + url;
  }
  else if (ch === '?') {
    // assume "?" and "#" only occure at the end indicating the query
    // and the fragment
    return base.replace(/[\?#].*$/, '') + url;
  }
  else {
    let base, path;
    if (/^file:/i.test(base)) {
      base = "file://";
      path = base.replace(/^file:\/{0,2}/i, '');
    }
    else {
      let match = /^([^:]+:\/*[^\/]+)(\/.*?)?(\?.*?)?(#.*)?$/.exec(base);
      base = match[1];
      path = match[2] || "/";
    }

    path = path.split("/");
    path.pop();
    if (path.length === 0) {
      // Ensure leading "/". Of course this is only valid on
      // unix like filesystems. More magic would be needed to
      // support other filesystems.
      path.push("");
    }
    path.push(url);
    return base + path.join("/");
  }
}

function getStartUrl(req, res) {
  req.cookies = {};
  (req.headers.cookie && req.headers.cookie.split(';') || []).reduce(function (oldValue, Cookie) {
    let parts = Cookie.split('=');
    oldValue[parts[0].trim()] = decodeURIComponent(( parts[1] || '' ).trim());
    return oldValue;
  }, req.cookies);

  console.info('req.cookies: ', req.cookies);

  req.query = url.parse(req.url, true).query;

  let startUrl = '';
  if (/\/url\/([^\/]+)/.test(req.url)) {
    let u = decodeURIComponent(RegExp.$1);
    if (/^http/.test(u)) {
      console.log('use queryString startUrl', u);
      startUrl = u;
    }
  }

  if (!startUrl) {
    console.log('use cookie startUrl', decodeURIComponent(req.cookies.startUrl || ''));
    startUrl = decodeURIComponent(req.cookies.startUrl || '');
  }

  let expires = new Date();
  expires.setDate(expires.getDate() + 1);
  let cookieInfo = ['startUrl=' + encodeURIComponent(startUrl) + '; Expires=' + expires.toISOString() + '; path=/; HttpOnly'];
  res.setHeader('Set-Cookie', cookieInfo);


  let redirectUri = req.url.replace(/.*\/url\//, '');
  if (/^http/.test(redirectUri)) {
    redirectUri = redirectUri.replace(/^[^\/]*/, '');
  }
  console.log('redirectUri', redirectUri);
  return getAbsUrl(redirectUri, startUrl);
}

const port = config.env.port || 1337;
const ip = config.env.ip;
server.listen(port, ip);
console.log('server listen on: ', 'http://' + (ip || 'localhost') + ':' + port);