var express = require('express');
var router = express.Router();
const pool = require('../../config/dbconfig');

var AWS = require('aws-sdk');
AWS.config.region = 'ap-northeast-2';

var fs = require('fs');

router.get('/boardPlay/:userKey', function(req, res, next) {
  let sess = req.session;
  const { userKey } = req.params;
  if(sess[userKey]){
    pool.getConnection((err, conn) => {
      if (err) {
        throw err;
      }
      const { userNo } = req.params;
      let query = `SELECT DISTINCT bpv.*, uf.created_at AS user_follow, (CASE WHEN bpv.user_no = ${sess[userKey].user_no} THEN '1' ELSE '0' END) AS this_user
                    FROM s_userBoard AS ub 
                    INNER JOIN s_boardPlayView AS bpv 
                    ON ub.user_no = ${sess[userKey].user_no} AND ub.board_no = bpv.board_no 
                    LEFT JOIN s_userFollower AS uf
                    ON bpv.user_no = uf.userFollow_follow AND uf.userFollow_follower = ${sess[userKey].user_no}
                    WHERE deleted_at IS NULL ORDER BY bpv.created_at DESC;`;
      conn.query(query, (e, rows) => {
        if (e) throw e;
          res.send({values: rows, result: 1});
        })
      conn.release();
    })
  }else{
    res.send({result: 0})
  }
});

router.get('/boardColumn/:userKey', function(req, res, next) {
  let sess = req.session;
  const { userKey } = req.params;
  if(sess[userKey]){
    pool.getConnection((err, conn) => {
      if (err) {
        throw err;
      }
      let query = `SELECT a.*, SUM(br.boardRating_rating) AS boardRating_rating, COUNT(br.boardComment_no) AS boardRating_count
                    FROM (SELECT a.*, bc.boardComment_no 
                      FROM (SELECT DISTINCT bcv.*
                        FROM s_boardColumnView AS bcv 
                        INNER JOIN s_userBoard AS ub 
                        ON ub.user_no = ${sess[userKey].user_no} AND ub.board_no = bcv.board_no
                            WHERE bcv.deleted_at IS NULL) AS a
                      LEFT JOIN s_boardComment AS bc
                      ON a.board_no = bc.board_no AND bc.boardComment_no = bc.boardRecomment_no) AS a
                    LEFT JOIN s_boardRating AS br
                    ON a.boardComment_no = br.boardComment_no
                    GROUP BY a.board_no ORDER BY a.created_at DESC;`;
      conn.query(query, (e, rows) => {
        if (e) throw e;
          res.send({values: rows});
        })
      conn.release();
    })
  }else{
    res.send({result: 0});
  }
});

router.get('/boardGram/:userKey', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const { userKey } = req.params;
    let sess = req.session;
    query = `SELECT DISTINCT bgv.*, ub.created_at AS board_save, ul.created_at AS board_like, uf.created_at AS user_follow 
              FROM s_boardGramView AS bgv
                LEFT JOIN s_userBoard AS ub 
                ON bgv.board_no = ub.board_no AND ub.user_no = ${sess[userKey].user_no}
                  LEFT JOIN s_userLike AS ul
                  ON bgv.board_no = ul.board_no AND ul.user_no = ${sess[userKey].user_no}
                    LEFT JOIN s_userFollower AS uf
                    ON bgv.user_no = uf.userFollow_follow AND uf.userFollow_follower = ${sess[userKey].user_no} WHERE deleted_at IS NULL AND ub.user_no = ${sess[userKey].user_no} ORDER BY bgv.created_at DESC;`
  
    conn.query(query, (e, rows) => {
      if (e) throw e;
        res.send({values: rows, user: {user_no: sess[userKey] ? sess[userKey].user_no : '', user_profile: sess[userKey] ? sess[userKey].user_profile : ''}});
      })
    conn.release();
  })
});

router.get('/boardComment/:userKey/:boardKind', function(req, res, next) {
  const { userKey, boardKind } = req.params;
    let query;
    let sess = req.session;
    if(sess[userKey]){
      pool.getConnection((err, conn) => {
        if (err) {
          throw err;
        }
      
        query = `SELECT a.*, br.boardRating_rating
                  FROM (SELECT bc.user_no, bc.boardComment_no, bc.board_no, bc.boardComment_content, DATE_FORMAT(bc.created_at, '%y. %m. %d') AS created_at, bc.deleted_at, b.board_title
                    FROM s_boardComment AS bc
                    INNER JOIN s_board AS b
                    ON bc.board_no = b.board_no
                    WHERE bc.user_no = ${sess[userKey].user_no} AND b.board_kind = ${boardKind}) AS a
                  LEFT JOIN s_boardRating AS br
                  ON a.boardComment_no = br.boardComment_no
                  ORDER BY a.created_at DESC;`;
        conn.query(query, (e, rows) => {
          if (e) throw e;
          res.send({values: rows, boardKind: boardKind});
        })
        conn.release();
      })
    }else{
      res.send({result: 0})
    }
});

router.get('/:userNo/:userKey', function(req, res, next) {
  let sess = req.session;
  const {userNo, userKey} = req.params;
  if(sess[userKey]){
    if(sess[userKey].user_no == userNo){
      res.send({result: 1});
    }else{
      res.send({result: 0});
    }
  }else{
    res.send({result: 0});
  }
});

router.get('/:userNo/:userKey/:followKind', function(req, res, next){
  let sess = req.session;
  const {userNo, userKey, followKind} = req.params;
  const thisUser = sess[userKey] ? sess[userKey].user_no : 0;
  let query;
  if(followKind === '1'){
    query = `SELECT a.*, b.this_user_follow
                  FROM(SELECT uf.userFollow_follow AS follow_user_no, uf.created_at , u.user_name, u.user_profile, s.sport_name
                    FROM s_userFollower AS uf
                    INNER JOIN s_user AS u
                    INNER JOIN s_userSport AS us
                    INNER JOIN s_sport AS s
                    ON uf.userFollow_follow = u.user_no AND u.user_no = us.user_no AND sport_favorite = 1 AND us.sport_no = s.sport_no
                    WHERE uf.userFollow_follower = ${userNo}) AS a
                  LEFT JOIN (SELECT uf.userFollow_follow, uf.created_at AS this_user_follow 
                    FROM s_userFollower AS uf
                      WHERE uf.userFollow_follower = ${thisUser}) AS b
                  ON a.follow_user_no = b.userFollow_follow ORDER BY created_at DESC;`;
  }else{
    query = `SELECT a.*, b.this_user_follow
              FROM(SELECT uf.userFollow_follower AS follow_user_no, uf.created_at , u.user_name, u.user_profile, s.sport_name
                FROM s_userFollower AS uf
                INNER JOIN s_user AS u
                INNER JOIN s_userSport AS us
                INNER JOIN s_sport AS s
                ON uf.userFollow_follower = u.user_no AND u.user_no = us.user_no AND sport_favorite = 1 AND us.sport_no = s.sport_no
                WHERE uf.userFollow_follow = ${userNo}) AS a
              LEFT JOIN (SELECT uf.userFollow_follow, uf.created_at AS this_user_follow 
                FROM s_userFollower AS uf
                  WHERE uf.userFollow_follower = ${thisUser}) AS b
              ON a.follow_user_no = b.userFollow_follow ORDER BY created_at DESC;`;
  }
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    conn.query(query,(e, rows) => {
      if (e) throw e;
      conn.release();
      if(rows[0]){
        res.send({values: rows, thisUser: thisUser});
      }else{
        res.send({result: 0});
      }
    })
  })
});

module.exports = router;
