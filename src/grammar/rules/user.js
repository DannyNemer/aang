var g = require('../grammar')
var category = require('./category')
var oneSg = require('./oneSg')
var preps = require('./prepositions')
var conjunctions = require('./conjunctions')
var stopWords = require('./stopWords')
var auxVerbs = require('./auxVerbs.js')


// Merges this module with 'user' category
var user = module.exports = category.new({ sg: 'user', pl: 'users', isPerson: true, entities: [ 'Danny', 'Aang' ] })

user.term.addWord({
	insertionCost: 2.5,
	accepted: [ 'people', 'users' ]
})

// |GitHub users (I follow)
user.company = g.newSymbol('company')
user.companyOpt = user.company.createNonterminalOpt()
user.head.addRule({ RHS: [ user.companyOpt, user.term ] })


// Person-number property only exists for nominative case
var nomUsers = g.newSymbol('nom', user.namePl)
// (repos) people who follow me (like)
nomUsers.addRule({ RHS: [ user.plural ], personNumber: 'pl' })
// (people) {user} (follows)
nomUsers.addRule({ RHS: [ user.catSg ], personNumber: 'threeSg' })
// nomUsers.addRule({ RHS: [ user.term ], personNumber: 'pl' }) // there is a semantic, no cost
// (people) I (follow)
nomUsers.addRule({ RHS: [ oneSg.plain ], semantic: oneSg.semantic, gramCase: 'nom', personNumber: 'one' })

// No personNumber because only used in conjunctions, which are always plural
var nomPlUsers = g.newSymbol('nom', 'pl', user.namePl)
// (people) people who follow me (and/or I follow)
nomPlUsers.addRule({ RHS: [ user.plural ] })
// (people) {user} (and/or I follow)
nomPlUsers.addRule({ RHS: [ user.catSg ] })
// (people) I (and/or {user} follow)
nomPlUsers.addRule({ RHS: [ oneSg.plain ], semantic: oneSg.semantic, gramCase: 'nom' })

var nomPlUsersPlus = g.newSymbol(nomPlUsers.name + '+')
// (people I and/or) {user} (follow)
nomPlUsersPlus.addRule({ RHS: [ nomPlUsers ] })
// (people I and/or) {user} and {user} (follow)
var andNomPlUsersPlus = g.newBinaryRule({ RHS: [ conjunctions.and, nomPlUsersPlus ] })
nomPlUsersPlus.addRule({ RHS: [ nomPlUsers, andNomPlUsersPlus ] })
// (people I and/or) {user} or {user} (follow)
var unionNomPlUsersPlus = g.newBinaryRule({ RHS: [ conjunctions.union, nomPlUsersPlus ] })
nomPlUsersPlus.addRule({ RHS: [ nomPlUsers, unionNomPlUsersPlus ], semantic: conjunctions.unionSemantic })

user.nomUsersPlus = g.newSymbol(nomUsers.name + '+')
// (people) I follow
user.nomUsersPlus.addRule({ RHS: [ nomUsers ] })
// (people) I and {user} follow
user.nomUsersPlus.addRule({ RHS: [ nomPlUsers, andNomPlUsersPlus ], personNumber: 'pl' })
// (people) I or {user} follow
user.nomUsersPlus.addRule({ RHS: [ nomPlUsers, unionNomPlUsersPlus ], personNumber: 'pl', semantic: conjunctions.unionSemantic })


// (repos) I <stop> (created)
user.nomUsersPreVerbStopWords = g.newBinaryRule({ RHS: [ nomUsers, stopWords.preVerb ] })

// (repos) I <stop> (contributed to)
user.nomUsersPlusPreVerbStopWords = g.newSymbol('nom', 'users', 'plus', stopWords.preVerb.name)
user.nomUsersPlusPreVerbStopWords.addRule({ RHS: [ user.nomUsersPlus, stopWords.preVerb ] })

// No insertion for '[have]' to prevent semantically identical trees from being created, such as "repos I like" suggesting "repos I have liked".
// (repos) I have (liked)
user.nomUsersPlusHaveNoInsertion = g.newBinaryRule({ RHS: [ user.nomUsersPlus, auxVerbs.haveNoInsertion ] })
// (repos) I have (contributed to)
user.nomUsersPlusHaveNoInsertionPreVerbStopWords = g.newBinaryRule({ RHS: [ user.nomUsersPlus, auxVerbs.haveNoInsertionPreVerbStopWords ]})
// (repos/issues/pull-requests) I <stop> have (created)
user.nomUsersPreVerbStopWordsHaveNoInsertion = g.newBinaryRule({ RHS: [ user.nomUsersPreVerbStopWords, auxVerbs.have ] })


var objUsers = g.newSymbol('obj', user.namePl)
// (people who follow) people who...; (people followed by) people who...
objUsers.addRule({ RHS: [ user.plural ] })
// (people who follow) {user}; (people followed by) {user}
objUsers.addRule({ RHS: [ user.catSg ] })
// (people who follow) me; (people followed by) me
objUsers.addRule({ RHS: [ oneSg.plain ], semantic: oneSg.semantic, gramCase: 'obj' })

// (people who follow) me and/or {user}; (people followed by) me and/or {user}
user.objUsersPlus = conjunctions.addForSymbol(objUsers)

// (people followed) by me; (repos liked) by me
user.byObjUsersPlus = g.newSymbol('by', 'obj', user.namePl + '+')
user.byObjUsersPlus.addRule({ RHS: [ preps.agent, user.objUsersPlus ] })

// (repos created) by me
user.byObjUsers = g.newSymbol('by', 'obj', user.namePl)
user.byObjUsers.addRule({ RHS: [ preps.agent, objUsers ] })


// {user:'s} (repositories); followers of {user:'s}
// Temporary solution
user.possessive = g.newSymbol(user.nameSg + ':\'s')
user.possessive.addRule({
	terminal: true,
	RHS: g.newEntityCategory({ name: user.nameSg + ':\'s', entities: [ 'Danny\'s' ] })
})


// GENDER:
var usersGenderSemantic = g.newSemantic({ name: g.hyphenate(user.namePl, 'gender'), cost: 0.5, minParams: 1, maxParams: 1, forbidMultiple: true })
var usersGenderFemaleSemantic = g.reduceSemantic(usersGenderSemantic, g.newSemantic({ isArg: true, name: 'female', cost: 0 }))
var usersGenderMaleSemantic = g.reduceSemantic(usersGenderSemantic, g.newSemantic({ isArg: true, name: 'male', cost: 0 }))

// female (followers of mine); (people who are) female
user.adjective.addRule({ terminal: true, RHS: 'female', semantic: usersGenderFemaleSemantic })
// male (followers of mine); (people who are) male
user.adjective.addRule({ terminal: true, RHS: 'male', semantic: usersGenderMaleSemantic })

var womenTerm = g.newSymbol('women', 'term')
womenTerm.addWord({
	accepted: [ 'women', 'females' ]
})
// women (who follow me); (people who are) women; women
user.head.addRule({ RHS: [ womenTerm ], semantic: usersGenderFemaleSemantic })

var menTerm = g.newSymbol('men', 'term')
menTerm.addWord({
	accepted: [ 'men', 'males' ]
})
// men (who follow me); (people who are) men; men
user.head.addRule({ RHS: [ menTerm ], semantic: usersGenderMaleSemantic })