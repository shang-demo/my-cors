'use strict';
/* jshint -W100 */

var iconv = require('iconv-lite');

module.exports = {
  /**
   * 转换编码
   * @param data  buffer
   * @param [encoding] 编码,默认utf8
   * @param [noCheck]  默认检测编码(gbk)进行转换
   */
  changeEncoding: function(data, encoding, noCheck) {
    var val = iconv.decode(data, encoding || 'utf8');
    if(!noCheck && encoding !== 'gbk' && val.indexOf('�') !== -1) {
      val = iconv.decode(data, 'gbk');
    }
    return val;
  }
};