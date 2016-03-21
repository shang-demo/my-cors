var request = require('request');
var fs = require('fs');

var formData = {
  Filedata: fs.createReadStream(__dirname + '/1.torrent')
};

request.post({
  url: 'http://localhost:9000/?proxyTo=http://iuser.coding.io/api/v1/login',
  body: {
    username: 'shang',
    password: ''
  },
  json: true
}, function(err, httpResponse, body) {
  if(err) {
    return console.error('upload failed:', err);
  }
  console.log(body);
});

request.post({
  url: 'http://localhost:9000/?proxyTo=http://tool.idanmu.net/uploadify.php',
  formData: formData
}, function(err, httpResponse, body) {
  if(err) {
    return console.error(err);
  }
  console.log(body);
});

request.get({
  url: 'http://localhost:9000/?proxyTo=http://proxy.xinshangshangxin.com/'
}, function(err, httpResponse, body) {
  if(err) {
    return console.error(err);
  }
  console.log(body);
});
