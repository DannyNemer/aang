var g = require('../grammar')
var Category = require('./Category')
var oneSg = require('./oneSg')
var preps = require('./prepositions')
var conjunctions = require('./conjunctions')
var stopWords = require('./stopWords')


// Merges this module with 'user' category
var user = module.exports = new Category({ sg: 'user', pl: 'users', person: true, entity: true })

var peopleTerm = g.addWord({
	symbol: new g.Symbol('people', 'term'),
	insertionCost: 2.5,
	accepted: [ 'people', 'users' ]
})

// |Github users (I follow)
user.company = new g.Symbol('company')
user.companyOpt = g.addNonterminalOpt(user.company)
user.head.addRule({ RHS: [ user.companyOpt, peopleTerm ] })


// Person-number property only exists for nominative case
user.nomUsers = new g.Symbol('nom', user.namePl)
// (repos) people who follow me (like)
user.nomUsers.addRule({ RHS: [ user.plural ], personNumber: 'pl' })
// (people) {user} (follows)
user.nomUsers.addRule({ RHS: [ user.catSg ], personNumber: 'threeSg' })
// (people) I (follow)
user.nomUsers.addRule({ RHS: [ oneSg.plain ], semantic: oneSg.semantic, gramCase: 'nom', personNumber: 'one' })

// (people) I and/or {user} follow
user.nomUsersPlus = conjunctions.addForSymbol(user.nomUsers, { personNumber: 'pl' })


// (repos) I <stop> (created)
user.nomUsersPreVerbStopWords = new g.Symbol('nom', 'users', 'pre', 'verb', 'stop', 'words')
user.nomUsersPreVerbStopWords.addRule({ RHS: [ user.nomUsers, stopWords.preVerb ] })

// (repos) I <stop> (contributed to)
user.nomUsersPlusPreVerbStopWords = new g.Symbol('nom', 'users', 'plus', 'pre', 'verb', 'stop', 'words')
user.nomUsersPlusPreVerbStopWords.addRule({ RHS: [ user.nomUsersPlus, stopWords.preVerb ] })


var objUsers = new g.Symbol('obj', user.namePl)
// (people who follow) people who...; (people followed by) people who...
objUsers.addRule({ RHS: [ user.plural ] })
// (people who follow) {user}; (people followed by) {user}
objUsers.addRule({ RHS: [ user.catSg ] })
// (people who follow) me; (people followed by) me
objUsers.addRule({ RHS: [ oneSg.plain ], semantic: oneSg.semantic, gramCase: 'obj' })

// (people who follow) me and/or {user}; (people followed by) me and/or {user}
user.objUsersPlus = conjunctions.addForSymbol(objUsers)

// (people followed) by me; (repos liked) by me
user.byObjUsersPlus = new g.Symbol('by', 'obj', user.namePl + '+')
user.byObjUsersPlus.addRule({ RHS: [ preps.agent, user.objUsersPlus ] })

// (repos created) by me
user.byObjUsers = new g.Symbol('by', 'obj', user.namePl)
user.byObjUsers.addRule({ RHS: [ preps.agent, objUsers ] })