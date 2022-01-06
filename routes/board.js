var express = require('express');
var router = express.Router();
const pool = require('../config/dbconfig');


router.post('/count', function(req, res, next) {
  const sess = req.session;
  const { boardNo, countKind, countValue, userKey} = req.body;
  if(sess[userKey]){
    pool.getConnection((err, conn) => {
      if (err) {
        throw err;
      }
      let tableName;
      let query = `BEGIN;
        UPDATE s_boardCount SET `;
      if(countKind === 'board_like'){
        query += `boardCount_like = boardCount_like `;
        tableName = 's_userLike';
      }else if(countKind === 'board_save'){
        query += `boardCount_save = boardCount_save `;
        tableName = 's_userBoard';
      }else{
        query += `boardCount_view = boardCount_view + 1 WHERE board_no = ${boardNo};`;
      }
      if(countValue === true){
        query += `+ 1 WHERE board_no = ${boardNo};
        INSERT INTO ${tableName} (user_no, board_no) VALUES (${sess[userKey].user_no}, ${boardNo});`;
      }else{
        query += `- 1 WHERE board_no = ${boardNo};
        DELETE FROM ${tableName} WHERE user_no = ${sess[userKey].user_no} AND board_no = ${boardNo};`;
      }
      query += `COMMIT;`
      conn.query(query, (e, row) => {
        if (e) throw e;
        res.send({result: 1})
      })
      conn.release();
    })
  }else{
    res.send({result: 0}) 
  }
});

router.get('/create/:userKey', function(req, res, next) {
  const sess = req.session;
  const userKey = req.params.userKey;
  if(sess[userKey]){
    pool.getConnection((err, conn) => {
      if (err) {
        throw err;
      }
      const query = `SELECT s.sport_no, s.sport_kind, s.sport_name FROM s_userSport AS us INNER JOIN s_sport AS s ON us.user_no = ${sess[userKey].user_no} AND us.sport_no = s.sport_no ORDER BY s.created_at;`;
      conn.query(query, (e, rows) => {
        if (e) throw e;
        res.send(rows);
      })
      conn.release();
    })
  }else{
    res.send();
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

module.exports = router;

/*
운동 그램 뷰 생성
CREATE VIEW s_boardGramView AS 
SELECT a.*, b.board_img, CONCAT(b.board_hashtag, ',') AS board_hashtag, b.boardOption_hashtag, b.board_recordTitle, b.board_recordContent, b.boardOption_record
FROM (SELECT b.board_no, b.created_at, bc.boardCount_like, bc.boardCount_save, b.board_title, u.user_no, u.user_profile, u.user_name, bd.boardDetail_content, bd.boardDetail_no, s.sport_no, s.sport_name, s.sport_icon
	FROM s_board AS b
		INNER JOIN s_boardDetail AS bd
        INNER JOIN s_boardCount AS bc
		INNER JOIN s_user AS u
        INNER JOIN s_sport AS s
        ON b.board_no = bd.board_no AND b.board_no = bc.board_no AND b.user_no = u.user_no AND b.sport_no = s.sport_no WHERE b.deleted_at IS NULL AND b.board_complete = 1) AS a LEFT JOIN
	(SELECT boardDetail_no, 
		(CASE WHEN boardOption_kind = 1 THEN boardOption_value END) AS board_img,
        group_concat(CASE WHEN boardOption_kind = 2 THEN boardOption_no END) AS boardOption_hashtag,
		group_concat(CASE WHEN boardOption_kind = 2 THEN boardOption_value END) AS board_hashtag,
        group_concat(CASE WHEN boardOption_kind = 3 THEN boardOption_no END) AS boardOption_record,
		group_concat(CASE WHEN boardOption_kind = 3 THEN boardOption_option END) AS board_recordTitle,
		group_concat(CASE WHEN boardOption_kind = 3 THEN boardOption_value END) AS board_recordContent
		FROM s_boardOption WHERE boardOption_option != 2 GROUP BY boardDetail_no) AS b
		ON a.boardDetail_no = b.boardDetail_no ORDER BY a.created_at DESC;

SELECT bgv.*, ub.created_at as board_like FROM s_boardGramView AS bgv LEFT JOIN s_userBoard AS ub ON bgv.board_no = ub.board_no AND ub.user_no = 59 WHERE bgv.sport_no = 9;
*/