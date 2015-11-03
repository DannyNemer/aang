var g = require('../grammar')
var Category = require('./Category')
var oneSg = require('./oneSg')
var preps = require('./prepositions')
var conjunctions = require('./conjunctions')
var stopWords = require('./stopWords')
var auxVerbs = require('./auxVerbs')


// Merges this module with 'user' `Category`.
var user = module.exports = new Category({ sg: 'user', pl: 'users', isPerson: true, entities: [ 'Danny', 'Aang', 'John von Neumann', 'John' ] })

// repos people like; repos liked by people
var allUsersSemantic = g.reduceSemantic(
	g.newSemantic({ name: 'all', cost: 0.5, minParams: 1, maxParams: 1 }),
	g.newSemantic({ isArg: true, name: user.nameSg, cost: 0 })
)

user.term.addWord({
	insertionCost: 2.5,
	accepted: [ 'people', 'users' ],
})

// |GitHub users (I follow)
user.company = g.newSymbol('company')
user.companyOpt = user.company.createNonterminalOpt()
user.head.addRule({ RHS: [ user.companyOpt, user.term ] })

// Person-number property only exists for nominative case.
user.nomUsers = g.newSymbol('nom', user.namePl)
// (repos) people who follow me (like)
user.nomUsers.addRule({ RHS: [ user.plural ], personNumber: 'pl' })
// (people) {user} (follows)
user.nomUsers.addRule({ RHS: [ user.catSg ], personNumber: 'threeSg' })
// (repos) people (like)
user.nomUsers.addRule({ RHS: [ user.term ], personNumber: 'pl', semantic: allUsersSemantic, noInsertionIndexes: [ 0 ] })
// (people) I (follow)
user.nomUsers.addRule({ RHS: [ oneSg.plain ], semantic: oneSg.semantic, case: 'nom', personNumber: 'oneSg' })

// No personNumber because only used in conjunctions, which are always plural.
var nomPlUsers = g.newSymbol('nom', 'pl', user.namePl)
// (people) people who follow me (and/or I follow)
nomPlUsers.addRule({ RHS: [ user.plural ] })
// (people) {user} (and/or I follow)
nomPlUsers.addRule({ RHS: [ user.catSg ] })
// (people) I (and/or {user} follow)
nomPlUsers.addRule({ RHS: [ oneSg.plain ], semantic: oneSg.semantic, case: 'nom' })

var nomPlUsersPlus = g.newSymbol(nomPlUsers.name + '+')
// (people I and/or) {user} (follow)
nomPlUsersPlus.addRule({ RHS: [ nomPlUsers ] })
// (people I and/or) {user} and {user} (follow)
var andNomPlUsersPlus = g.newBinaryRule({ RHS: [ conjunctions.and, nomPlUsersPlus ], noInsertionIndexes: [ 0, 1 ] })
nomPlUsersPlus.addRule({ RHS: [ nomPlUsers, andNomPlUsersPlus ], noInsertionIndexes: [ 0, 1 ] })
// (people I and/or) {user} or {user} (follow)
var unionNomPlUsersPlus = g.newBinaryRule({ RHS: [ conjunctions.union, nomPlUsersPlus ], noInsertionIndexes: [ 0, 1 ] })
nomPlUsersPlus.addRule({ RHS: [ nomPlUsers, unionNomPlUsersPlus ], semantic: conjunctions.unionSemantic, noInsertionIndexes: [ 0, 1 ] })

user.nomUsersPlus = g.newSymbol(user.nomUsers.name + '+')
// (people) I follow
user.nomUsersPlus.addRule({ RHS: [ user.nomUsers ] })
// (people) I and {user} follow
user.nomUsersPlus.addRule({ RHS: [ nomPlUsers, andNomPlUsersPlus ], personNumber: 'pl', noInsertionIndexes: [ 0, 1 ] })
// (people) I or {user} follow
user.nomUsersPlus.addRule({ RHS: [ nomPlUsers, unionNomPlUsersPlus ], personNumber: 'pl', semantic: conjunctions.unionSemantic, noInsertionIndexes: [ 0, 1 ] })


// (repos) I <stop> (created)
user.nomUsersPreVerbStopWord = g.newBinaryRule({ RHS: [ user.nomUsers, stopWords.preVerb ] })
// (repos) I <stop> (contributed to)
user.nomUsersPlusPreVerbStopWord = g.newBinaryRule({ RHS: [ user.nomUsersPlus, stopWords.preVerb ] })

// No insertion for '[have]' to prevent semantically identical trees from being created, such as "repos I like" suggesting "repos I have liked".
// (repos) [nom-users+] have/has (liked)
user.nomUsersPlusHaveNoInsert = g.newBinaryRule({ RHS: [ user.nomUsersPlus, auxVerbs.have ], noInsertionIndexes: [ 1 ] })
// (repos) [nom-users+] have/has <stop> (contributed to)
user.nomUsersPlusHaveNoInsertPreVerbStopWord = g.newBinaryRule({ RHS: [ user.nomUsersPlus, auxVerbs.haveNoInsertPreVerbStopWord ], noInsertionIndexes: [ 1 ] })

// (repos) [nom-users+] do/does not (like)
user.nomUsersPlusDoPresentNegation = g.newBinaryRule({ RHS: [ user.nomUsersPlus, auxVerbs.doPresentNegation ] })
// (repos) [nom-users+] did not (fork)
user.nomUsersPlusDoPastNegation = g.newBinaryRule({ RHS: [ user.nomUsersPlus, auxVerbs.doPastNegation ] })
// (repos) [nom-users+] have/has not (liked)
// No insertion for '[have]' to prevent "repos I not" suggesting two semantically identical trees: "have not" and "do not".
user.nomUsersPlusHaveNoInsertNegation = g.newBinaryRule({ RHS: [ user.nomUsersPlus, auxVerbs.haveNoInsertNegation ] })


user.objUser = g.newSymbol('obj', user.nameSg)
// (people who follow) anyone
user.objUser.addRule({ isTerminal: true, RHS: 'anyone', semantic: allUsersSemantic })
// (people who follow) {user}; (people followed by) {user}
user.objUser.addRule({ RHS: [ user.catSg ] })
// (people who follow) me; (people followed by) me
user.objUser.addRule({ RHS: [ oneSg.plain ], semantic: oneSg.semantic, case: 'obj' })

var objUsers = g.newSymbol('obj', user.namePl)
// (people who follow) {user}/me
objUsers.addRule({ RHS: [ user.objUser ] })
// (people who follow) people who...; (people followed by) people who...
objUsers.addRule({ RHS: [ user.plural ] })
// (people who follow) people; (people followed by) people
objUsers.addRule({ RHS: [ user.term ], semantic: allUsersSemantic, noInsertionIndexes: [ 0 ] })

// (people who follow) me and/or {user}; (people followed by) me and/or {user}
user.objUsersPlus = conjunctions.addForSymbol(objUsers)

// (people followed) by [obj-users+]; (repos liked) by [obj-users+]
user.byObjUsersPlus = g.newBinaryRule({ RHS: [ preps.agent, user.objUsersPlus ], noInsertionIndexes: [ 1 ] })

// (repos created) by [obj-users]
user.byObjUsers = g.newBinaryRule({ RHS: [ preps.agent, objUsers ] })


// {user:'s} (repositories); followers of {user:'s}
// This is a temporary solution.
user.possessive = g.newSymbol(user.nameSg + ':\'s')
user.possessive.addRule({
	isTerminal: true,
	RHS: g.newEntityCategory({ name: user.nameSg + ':\'s', entities: [ 'Danny\'s', 'Aang\'s', 'John von Neumann\'s', 'John\'s' ] }),
	isPlaceholder: true,
})


// GENDER:
var usersGenderSemantic = g.newSemantic({ name: g.hyphenate(user.namePl, 'gender'), cost: 0.5, minParams: 1, maxParams: 1, forbidsMultiple: true })
var usersGenderFemaleSemantic = g.reduceSemantic(usersGenderSemantic, g.newSemantic({ isArg: true, name: 'female', cost: 0 }))
var usersGenderMaleSemantic = g.reduceSemantic(usersGenderSemantic, g.newSemantic({ isArg: true, name: 'male', cost: 0 }))

// female (followers of mine); (people who are) female
user.adjective.addRule({ isTerminal: true, RHS: 'female', semantic: usersGenderFemaleSemantic })
// male (followers of mine); (people who are) male
user.adjective.addRule({ isTerminal: true, RHS: 'male', semantic: usersGenderMaleSemantic })

var womenTerm = g.newSymbol('women', 'term')
womenTerm.addWord({
	accepted: [ 'women', 'females' ],
})
// women (who follow me); (people who are) women; women
user.head.addRule({ RHS: [ womenTerm ], semantic: usersGenderFemaleSemantic })

var menTerm = g.newSymbol('men', 'term')
menTerm.addWord({
	accepted: [ 'men', 'males' ],
})
// men (who follow me); (people who are) men; men
user.head.addRule({ RHS: [ menTerm ], semantic: usersGenderMaleSemantic })