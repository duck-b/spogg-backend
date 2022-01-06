var express = require('express');
var request = require('request');
var router = express.Router();
const pool = require('../config/dbconfig');

var AWS = require('aws-sdk');
AWS.config.region = 'ap-northeast-2';

var multer = require('multer');
var multerS3 = require('multer-s3');
var s3 = new AWS.S3();
var storage = multerS3({
  s3: s3,
  bucket : 'store.spo.gg',
  contentType : multerS3.AUTO_CONTENT_TYPE,
  acl : 'public-read',
  metadata: function(req, file, cb){
    cb(null, { fieldName: file.fieldname })
  },
  key : function(req, file, cb){
    cb(null, `user/${Date.now()}_${file.originalname}`)
  }
});
const upload = multer({ storage: storage });
var fs = require('fs');


router.get('/naverapi', function(req, res, next) {
  var client_id = 'YxD7HKQsx5SslP1h4zau';
  var client_secret = 'wucpAPCoLg';

  var api_url = 'https://openapi.naver.com/v1/datalab/shopping/categories';
  var request_body = {
      "startDate": "2017-08-01",
      "endDate": "2017-09-30",
      "timeUnit": "month",
      "category": [
          {"name": "패션의류", "param": ["50000000"]},
          {"name": "화장품/미용", "param": ["50000002"]}
      ],
      "device": "pc",
      "ages": ["20", "30"],
      "gender": "f"
  };
  request.post({
          url: api_url,
          body: JSON.stringify(request_body),
          headers: {
              'X-Naver-Client-Id': client_id,
              'X-Naver-Client-Secret': client_secret,
              'Content-Type': 'application/json'
          }
      },
      function (error, response, body) {
          // console.log(response.statusCode);
          // console.log(body);
          res.send(body)
      });
  
});

router.get('/naverapi/:search' ,function(req, res, next){
  var client_id = 'YxD7HKQsx5SslP1h4zau';
  var client_secret = 'wucpAPCoLg';
  const { search } = req.params
  var api_url = `https://openapi.naver.com/v1/search/shop?query=${encodeURI(search)}&display=10`;
  var options = {
      url: api_url,
      headers: {'X-Naver-Client-Id':client_id, 'X-Naver-Client-Secret': client_secret}
  };
  request.get(options, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      // res.writeHead(200, {'Content-Type': 'text/json;charset=utf-8'});
      res.send(body)
      // res.end(body);
      // console.log(body)
    } else {
      // res.status(response.statusCode).end();
      // console.log('error = ' + response.statusCode);
    }
  });
})

module.exports = router;
