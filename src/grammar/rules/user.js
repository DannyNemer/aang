var g = require('../grammar')
var Category = require('./Category')
var stopwords = require('./stopWords')
var oneSg = require('./oneSg')
var preps = require('./prepositions')
var poss = require('./poss')
var operators = require('./operators')

// Merges this module with 'user' category
var user = module.exports = new Category({ sg: 'user', pl: 'users', person: true })

var peopleTerm = g.addWord({
	name: 'people-term',
	insertionCost: 2.5,
	accepted: [ 'people', 'users' ]
})

user.companyOpt = new g.Symbol('company', 'opt')
// GitHub users I follow
user.company = new g.Symbol('company')
user.companyOpt.addRule({ RHS: [ user.company ] })
// users I follow
user.companyOpt.addRule({ terminal: true, RHS: g.emptyTermSym }) // <empty> always last for nonterm opt

// |Github users (I follow)
user.head.addRule({ RHS: [ user.companyOpt, peopleTerm ] })


var userTerm = new g.Symbol(user.nameSg)
// (people) {user} (follows); (people who follow) {user}
userTerm.addRule({ terminal: true, RHS: '{user}' })


// Person-number property only exists for nominative case
user.nomUsers = new g.Symbol('nom', 'users')
// (repos) people who follow me (like)
user.nomUsers.addRule({ RHS: [ user.plural ], personNumber: 'oneOrPl' })
// (people) {user} (follows)
user.nomUsers.addRule({ RHS: [ userTerm ], personNumber: 'threeSg' })
// (people) I (follow)
user.nomUsers.addRule({ RHS: [ oneSg.plain ], gramCase: 'nom', personNumber: 'oneOrPl' })

user.nomUsersPlus = new g.Symbol('nom', 'users+')
user.nomUsersPlus.addRule({ RHS: [ user.nomUsers ] })
// (people) I and {user} follow
var andNomUsersPlus = new g.Symbol('and', 'nom', 'users+')
andNomUsersPlus.addRule({ RHS: [ operators.and, user.nomUsersPlus ] })
user.nomUsersPlus.addRule({ RHS: [ user.nomUsers, andNomUsersPlus ], personNumber: 'oneOrPl' })
// (people) I or {user} follow
var orNomUsersPlus = new g.Symbol('or', 'nom', 'users+')
orNomUsersPlus.addRule({ RHS: [ operators.union, user.nomUsersPlus ] })
user.nomUsersPlus.addRule({ RHS: [ user.nomUsers, orNomUsersPlus ], personNumber: 'oneOrPl' })


var objUsers = new g.Symbol('obj', 'users')
// (people who follow) people who...; (people followed by) people who...
objUsers.addRule({ RHS: [ user.plural ] })
// (people who follow) {user}; (people followed by) {user}
objUsers.addRule({ RHS: [ userTerm ] })
// (people who follow) me; (people followed by) me
objUsers.addRule({ RHS: [ oneSg.plain ], gramCase: 'obj' })

user.objUsersPlus = new g.Symbol('obj', 'users+')
user.objUsersPlus.addRule({ RHS: [ objUsers ] })
// (people who follow) me and {user}; (people followed by) me and {user}
var andObjUsersPlus = new g.Symbol('and', 'obj', 'users+')
andObjUsersPlus.addRule({ RHS: [ operators.and, user.objUsersPlus ] })
user.objUsersPlus.addRule({ RHS: [ objUsers, andObjUsersPlus ] })
// (people who follow) me or {user}; (people followed by) me or {user}
var orObjUsersPlus = new g.Symbol('or', 'obj', 'users+')
orObjUsersPlus.addRule({ RHS: [ operators.union, user.objUsersPlus ] })
user.objUsersPlus.addRule({ RHS: [ objUsers, orObjUsersPlus ] })

// (people followed) by me; (repos liked) by me
user.byObjUsersPlus = new g.Symbol('by', 'obj', 'users+')
user.byObjUsersPlus.addRule({ RHS: [ preps.agent, user.objUsersPlus ] })

// (repos created) by me
user.byObjUsers = new g.Symbol('by', 'obj', 'users')
user.byObjUsers.addRule({ RHS: [ preps.agent, objUsers ] })