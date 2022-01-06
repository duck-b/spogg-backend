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
    cb(null, `event/${Date.now()}_${file.originalname}`)
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
    const query = `SELECT event_no AS id, event_name, event_image, event_info, CONCAT(event_startDate, '&nbsp;~&nbsp;' ,event_endDate) AS event_term, event_url FROM s_event ORDER BY created_at DESC`;
    conn.query(query, (e, rows) => {
      if (e) throw e;
      res.send(rows);
    })
    conn.release();
  })
});

router.get('/:eventId/update', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const event_no = req.params.eventId;
    const query = `SELECT * FROM s_event WHERE event_no = ?`;
    conn.query(query, [event_no], (e, row) => {
      if (e) throw e;
      if(row[0]){
        res.send({data: row[0], result: 1});
      }else{
        res.send({data: null, result: 0});
      }
    })
    conn.release();
  })
});

router.post('/:eventId/update', upload.single('imgFile'), function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const query = `UPDATE s_event SET event_name = ?, event_startDate = ?, event_endDate = ?, event_url = ?, event_info = ?, event_image = ? WHERE event_no = ?`;
    const event_no = req.params.eventId;
    const { name, start, end, url, info } = req.body;
    let image;
    if(req.file){
      image = req.file.location;
    }else{
      image = req.body.image;
    }
    conn.query(query, [name, start, end, url, info, image , event_no], (e, row) => {
      if (e) throw e;
      res.send({result: row.affectedRows});
    })
    conn.release();
  })
});

router.post('/create', upload.single('imgFile'), function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }  
    const query = `INSERT INTO s_event (event_name, event_startDate, event_endDate, event_url, event_info, event_image) VALUES (?, ?, ?, ?, ?, ?);`;
    const { name, start, end, url, info } = req.body;
    const image = req.file.location;
    conn.query(query, [name, start, end, url, info, image], (e, row) => {
      if (e) throw e;
      res.send({result: row.affectedRows});
    })
    conn.release();
  })
});

router.post('/:eventId/delete', upload.single(), function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err){
      throw err;
    }
    const event_no = req.params.eventId;
    const query = `DELETE FROM s_event WHERE event_no = ${event_no};`;
    conn.query(query, (e, row) => {
      if (e) throw e;
      res.send({result: 1});
    })
    conn.release();
  })
});

module.exports = router;
