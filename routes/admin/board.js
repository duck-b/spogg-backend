var express = require('express');
var router = express.Router();
const pool = require('../../config/dbconfig');
const cookieParser = require('cookie-parser');

var AWS = require('aws-sdk');
AWS.config.region = 'ap-northeast-2';

var fs = require('fs');

/* GET users listing. */
router.get('/', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const query = `SELECT b.board_no AS id, b.board_title, 
      (CASE WHEN b.board_kind = 1 THEN '큐레이션' ELSE (CASE WHEN b.board_kind = 3 THEN '다이어리' ELSE '인포머' END) END) AS board_kind, 
        u.user_no, u.user_name, s.sport_name,
        bo.boardOption_value AS board_image,
        b.created_at, b.updated_at
    FROM s_board AS b 
    INNER JOIN s_user AS u 
    INNER JOIN s_sport AS s
    INNER JOIN s_boardDetail AS bd
    INNER JOIN s_boardOption AS bo
    ON b.user_no = u.user_no AND b.sport_no = s.sport_no AND b.board_no = bd.board_no AND bd.boardDetail_no = bo.boardDetail_no
    WHERE bd.boardDetail_num = 1 AND bo.boardOption_kind = 1 ORDER BY b.created_at DESC;`;
    conn.query(query, (e, row) => {
      if (e) throw e;
      res.send(row);
    })
    conn.release();
  })
});

router.get('/:boardNo', function(req, res, next) {
  const { boardNo } = req.params;
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const query = `BEGIN;
    SELECT b.board_no, b.board_title, (CASE WHEN b.board_kind = 1 THEN '큐레이션' ELSE (CASE WHEN b.board_kind = 3 THEN '다이어리' ELSE '인포머' END) END) AS board_kind, b.deleted_at, b.created_at, b.updated_at, u.user_no, u.user_name, s.sport_no, s.sport_name FROM s_board AS b INNER JOIN s_user AS u INNER JOIN s_sport AS s ON b.user_no = u.user_no AND b.sport_no = s.sport_no WHERE board_no = ${boardNo};
    COMMIT;`;
    conn.query(query,(e, rows) => {
      if (e) throw e;
      res.send(rows);
    })
    conn.release();
  })
});

module.exports = router;
