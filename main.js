var util = require('./util')
var g = require('./grammar')

var stopwords = require('./stopWords')

var userLhs = new g.Symbol('user-lhs')
userLhs.addRule({ RHS: [ stopwords.emptyTermSym ] })


var peopleTerm = new g.Symbol('people-term')
peopleTerm.addRule({ RHS: [ 'people' ]})
peopleTerm.addRule({ RHS: [ 'users' ]})

var github = new g.Symbol('github')
github.addRule({ RHS: [ stopwords.emptyTermSym ] })
github.addRule({ RHS: [ 'GitHub' ] }) // both accepted, though FB doesn't

// make a seperate module for creating these new category functions, and variables for accessing them?
var userHead = new g.Symbol('user-head')
userHead.addRule({ RHS: [ github, peopleTerm ] })

var userLhsUserHead = new g.Symbol('user-lhs-user-head')
userLhsUserHead.addRule({ RHS: [ userLhs, userHead ] })

var userRhs = new g.Symbol('user-rhs')

var userNoRelativeBase = new g.Symbol('user-no-relative-base')
userNoRelativeBase.addRule({ RHS: [ userLhsUserHead, userRhs ] })

var userNoRelative = new g.Symbol('user-no-relative')
userNoRelative.addRule({ RHS: [ userNoRelativeBase ] })

var userPlural = new g.Symbol('user-plural')
userPlural.addRule({ RHS: [ userNoRelative ]})

var users = new g.Symbol('users')
users.addRule({ RHS: [ userPlural ] })

var start = new g.Symbol('start')
start.addRule({ RHS: [ users ]})

g.printGrammar()
