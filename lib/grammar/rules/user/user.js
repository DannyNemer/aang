var g = require('../../grammar')
var Category = require('./../Category')
var oneSg = require('./oneSg')
var anaphora = require('./anaphora')
var preps = require('./../prepositions')
var conjunctions = require('./../conjunctions')
var stopWords = require('./../stopWords')
var auxVerbs = require('./../auxVerbs')


// Merge `module` with 'user' `Category`.
var user = module.exports = new Category({
	sg: 'user',
	pl: 'users',
	isPerson: true,
	entities: [ 'Danny', 'Aang', 'John von Neumann', 'John not Neumann', 'John', 'George Bush', 'Jeb Bush', 'Marc Marc', 'Max Planck Max', 'Richard Feynman', 'Elizabeth Cady Stanton' ],
})

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
user.head.addRule({ rhs: [ user.companyOpt, user.term ] })

// Person-number property only exists for nominative case.
user.nomUsers = g.newSymbol('nom', user.namePl)
// (repos) people who follow me (like)
user.nomUsers.addRule({
	rhs: [ user.plural ],
	personNumber: 'pl',
})
// (people) {user} (follows)
user.nomUsers.addRule({
	rhs: [ user.catSg ],
	personNumber: 'threeSg',
})
// (repos) people (like)
user.nomUsers.addRule({
	rhs: [ user.term ],
	noInsertionIndexes: [ 0 ],
	semantic: allUsersSemantic,
	personNumber: 'pl',
})
// (people) I (follow)
user.nomUsers.addRule({
	rhs: [ oneSg.pronoun ],
	semantic: oneSg.semanticArg,
	case: 'nom',
	personNumber: 'oneSg',
})
// (repos {user} likes that) he/she (contributed to)
user.nomUsers.addRule({
	rhs: [ anaphora.threeSg ],
	semantic: anaphora.threeSgSemanticArg,
	case: 'nom',
	personNumber: 'threeSg',
})

// No `personNumber` because only used in conjunctions, which are always plural.
var nomUsersPlural = g.newSymbol('nom', user.namePl, 'plural')
// (people) people who follow me (and/or I follow)
nomUsersPlural.addRule({ rhs: [ user.plural ] })
// (people) {user} (and/or I follow)
nomUsersPlural.addRule({ rhs: [ user.catSg ] })
// (people) I (and/or {user} follow)
nomUsersPlural.addRule({ rhs: [ oneSg.pronoun ], semantic: oneSg.semanticArg, case: 'nom' })
// ({user:'s} followers) he (and/or I follow)
nomUsersPlural.addRule({ rhs: [ anaphora.threeSg ], semantic: anaphora.threeSgSemanticArg, case: 'nom' })

// Lacks person-number properties because used by `[nom-users+]` in conjunctions, enabling correct conjugation of queries such as "people Danny and Aang follow".
var nomUsersPluralPlus = conjunctions.create(nomUsersPlural, true)
var nomUsersPluralAndnomUsersPluralPlusNoUnion = nomUsersPluralPlus.rules[1]
var nomUsersPluralPlusNoUnionOrnomUsersPluralPlus = nomUsersPluralPlus.rules[2]

// Do not use `conjunctions.create()` because conjunctions must use `[nom-users-plural]`, which lack person-number properties, to enable proper conjugation.
user.nomUsersPlus = g.newSymbol(user.nomUsers.name + '+')
// (people) `[nom-users]` (follow)
user.nomUsersPlus.addRule({
	rhs: [ user.nomUsers ],
})
// Define `personNumber` for conjunctions to enable "people I and Danny follow", using sub-rules which lack person-number properties.
// (people) `[nom-users-plural]` and `[nom-users-plural]` [and `[nom-users-plural]` ...] (follow)
user.nomUsersPlus.addRule({
	rhs: nomUsersPluralAndnomUsersPluralPlusNoUnion.rhs,
	noInsertionIndexes: nomUsersPluralAndnomUsersPluralPlusNoUnion.noInsertionIndexes,
	personNumber: 'pl',
})
// (people) `[nom-users-plural]` [and `[nom-users-plural]` ...] or `[nom-pl-users+]` (follow)
user.nomUsersPlus.addRule({
	rhs: nomUsersPluralPlusNoUnionOrnomUsersPluralPlus.rhs,
	noInsertionIndexes: nomUsersPluralPlusNoUnionOrnomUsersPluralPlus.noInsertionIndexes,
	semantic: nomUsersPluralPlusNoUnionOrnomUsersPluralPlus.semantic,
	personNumber: 'pl',
})


// Produces only plural subjects.
// Nearly identical rule structure to rules that `conjunctions.create()` defines, however, prevents `union()` with semantic arguments representing single users (and incorporates `[nom-pl-users+]` from above).
user.nomUsersPluralSubj = g.newSymbol(nomUsersPlural.name, 'subj')
// (followers) `[user-plural]` (share)
user.nomUsersPluralSubj.addRule({
	rhs: [ user.plural ],
	personNumber: 'pl',
})
// (followers) `[nom-users-plural]` and `[nom-users-plural]` [and `[nom-users-plural]` ...] (share)
user.nomUsersPluralSubj.addRule({
	rhs: nomUsersPluralAndnomUsersPluralPlusNoUnion.rhs,
	noInsertionIndexes: nomUsersPluralAndnomUsersPluralPlusNoUnion.noInsertionIndexes,
	personNumber: 'pl',
})

// Only permit semantic arguments in `union()` for multiple users; i.e., prevent "`{users}` or `{user}`".
// Following logic's order of operations, "and" takes precedence over "or". Hence, segments between "or" are grouped together with `intersect()`, which are then grouped together in `union()`.
var nomUsersPluralSubjNoUnion = g.newSymbol(user.nomUsersPluralSubj.name, 'no', 'union')
// (followers) my followers (or I and {user} share)
nomUsersPluralSubjNoUnion.addRule({
	rhs: [ user.plural ],
})
// (followers) I and {user} (or {user} and {user} share)
nomUsersPluralSubjNoUnion.addRule({
	rhs: nomUsersPluralAndnomUsersPluralPlusNoUnion.rhs,
	noInsertionIndexes: nomUsersPluralAndnomUsersPluralPlusNoUnion.noInsertionIndexes,
})

// Following logic's order of operations, "and" takes precedence over "or". Hence, segments between "or" are grouped together with `intersect()`, which are then grouped together in `union()`.
var nomUsersPluralSubjNoUnionOr = g.newBinaryRule({
	rhs: [ nomUsersPluralSubjNoUnion, conjunctions.union ],
	noInsertionIndexes: [ 0, 1 ],
	semantic: conjunctions.intersectSemantic,
})
var nomUsersPluralSubjIntersect = g.newSymbol(user.nomUsersPluralSubj.name, 'intersect').addRule({
	rhs: [ user.nomUsersPluralSubj ],
	semantic: conjunctions.intersectSemantic,
})
// (followers) `[nom-pl-users-subj]` [and `[nom-pl-users-subj]` ...] or `[nom-pl-users-subj+]` (share)
// (followers) I and {user} or {user} and {user} (share); (followers) my followers or people I follow (share)
user.nomUsersPluralSubj.addRule({
	rhs: [ nomUsersPluralSubjNoUnionOr, nomUsersPluralSubjIntersect ],
	noInsertionIndexes: [ 0, 1 ],
	semantic: conjunctions.unionSemantic,
	personNumber: 'pl',
})


// (repos) I <stop> [have-opt] (created)
user.nomUsersPreVerbStopWordHaveOpt = g.newBinaryRule({ rhs: [ [ user.nomUsers, stopWords.preVerb ], auxVerbs.haveOpt ] })
// (repos) I <stop> (contributed to)
user.nomUsersPlusPreVerbStopWord = g.newBinaryRule({ rhs: [ user.nomUsersPlus, stopWords.preVerb ] })

// No insertion for '[have]' to prevent semantically identical trees from being created, such as "repos I like" suggesting "repos I have liked".
// (repos) [nom-users+] have/has (liked)
user.nomUsersPlusHaveNoInsert = g.newBinaryRule({
	rhs: [ user.nomUsersPlus, auxVerbs.have ],
	noInsertionIndexes: [ 1 ],
})
// (repos) [nom-users+] have/has <stop> (contributed to)
user.nomUsersPlusHaveNoInsertPreVerbStopWord = g.newBinaryRule({
	rhs: [ user.nomUsersPlus, auxVerbs.haveNoInsertPreVerbStopWord ],
	noInsertionIndexes: [ 1 ],
})

// (repos) [nom-users+] do/does not (like)
user.nomUsersPlusDoPresentNegation = g.newBinaryRule({ rhs: [ user.nomUsersPlus, auxVerbs.doPresentNegation ] })
// (repos) [nom-users+] did not (fork)
user.nomUsersPlusDoPastNegation = g.newBinaryRule({ rhs: [ user.nomUsersPlus, auxVerbs.doPastNegation ] })
// (repos) [nom-users+] have/has not (liked)
// No insertion for '[have]' to prevent "repos I not" suggesting two semantically identical trees: "have not" and "do not".
user.nomUsersPlusHaveNoInsertNegation = g.newBinaryRule({ rhs: [ user.nomUsersPlus, auxVerbs.haveNoInsertNegation ] })


user.objUser = g.newSymbol('obj', user.nameSg)
// (people who follow) anyone
user.objUser.addRule({ isTerminal: true, rhs: 'anyone', semantic: allUsersSemantic })
// (people who follow) {user}; (people followed by) {user}
user.objUser.addRule({ rhs: [ user.catSg ] })
// (people who follow) me; (people followed by) me
user.objUser.addRule({ rhs: [ oneSg.pronoun ], semantic: oneSg.semanticArg, case: 'obj' })
// ({user:'s} followers who follow) him/her; ({user:'s} followers followed by) him/her
user.objUser.addRule({ rhs: [ anaphora.threeSg ], semantic: anaphora.threeSgSemanticArg, case: 'obj' })

user.objUsers = g.newSymbol('obj', user.namePl)
// (people who follow) {user}/me
user.objUsers.addRule({ rhs: [ user.objUser ] })
// (people who follow) people who...; (people followed by) people who...
user.objUsers.addRule({ rhs: [ user.plural ] })
// (people who follow) people; (people followed by) people
user.objUsers.addRule({
	rhs: [ user.term ],
	noInsertionIndexes: [ 0 ],
	semantic: allUsersSemantic,
})

// (people who follow) me and/or {user}; (people followed by) me and/or {user}
user.objUsersPlus = conjunctions.create(user.objUsers)

// (repos created) by [obj-users]
user.byObjUsers = g.newBinaryRule({ rhs: [ preps.agent, user.objUsers ] })
// (people followed) by [obj-users+]; (repos liked) by [obj-users+]
user.byObjUsersPlus = g.newBinaryRule({ rhs: [ preps.agent, user.objUsersPlus ] })


// {user:'s} (repositories); followers of {user:'s}
// This is a temporary solution.
user.possessive = g.newSymbol(user.nameSg + ':\'s')
user.possessive.addRule({
	isTerminal: true,
	rhs: g.newEntityCategory({
		name: user.nameSg + ':\'s',
		entities: [ 'Danny\'s', 'Aang\'s', 'John von Neumann\'s', 'John\'s' ],
		isPerson: true,
	}),
	isPlaceholder: true,
})


// Load `user` specific rules.
require('./followers')
require('./gender')