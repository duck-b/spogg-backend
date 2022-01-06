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

router.get('/:userKey', function(req, res, next) {
    let sess = req.session;
    if(sess[req.params.userKey]){
      res.send(sess[req.params.userKey])
    }else{
      delete sess[req.params.userKey];
      res.send(null)
    }
});

router.post('/follow', function(req, res, next) {
  let sess = req.session;
  const { followUser, followerUser, follow } = req.body;
  if(sess[followerUser]){
    pool.getConnection((err, conn) => {
      if (err) {
        throw err;
      }
      let query;
      if(follow === 'insert'){
        query = `INSERT INTO s_userFollower (userFollow_follower, userFollow_follow) VALUES (?, ?);`;
      }else if(follow === 'delete'){
        query = `DELETE FROM s_userFollower WHERE userFollow_follower = ? AND userFollow_follow = ?;`;
      }
      conn.query(query, [sess[followerUser].user_no, followUser],(e, rows) => {
        if (e) throw e;
        res.send({result: 1, thisUser: sess[followerUser].user_no});
      })
      conn.release();
    })
  }else{
    res.send({result: 0})
  }
});

router.post('/question', upload.single('imgFile'), function(req, res, next){
  let sess = req.session;
  const { title, content, userKey } = req.body;
  if(sess[userKey]){
    pool.getConnection((err, conn) => {
      if (err) {
        throw err;
      }
      let userQuestion_image = '';
      if(req.file){
        userQuestion_image = req.file.location; 
      }
      let query = `INSERT INTO s_userQuestion (user_no, userQuestion_title, userQuestion_content, userQuestion_image) VALUES (?, ?, ?, ?);`;
      conn.query(query, [sess[userKey].user_no, title, content, userQuestion_image],(e, row) => {
        if (e) throw e;
        if(row){
          res.send({result: 1});
        }else{
          res.send({result: 0});
        }
      })
      conn.release();
    })
  }else{
    res.send({result: 0});
  }
});

router.get('/:userKey/userStatus', function(req, res, next){
  let sess = req.session;
  const { userKey } = req.params;
  if(sess[userKey]){
    res.send({userStatus: sess[userKey].user_status});
  }else{
    res.send({userStatus: 0});
  }
});

router.get('/:userKey/update', function(req, res, next){
  let sess = req.session;
  const { userKey } = req.params;
  if(sess[userKey]){
    pool.getConnection((err, conn) => {
      if (err) {
        throw err;
      }
      let query = `SELECT u.user_name, u.user_email, u.user_phone, u.user_profile, ua.userAgree_status FROM s_user AS u LEFT JOIN s_userAgree AS ua ON u.user_no = ua.user_no AND ua.agree_no = 3 WHERE u.user_no = ${sess[userKey].user_no}`;
      conn.query(query,(e, row) => {
        if (e) throw e;
        if(row[0]){
          res.send({value: row[0], result: 1});
        }else{
          res.send({result: 0});
        }
      })
      conn.release();
    })
  }else{
    res.send({result: 0});
  }
});

router.post('/:userKey/update', upload.single('imgFile'), function(req, res, next){
  let sess = req.session;
  const { userKey } = req.params;
  const { userName, userPhone, userPromotion } = req.body;
  const userAgree_status = userPromotion === 'true' ? 1 : 0;
  if(sess[userKey]){
    pool.getConnection((err, conn) => {
      if (err) {
        throw err;
      }
      let backQuery = '';
      if(req.file){
        backQuery = `, user_profile = '${req.file.location}'`;
        sess[userKey].user_profile = req.file.location;
      }
      let query = `BEGIN;
        UPDATE s_user SET user_name = ?, user_phone = ? ${backQuery} WHERE user_no = ${sess[userKey].user_no};
        UPDATE s_userAgree SET userAgree_status = ? WHERE user_no = ${sess[userKey].user_no} AND agree_no = 3;
        COMMIT;`;
      conn.query(query, [userName, userPhone, userAgree_status],(e, row) => {
        if (e) throw e;
        if(row[0]){
          sess[userKey].user_name = userName;
          res.send({result: 1, userNo: sess[userKey].user_no});
        }else{
          res.send({result: 0});
        }
      })
      conn.release();
    })
  }else{
    res.send({result: 0});
  }
});

router.get('/:userKey/sport', function(req, res, next){
  let sess = req.session;
  const { userKey } = req.params;
  if(sess[userKey]){
    pool.getConnection((err, conn) => {
      if (err) {
        throw err;
      }
      let query = `SELECT s.sport_no, s.sport_name, us.sport_favorite FROM s_sport AS s LEFT JOIN s_userSport AS us ON s.sport_no = us.sport_no AND us.user_no = ${sess[userKey].user_no}`;
      conn.query(query,(e, rows) => {
        if (e) throw e;
        if(rows[0]){
          res.send({value: rows, result: 1});
        }else{
          res.send({result: 0});
        }
      })
      conn.release();
    })
  }else{
    res.send({result: 0});
  }
});

router.post('/:userKey/sport', function(req, res, next){
  let sess = req.session;
  const { userKey } = req.params;
  const { sports, sportFavorite } = req.body;
  if(sess[userKey] && sports){
    pool.getConnection((err, conn) => {
      if (err) {
        throw err;
      }
      
      let query = `BEGIN;`
      for(let i = 0; i<sports.length; i++){
        if(sports[i].sportCheck){
          query += `INSERT INTO s_userSport (user_no, sport_no) VALUES (${sess[userKey].user_no}, ${sports[i].sportNo});`
          if(sess[userKey].user_sport){
            sess[userKey].user_sport += `,${sports[i].sportNo}`;
          }else{
            sess[userKey].user_sport += sports[i].sportNo;
          }
        }else{
          query += `DELETE FROM s_userSport WHERE user_no = ${sess[userKey].user_no} AND sport_no = ${sports[i].sportNo};`
          sess[userKey].user_sport = `,${sess[userKey].user_sport},`;
          sess[userKey].user_sport = sess[userKey].user_sport.replace(`,${sports[i].sportNo},`,',');
          sess[userKey].user_sport = sess[userKey].user_sport.substr(1);
          sess[userKey].user_sport = sess[userKey].user_sport.substr(0, sess[userKey].user_sport.length-1);
        }
      }
      query += `UPDATE s_userSport SET sport_favorite = 0 WHERE user_no = ${sess[userKey].user_no};`
      query += `UPDATE s_userSport SET sport_favorite = 1 WHERE user_no = ${sess[userKey].user_no} AND sport_no = ${sportFavorite.sportNo};`
      query += `COMMIT;`;
      conn.query(query,(e, row) => {
        if (e) throw e;
        if(row[0]){
          res.send({result: 1, userNo: sess[userKey].user_no});
        }else{
          res.send({result: 0});
        }
      })
      conn.release();
    })
  }else{
    res.send({result: 0});
  }
});

router.get('/:userNo/:userKey', function(req, res, next) {
  let sess = req.session;
  const {userNo, userKey} = req.params;
  let query = '';
  const thisUser = sess[userKey] ? sess[userKey].user_no : 0;
  if(thisUser === userNo){
    query = `
            SET SESSION group_concat_max_len = 10000;
              SELECT a.*, COUNT(uf.userFollow_follower) AS count_follow
              FROM (SELECT a.*, COUNT(uf.userFollow_follow) AS count_follower
                FROM (SELECT u.user_no, u.user_profile, u.user_name, u.user_status, GROUP_CONCAT(s.sport_name) AS sport_name, GROUP_CONCAT(us.sport_favorite) AS sport_favorite, GROUP_CONCAT(s.sport_icon) AS sport_icon, GROUP_CONCAT(CASE WHEN us.sport_favorite = 1 THEN s.sport_background END) AS sport_background
                  FROM s_user AS u 
                  INNER JOIN s_userSport AS us 
                  INNER JOIN s_sport AS s
                  ON u.user_no = us.user_no AND us.sport_no = s.sport_no
                  WHERE u.user_no = ${thisUser} AND u.deleted_at IS NULL
                  GROUP BY u.user_no) AS a
                LEFT JOIN s_userFollower AS uf
                ON a.user_no = uf.userFollow_follow
                GROUP BY a.user_no) AS a
              LEFT JOIN s_userFollower AS uf
              ON a.user_no = uf.userFollow_follower
              GROUP BY a.user_no;
              `;
  }else{
    query = `
              SET SESSION group_concat_max_len = 10000;
              SELECT a.*, uf.created_at AS user_follow
              FROM (SELECT a.*, COUNT(uf.userFollow_follower) AS count_follow
              FROM (SELECT a.*, COUNT(uf.userFollow_follow) AS count_follower
                FROM (SELECT u.user_no, u.user_profile, u.user_name, u.user_status, GROUP_CONCAT(s.sport_name) AS sport_name, GROUP_CONCAT(us.sport_favorite) AS sport_favorite, GROUP_CONCAT(s.sport_icon) AS sport_icon, GROUP_CONCAT(CASE WHEN us.sport_favorite = 1 THEN s.sport_background END) AS sport_background
                  FROM s_user AS u 
                  INNER JOIN s_userSport AS us 
                  INNER JOIN s_sport AS s
                  ON u.user_no = us.user_no AND us.sport_no = s.sport_no
                  WHERE u.user_no = ${userNo} AND u.deleted_at IS NULL
                  GROUP BY u.user_no) AS a
                LEFT JOIN s_userFollower AS uf
                ON a.user_no = uf.userFollow_follow
                GROUP BY a.user_no) AS a
              LEFT JOIN s_userFollower AS uf
              ON a.user_no = uf.userFollow_follower
              GROUP BY a.user_no) AS a
              LEFT JOIN s_userFollower AS uf
              ON a.user_no = uf.userFollow_follow AND uf.userFollow_follower = ${thisUser};`;
  }
  
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    conn.query(query,(e, row) => {
      if (e) throw e;
      if(row[1]){
        res.send({value: row[1][0], result: thisUser == userNo ? 2 : 1});
      }else{
        res.send({result: 0});
      }
    })
    conn.release();
  })
});

/*
router.get('/put', function(req, res, next) {
  var s3 = new AWS.S3();
  var params = {
    'Bucket' : 'store.spo.gg',
    'Key' : 'upload_test.png',
    'ACL' : 'public-read',
    'Body' : fs.createReadStream('public/images/test.png'),
    'ContentType' : 'image/png'
  }
  s3.upload(params, function(err, data){
    res.send(data);
  });
});*/
/* 서버로 다운로드
router.get('/get', function(req, res, next){
  var s3 = new AWS.S3();
  var file = fs.createWriteStream('logo.png');
  var params = {
    'Bucket' : 'store.spogg.kr',
    'Key' : 'logo.png'
  }
  s3.getObject(params).createReadStream().pipe(file);
  res.send('hello');
});
*/
module.exports = router;
