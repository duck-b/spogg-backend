var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var testRouter = require('./routes/test');
var userRouter = require('./routes/user');
var userPageRouter = require('./routes/user/userPage');
var loginRouter = require('./routes/login');
var logoutRouter = require('./routes/logout');
var registRouter = require('./routes/regist');
var commentRouter = require('./routes/comment');
var boardRouter = require('./routes/board');
var boardGramRouter = require('./routes/board/boardGram');
var boardPlayRouter = require('./routes/board/boardPlay');
var boardColumnRouter = require('./routes/board/boardColumn');

var adminLoginRouter = require('./routes/admin/login');
var adminLogoutRouter = require('./routes/admin/logout');
var adminUserRouter = require('./routes/admin/user');
var adminShopRouter = require('./routes/admin/shop');
var adminBoardRouter = require('./routes/admin/board');
var adminSportRouter = require('./routes/admin/sport');
var adminGoodsRouter = require('./routes/admin/goods');
var adminNoticeRouter = require('./routes/admin/notice');
var adminEventRouter = require('./routes/admin/event');

var app = express();
const port = process.env.PORT || 5000;

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  httpOnly: true,
  secret: '@#@$MYSIGN#@$#$',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    //maxAge: 1000 * 60 * 60
  },
 }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/api/test', testRouter);
app.use('/api/user', userRouter);
app.use('/api/userPage', userPageRouter);
app.use('/api/login', loginRouter);
app.use('/api/logout', logoutRouter);
app.use('/api/regist', registRouter);
app.use('/api/comment', commentRouter);
app.use('/api/board', boardRouter);
app.use('/api/boardGram', boardGramRouter);
app.use('/api/boardPlay', boardPlayRouter);
app.use('/api/boardColumn', boardColumnRouter);

//admin
app.use('/api/admin/login', adminLoginRouter);
app.use('/api/admin/logout', adminLogoutRouter);

app.use('/api/admin/user', adminUserRouter);
app.use('/api/admin/shop', adminShopRouter);
app.use('/api/admin/board', adminBoardRouter);
app.use('/api/admin/sport', adminSportRouter);
app.use('/api/admin/goods', adminGoodsRouter);
app.use('/api/admin/notice', adminNoticeRouter);
app.use('/api/admin/event', adminEventRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});
// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

app.listen(port, () => console.log(`Listening on port ${port}`));

module.exports = app;