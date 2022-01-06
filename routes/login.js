var express = require('express');
const { UpgradeRequired } = require('http-errors');
var router = express.Router();
const pool = require('../config/dbconfig');

const { OAuth2Client } = require('google-auth-library');

var client_id = 'YxD7HKQsx5SslP1h4zau';
var client_secret = 'wucpAPCoLg';
var state = "RANDOM_STATE";
var redirectURI = encodeURI("http://localhost:5000/api/login/callback");
var api_url = "";

router.get('/admin', function(req, res, next) {
  pool.getConnection((err, conn) => {
    if (err){
      throw err;
    }
    const query = `SELECT u.user_no, u.user_name, u.user_profile, u.user_status, GROUP_CONCAT(us.sport_no) AS sport_no FROM s_user AS u LEFT JOIN s_userSport AS us ON u.user_no = us.user_no WHERE u.user_no = 59 GROUP BY u.user_no;`;
    conn.query(query, (e, row) => {
      if (e) throw e;  
        let sess = req.session;
        const uniqueInt = Date.now();
        sess[uniqueInt+row[0].user_no] = {
            user_no: row[0].user_no,
            user_name: row[0].user_name,
            user_profile: row[0].user_profile,
            user_sport: row[0].sport_no,
            user_status: row[0].user_status,
            log_times: uniqueInt + (3600 * 10 * 10)
        }
        res.send({status: 1, userKey: uniqueInt+row[0].user_no });
    })
    conn.release();
  })
})

// router.get('/naverlogin', function (req, res) {
//   api_url = 'https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=' + client_id + '&redirect_uri=' + redirectURI + '&state=' + state;
//    res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'});
//    res.end("<a href='"+ api_url + "'><img height='50' src='http://static.nid.naver.com/oauth/small_g_in.PNG'/></a>");
//  });

// router.get('/callback', function (req, res) {
//   code = req.query.code;
//   state = req.query.state;
//   const token = "AAAAOA1DutmPEhiBdqJLE87BOpGFdg9E91QAMDd9jGIWMVZrdCYh5C61TaoWjd8P2cDYjybREkTB5FODhd8VBgTBQXg";
//   api_url = 'https://nid.naver.com/oauth2.0/token?grant_type=delete&client_id='
//    + client_id + '&client_secret=' + client_secret + '&redirect_uri=' + redirectURI + '&code=' + code + '&state=' + state
//    +'&access_token='+token+'&service_provider=NAVER';
//   var request = require('request');
//   var options = {
//       url: api_url,
//       headers: {'X-Naver-Client-Id':client_id, 'X-Naver-Client-Secret': client_secret}
//    };
//   request.get(options, function (error, response, body) {
//     if (!error && response.statusCode == 200) {
//       res.writeHead(200, {'Content-Type': 'text/json;charset=utf-8'});
//       res.end(body);
//       console.log(api_url)
//     } else {
//       res.status(response.statusCode).end();
//       console.log('error = ' + response.statusCode);
//     }
//   });
// });

router.get('/naver/:token', function (req, res) {
  var header = "Bearer " + req.params.token;
  var api_url = 'https://openapi.naver.com/v1/nid/me';
  var request = require('request');
  var options = {
      url: api_url,
      headers: {'Authorization': header}
  };
  request.get(options, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      //res.send(JSON.parse(body).response);
      if(JSON.parse(body).response.email && JSON.parse(body).response.profile_image){
        pool.getConnection((err, conn) => {
          if (err){
            throw err;
          }
          const userData  = JSON.parse(body).response;
          const user_id  = userData.id;
          const query = `SELECT u.user_no, u.user_name, u.user_profile, u.user_status, GROUP_CONCAT(us.sport_no) AS sport_no  FROM s_user AS u LEFT JOIN s_userSport AS us ON u.user_no = us.user_no WHERE u.user_id = ? AND u.user_sns = 2 GROUP BY u.user_no;`;
          conn.query(query, [user_id],(e, row) => {
            if (e) throw e;
            if(row[0]){
              let sess = req.session;
              const uniqueInt = Date.now();
              sess[uniqueInt+row[0].user_no] = {
                  user_no: row[0].user_no,
                  user_name: row[0].user_name,
                  user_profile: row[0].user_profile,
                  user_sport: row[0].sport_no,
                  user_status: row[0].user_status,
                  log_times: uniqueInt + (3600 * 10 * 10)
              }
              res.send({status: 1, userKey: uniqueInt+row[0].user_no });
            }else{
              res.send({status: 2, data: {user_id: user_id, user_sns: 2, user_email: userData.email, user_profile: userData.profile_image}})
            }
          })
          conn.release();
        })
      }else{
        api_url = 'https://nid.naver.com/oauth2.0/token?grant_type=delete&client_id='
        + client_id + '&client_secret=' + client_secret + '&redirect_uri=' + redirectURI + '&code=undefined&state=undefined' 
        +'&access_token='+ req.params.token +'&service_provider=NAVER';
        var request = require('request');
        var options = {
            url: api_url,
            headers: {'X-Naver-Client-Id':client_id, 'X-Naver-Client-Secret': client_secret}
        };
        request.get(options, function (error, response, body) {
          if (!error && response.statusCode == 200) {
            console.log('error1 = ' + response.statusCode);
            res.send({status: 3})
          } else {
            res.status(response.statusCode).end();
            console.log('error1 = ' + response.statusCode);
          }
        });
      }
    } else {
      console.log('error');
      if(response != null) {
        console.log('error2 = ' + response.statusCode);
        res.send({status: 3})
      }
    }
  });
});

router.post('/google', function (req, res, next) {
  const { googleId, email, imageUrl } = req.body;
  if(email && imageUrl){
    pool.getConnection((err, conn) => {
      if (err){
        throw err;
      }
      const user_id  = googleId;
      const query = `SELECT u.user_no, u.user_name, u.user_profile, u.user_status, GROUP_CONCAT(us.sport_no) AS sport_no FROM s_user AS u LEFT JOIN s_userSport AS us ON u.user_no = us.user_no WHERE u.user_id = ? AND u.user_sns = 3 GROUP BY u.user_no;`;
      conn.query(query, [user_id],(e, row) => {
        if (e) throw e;
        if(row[0]){
          let sess = req.session;
          const uniqueInt = Date.now();
          sess[uniqueInt+row[0].user_no] = {
              user_no: row[0].user_no,
              user_name: row[0].user_name,
              user_profile: row[0].user_profile,
              user_sport: row[0].sport_no,
              user_status: row[0].user_status,
              log_times: uniqueInt + (3600 * 10 * 10)
          }
          res.send({status: 1, userKey: uniqueInt+row[0].user_no });
        }else{
          res.send({status: 2, data: {user_id: user_id, user_sns: 3, user_email: email, user_profile: imageUrl}})
        }
      })
      conn.release();
    })
  }else{
    res.send({status: 3});
  }
});

router.get('/google/:token', function (req, res) {
  const client = new OAuth2Client('758180950975-qf2hd13t95g8v6me465ren4bmudn4vod.apps.googleusercontent.com');
  async function verify(){
    const ticket = await client.verifyIdToken({
      idToken: req.params.token
    })
    const payload = ticket.getPayload();
    insertUserIntoDB(payload);
  }
  verify();
  const insertUserIntoDB = (payload) => {
    const {
        sub,
        email
    } = payload;
    if(payload.email){
      pool.getConnection((err, conn) => {
        if (err){
          throw err;
        }
        const user_id  = payload.sub;
        const query = `SELECT u.user_no, u.user_name, u.user_profile, u.user_status, GROUP_CONCAT(us.sport_no) AS sport_no FROM s_user AS u LEFT JOIN s_userSport AS us ON u.user_no = us.user_no WHERE u.user_id = ? AND u.user_sns = 3 GROUP BY u.user_no;`;
        conn.query(query, [user_id],(e, row) => {
          if (e) throw e;
          if(row[0]){
            let sess = req.session;
            const uniqueInt = Date.now();
            sess[uniqueInt+row[0].user_no] = {
                user_no: row[0].user_no,
                user_name: row[0].user_name,
                user_profile: row[0].user_profile,
                user_sport: row[0].sport_no,
                user_status: row[0].user_status,
                log_times: uniqueInt + (3600 * 10 * 10)
            }
            res.send({status: 1, userKey: uniqueInt+row[0].user_no });
          }else{
            res.send({status: 2, data: {user_id: user_id, user_sns: 3, user_email: payload.email, user_profile: null}})
          }
        })
        conn.release();
      })
    }else{
      res.send({status: 3});
    }
  }
  
});

router.post('/kakao', function (req, res, next) {
  const { kakaoId, email, imageUrl } = req.body;
  if(email && imageUrl){
    pool.getConnection((err, conn) => {
      if (err){
        throw err;
      }
      const user_id  = kakaoId;
      const query = `SELECT u.user_no, u.user_name, u.user_profile, u.user_status, GROUP_CONCAT(us.sport_no) AS sport_no FROM s_user AS u LEFT JOIN s_userSport AS us ON u.user_no = us.user_no WHERE u.user_id = ? AND u.user_sns = 1 GROUP BY u.user_no;`;
      conn.query(query, [user_id],(e, row) => {
        if (e) throw e;
        if(row[0]){
          let sess = req.session;
          const uniqueInt = Date.now();
          sess[uniqueInt+row[0].user_no] = {
              user_no: row[0].user_no,
              user_name: row[0].user_name,
              user_profile: row[0].user_profile,
              user_sport: row[0].sport_no,
              user_status: row[0].user_status,
              log_times: uniqueInt + (3600 * 10 * 10)
          }
          res.send({status: 1, userKey: uniqueInt+row[0].user_no });
        }else{
          res.send({status: 2, data: {user_id: user_id, user_sns: 1, user_email: email, user_profile: imageUrl}})
        }
      })
      conn.release();
    })
  }else{
    res.send({status: 3});
  }
});

router.get('/kakao/:token', function (req, res) {
  var header = "Bearer " + req.params.token;
  var api_url = 'https://kapi.kakao.com/v2/user/me';
  var request = require('request');
  var options = {
      url: api_url,
      headers: {'Authorization': header}
  };
  request.get(options, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      const kakaoUser = JSON.parse(body);
      const email = kakaoUser.kakao_account.email
      const profileImage = kakaoUser.kakao_account.profile.thumbnail_image_url
      
      if(email && profileImage){
        pool.getConnection((err, conn) => {
          if (err){
            throw err;
          }
          const user_id  = kakaoUser.id;
          const query = `SELECT u.user_no, u.user_name, u.user_profile, u.user_status, GROUP_CONCAT(us.sport_no) AS sport_no  FROM s_user AS u LEFT JOIN s_userSport AS us ON u.user_no = us.user_no WHERE u.user_id = ? AND u.user_sns = 1 GROUP BY u.user_no;`;
          conn.query(query, [user_id],(e, row) => {
            if (e) throw e;
            if(row[0]){
              let sess = req.session;
              const uniqueInt = Date.now();
              sess[uniqueInt+row[0].user_no] = {
                  user_no: row[0].user_no,
                  user_name: row[0].user_name,
                  user_profile: row[0].user_profile,
                  user_sport: row[0].sport_no,
                  user_status: row[0].user_status,
                  log_times: uniqueInt + (3600 * 10 * 10)
              }
              res.send({status: 1, userKey: uniqueInt+row[0].user_no });
            }else{
              res.send({status: 2, data: {user_id: user_id, user_sns: 2, user_email: email, user_profile: profileImage}})
            }
          })
          conn.release();
        })
      }else{
        res.send({status: 3})
      }
    } else {
      console.log('error');
      if(response != null) {
        console.log('error2 = ' + response.statusCode);
      }
    }
  });
});

module.exports = router;