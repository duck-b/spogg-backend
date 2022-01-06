var express = require('express');
const { UpgradeRequired } = require('http-errors');
var router = express.Router();

router.post('/', function(req, res, next) {
    let sess = req.session;
    const { adminKey } = req.body;
    res.send({result: 1})
    delete sess[adminKey];    
});

module.exports = router;