require('./config/init.js');

var BufferHelper = require('bufferhelper');
var cors = require('cors')();
var fs = require('fs');
var http = require('http');
var url = require('url');

var utilities = require('./utilities.js');
var httpProxy = require('./framework/http-proxy/index.js');

// var erudaStr = './eruda.min.js';
// var addStr = '<script>' + fs.readFileSync(erudaStr) + '</script><script>eruda.init();</script>';
var addStr = '<script src="http://upload.xinshangshangxin.com/eruda.min.js"></script><script>eruda.init();</script>';

var proxy = httpProxy.createProxyServer({});
proxy.on('proxyReq', function(proxyReq, req, res, options) {
});

proxy.on('proxyRes', function(proxyRes, req, res) {
  if(req.query.debug
    && proxyRes.headers
    && proxyRes.headers['content-type']
    && /text\/html/.test(proxyRes.headers['content-type'])) {

    var bufferHelper = new BufferHelper();

    var _end = res.end;
    var _writeHead = res.writeHead;
    var _write = res.write;

    res.writeHead = function() {
      if(proxyRes.headers && proxyRes.headers['content-length']) {
        res.setHeader(
          'content-length',
          parseInt(proxyRes.headers['content-length'], 10) + addStr.length
        );
      }

      // This disables chunked encoding
      res.setHeader('transfer-encoding', '');

      // Disable cache for all http as well
      res.setHeader('cache-control', 'no-cache');

      _writeHead.apply(this, arguments);
    };

    res.write = function(data) {
      bufferHelper.concat(data);
    };

    res.end = function() {
      _write.call(res, modifyHtml(utilities.changeEncoding(bufferHelper.toBuffer())));
      _end.apply(this, arguments);
    };
  }
});

var server = http.createServer(function(req, res) {
  cors(req, res, function() {

    var queryObject = url.parse(req.url, true).query;
    req.query = queryObject;

    if(!queryObject.proxyTo) {
      var redirectTo = parseReferToRedirect(req);
      if(!redirectTo) {
        res.writeHead(400, {
          'Content-Type': 'text/json'
        });
        return res.end(JSON.stringify({
          code: 400,
          msg: 'need query proxyTo'
        }));
      }

      queryObject.proxyTo = redirectTo;
      console.log('redirectTo: ', redirectTo);
      res.writeHead(301, {
        Location: redirectTo
      });
      res.end();
      return
    }

    if(queryObject.debug) {
      req.headers = req.headers || {};
      req.headers['accept-encoding'] = null;
    }

    queryObject.proxyTo = /^http/.test(queryObject.proxyTo) ? queryObject.proxyTo : 'http://' + queryObject.proxyTo;

    queryObject.proxyTo = encodeURI(queryObject.proxyTo);
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


function parseReferToRedirect(req) {
  var referUrlParse = url.parse((req.headers || {}).referer || '', true);
  var refererObj = referUrlParse.query;

  refererObj.proxyTo = /^http/.test(refererObj.proxyTo) ? refererObj.proxyTo : 'http://' + refererObj.proxyTo;

  var originObj = url.parse(refererObj.proxyTo || '', true);
  if(!originObj.protocol || !originObj.host || originObj.host === 'undefined' || !req.url) {
    return false;
  }
  return referUrlParse.protocol + '//' + referUrlParse.host + '?' + (refererObj.debug ? 'debug=1&' : '') + 'proxyTo=' + encodeURIComponent(originObj.protocol + '//' + originObj.host + req.url);
}

function modifyHtml(str) {
  if(/(<head.*?>)/.test(str)) {
    console.log('head match');
    str = str.replace(RegExp.$1, RegExp.$1 + addStr);
  }
  else if(/<body.*?>/.test(str)) {
    console.log('body match');
    str = str.replace(RegExp.$1, RegExp.$1 + addStr);
  }
  else if(/<html.*?>/.test(str)) {
    console.log('html match');
    str = str.replace(RegExp.$1, RegExp.$1 + addStr);
  }
  else {
    console.log('not find html or body');
  }
  return str;
}


var port = config.env.port || 1337;
var ip = config.env.ip || null;
server.listen(port, ip);