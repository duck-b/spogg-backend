var express = require('express');
var router = express.Router();
const pool = require('../../config/dbconfig');
const cookieParser = require('cookie-parser');

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
    cb(null, `board/${Date.now()}_${file.originalname}`)
  }
});
const upload = multer({ storage: storage });
var fs = require('fs');

/* GET users listing. */
router.post('/', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const { userKey, search } = req.body;
    let sess = req.session;
    let query;
    let backQuery = '';
    if(sess[userKey]){
      const sport_no = sess[userKey].user_sport.split(',');
      for(let i = 0; i<sport_no.length; i++){
        if(i !== 0){
          backQuery += ` OR bgv.sport_no = ${sport_no[i]}`;
        }else{
          backQuery += ` AND (bgv.sport_no = ${sport_no[i]}`;
        }
      }
      backQuery += `)`
      if(search){
        backQuery += ` AND (board_title LIKE '%${search}%' OR user_name = '${search}' OR board_hashtag LIKE '%${search},%')`
      }
      query = `SELECT DISTINCT bgv.*, ub.created_at AS board_save, ul.created_at AS board_like, uf.created_at AS user_follow 
                FROM s_boardGramView AS bgv
                  LEFT JOIN s_userBoard AS ub 
                  ON bgv.board_no = ub.board_no AND ub.user_no = ${sess[userKey].user_no} 
                    LEFT JOIN s_userLike AS ul
                    ON bgv.board_no = ul.board_no AND ul.user_no = ${sess[userKey].user_no}
                        LEFT JOIN s_userFollower AS uf
                        ON bgv.user_no = uf.userFollow_follow AND uf.userFollow_follower = ${sess[userKey].user_no} 
                WHERE deleted_at IS NULL ${backQuery} ORDER BY bgv.created_at DESC;`
      }else{
        if(search){
          backQuery += ` AND (board_title LIKE '%${search}%' OR user_name = '${search}' OR board_hashtag LIKE '%${search},%')`
        }
        query = `SELECT DISTINCT * FROM s_boardGramView WHERE deleted_at IS NULL ${backQuery} ORDER BY created_at DESC;`;
      }
      conn.query(query, (e, rows) => {
        if (e) throw e;
        res.send({values: rows, user: {user_no: sess[userKey] ? sess[userKey].user_no : '', user_profile: sess[userKey] ? sess[userKey].user_profile : ''}});
      })
    conn.release();
  })
});


router.get('/:userNo/:userKey', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const { userNo, userKey } = req.params;
    let query;
    let sess = req.session;
    if(sess[userKey]){
      query = `SELECT DISTINCT bgv.*, ub.created_at AS board_save, ul.created_at AS board_like, uf.created_at AS user_follow 
                FROM s_boardGramView AS bgv
                  LEFT JOIN s_userBoard AS ub 
                  ON bgv.board_no = ub.board_no AND ub.user_no = ${sess[userKey].user_no}
                    LEFT JOIN s_userLike AS ul
                    ON bgv.board_no = ul.board_no AND ub.user_no = ${sess[userKey].user_no}
                      LEFT JOIN s_userFollower AS uf
                      ON bgv.user_no = uf.userFollow_follow AND uf.userFollow_follower = ${sess[userKey].user_no} WHERE deleted_at IS NULL AND bgv.user_no = ${userNo} ORDER BY bgv.created_at DESC;`
    }else{
      query = `SELECT DISTINCT * FROM s_boardGramView WHERE deleted_at IS NULL AND user_no = ${userNo} ORDER BY created_at DESC;`; 
    }
    conn.query(query, (e, rows) => {
      if (e) throw e;
        res.send({values: rows, user: {user_no: sess[userKey] ? sess[userKey].user_no : '', user_profile: sess[userKey] ? sess[userKey].user_profile : ''}});
      })
    conn.release();
  })
});

router.get('/:boardId/update/:userKey', function(req, res, next) {
  const sess = req.session;
  const userKey = req.params.userKey;
  if(sess[userKey]){
    pool.getConnection((err, conn) => {
      if (err) {
        throw err;
      }
      let backQuery = '';
      const sport_no = sess[userKey].user_sport.split(',');
      for(let i = 0; i<sport_no.length; i++){
        if(i !== 0){
          backQuery += ` OR sport_no = ${sport_no[i]}`;
        }else{
          backQuery += `WHERE (sport_no = ${sport_no[i]}`;
        }
      }
      backQuery += `)`
      const query = `BEGIN;
        SELECT sport_no, sport_kind, sport_name FROM s_sport ${backQuery} ORDER BY created_at;
        SELECT DISTINCT * FROM s_boardGramView WHERE board_no = ${req.params.boardId} AND user_no = ${sess[userKey].user_no};
      COMMIT;`;
      conn.query(query, (e, rows) => {
        if (e) throw e;
        if(rows[2][0]){
          res.send({sport: rows[1], board: rows[2][0], result: 1});
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

router.post('/:boardId/update', upload.single('imgFile'), function(req, res, next) {
  let sess = req.session;
  if(sess[req.body.userKey]){
    if(sess[req.body.userKey].user_no == req.body.user_no){
    pool.getConnection((err, conn) => {
      if (err) {
        throw err;
      }
      let query = `BEGIN;
                    UPDATE s_board SET sport_no = ?, board_title = ? WHERE board_no = ?;
                    UPDATE s_boardDetail SET boardDetail_content = ? WHERE boardDetail_no = ?;
                      `;
      const { sport_no, board_title, board_content, boardDetail_no, recordChange, recordTitle, recordContent, keyword, deleteKeyword } = req.body;
      const board_no = req.params.boardId;
      let queryData = [sport_no, board_title, board_no, board_content, boardDetail_no];
      if(req.file){
        query += `\nUPDATE s_boardOption SET boardOption_value = ? WHERE boardDetail_no = ? AND boardOption_kind = 1;`;
        queryData.push(req.file.location, boardDetail_no);
      }
      if(recordChange){
        for(let i = 0; i<recordChange.length; i++){
          query += `\nUPDATE s_boardOption SET boardOption_option = ?, boardOption_value = ? WHERE boardOption_no = ?;`;
          queryData.push(recordTitle[i], recordContent[i], recordChange[i]);
        }
      }
      if(keyword){
        for(let i = 0; i<keyword.length; i++){
          query += `\nINSERT INTO s_boardOption (boardDetail_no, boardOption_kind, boardOption_value) VALUES (?, 2, ?);`
          queryData.push(boardDetail_no, keyword[i]);
        }
      }
      if(deleteKeyword){
        for(let i = 0; i<deleteKeyword.length; i++){
          query += `\nDELETE FROM s_boardOption WHERE boardOption_no = ?;`
          queryData.push(deleteKeyword[i]);
        }
      }
      query += `COMMIT;`;
      conn.query(query, queryData, (e, rows) => {
        if (e) throw e;
        res.send({result: 1});
      })
      conn.release();
    })
    }else{
      res.send({result: 0});
    }
  }else{
    res.send({result: 0});
  }
});

router.post('/create', upload.single('imgFile'), function(req, res, next) {
  let sess = req.session;
  if(sess[req.body.userKey]){
    pool.getConnection((err, conn) => {
      if (err) {
        throw err;
      }
      let query = `BEGIN;
                      INSERT INTO s_board (user_no, board_kind, sport_no, board_title, board_complete) VALUES (?, ?, ?, ?, ?);
                      INSERT INTO s_boardCount (board_no) SELECT MAX(board_no) FROM s_board;
                      `;
      const { board_kind, sport_no, board_title, board_content, recordTitle, recordContent, keyword, board_complete } = req.body;
      const board_img = req.file.location;
      let queryData = [sess[req.body.userKey].user_no, board_kind, sport_no, board_title, board_complete];
      query += `\nINSERT INTO s_boardDetail (board_no, boardDetail_num, boardDetail_content) SELECT MAX(board_no), 1, ? FROM s_board;`;
      queryData.push(board_content);
      query += `\nINSERT INTO s_boardOption (boardDetail_no, boardOption_kind, boardOption_value) SELECT MAX(boardDetail_no), 1, ? FROM s_boardDetail;`
      queryData.push(board_img);
      if(keyword){
        for(let j = 0; j<keyword.length; j++){
          query += `\nINSERT INTO s_boardOption (boardDetail_no, boardOption_kind, boardOption_value) SELECT MAX(boardDetail_no), 2, ? FROM s_boardDetail;`
          queryData.push(keyword[j]);
        }
      }
      for(let j = 0; j<recordTitle.length; j++){
        query += `\nINSERT INTO s_boardOption (boardDetail_no, boardOption_kind, boardOption_option, boardOption_value) SELECT MAX(boardDetail_no), 3, ?, ? FROM s_boardDetail;`
        queryData.push(recordTitle[j], recordContent[j]);
      }
      query += `COMMIT;`;
      conn.query(query, queryData, (e, rows) => {
        if (e) throw e;
        res.send({result: 1});
      })
      conn.release();
    })
  }else{
    res.send({result: 0});
  }
});

router.post('/delete', function(req, res, next) {
  const sess = req.session;
  const {boardNo, userKey} = req.body;
  if(sess[userKey]){
    pool.getConnection((err, conn) => {
      if (err) {
        throw err;
      }
      const query = `UPDATE s_board SET deleted_at = NOW() WHERE board_no = ? AND user_no = ?`;
      conn.query(query, [boardNo, sess[userKey].user_no], (e, rows) => {
        if (e) throw e;
        res.send({result: 1});
      })
      conn.release();
    })
  }else{
    res.send({result: 0});
  }
});

router.get('/detail/:boardId/:userKey', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const { boardId, userKey } = req.params;
    let sess = req.session;
    const userNo = sess[userKey] ? sess[userKey].user_no : 0;
    query = `SELECT DISTINCT bgv.*, ub.created_at AS board_save, ul.created_at AS board_like, uf.created_at AS user_follow 
              FROM s_boardGramView AS bgv
                LEFT JOIN s_userBoard AS ub 
                ON bgv.board_no = ub.board_no AND ub.user_no = ${userNo} 
                  LEFT JOIN s_userLike AS ul
                  ON bgv.board_no = ul.board_no AND ul.user_no = ${userNo}
                      LEFT JOIN s_userFollower AS uf
                      ON bgv.user_no = uf.userFollow_follow AND uf.userFollow_follower = ${userNo} 
              WHERE bgv.board_no = ${boardId} AND deleted_at IS NULL;`
      
      conn.query(query, (e, rows) => {
        if (e) throw e;
        res.send({values: rows, user: {user_no: sess[userKey] ? sess[userKey].user_no : '', user_profile: sess[userKey] ? sess[userKey].user_profile : ''}});
      })
    conn.release();
  })
});

module.exports = router;

/*
운동 그램 뷰 생성
CREATE ALTER VIEW s_boardGramView AS 
SELECT a.*, b.board_img, CONCAT(b.board_hashtag, ',') AS board_hashtag, b.boardOption_hashtag, b.board_recordTitle, b.board_recordContent, b.boardOption_record
FROM (SELECT b.board_no, b.created_at, b.deleted_at, bc.boardCount_like, bc.boardCount_save, b.board_title, u.user_no, u.user_profile, u.user_name, bd.boardDetail_content, bd.boardDetail_no, s.sport_no, s.sport_name, s.sport_icon2 AS sport_icon, COUNT(bcomment.boardComment_content) AS boardCount_comment
    FROM s_board AS b
        INNER JOIN s_boardDetail AS bd
            INNER JOIN s_boardCount AS bc
        INNER JOIN s_user AS u
            INNER JOIN s_sport AS s
            ON b.board_no = bd.board_no AND b.board_no = bc.board_no AND b.user_no = u.user_no AND b.sport_no = s.sport_no
          LEFT JOIN s_boardComment AS bcomment
                ON b.board_no = bcomment.board_no
    WHERE b.board_kind = 3 AND b.board_complete = 1
    GROUP BY board_no) AS a LEFT JOIN
	(SELECT boardDetail_no, 
		(CASE WHEN boardOption_kind = 1 THEN boardOption_value END) AS board_img,
        group_concat(CASE WHEN boardOption_kind = 2 THEN boardOption_no END) AS boardOption_hashtag,
		group_concat(CASE WHEN boardOption_kind = 2 THEN boardOption_value END) AS board_hashtag,
        group_concat(CASE WHEN boardOption_kind = 3 THEN boardOption_no END) AS boardOption_record,
		group_concat(CASE WHEN boardOption_kind = 3 THEN boardOption_option END) AS board_recordTitle,
		group_concat(CASE WHEN boardOption_kind = 3 THEN boardOption_value END) AS board_recordContent
		FROM s_boardOption WHERE boardOption_option != 2 GROUP BY boardDetail_no) AS b
		ON a.boardDetail_no = b.boardDetail_no ORDER BY a.created_at DESC;
*/