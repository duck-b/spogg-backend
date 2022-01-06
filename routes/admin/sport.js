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
    cb(null, `sport/${Date.now()}_${file.originalname}`)
  }
});
const upload = multer({ storage: storage });
var fs = require('fs');

/* GET users listing. */
router.get('/', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const query = `SELECT sport_no AS id, sport_name, 
                    (CASE WHEN sport_kind = 1 THEN '구기 / 라켓' WHEN sport_kind = 2 THEN '헬스 / 피트니스' WHEN sport_kind = 3 THEN '레저 / 생활체육' ELSE '기타' END) AS sport_kind
                  FROM s_sport ORDER BY created_at;`;
    conn.query(query, (e, rows) => {
      if (e) throw e;
      res.send(rows);
    })
    conn.release();
  })
});

router.get('/:sportId', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const query = `SELECT sport_no AS id, sport_name, 
                    (CASE WHEN sport_kind = 1 THEN '구기 / 라켓' WHEN sport_kind = 2 THEN '헬스 / 피트니스' WHEN sport_kind = 3 THEN '레저 / 생활체육' ELSE '기타' END) AS sport_kind,
                    sport_icon 
                  FROM s_sport 
                  WHERE sport_no = ?;`;
    const sport_no = req.params.sportId;
    conn.query(query, [sport_no], (e, row) => {
      if (e) throw e;
      if(row[0]){
        const query = `SELECT sportDetail_page, sportDetail_keyword FROM s_sportDetail WHERE sport_no = ?`;
        conn.query(query, [sport_no], (e, rowKeyword) => {
          if (e) throw e;
          if(rowKeyword[0]){
            res.send({data: row[0], keyword: rowKeyword, result: 1});
          }else{
            res.send({data: row[0], keyword: null, result: 1});
          }
        })
      }else{
        res.send({data: null, result: 0});
      }
    })
    conn.release();
  })
});

router.get('/:sportId/update', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const query = `SELECT sport_no, sport_name, sport_kind, sport_icon, sport_icon2, sport_background FROM s_sport WHERE sport_no = ?;`;
    const sport_no = req.params.sportId;
    conn.query(query, [sport_no], (e, row) => {
      if (e) throw e;
      if(row[0]){
        const query = `SELECT sportDetail_no, sportDetail_page, sportDetail_keyword FROM s_sportDetail WHERE sport_no = ?;`;
        conn.query(query, [sport_no], (e, rowKeyword) => {
          if (e) throw e;
          if(rowKeyword[0]){
            res.send({data: row[0], keyword: rowKeyword, result: 1});
          }else{
            res.send({data: row[0], keyword: null, result: 1});
          }
        })
      }else{
        res.send({data: null, result: 0});
      }
    })
    conn.release();
  })
});

router.post('/:sportId/update', upload.array('images[]', 3), function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    let backQuery = '';
    for(let i = 0; i<req.files.length; i++){
      if(req.body.imagesKind[i] === 'icon'){
        backQuery += `, sport_icon = '${req.files[i].location}'`
      }else if(req.body.imagesKind[i] === 'icon2'){
        backQuery += `, sport_icon2 = '${req.files[i].location}'`
      }else if(req.body.imagesKind[i] === 'background'){
        backQuery += `, sport_background = '${req.files[i].location}'`
      }
    }
    let query = `BEGIN;
    UPDATE s_sport SET sport_kind = ?, sport_name = ? ${backQuery} WHERE sport_no = ?;
    `;
    let queryData = [];
    queryData.push(req.body.kind);
    queryData.push(req.body.name);
    queryData.push(req.params.sportId);
    for(let i = 0; i < req.body.keyword.length; i++){
      if(req.body.keyword[i][0]){
        for(let j = 0; j < req.body.keyword[i].length; j++){
          query += `INSERT INTO s_sportDetail (sport_no, sportDetail_page, sportDetail_keyword) VALUES (?, ?, ?);
          `;
          queryData.push(req.params.sportId);
          queryData.push(i+1);
          queryData.push(req.body.keyword[i][j]);
        }
      }
    }
    if(req.body.deleteKeyword){
      for(let i = 0; i < req.body.deleteKeyword.length; i++){
        query += `DELETE FROM s_sportDetail WHERE sportDetail_no = ?;
        `;
        queryData.push(req.body.deleteKeyword[i]);
      }
    }
    query += `COMMIT;`;
    conn.query(query, queryData, (e, row) => {
      if (e) throw e;
        res.send({result: row[1].affectedRows});
    })
    conn.release();
  })
});

router.post('/create', upload.array('images[]', 3), function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const query = `INSERT INTO s_sport (sport_kind, sport_name, sport_icon, sport_icon2, sport_background) VALUES (?, ?, ?, ? ,?);`;
    const { kind, name } = req.body;
    let icon;
    if(req.files[0]){
      icon = req.files[0].location;
    }
    let icon2;
    if(req.files[1]){
      icon2 = req.files[1].location;
    }
    let background;
    if(req.files[2]){
      background = req.files[2].location;
    }
    conn.query(query, [kind, name, icon, icon2, background], (e, row) => {
      if (e) throw e;
      let kind_text;
      switch(kind){
        case "1" :
          kind_text = "구기 / 라켓";
          break;
        case "2" :
          kind_text = "헬스 / 피트니스";
          break;
        case "3" :
          kind_text = "레저 / 생활체육";
          break;
        case "4" :
          kind_text = "기타";
          break;
        default :
          break;
      }
      res.send({data: {id: row.insertId, sport_name: name, sport_kind: kind_text}, result: 1});
    })
    conn.release();
  })
});

router.post('/:sportId/delete', upload.single(), function(req, res, next) {
  let sess = req.session;
  const { adminKey } = req.body;
  if(sess[adminKey].admin_status === 1){
    pool.getConnection((err, conn) => {
      if (err){
        throw err;
      }
      const sport_no = req.params.sportId;
      const query = `BEGIN;
                      DELETE FROM s_sportDetail WHERE sport_no = ${sport_no};
                      DELETE FROM s_sport WHERE sport_no = ${sport_no};
                      COMMIT;`;
      conn.query(query, (e, row) => {
        if (e) throw e;
        res.send({result: 1});
      })
      conn.release();
    })
  }else{
    res.send({result: 2});
  }
});


module.exports = router;
