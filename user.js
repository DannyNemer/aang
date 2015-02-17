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

// var userObjFilter = new g.Symbol('user', 'obj', 'filter')
// userObjFilter.addRule({ RHS: [ nomUsers ] })

genSymPlus('user', 'obj', 'filter')


// FOLLOW:
var follow = new g.Symbol('follow')
follow.addRule({ RHS: [ 'follow' ]})

var stopwordFollow = new g.Symbol('stopword', 'follow')
stopwordFollow.addRule({ RHS: [ stopwords.preVerbStopwords, follow ] })


// Takes strings are arguments, to be concatenated as Symbol's name
function genSymPlus() {
	// Create new Symbol, based passed argument for name to g.Symbol
	var sym = new (Function.prototype.bind.apply(g.Symbol, arguments))

	arguments[Object.keys(arguments).length - 1] += '+'
	var symPlus = new (Function.prototype.bind.apply(g.Symbol, arguments))
	symPlus.addRule({ RHS: [ sym ]})

	return sym
}