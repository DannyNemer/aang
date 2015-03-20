var g = require('../grammar')
var Category = require('./Category')
var stopwords = require('./stopWords')
var oneSg = require('./oneSg')
var preps = require('./prepositions')
var poss = require('./poss')


var user = module.exports = new Category({ sg: 'user', pl: 'users', person: true })

var peopleTerm = g.addWord({
	name: 'people-term',
	insertionCost: 2.5,
	accepted: [ 'people', 'users' ]
})

user.github = g.addWord({
	name: 'github-opt',
	optional: true,
	accepted: [ 'GitHub' ]
})

// |Github users (I follow)
user.head.addRule({ RHS: [ user.github, peopleTerm ] })


var userTerm = new g.Symbol(user.nameSg)
// (people) {user} (follows); (people who follow) {user}
userTerm.addRule({ terminal: true, RHS: '{user}' })


var nomUsers = new g.Symbol('nom', 'users')
// (repos) people who follow me (like)
nomUsers.addRule({ RHS: [ user.plural ], personNumber: 'oneOrPl' })
// (people) {user} (follows)
nomUsers.addRule({ RHS: [ userTerm ], personNumber: 'threeSg' })
// (people) I (follow)
nomUsers.addRule({ RHS: [ oneSg.plain ], gramCase: 'nom', personNumber: 'oneOrPl' })

user.nomUsersPlus = new g.Symbol('nom', 'users+')
user.nomUsersPlus.addRule({ RHS: [ nomUsers ] })


var objUser = new g.Symbol('obj', 'user')
// (people followed by) {user}; (people who follow) {user}
objUser.addRule({ RHS: [ userTerm ], personNumber: 'threeSg' })
// (people followed by) me; (people who follow) me
objUser.addRule({ RHS: [ oneSg.plain ], gramCase: 'obj' })

var objUsers = new g.Symbol('obj', 'users')
// (people who follow) me/{user}
objUsers.addRule({ RHS: [ objUser ] })
// (people who follow) people
objUsers.addRule({ RHS: [ user.plural ] })

user.objUsersPlus = new g.Symbol('obj', 'users+')
user.objUsersPlus.addRule({ RHS: [ objUsers ] })

// (people followed) by me
user.byObjUsers = new g.Symbol('by', 'obj', 'users')
user.byObjUsers.addRule({ RHS: [ preps.agent, user.objUsersPlus ] })