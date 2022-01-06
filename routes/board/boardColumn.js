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
          backQuery += ` OR bcv.sport_no = ${sport_no[i]}`;
        }else{
          backQuery += `AND  (bcv.sport_no = ${sport_no[i]}`;
        }
      }
      backQuery += `)`
      if(search){
        backQuery += ` AND (user_name = '${search}' OR board_hashtag LIKE '%${search},%')`
      }
      query = `SELECT a.*, SUM(br.boardRating_rating) AS boardRating_rating, COUNT(br.boardComment_no) AS boardRating_count
                FROM (SELECT DISTINCT bcv.*, bc.boardComment_no FROM s_boardColumnView AS bcv 
                  LEFT JOIN s_boardComment AS bc
                  ON bcv.board_no = bc.board_no AND bc.boardComment_no = bc.boardRecomment_no
                  WHERE bcv.deleted_at IS NULL ${backQuery}) AS a 
                LEFT JOIN s_boardRating AS br
                ON a.boardComment_no = br.boardComment_no
                GROUP BY a.board_no ORDER BY a.created_at DESC;`
      }else{
        if(search){
          backQuery += ` AND (user_name = '${search}' OR board_hashtag LIKE '%${search},%')`
        }
        query = `SELECT a.*, SUM(br.boardRating_rating) AS boardRating_rating, COUNT(br.boardComment_no) AS boardRating_count
                  FROM (SELECT DISTINCT bcv.*, bc.boardComment_no 
                    FROM s_boardColumnView AS bcv 
                    LEFT JOIN s_boardComment AS bc
                    ON bcv.board_no = bc.board_no AND bc.boardComment_no = bc.boardRecomment_no
                    WHERE bcv.deleted_at IS NULL ${backQuery}) AS a 
                  LEFT JOIN s_boardRating AS br
                  ON a.boardComment_no = br.boardComment_no
                  GROUP BY a.board_no ORDER BY a.created_at DESC;`;
      }
      conn.query(query, (e, rows) => {
        if (e) throw e;
        if(sess[userKey]){
          const sport_no = sess[userKey].user_sport.split(',');
          let boardKeywordBackQuery = '';
          for(let i = 0; i<sport_no.length; i++){
            if(i !== 0){
              boardKeywordBackQuery += ` OR sport_no = ${sport_no[i]}`;
            }else{
              boardKeywordBackQuery += `AND (sport_no = ${sport_no[i]}`;
            }
          }
          boardKeywordBackQuery += `)`;
          let boardKeywordQuery = `SELECT sportDetail_keyword FROM s_sportDetail WHERE sportDetail_page = 6 ${boardKeywordBackQuery} ORDER BY sportDetail_no;`
          conn.query(boardKeywordQuery, (e, boardKeyword) => {
            res.send({values: rows, boardKeyword: boardKeyword});  
          })
        }else{
          res.send({values: rows});
        }
      })
    conn.release();
  })
});

router.get('/:userNo', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const { userNo } = req.params;
    let query = `SELECT a.*, SUM(br.boardRating_rating) AS boardRating_rating, COUNT(br.boardComment_no) AS boardRating_count
                  FROM (SELECT DISTINCT bcv.*, bc.boardComment_no 
                    FROM s_boardColumnView AS bcv 
                    LEFT JOIN s_boardComment AS bc
                    ON bcv.board_no = bc.board_no AND bc.boardComment_no = bc.boardRecomment_no
                    WHERE bcv.deleted_at IS NULL AND bcv.user_no = ${userNo}) AS a 
                  LEFT JOIN s_boardRating AS br
                  ON a.boardComment_no = br.boardComment_no
                  GROUP BY a.board_no ORDER BY a.created_at DESC;`;
    conn.query(query, (e, rows) => {
      if (e) throw e;
        res.send({values: rows});
      })
    conn.release();
  })
});

router.get('/:boardId/:userKey', function(req, res, next) {
  const sess = req.session;
  const { boardId, userKey } = req.params;
  const user_no = sess[userKey] ? sess[userKey].user_no : 0;
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const query = `SELECT a.*, b.comment_count, (CASE WHEN a.user_no = ${user_no} THEN 1 ELSE NULL END) AS write_user
                    FROM(SELECT a.*, uf.created_at AS user_follow 
                      FROM (SELECT a.*, ub.created_at AS user_save 
                        FROM (SELECT bcv.*, ul.created_at AS user_like 
                          FROM s_boardColumnView AS bcv 
                          LEFT JOIN s_userLike AS ul 
                          ON bcv.board_no = ul.board_no AND ul.user_no = ${user_no} 
                        WHERE bcv.board_no = ${boardId}) AS a 
                        LEFT JOIN s_userBoard AS ub
                        ON a.board_no = ub.board_no AND ub.user_no = ${user_no}) AS a
                      LEFT JOIN s_userFollower AS uf
                      ON a.user_no = uf.userFollow_follow AND uf.userFollow_follower = ${user_no}) AS a
                    LEFT JOIN (SELECT COUNT(boardComment_no) AS comment_count, ${boardId} AS board_no FROM s_boardComment WHERE board_no = ${boardId}) AS b
                    ON a.board_no = b.board_no;`;
    conn.query(query, (e, row) => {
      if (e) throw e;
      const num = /[0-9]/;
      if(num.test(row[0].goods_no)){
        let otherGoodsBackQuery = '';
        for(let i = 0; i<row[0].goods_no.split('|').length; i++){
          for(let j = 0; j<row[0].goods_no.split('|')[i].split(',').length; j++){
            if(row[0].goods_no.split('|')[i].split(',')[j]){
              if(otherGoodsBackQuery !== ''){
                otherGoodsBackQuery += ` OR g.goods_no = ${row[0].goods_no.split('|')[i].split(',')[j]}`;
              }else{
                otherGoodsBackQuery = `g.goods_no = ${row[0].goods_no.split('|')[i].split(',')[j]}`;
              }
            }
          }
        }
        let otherGoodsQuery = `SELECT a.goods_no, g.goods_name, gd.goodsDetail_value
                                FROM (SELECT gd.goodsDetail_value  AS goods_no
                                  FROM s_goods AS g 
                                  INNER JOIN s_goodsDetail AS gd 
                                  ON g.goods_no = gd.goods_no 
                                  WHERE gd.goodsDetail_kind = 5 AND (${otherGoodsBackQuery})) AS a
                                INNER JOIN s_goods as g
                                INNER JOIN s_goodsDetail as gd
                                ON a.goods_no = g.goods_no AND g.goods_no = gd.goods_no
                                WHERE gd.goodsDetail_kind = 1;`;
        conn.query(otherGoodsQuery, (e, otherGoods) => {
        if (e) throw e;
          res.send({value: row[0], otherGoods: otherGoods}); 
        })
      }else{
        res.send({value: row[0], otherGoods: null}); 
      }
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
        SELECT DISTINCT * FROM s_boardColumnView WHERE board_no = ${req.params.boardId} AND user_no = ${sess[userKey].user_no} AND deleted_at IS NULL;
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

router.post('/:boardId/update', upload.array('imgFile', 10), function(req, res, next) {
  let sess = req.session;
  let k = 0;
  if(sess[req.body.userKey]){
    if(sess[req.body.userKey].user_no == req.body.userNo){
    pool.getConnection((err, conn) => {
      if (err) {
        throw err;
      }
      let query = `BEGIN;
                    UPDATE s_board SET sport_no = ?, board_title = ? WHERE board_no = ?;`;
      const { sportNo, boardTitle, imgWidth, imgHeight, deleteBoardDetail, deleteBoardGoodsX, 
              deleteBoardGoodsY, deleteBoardDetailGoods, boardDetailNo, changeImg, boardContent, boardGoodsState, 
              boardGoodsX, boardGoodsY, boardGoodsPointX, boardGoodsInfo, boardHashtag, boardHashtagState } = req.body;
      const boardNo = req.params.boardId;
      let queryData = [sportNo, boardTitle, boardNo];
      if(deleteBoardDetail){
        for(let i = 0; i<deleteBoardDetail.length; i++){
          query += `\nDELETE FROM s_boardOption WHERE boardDetail_no = ?;
                      DELETE FROM s_boardGoods WHERE boardDetail_no = ?;
                      DELETE FROM s_boardDetail WHERE boardDetail_no = ?;`;
          queryData.push(deleteBoardDetail[i], deleteBoardDetail[i], deleteBoardDetail[i]);
        }
      }
      if(deleteBoardDetailGoods){
        for(let i = 0; i<deleteBoardDetailGoods.length; i++){
          query += `\nDELETE FROM s_boardGoods WHERE boardDetail_no = ? AND boardGoods_x = ? AND boardGoods_y = ?;`;
          queryData.push(deleteBoardDetailGoods[i], deleteBoardGoodsX[i], deleteBoardGoodsY[i]);
        }
      }
      for(i = 0; i<boardDetailNo.length; i++){
        if(boardDetailNo[i] !== 'undefined'){
          query += `\nUPDATE s_boardDetail SET boardDetail_num = ?, boardDetail_content = ? WHERE boardDetail_no = ?;`;
          queryData.push(i+1, boardContent[i], boardDetailNo[i]);
          if(changeImg[i] === '1'){
            query += `\nUPDATE s_boardOption SET boardOption_value = ? WHERE boardDetail_no = ? AND boardOption_kind = 1;`;
            queryData.push(req.files[k].location, boardDetailNo[i]);
            k++;
          }
          if(boardHashtag){
            if(boardHashtag[i]){
              for(j = 0; j<boardHashtag[i].length; j++){
                if(boardHashtagState[i][j] === 'insert'){
                  query += `\nINSERT INTO s_boardOption (boardDetail_no, boardOption_kind, boardOption_value) VALUES (?, 2, ?);`
                  queryData.push(boardDetailNo[i], boardHashtag[i][j]);
                }else if(boardHashtagState[j] === 'delete'){
                  query += `\nDELETE FROM s_boardOption WHERE boardDetail_no = ? AND boardOption_kind = 2 AND boardOption_value = ?;`
                  queryData.push(boardDetailNo[i], boardHashtag[i][j]);
                }
              }
            }
          }
          if(boardGoodsState){
            if(boardGoodsState[i]){
              for(j = 0; j<boardGoodsState[i].length; j++){
                if(boardGoodsState[i][j] === 'insert'){
                  query += `\nINSERT INTO s_boardGoods (boardDetail_no, boardGoods_info, boardGoods_x, boardGoods_y) VALUES (?, ?, ?, ?);`;
                  queryData.push(boardDetailNo[i], boardGoodsInfo[i][j], boardGoodsX[i][j]/imgWidth, boardGoodsY[i][j]/imgHeight);
                }else if(boardGoodsState[i][j] === 'update'){
                  query += `\nUPDATE s_boardGoods SET boardGoods_info = ? WHERE boardDetail_no = ? AND boardGoods_x = ? AND boardGoods_y = ?;`;
                  queryData.push(boardDetailNo[i], boardGoodsInfo[i][j], boardGoodsX[i][j]/imgWidth, boardGoodsY[i][j]/imgHeight);
                }
              }
            }
          }
        }else{
          query += `INSERT INTO s_boardDetail (board_no, boardDetail_num, boardDetail_content) VALUES (?, ?, ?);`;
          queryData.push(boardNo, i+1, boardContent[i]);
          if(changeImg[i] === '1'){
            query += `\nINSERT INTO s_boardOption (boardDetail_no, boardOption_kind, boardOption_value) SELECT MAX(boardDetail_no), 1, ? FROM s_boardDetail;`;
            queryData.push(req.files[k].location);
            k++;
          }
          if(boardHashtag){
            if(boardHashtag[i]){
              for(j = 0; j<boardHashtag[i].length; j++){
                if(boardHashtagState[i][j] === 'insert'){
                  query += `\nINSERT INTO s_boardOption (boardDetail_no, boardOption_kind, boardOption_value) SELECT MAX(boardDetail_no), 2, ? FROM s_boardDetail;`
                  queryData.push(boardHashtag[i][j]);
                }
              }
            }
          }
          if(boardGoodsState){
            if(boardGoodsState[i]){
              for(j = 0; j<boardGoodsState[i].length; j++){
                if(boardGoodsState[i][j] === 'insert'){
                  query += `\nINSERT INTO s_boardGoods (boardDetail_no, boardGoods_info, boardGoods_x, boardGoods_y) SELECT MAX(boardDetail_no), ?, ?, ? FROM s_boardDetail;`;
                  queryData.push(boardGoodsInfo[i][j], boardGoodsX[i][j]/imgWidth, boardGoodsY[i][j]/imgHeight);
                }
              }
            }
          }
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

router.post('/create', upload.array('imgFile', 10), function(req, res, next) {
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
      const { board_kind, sport_no, board_title, board_content, board_complete, board_keyword, board_point_x, board_point_y, board_point_content, imgWidth, imgHeight } = req.body;
      
      let queryData = [sess[req.body.userKey].user_no, board_kind, sport_no, board_title, board_complete];
      for(let i = 0; i < req.files.length; i++){
        query += `\nINSERT INTO s_boardDetail (board_no, boardDetail_num, boardDetail_content) SELECT MAX(board_no), ${(i+1)}, ? FROM s_board;`;
        queryData.push(board_content[i]);
        query += `\nINSERT INTO s_boardOption (boardDetail_no, boardOption_kind, boardOption_value) SELECT MAX(boardDetail_no), 1, ? FROM s_boardDetail;`
        queryData.push(req.files[i].location);
        if(board_keyword){
          if(board_keyword[i]){
            for(let j = 0; j<board_keyword[i].length; j++){
              query += `\nINSERT INTO s_boardOption (boardDetail_no, boardOption_kind, boardOption_value) SELECT MAX(boardDetail_no), 2, ? FROM s_boardDetail;`
              queryData.push(board_keyword[i][j]);
            }
          }
        }
        if(board_point_x){
          if(board_point_x[i]){
            for(let j = 0; j<board_point_x[i].length; j++){
              query += `\nINSERT INTO s_boardGoods (boardDetail_no, boardGoods_info, boardGoods_x, boardGoods_y) SELECT MAX(boardDetail_no), ?, ?, ? FROM s_boardDetail;`
              queryData.push(board_point_content[i][j], board_point_x[i][j]/imgWidth, board_point_y[i][j]/imgHeight)
            }
          }
        }
      }
      query += `COMMIT;`;
      conn.query(query, queryData, (e, rows) => {
        if (e) throw e;
        res.send({result: 1, data: rows});
      })
      conn.release();
    })
  }else{
    res.send({result: 0});
  }
});

module.exports = router;

/*
전문가 칼럼 뷰 생성
CREATE ALTER VIEW s_boardColumnView AS 
SELECT a.board_no, a.board_title, a.deleted_at, a.boardCount_like, a.boardCount_save, a.boardCount_view, a.user_no, a.user_name, a.user_profile, a.sport_no, a.sport_name, a.created_at,
	GROUP_CONCAT(a.boardDetail_no SEPARATOR '|') AS boardDetail_no,
    GROUP_CONCAT(a.boardDetail_num SEPARATOR '|') AS boardDetail_num,
    GROUP_CONCAT(a.boardDetail_content SEPARATOR '|') AS boardDetail_content,
    GROUP_CONCAT(a.board_img SEPARATOR '|') AS board_img,
    GROUP_CONCAT(CASE WHEN a.board_hashtag IS NULL THEN '' ELSE a.board_hashtag END SEPARATOR '|') AS board_hashtag,
	GROUP_CONCAT(CASE WHEN a.boardGoods_info IS NULL THEN '' ELSE a.boardGoods_info END SEPARATOR '|') AS boardGoods_info,
    GROUP_CONCAT(CASE WHEN a.boardGoods_x IS NULL THEN '' ELSE a.boardGoods_x END SEPARATOR '|') AS boardGoods_x,
    GROUP_CONCAT(CASE WHEN a.boardGoods_y IS NULL THEN '' ELSE a.boardGoods_y END SEPARATOR '|') AS boardGoods_y,
	GROUP_CONCAT(CASE WHEN a.goods_no IS NULL THEN '' ELSE a.goods_no END SEPARATOR '|') AS goods_no,
    GROUP_CONCAT(CASE WHEN a.goods_name IS NULL THEN '' ELSE a.goods_name END SEPARATOR '|') AS goods_name,
    GROUP_CONCAT(CASE WHEN a.goods_manufacturer IS NULL THEN '' ELSE a.goods_manufacturer END SEPARATOR '|') AS goods_manufacturer,
	GROUP_CONCAT(CASE WHEN a.thisGoods_image IS NULL THEN '' ELSE a.thisGoods_image END SEPARATOR '|') AS thisGoods_image
FROM (SELECT a.board_no, a.board_title, a.deleted_at, a.boardCount_like, a.boardCount_save, a.boardCount_view, a.user_no, a.user_name, a.user_profile, a.sport_no, a.sport_name, a.created_at, a.boardDetail_no, a. boardDetail_num, a.boardDetail_content, a.board_img, CONCAT(a.board_hashtag, ',') AS board_hashtag,
	GROUP_CONCAT(a.boardGoods_info) AS boardGoods_info,
    GROUP_CONCAT(a.boardGoods_x) AS boardGoods_x,
    GROUP_CONCAT(a.boardGoods_y) AS boardGoods_y,
	GROUP_CONCAT(CASE WHEN a.goods_no IS NULL THEN '' ELSE a.goods_no END) AS goods_no,
    GROUP_CONCAT(CASE WHEN a.goods_no IS NULL THEN '' ELSE a.goods_name END) AS goods_name,
    GROUP_CONCAT(CASE WHEN a.goods_no IS NULL THEN '' ELSE a.goods_manufacturer END) AS goods_manufacturer,
    GROUP_CONCAT(CASE WHEN a.goods_no IS NULL THEN '' ELSE gd.goodsDetail_value END) AS thisGoods_image
FROM (SELECT a.*, g.goods_name, g.goods_manufacturer
	FROM (SELECT a.*, bg.boardGoods_info, bg.boardGoods_x, bg.boardGoods_y, bg.goods_no
		FROM (SELECT a.*,
				GROUP_CONCAT(CASE WHEN bo.boardOption_kind  = 1 THEN boardOption_value END) AS board_img,
				GROUP_CONCAT(CASE WHEN bo.boardOption_kind  = 2 THEN boardOption_value END) AS board_hashtag
			FROM (SELECT b.board_no, b.board_title, b.deleted_at, bc.boardCount_like, bc.boardCount_save, bc.boardCount_view, b.user_no, u.user_name, u.user_profile, s.sport_no, s.sport_name, b.created_at, bd.boardDetail_no, bd.boardDetail_num, bd.boardDetail_content
				FROM s_board AS b
				INNER JOIN s_user AS u
				INNER JOIN s_sport AS s
				INNER JOIN s_boardCount AS bc
				INNER JOIN s_boardDetail AS bd
				ON b.user_no = u.user_no AND b.board_no = bd.board_no AND b.board_no = bc.board_no
			WHERE b.board_kind = 5 AND b.sport_no = s.sport_no) AS a
			LEFT JOIN s_boardOption AS bo
			ON a.boardDetail_no = bo.boardDetail_no
			GROUP BY boardDetail_no
			ORDER BY boardDetail_num) AS a
		LEFT JOIN s_boardGoods AS bg
		ON a.boardDetail_no = bg.boardDetail_no) AS a 
	LEFT JOIN s_goods AS g
	ON a.goods_no = g.goods_no) AS a
LEFT JOIN s_goodsDetail AS gd
ON a.goods_no = gd.goods_no AND goodsDetail_kind = 1
GROUP BY a.boardDetail_no) AS a
GROUP BY a.board_no;

*/