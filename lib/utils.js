const iconv = require('iconv-lite');

const svc = {
  /**
   * 转换编码
   * @param data  buffer
   * @param [encoding] 编码,默认utf8
   * @param [noCheck]  默认检测编码(gbk)进行转换
   */
  changeEncoding: function (data, encoding, noCheck) {
    var val = iconv.decode(data, encoding || 'utf8');
    if (!noCheck && encoding !== 'gbk' && val.indexOf('�') !== -1) {
      val = iconv.decode(data, 'gbk');
    }
    return val;
  },
  appendScript: function (str, scriptStr) {
    if (/(<head.*?>)/.test(str)) {
      logger.info('head match');
      str = str.replace(RegExp.$1, RegExp.$1 + scriptStr);
    }
    else if (/<body.*?>/.test(str)) {
      logger.info('modifyHtml body match');
      str = str.replace(RegExp.$1, RegExp.$1 + scriptStr);
    }
    else if (/<html.*?>/.test(str)) {
      logger.info('modifyHtml html match');
      str = str.replace(RegExp.$1, RegExp.$1 + scriptStr);
    }
    else {
      logger.info('not find html or body');
    }
    return str;
  }
};

module.exports = svc;