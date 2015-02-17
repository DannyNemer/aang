var g = require('../grammar')
var Category = require('../category')

var stopwords = require('./stopWords')
var oneSg = require('./oneSg')


var user = new Category('user')

var users = new g.Symbol('users')
users.addRule({ RHS: [ user.plural ] })

var start = new g.Symbol('start')
start.addRule({ RHS: [ users ]})


var peopleTerm = new g.Symbol('people', 'term')
peopleTerm.addRule({ RHS: [ 'people' ]})
peopleTerm.addRule({ RHS: [ 'users' ]})

var github = new g.Symbol('github')
github.addRule({ RHS: [ stopwords.emptyTermSym ] })
github.addRule({ RHS: [ 'GitHub' ] }) // both accepted, though FB doesn't

// Github users (I follow)
user.head.addRule({ RHS: [ github, peopleTerm ] })

// (people) I (follow)
var nomUsers = new g.Symbol('nom', 'users')
nomUsers.addRule({ RHS: [ oneSg.plain ] })

// (people) I (follow)
var userObjFilter = new g.Symbol(user.name, 'obj', 'filter')
userObjFilter.addRule({ RHS: [ nomUsers ] })

var userObjFilterPlus = new g.Symbol(user.name, 'obj', 'filter+')
userObjFilterPlus.addRule({ RHS: [ userObjFilter ] })

user.rhsExt.addRule({ RHS: [ userObjFilterPlus ] })

// FOLLOW:
var follow = new g.Symbol('follow')
follow.addRule({ RHS: [ 'follow' ]})

// (people I) follow
var stopwordFollow = new g.Symbol('stopword', 'follow')
stopwordFollow.addRule({ RHS: [ stopwords.preVerbStopwords, follow ] })