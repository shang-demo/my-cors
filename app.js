require('./config/init.js');

var BufferHelper = require('bufferhelper');
var cors = require('cors')();
var fs = require('fs');
var http = require('http');
var path = require('path');
var url = require('url');

var indexHTML = fs.readFileSync(path.join(__dirname, './index.html'));
var utilities = require('./utilities.js');
var httpProxy = require('./framework/http-proxy/index.js');

process.on('uncaughtException', function(err) {
  console.error('Error caught in uncaughtException event:', err);
});

// var erudaStr = './eruda.min.js';
// var addStr = '<script>' + fs.readFileSync(erudaStr) + '</script><script>eruda.init();</script>';
var addStr = '<script src="//static.xinshangshangxin.com/eruda/1.0.5/eruda.min.js"></script><script>eruda.init();</script>';

var proxy = httpProxy.createProxyServer({});
proxy.on('proxyReq', function (proxyReq, req, res, options) {
});

proxy.on('proxyRes', function (proxyRes, req, res) {
  if (proxyRes.statusCode === 301 || proxyRes.statusCode === 302) {
    proxyRes.headers.location = '/url/' + encodeURIComponent(proxyRes.headers.location);
  }

  var cookies = proxyRes.headers && proxyRes.headers['set-cookie'] || [];
  var originCookies = res._headers && res._headers['set-cookie'] || [];
  delete proxyRes.headers['set-cookie'];
  res.setHeader('Set-Cookie', cookies.concat(originCookies));

  if (!req.query.disableDebug
    && proxyRes.headers
    && proxyRes.headers['content-type']
    && /text\/html/.test(proxyRes.headers['content-type'])) {

    var bufferHelper = new BufferHelper();

    var _end = res.end;
    var _writeHead = res.writeHead;
    var _write = res.write;

    res.writeHead = function () {
      if (proxyRes.headers && proxyRes.headers['content-length']) {
        res.setHeader(
          'content-length',
          parseInt(proxyRes.headers['content-length'], 10) + addStr.length
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

var server = http.createServer(function (req, res) {
  cors(req, res, function () {
    console.log('\n');
    if (req.url === '/') {
      res.writeHead(200, {
        'Content-Type': 'text/html'
      });
      return res.end(indexHTML);
    }

    // leancloud不使用云函数和Hook
    if(req.url === '/1.1/functions/_ops/metadatas') {
      res.writeHead(404, {
        'Content-Type': 'text/html'
      });
      return res.end('');
    }

    var redirectAbsoluteUrl = getStartUrl(req, res);
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


function getRedirectAbsoluteUrl(req, startUrl) {
  if (!startUrl) {
    console.log('no startUrl, try to get from req.headers.referer');

    var referer = (req.headers || {}).referer || '';
    if (!referer) {
      console.log('no startUrl from url, cookie and req.headers.referer');
      return false;
    }

    startUrl = referer;

    // var referUrlParse = url.parse(referer, true);
    // var refererObj = referUrlParse.query;
    // startUrl = referUrlParse.protocol + '//' + referUrlParse.host + '?' + (refererObj.disableDebig ? 'disableDebug=1&' : '');
  }

  var redirectUri = req.url;
  if (/\/url\/([^\/]+)/.test(redirectUri)) {
    redirectUri = redirectUri.replace(/\/url\/([^\/]+)\/?/, '');
  }

  console.log('redirectUri', redirectUri, 'startUrl', startUrl);

  return getAbsUrl(redirectUri, startUrl);
}

function modifyHtml(str) {
  if (/(<head.*?>)/.test(str)) {
    console.log('modifyHtml head match');
    str = str.replace(RegExp.$1, RegExp.$1 + addStr);
  }
  else if (/<body.*?>/.test(str)) {
    console.log('modifyHtml body match');
    str = str.replace(RegExp.$1, RegExp.$1 + addStr);
  }
  else if (/<html.*?>/.test(str)) {
    console.log('modifyHtml html match');
    str = str.replace(RegExp.$1, RegExp.$1 + addStr);
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
  } else if (/^[a-z][-+\.a-z0-9]*:/i.test(url)) {
    // The scheme actually could contain any kind of alphanumerical unicode
    // character, but JavaScript regular expressions don't support unicode
    // character classes. Maybe /^[^:]+:/ or even /^.*:/ would be sufficient?
    return url;
  } else if (url.slice(0, 2) === '//') {
    return /^[^:]+:/.exec(base)[0] + url;
  }

  var ch = url.charAt(0);
  if (ch === '/') {
    if (/^file:/i.test(base)) {
      // file scheme has no hostname
      return 'file://' + url;
    } else {
      return /^[^:]+:\/*[^\/]+/i.exec(base)[0] + url;
    }
  } else if (ch === '#') {
    // assume "#" only occures at the end indicating the fragment
    return base.replace(/#.*$/, '') + url;
  } else if (ch === '?') {
    // assume "?" and "#" only occure at the end indicating the query
    // and the fragment
    return base.replace(/[\?#].*$/, '') + url;
  } else {
    var base, path;
    if (/^file:/i.test(base)) {
      base = "file://";
      path = base.replace(/^file:\/{0,2}/i, '');
    } else {
      var match = /^([^:]+:\/*[^\/]+)(\/.*?)?(\?.*?)?(#.*)?$/.exec(base);
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
    var parts = Cookie.split('=');
    oldValue[parts[0].trim()] = decodeURIComponent(( parts[1] || '' ).trim());
    return oldValue;
  }, req.cookies);

  console.info('req.cookies: ', req.cookies);

  req.query = url.parse(req.url, true).query;

  var startUrl = '';
  if (/\/url\/([^\/]+)/.test(req.url)) {
    var u = decodeURIComponent(RegExp.$1);
    if (/^http/.test(u)) {
      console.log('use queryString startUrl', u);
      startUrl = u;
    }
  }

  if(!startUrl) {
    console.log('use cookie startUrl', decodeURIComponent(req.cookies.startUrl || ''));
    startUrl = decodeURIComponent(req.cookies.startUrl || '');
  }

  var expires = new Date();
  expires.setDate(expires.getDate() + 1);
  var cookieInfo = ['startUrl=' + encodeURIComponent(startUrl) + '; Expires=' + expires.toISOString() + '; path=/; HttpOnly'];
  res.setHeader('Set-Cookie', cookieInfo);


  var redirectUri = req.url.replace(/.*\/url\//, '');
  if (/^http/.test(redirectUri)) {
    redirectUri = redirectUri.replace(/^[^\/]*/, '');
  }
  console.log('redirectUri', redirectUri);
  return getAbsUrl(redirectUri, startUrl);
}

var port = config.env.port || 1337;
var ip = config.env.ip;
server.listen(port, ip);
console.log('server listen on: ', 'http://' + (ip || 'localhost') + ':' + port);