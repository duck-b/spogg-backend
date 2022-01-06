var express = require('express');
var router = express.Router();
const pool = require('../config/dbconfig');

var AWS = require('aws-sdk');
AWS.config.region = 'ap-northeast-2';

var fs = require('fs');

// /* GET users listing. */
router.get('/:boardNo', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const query = `SELECT a.*, u.user_name AS recommentUser_name
                    FROM (SELECT bc.board_no, bc.boardComment_no, u.user_no, u.user_name, u.user_profile, 
                          bc.boardComment_content, bc.boardRecomment_no, bc.boardRecomment_user, bc.deleted_at, bc.created_at 
                            FROM s_boardComment AS bc
                              LEFT JOIN s_user AS u
                              ON bc.user_no = u.user_no
                            WHERE bc.board_no = ?) AS a
                      LEFT JOIN s_user AS u ON u.user_no = a.boardRecomment_user ORDER BY boardRecomment_no, created_at;`;
    conn.query(query, [req.params.boardNo], (e, rows) => {
      if (e) throw e;
      res.send(rows);
    })
    conn.release();
  })
});

router.get('/:boardNo/:userKey', function(req, res, next) {
  const sess = req.session;
  let user = sess[req.params.userKey] 
  ? sess[req.params.userKey]
  : {user_no: '', user_profile: '', user_name: ''};
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const query = `SELECT a.*, br.boardRating_rating
                  FROM (SELECT a.*, u.user_name AS recommentUser_name
                      FROM (SELECT bc.board_no, bc.boardComment_no, u.user_no, u.user_name, u.user_profile, 
                            bc.boardComment_content, bc.boardRecomment_no, bc.boardRecomment_user, bc.deleted_at, bc.created_at 
                              FROM s_boardComment AS bc
                                LEFT JOIN s_user AS u
                                ON bc.user_no = u.user_no
                              WHERE bc.board_no = ?) AS a
                        LEFT JOIN s_user AS u ON u.user_no = a.boardRecomment_user) AS a
                  LEFT JOIN s_boardRating AS br
                  ON a.boardComment_no = br.boardComment_no ORDER BY boardRecomment_no, created_at`;
    conn.query(query, [req.params.boardNo], (e, rows) => {
      if (e) throw e;
      res.send({comments: rows, user: user});
    })
    conn.release();
  })
});

router.post('/', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const { board_no, user_no, comment, recomment_no, recomment_user } = req.body;
    let query = "BEGIN;";
    if(recomment_user){
      query += `INSERT INTO s_boardComment (board_no, user_no, boardComment_content, boardRecomment_no, boardRecomment_user) VALUES (?, ?, ?, ${recomment_no}, ${recomment_user});`;
    }else{
      query += `INSERT INTO s_boardComment (board_no, user_no, boardComment_content, boardRecomment_no)
                SELECT ?, ?, ?, AUTO_INCREMENT FROM information_schema.tables WHERE table_name = 's_boardComment' AND table_schema = DATABASE();`
    }
    query += `SELECT a.*, br.boardRating_rating
              FROM (SELECT a.*, u.user_name AS recommentUser_name
                  FROM (SELECT bc.board_no, bc.boardComment_no, u.user_no, u.user_name, u.user_profile, 
                        bc.boardComment_content, bc.boardRecomment_no, bc.boardRecomment_user, bc.deleted_at, bc.created_at 
                          FROM s_boardComment AS bc
                            LEFT JOIN s_user AS u
                            ON bc.user_no = u.user_no
                          WHERE bc.board_no = ?) AS a
                    LEFT JOIN s_user AS u ON u.user_no = a.boardRecomment_user) AS a
              LEFT JOIN s_boardRating AS br
              ON a.boardComment_no = br.boardComment_no ORDER BY boardRecomment_no, created_at;
              COMMIT;`
    conn.query(query, [board_no, user_no, comment, board_no], (e, rows) => {
      if (e) throw e;
      res.send(rows[2]);
    })
    conn.release();
  })
});

router.post('/delete', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const query = `UPDATE s_boardComment SET deleted_at = NOW() WHERE boardComment_no = ? AND user_no = ?`;
    conn.query(query, [req.body.comment_no, req.body.user_no], (e, rows) => {
      if (e) throw e;
      res.send(rows);
    })
    conn.release();
  })
});

router.post('/column', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const { board_no, user_no, comment, rating, recomment_no, recomment_user } = req.body;
    let query = "BEGIN;";
    if(recomment_user){
      query += `INSERT INTO s_boardComment (board_no, user_no, boardComment_content, boardRecomment_no, boardRecomment_user) VALUES (?, ?, ?, ${recomment_no}, ${recomment_user});`;
    }else{
      query += `INSERT INTO s_boardComment (board_no, user_no, boardComment_content, boardRecomment_no)
                SELECT ?, ?, ?, AUTO_INCREMENT FROM information_schema.tables WHERE table_name = 's_boardComment' AND table_schema = DATABASE();
                INSERT INTO s_boardRating (boardComment_no, boardRating_rating) SELECT MAX(boardComment_no), ${rating} FROM s_boardComment;`
    }
    query += `SELECT a.*, br.boardRating_rating
              FROM (SELECT a.*, u.user_name AS recommentUser_name
                  FROM (SELECT bc.board_no, bc.boardComment_no, u.user_no, u.user_name, u.user_profile, 
                        bc.boardComment_content, bc.boardRecomment_no, bc.boardRecomment_user, bc.deleted_at, bc.created_at 
                          FROM s_boardComment AS bc
                            LEFT JOIN s_user AS u
                            ON bc.user_no = u.user_no
                          WHERE bc.board_no = ?) AS a
                    LEFT JOIN s_user AS u ON u.user_no = a.boardRecomment_user) AS a
              LEFT JOIN s_boardRating AS br
              ON a.boardComment_no = br.boardComment_no ORDER BY boardRecomment_no, created_at;
              COMMIT;`
    conn.query(query, [board_no, user_no, comment, board_no], (e, rows) => {
      if (e) throw e;
      res.send(rows[rows.length - 2]);
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
