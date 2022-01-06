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
    cb(null, `goods/${Date.now()}_${file.originalname}`)
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
    const query = `SELECT g.goods_no AS id, goods_name, g.created_at, s.sport_name, 
                    (CASE WHEN goods_kind = 1 THEN '용품' WHEN goods_kind = 2 THEN '레슨' WHEN goods_kind = 3 THEN '구장' ELSE '대회' END) AS goods_kind,
                    MAX(CASE WHEN goodsDetail_kind = 1 THEN goodsDetail_value END) AS firstImg,
                    MAX(CASE WHEN goodsDetail_kind = 2 THEN goodsDetail_value END) AS fixHashtag,
                    DATE_FORMAT(g.created_at, '%Y-%m-%d') AS createTime
                  FROM s_goods AS g
                    INNER JOIN s_sport AS s 
                    INNER JOIN s_goodsDetail AS gd
                      ON g.goods_sport = s.sport_no AND g.goods_no = gd.goods_no
                  GROUP BY g.goods_no ORDER BY g.created_at DESC;`;
    conn.query(query, (e, rows) => {
      if (e) throw e;
      res.send(rows);
    })
    conn.release();
  })
});

router.get('/create', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const query = `SELECT sport_no, sport_kind, sport_name FROM s_sport ORDER BY created_at;`;
    conn.query(query, (e, rows) => {
      if (e) throw e;
      res.send(rows);
    })
    conn.release();
  })
});

router.get('/search/:search', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const query = `SELECT g.goods_no AS id, goods_name, g.created_at, s.sport_name, 
      (CASE WHEN goods_kind = 1 THEN '용품' WHEN goods_kind = 2 THEN '레슨' WHEN goods_kind = 3 THEN '구장' ELSE '대회' END) AS goods_kind,
      MAX(CASE WHEN goodsDetail_kind = 1 THEN goodsDetail_value END) AS firstImg,
      MAX(CASE WHEN goodsDetail_kind = 2 THEN goodsDetail_value END) AS fixHashtag,
      DATE_FORMAT(g.created_at, '%Y-%m-%d') AS createTime
    FROM s_goods AS g
      INNER JOIN s_sport AS s 
      LEFT JOIN s_goodsDetail AS gd
        ON g.goods_sport = s.sport_no AND g.goods_no = gd.goods_no
    WHERE g.goods_name LIKE ? 
    GROUP BY g.goods_no ORDER BY g.created_at DESC;`;
    conn.query(query, `%${req.params.search}%`, (e, rows) => {
      if (e) throw e;
      res.send(rows);
    })
    conn.release();
  })
});

router.get('/:goodsId', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const query = `BEGIN;
    SELECT g.*, s.sport_name FROM s_goods AS g LEFT JOIN s_sport AS s ON g.goods_sport = s.sport_no WHERE goods_no = ?;
    SELECT * FROM s_goodsDetail WHERE goods_no = ? AND goodsDetail_kind < 5 ORDER BY goodsDetail_kind;
    SELECT g.goods_no, g.goods_name, g.goods_manufacturer FROM s_goodsDetail AS gd INNER JOIN s_goods AS g ON gd.goodsDetail_value = g.goods_no WHERE gd.goods_no = ? AND gd.goodsDetail_kind = 5; 
    SELECT s.shop_no, s.shop_name, s.shop_num FROM s_shopGoods AS sg LEFT JOIN s_shop AS s ON sg.shop_no = s.shop_no WHERE sg.goods_no = ?; 
    COMMIT`;
    const goods_no = req.params.goodsId;
    conn.query(query, [goods_no, goods_no, goods_no, goods_no], (e, row) => {
      if (e) throw e;
      if(row[1][0]){
        res.send({data: row[1][0], detailData: row[2], withGoods: row[3], shopGoods: row[4], result: 1});
      }else{
        res.send({result: 0});
      }
    })
    conn.release();
  })
});

router.get('/:goodsId/update', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const goods_no = req.params.goodsId;
    const query = `BEGIN;
      SELECT g.*, s.sport_name FROM s_goods AS g LEFT JOIN s_sport AS s ON g.goods_sport = s.sport_no WHERE goods_no = ${goods_no};
      SELECT * FROM s_goodsDetail WHERE goods_no = ${goods_no};
      SELECT sport_no, sport_kind, sport_name FROM s_sport ORDER BY created_at;
    COMMIT;`;
    conn.query(query, (e, rows) => {
      if (e) throw e;
      res.send({goods: rows[1][0], goodsDetail: rows[2], sport: rows[3]});
    })
    conn.release();
  })
});

router.post('/:goodsId/update', upload.single('firstImage'), function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const { name, kind, sport, manufacturer, releaseDate, releasePrice, url, info, status} = req.body;
    let updateStatus;
    if(status === true){
      updateStatus = 2;
    }else{
      updateStatus = 1;
    }
    const goods_no = req.params.goodsId;
    let query = `BEGIN;
      UPDATE s_goods SET goods_name = ?, goods_kind = ?, goods_sport = ?, goods_manufacturer = ?, goods_releaseDate = ?, goods_releasePrice = ?, goods_url = ?, goods_info = ?, goods_status = ? WHERE goods_no = ?;
    `;
    let queryData = [name, kind, sport, manufacturer, releaseDate, releasePrice, url, info, updateStatus, goods_no];

    if(req.file){
      if(!req.body.beforeImage){
        query += `INSERT INTO s_goodsDetail (goods_no, goodsDetail_kind, goodsDetail_value) VALUES (?, ?, ?);
        `;
        queryData.push(goods_no);
        queryData.push(1);
        queryData.push(req.file.location);
      }else{
        query += `UPDATE s_goodsDetail SET goodsDetail_value = ? WHERE goods_no = ? AND goodsDetail_kind = ?;
        `;
        queryData.push(req.file.location);
        queryData.push(goods_no);
        queryData.push(1);
      }
    }

    if(req.body.fixHashtag){
      if(!req.body.beforeHashtag){
        query += `INSERT INTO s_goodsDetail (goods_no, goodsDetail_kind, goodsDetail_value) VALUES (?, ?, ?);
        `;
        queryData.push(goods_no);
        queryData.push(2);
        queryData.push(req.body.fixHashtag);
      }else{
        query += `UPDATE s_goodsDetail SET goodsDetail_value = ? WHERE goods_no = ? AND goodsDetail_kind = ?;
        `;
        queryData.push(req.body.fixHashtag);
        queryData.push(goods_no);
        queryData.push(2);
      }
    }else{
      if(req.body.beforeHashtag !== req.body.fixHashtag){
        query += `DELETE s_goodsDetail WHERE goods_no = ? AND goodsDetail_kind = ?;
        `;
        queryData.push(goods_no);
        queryData.push(2);
      }
    }

    for(let i = 0; i < req.body.hashtag.length; i++){
      query += `INSERT INTO s_goodsDetail (goods_no, goodsDetail_kind, goodsDetail_value) VALUES (?, ?, ?);
        `;
        queryData.push(goods_no);
        queryData.push(4);
        queryData.push(req.body.hashtag[i]);
    }

    for(let i = 0; i < req.body.deleteHashtage.length; i++){
      query += `DELETE FROM s_goodsDetail WHERE goodsDetail_no = ?;
        `;
        queryData.push(req.body.deleteHashtage[i]);
    }
    
    query += `COMMIT;`
    conn.query(query, queryData, (e, row) => {
      if (e) throw e;
        res.send({goods_no: goods_no});
    })
    conn.release();
  })
});

router.post('/:goodsId/withGoods', upload.single(''),function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const goods_no = req.params.goodsId;
    let queryData = [];
    let query = `BEGIN;
    `;
    for(let i = 0; i < req.body.goodsNo.length; i++){
      query += `INSERT INTO s_goodsDetail (goods_no, goodsDetail_kind, goodsDetail_value) VALUES (${goods_no}, 5, ?);
      `;
      queryData.push(req.body.goodsNo[i]);
    }
    query += `SELECT g.goods_no, g.goods_name, g.goods_manufacturer FROM s_goodsDetail AS gd INNER JOIN s_goods AS g ON gd.goodsDetail_value = g.goods_no WHERE gd.goods_no = ${goods_no} AND gd.goodsDetail_kind = 5; 
    COMMIT;`
    conn.query(query, queryData,(e, rows) => {
      if (e) throw e;
      res.send(rows[req.body.goodsNo.length+1]);
    })
    conn.release();
  })
});

router.post('/:goodsId/withGoodsDelete', upload.single(''),function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const goods_no = req.params.goodsId;
    const goodsDetail_value = req.body.goodsNo;
    const query = `DELETE FROM s_goodsDetail WHERE goods_no = ? AND goodsDetail_value = ? AND goodsDetail_kind = 5;`
    conn.query(query, [goods_no, goodsDetail_value],(e, row) => {
      if (e) throw e;
      res.send({result: row.affectedRows}); 
      console.log(row)
    })
    conn.release();
  })
});

router.post('/create', upload.single('firstImage'), function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    let query = `BEGIN;
                    INSERT INTO s_goods (goods_name, goods_kind, goods_sport, goods_manufacturer, goods_releaseDate, goods_releasePrice, goods_url, goods_info, goods_status) 
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?); 
                    SELECT MAX(goods_no) AS goods_no FROM s_goods WHERE goods_name = ?;
                    `;
    const { name, kind, sport, manufacturer, releaseDate, releasePrice, url, info } = req.body;
    let queryData = [name, kind, sport, manufacturer, releaseDate, releasePrice, url, info];
    if(req.body.status === true){
      queryData.push(2);
    }else{
      queryData.push(1);
    }
    queryData.push(name);
    if(req.file){
      query += `INSERT INTO s_goodsDetail (goods_no, goodsDetail_kind, goodsDetail_value) 
      SELECT MAX(goods_no), 1, ? 
        FROM s_goods 
        WHERE goods_name = ?
        ;`
      queryData.push(req.file.location);
      queryData.push(name);
    }
    if(req.body.fixHashtag){
      query += `INSERT INTO s_goodsDetail (goods_no, goodsDetail_kind, goodsDetail_value) 
      SELECT MAX(goods_no), 2, ? 
        FROM s_goods 
        WHERE goods_name = ?
        ;`
      queryData.push(req.body.fixHashtag);
      queryData.push(name);
    }
    query += `COMMIT;`;
    conn.query(query, queryData, (e, row) => {
      if (e) throw e;
      res.send({goods_no: row[2][0].goods_no});
    })
    conn.release();
  })
});

router.post('/imgupload', upload.array('images', 10), function(req, res, next) {
  if(req.files.length > 0){
    pool.getConnection((err, conn) => {
      if (err) {
        throw err;
      }
      let query = 'BEGIN;'
      let url = [];
      for(let i = 0; i < req.files.length; i++){
        query += 'INSERT INTO s_goodsDetail (goods_no, goodsDetail_kind, goodsDetail_value) VALUES (?, ?, ?);';
        url.push(req.body.goods_no);
        url.push(3);
        url.push(req.files[i].location);
      }
      query += 'COMMIT;'
      conn.query(query, url, (e, row) => {
        if (e) throw e;
        
      })
      conn.release();
    })
  }
});


router.post('/:goodsId/delete', upload.single(), function(req, res, next) {
  let sess = req.session;
  const { adminKey } = req.body;
  if(sess[adminKey].admin_status === 1){
    pool.getConnection((err, conn) => {
      if (err){
        throw err;
      }
      const goods_no = req.params.goodsId;
      const query = `BEGIN;
                      DELETE FROM s_goodsDetail WHERE goods_no = ${goods_no};
                      DELETE FROM s_goods WHERE goods_no = ${goods_no};
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

router.post('/:goodsId/imgupdate', upload.array('images', 10), function(req, res, next) {
  if(req.files.length > 0 || req.body.deleteImage.includes("true")){
    pool.getConnection((err, conn) => {
      if (err) {
        throw err;
      }
      let query = 'BEGIN;'
      let queryData = [];
      for(let i = 0; i < req.files.length; i++){
        query += 'INSERT INTO s_goodsDetail (goods_no, goodsDetail_kind, goodsDetail_value) VALUES (?, ?, ?);';
        queryData.push(req.params.goodsId);
        queryData.push(3);
        queryData.push(req.files[i].location);
      }
      if(req.body.deleteImage){
        for(let i = 0; i < req.body.deleteImage.length; i++){
          if(req.body.deleteImage[i] === "true"){
            query += 'DELETE FROM s_goodsDetail WHERE goodsDetail_no = ?;';
            queryData.push(req.body.deleteDetailNo[i]);
          }
        }
      }
      query += 'COMMIT;'
      conn.query(query, queryData, (e, row) => {
        if (e) throw e;
        
      })
      conn.release();
    })
  }
});

module.exports = router;
