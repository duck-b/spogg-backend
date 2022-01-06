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
    cb(null, `user/shop/${Date.now()}_${file.originalname}`)
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
    const query = `SELECT shop_no AS id, shop_name, shop_phone, shop_num, shop_companyName, shop_companyPhone, 
      CONCAT(shop_address, shop_addressDetail) AS shop_address, 
      (CASE WHEN shop_kind = 1 THEN '용품' WHEN shop_kind = 2 THEN '레슨' WHEN shop_kind = 3 THEN '구장' ELSE '정지' END) AS shop_kind,
      (CASE WHEN shop_status = 2 THEN '영업' ELSE '정지' END) AS shop_status
    FROM s_shop 
    ORDER BY created_at DESC;`;
    conn.query(query, (e, rows) => {
      if (e) throw e;
      res.send(rows);
    })
    conn.release();
  })
});

router.get('/:shopId', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const shop_no = req.params.shopId;
    const query = `SELECT * FROM s_shop WHERE shop_no = ${shop_no}`;
    conn.query(query, (e, row) => {
      if (e) throw e;
      if(row[0]){
        const query = `SELECT shopImage_image FROM s_shopImage WHERE shop_no = ${shop_no}`;
        conn.query(query, (e, rowImage) => {
          if (e) throw e;
            const query = `SELECT g.goods_no, 
            (CASE WHEN goods_kind = 1 THEN '용품' WHEN goods_kind = 2 THEN '레슨' WHEN goods_kind = 3 THEN '구장' ELSE '정지' END) AS goods_kind,
            s.sport_name,
            g.goods_name 
            FROM s_shopGoods AS sg 
              INNER JOIN s_goods AS g 
              INNER JOIN s_sport AS s 
              ON sg.goods_no = g.goods_no AND g.goods_sport = s.sport_no
            WHERE sg.shop_no = ${shop_no};`;
            conn.query(query, (e, rowGoods) => {
              res.send({data: row[0], images: rowImage, goods: rowGoods, result: 1});
            })
        })
      }else{
        res.send({data: null, result: 0});
      }
    })
    conn.release();
  })
});

router.get('/:shopId/update', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const query = `SELECT * FROM s_shop WHERE shop_no = ?`;
    const shop_no = req.params.shopId;
    conn.query(query, [shop_no], (e, row) => {
      if (e) throw e;
      if(row[0]){
        const query = `SELECT shopImage_no, shopImage_image FROM s_shopImage WHERE shop_no = ?`;
        conn.query(query, [shop_no], (e, rowImage) => {
          if (e) throw e;
          if(rowImage[0]){
            res.send({data: row[0], images: rowImage, result: 1});
          }else{
            res.send({data: row[0], images: null,result: 1});
          }
        })
      }else{
        res.send({data: null, result: 0});
      }
    })
    conn.release();
  })
});

router.post('/:shopId/update', upload.single('logo'), function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const query = `UPDATE s_shop SET shop_name = ?, shop_phone = ?, shop_companyName = ?, shop_companyPhone = ?, shop_email = ?, shop_post = ?, shop_address = ?, shop_addressDetail = ?, shop_kind = ?, shop_status = ?, shop_homepage = ?, shop_info = ?, shop_logo = ? WHERE shop_no = ?`;
    const { name, phone, companyName, companyPhone, email, post, address, addressDetail, kind, status, homepage, info } = req.body;
    let { updateStatus, logoName } = "";
    if(status === true){
      updateStatus = 2;
    }else{
      updateStatus = 1;
    }
    if(req.file){
      logoName = req.file.location;
    }else{
      logoName = req.body.logoName;
    }
    const shop_no = req.params.shopId;
    conn.query(query, [name, phone, companyName, companyPhone, email, post, address, addressDetail, kind, updateStatus, homepage, info, logoName, shop_no], (e, row) => {
      if (e) throw e;
        res.send({result: row.affectedRows});
    })
    conn.release();
  })
});

router.post('/create', upload.single('logo'), function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err) {
      throw err;
    }
    const query = `BEGIN;
                    INSERT INTO s_member (member_status) VALUES (2); 
                    INSERT INTO s_shop (shop_no, shop_num, shop_pw, shop_name, shop_phone, shop_email, shop_companyName, shop_companyPhone, shop_post, shop_address, shop_addressDetail, shop_kind, shop_homepage, shop_info, shop_status, shop_logo) 
                      SELECT MAX(member_no), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? 
                        FROM s_member 
                        WHERE member_status = 2;
                    SELECT shop_no FROM s_shop WHERE shop_num = ?;
                  COMMIT;`;
    const {num, pw, name, phone, email, companyName, companyPhone, post, address, addressDetail, kind, homepage, info, status } = req.body;
    let insertStatus;
    if(status === true){
      insertStatus = 2;
    }else{
      insertStatus = 1;
    }
    let logo;
    if(req.file){
      logo = req.file.location;
    }else{
      logo = '';
    }
    conn.query(query, [num, pw, name, phone, email, companyName, companyPhone, post, address, addressDetail, kind, homepage, info, insertStatus, logo, num], (e, row) => {
      if (e) throw e;
      res.send({shop_no: row[3][0].shop_no});
    })
    conn.release();
  })
});

router.post('/pwreset', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err){
      throw err;
    }
    const query = `UPDATE s_shop SET shop_pw = ? WHERE shop_no = ?`;
    const {shop_no, shop_pw} = req.body;
    conn.query(query, [shop_pw, shop_no], (e, row) => {
      if (e) throw e;
      res.send({result: row.affectedRows});
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
        query += 'INSERT INTO s_shopImage (shop_no, shopImage_image) VALUES (?, ?);';
        url.push(req.body.shop_no);
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

router.post('/:shopId/goods', upload.single(), function(req, res, next) {
    pool.getConnection((err, conn) => {
      if (err){
        throw err;
      }
      const shop_no = req.params.shopId;
      let query = `BEGIN;
      `
      for(let i = 0; i < req.body.goodsNo.length; i++){
        query += `INSERT INTO s_shopGoods (shop_no, goods_no) VALUES (${shop_no}, ${req.body.goodsNo[i]});`;
      }
      query += `SELECT g.goods_no, 
        (CASE WHEN goods_kind = 1 THEN '용품' WHEN goods_kind = 2 THEN '레슨' WHEN goods_kind = 3 THEN '구장' ELSE '정지' END) AS goods_kind,
        s.sport_name,
        g.goods_name 
        FROM s_shopGoods AS sg 
          INNER JOIN s_goods AS g 
          INNER JOIN s_sport AS s 
          ON sg.goods_no = g.goods_no AND g.goods_sport = s.sport_no
        WHERE sg.shop_no = ${shop_no};
        COMMIT;`
      conn.query(query, (e, rows) => {
        if (e) throw e;
        res.send({data: rows[req.body.goodsNo.length+1]});
      })
      conn.release();
    })
});

router.post('/:shopId/delete', upload.single(), function(req, res, next) {
  let sess = req.session;
  const { adminKey } = req.body;
  if(sess[adminKey].admin_status === 1){
    pool.getConnection((err, conn) => {
      if (err){
        throw err;
      }
      const shop_no = req.params.shopId;
      const query = `BEGIN;
                      DELETE FROM s_shopGoods WHERE shop_no = ${shop_no};
                      DELETE FROM s_shopImage WHERE shop_no = ${shop_no};
                      DELETE FROM s_shop WHERE shop_no = ${shop_no};
                      DELETE FROM s_member WHERE member_no = ${shop_no};
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

router.post('/:shopId/goodsDelete', upload.single(), function(req, res, next) {
    pool.getConnection((err, conn) => {
      if (err){
        throw err;
      }
      const shop_no = req.params.shopId;
      const goods_no = req.body.goodsNo;
      const query = `BEGIN;
                      DELETE FROM s_shopGoods WHERE shop_no = ${shop_no} AND goods_no = ${goods_no};
                      COMMIT;`;
      conn.query(query, (e, row) => {
        if (e) throw e;
        res.send({result: 1});
      })
      conn.release();
    })
});

router.post('/:shopId/imgupdate', upload.array('images', 10), function(req, res, next) {
  if(req.files.length > 0 || req.body.deleteImage.includes("true")){
    pool.getConnection((err, conn) => {
      if (err) {
        throw err;
      }
      let query = 'BEGIN;'
      let queryData = [];
      for(let i = 0; i < req.files.length; i++){
        query += 'INSERT INTO s_shopImage (shop_no, shopImage_image) VALUES (?, ?);';
        queryData.push(req.params.shopId);
        queryData.push(req.files[i].location);
      }
      if(req.body.deleteImage){
        for(let i = 0; i < req.body.deleteImage.length; i++){
          if(req.body.deleteImage[i] === "true"){
            query += 'DELETE FROM s_shopImage WHERE shopImage_no = ?;';
            queryData.push(req.body.deleteImageNo[i]);
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
