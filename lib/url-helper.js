
const svc = {
  absoluteUrl: function (url, base) {
    if (!base) {
      return url;
    }

    if (!url) {
      return base;
    }
    else if (/^[a-z][-+\.a-z0-9]*:/i.test(url)) {
      return url;
    }
    else if (url.slice(0, 2) === '//') {
      return /^[^:]+:/.exec(base)[0] + url;
    }

    let ch = url.charAt(0);
    if (ch === '/') {
      if (/^file:/i.test(base)) {
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
      let path;
      if (/^file:/i.test(base)) {
        path = base.replace(/^file:\/{0,2}/i, '');
        base = 'file://';
      }
      else {
        let match = /^([^:]+:\/*[^\/]+)(\/.*?)?(\?.*?)?(#.*)?$/.exec(base);
        base = match[1];
        path = match[2] || '/';
      }

      path = path.split('/');
      path.pop();
      if (path.length === 0) {
        path.push('');
      }
      path.push(url);
      return base + path.join('/');
    }
  },
  getRedirectUrl: function (req, res) {
    let endpoint = '';
    if (/\/url\/([^\/]+)/.test(req.url)) {
      let u = decodeURIComponent(RegExp.$1);
      if (/^http/.test(u)) {
        logger.info('use queryString endpoint', u);
        endpoint = u;
      }
    }

    if (!endpoint) {
      logger.info('use cookie endpoint', decodeURIComponent(req.cookies.endpoint || ''));
      endpoint = decodeURIComponent(req.cookies.endpoint || '');
    }

    let expires = new Date();
    expires.setDate(expires.getDate() + 1);
    let cookieInfo = ['endpoint=' + encodeURIComponent(endpoint) + '; Expires=' + expires.toISOString() + '; path=/; HttpOnly'];
    res.setHeader('Set-Cookie', cookieInfo);

    let redirectUri = req.url.replace(/.*\/url\//, '');
    if (/^http/.test(redirectUri)) {
      redirectUri = redirectUri.replace(/^[^\/]*/, '');
    }

    logger.info('redirectUri', redirectUri);
    return svc.absoluteUrl(redirectUri, endpoint);
  },
};

module.exports = svc;