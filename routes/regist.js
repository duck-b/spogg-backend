var express = require('express');
var router = express.Router();
const pool = require('../config/dbconfig');
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
    cb(null, `event/${Date.now()}_${file.originalname}`)
  }
});
const upload = multer({ storage: storage });
var fs = require('fs');
const moment = require('moment');

/* GET users listing. */
router.get('/', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const query = `SELECT sport_no, sport_kind, sport_name, false AS sport_check FROM s_sport ORDER BY sport_kind, sport_no`;
    conn.query(query, (e, rows) => {
      if (e) throw e;
      res.send(rows);
    })
    conn.release();
  })
});

router.post('/create', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const { sns, checked, nickName, gender, birth, sports } = req.body;
    let query = `BEGIN;
                    INSERT INTO s_member (member_status) VALUES (1); 
                    INSERT INTO s_user (user_no, user_id, user_email, user_sns, user_name, user_birth, user_gender, user_profile, user_status) 
                      SELECT MAX(member_no), ?, ?, ?, ?, ?, ?, ?, 1 
                        FROM s_member 
                        WHERE member_status = 1;
                    SELECT user_no, user_name, user_profile FROM s_user WHERE user_id = ? AND user_sns = ?;
                    INSERT INTO s_userAgree (user_no, agree_no, userAgree_status) SELECT MAX(member_no), 1, ? FROM s_member WHERE member_status = 1;
                    INSERT INTO s_userAgree (user_no, agree_no, userAgree_status) SELECT MAX(member_no), 2, ? FROM s_member WHERE member_status = 1;
                    INSERT INTO s_userAgree (user_no, agree_no, userAgree_status) SELECT MAX(member_no), 3, ? FROM s_member WHERE member_status = 1;`;
    let user_sport;
    for(let i=0; i<sports.length; i++){
        if(sports[i].sport_check){
            if(user_sport){
              user_sport += `,${sports[i].sport_no}`;
            }else{
              user_sport = `${sports[i].sport_no}`;
            }
            if(!sports[i].sport_favorite){
              query += `\nINSERT INTO s_userSport (user_no, sport_no) SELECT MAX(member_no), ${sports[i].sport_no} FROM s_member WHERE member_status = 1;`;
            }else{
              query += `\nINSERT INTO s_userSport (user_no, sport_no, sport_favorite) SELECT MAX(member_no), ${sports[i].sport_no}, 1 FROM s_member WHERE member_status = 1;`;
            }
        }
    }
    console.log(user_sport);
    query += `\nCOMMIT;`
    let data = [];
    data.push(sns.user_id, sns.user_email, sns.user_sns, nickName, `${birth.year}-${birth.month}-${birth.day}`, gender, sns.user_profile, 
        sns.user_id, sns.user_sns, 
        checked[0] ? 1 : 0, checked[1] ? 1 : 0, checked[2] ? 1 : 0);

    conn.query(query, data, (e, rows) => {
        if (e) throw e;
        if(rows[3][0]){
            let sess = req.session;
            const uniqueInt = Date.now();
            sess[uniqueInt+rows[3][0].user_no] = {
                user_no: rows[3][0].user_no,
                user_name: rows[3][0].user_name,
                user_profile: rows[3][0].user_profile,
                user_sport: user_sport,
                user_status: 1,
                log_times: uniqueInt + (3600 * 10 * 10)
            }
            res.send({ result: 1, userKey: uniqueInt+rows[3][0].user_no });
        }else{
            res.send({ result: 0 });
        } 
    })
    conn.release();
  })
});

router.post('/checkId', function(req, res, next) {
    pool.getConnection((err, conn) => {
      if (err) {
        throw err;
      }
      const query = `SELECT user_no FROM s_user WHERE user_name = ?;`;
      conn.query(query, [req.body.nickName],(e, row) => {
        if (e) throw e;
        if(row[0]){
            res.send({status: 2})
        }else{
            res.send({status: 1})
        }
      })
      conn.release();
    })
  });

module.exports = router;
