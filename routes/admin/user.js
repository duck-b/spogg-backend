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
    const query = `SELECT user_no AS id, user_profile, user_name, user_email,
      (CASE WHEN user_sns = 1 THEN '카카오' ELSE (CASE WHEN user_sns = 2 THEN '네이버' ELSE '구글' END) END) AS user_sns,
      (CASE WHEN user_gender = 1 THEN '남' ELSE '여' END) AS user_gender,
      (CASE WHEN user_status = 1 THEN '일반' ELSE (CASE WHEN user_status = 2 THEN '인플루언서' ELSE '전문가' END) END) AS user_status,
      created_at  
      FROM s_user ORDER BY created_at DESC;`;
    conn.query(query, (e, row) => {
      if (e) throw e;
      res.send(row);
    })
    conn.release();
  })
});

router.get('/:userNo', function(req, res, next) {
  const { userNo } = req.params;
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const query = `BEGIN;
    SELECT * FROM s_user WHERE user_no = ${userNo};
    SELECT ua.*, a.agree_name FROM s_userAgree AS ua LEFT JOIN s_agree AS a ON ua.agree_no = a.agree_no WHERE ua.user_no = ${userNo};
    SELECT b.board_no, b.board_title, b.board_kind, s.sport_name, b.created_at, b.deleted_at FROM s_board AS b LEFT JOIN s_sport AS s ON b.sport_no = s.sport_no WHERE b.user_no = ${userNo} ORDER BY b.created_at DESC;
    SELECT us.*, s.sport_name FROM s_userSport AS us LEFT JOIN s_sport AS s ON us.sport_no = s.sport_no WHERE us.user_no = ${userNo};
    SELECT u.user_no, u.user_name, u.user_profile FROM s_userFollower AS uf LEFT JOIN s_user AS u ON uf.userFollow_follower = u.user_no WHERE uf.userFollow_follow = ${userNo};
    SELECT u.user_no, u.user_name, u.user_profile FROM s_userFollower AS uf LEFT JOIN s_user AS u ON uf.userFollow_follow = u.user_no WHERE uf.userFollow_follower = ${userNo};
    COMMIT;`;
    conn.query(query,(e, rows) => {
      if (e) throw e;
      res.send(rows);
    })
    conn.release();
  })
});

module.exports = router;
