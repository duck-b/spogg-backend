var express = require('express');
const { UpgradeRequired } = require('http-errors');
var router = express.Router();
const pool = require('../../config/dbconfig');

/* GET Admin login listing. */
router.post('/', function(req, res, next) {
    pool.getConnection((err, conn) => {
        if (err) {
            throw err;
        }
        const { id, pw } = req.body;
        const query = `SELECT admin_no ,admin_id, admin_status FROM s_admin WHERE admin_id = ? AND admin_pw = ?`;
        conn.query(query, [id, pw], (e, row) => {
            if (e) throw e;
            if(row[0]){
                let sess = req.session;
                const uniqueInt = Date.now();
                sess[uniqueInt+row[0].admin_no] = {
                    admin_id: row[0].admin_id,
                    admin_status: row[0].admin_status,
                    log_times: uniqueInt + (3600 * 10 * 10)
                }
                res.send({ data: row[0], result: 1, adminKey: uniqueInt+row[0].admin_no });
            }else{
                res.send({ data: null, result: 0 });
            }            
        });
        conn.release();
    })
});

router.post('/check', function(req, res, next) {
    let sess = req.session;
    const { adminCheck } = req.body;
    if(sess[adminCheck]){
        sess[adminCheck].log_times = Date.now() + (3600 * 10 * 10);
        res.send({result: 1, data: sess[adminCheck], adminKey: adminCheck});
    }else{
        res.send({result: 0, data: null})
    }
});

module.exports = router;