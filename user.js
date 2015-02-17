var g = require('./grammar')

var Category = require('./category')
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

user.head.addRule({ RHS: [ github, peopleTerm ] })


// Next: make function for [sym+] rules
// put in same module as Category

var nomUsers = new g.Symbol('nom', 'users')
nomUsers.addRule({ RHS: [ oneSg.plain ] })


// FOLLOW:
var follow = new g.Symbol('follow')
follow.addRule({ RHS: [ 'follow' ]})

var stopwordFollow = new g.Symbol('stopword', 'follow')
stopwordFollow.addRule({ RHS: [ stopwords.preVerbStopwords, follow ] })