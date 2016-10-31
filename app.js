var express = require('express')
  , expressLayouts = require('express-ejs-layouts')
  , session = require('express-session')
  , request = require('request')
  , logger = require('morgan')
  , passport = require('passport')
  , util = require('util')
  , crypto = require('crypto')
  , RedditStrategy = require('passport-reddit').Strategy;

var REDDIT_CLIENT_ID = "7rXurT-lQ5rzUA";
var REDDIT_CLIENT_SECRET = "dd6Xrwek2sY9rblM0JgG3Vxyois";


// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Reddit profile is
//   serialized and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


// Use the RedditStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and Reddit
//   profile), and invoke a callback with a user object.
passport.use(new RedditStrategy({
    clientID: REDDIT_CLIENT_ID,
    clientSecret: REDDIT_CLIENT_SECRET,
    callbackURL: "http://127.0.0.1:3000/auth/reddit/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {

      // To keep the example simple, the user's Reddit profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the Reddit account with a user record in your database,
      // and return that user instead.
      profile.token = accessToken;
      return done(null, profile);
    });
  }
));


var app = express();

// configure Express
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(logger('dev'));
app.use(session({
  resave: false,
  saveUninitialized: false,
  secret: 'keyboard cat'
}));
// Initialize Passport!  Also use passport.session() middleware, to support
// persistent login sessions (recommended).
app.use(passport.initialize());
app.use(passport.session());
app.use(expressLayouts);

app.get('/', ensureAuthenticated, function(req, res){
  var fullUser = req.user;
  var breakdown = [];
  var submitUrl = '//www.reddit.com/r/KarmaAnalysis/submit?';
  var postTitle = '/u/' + fullUser.name + '\'s Karma Analysis';
  var postHeader = '#[/u/' + fullUser.name + '](\/\/reddit.com/u/' + fullUser.name +')\'s Karma Analysis\n--\n';
  var postText = '####Link Karma: ' + fullUser.link_karma + '\n####Comment Karma: ' + fullUser.comment_karma + '\nSubreddit | Post Karma | Comment Karma\n:--|:--|:--';
  request({
    url: 'https://oauth.reddit.com/api/v1/me/karma',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'web_server:karmaanalysis:v1.0.0', 'Authorization': 'Bearer ' + fullUser.token },
    json: true
  }, function(error, response, body) {
    if (error) {
      return console.error('Error: ', error);
    } else if (response.statusCode !== 200) {
      return console.error('Error: ', response);
    } else {
      for(var i = 0; i < body.data.length; i++) {
      var subredditName = body.data[i].sr;
      var subredditLink = '//www.reddit.com/r/' + subredditName;
      var linkKarma = body.data[i].link_karma;
      var commentKarma = body.data[i].comment_karma;

        postText += '\n[' + subredditName + '](' + subredditLink + ') | ' + linkKarma + ' | ' + commentKarma + ' ';

        breakdown.push({
          subreddit_name: subredditName,
          subreddit_link: subredditLink,
          link_karma: linkKarma,
          comment_karma: commentKarma
        }); 
      }
    }

    fullUser.breakdown = breakdown;
    fullUser.markdown = postHeader + postText;
    fullUser.submit_link = submitUrl + 'title='+ encodeURIComponent(postTitle) + '&text=' + encodeURIComponent(postHeader + postText);

    res.render('index', { user: fullUser });
  });
});

app.get('/login', function(req, res){
  res.render('login', { user: req.user });
});

app.get('/index2', function(req, res){
  res.render('index2', { user: req.user });
});


var randomString = crypto.randomBytes(32).toString('hex');

// GET /auth/reddit
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Reddit authentication will involve
//   redirecting the user to reddit.com.  After authorization, Reddit
//   will redirect the user back to this application at /auth/reddit/callback
//
//   Note that the 'state' option is a Reddit-specific requirement.
app.get('/auth/reddit', function(req, res, done){
  passport.authenticate('reddit', {
    state: randomString,
    duration: 'temporary',
    scope: 'identity,mysubreddits'
  })(req, res, done);
});


// GET /auth/reddit/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/reddit/callback', function(req, res, done){
  // Check for origin via state token
  if (req.query.state == randomString){
    passport.authenticate('reddit', {
      successRedirect: '/',
      failureRedirect: '/login'
    })(req, res, done);
  } else {
    done(new Error(403));
  }
});

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.listen(3000);


// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login');
}