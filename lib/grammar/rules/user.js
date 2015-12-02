var g = require('../grammar')
var Category = require('./Category')
var oneSg = require('./oneSg')
var preps = require('./prepositions')
var conjunctions = require('./conjunctions')
var stopWords = require('./stopWords')
var auxVerbs = require('./auxVerbs')


// Merges this module with 'user' `Category`.
var user = module.exports = new Category({ sg: 'user', pl: 'users', isPerson: true, entities: [ 'Danny', 'Aang', 'John von Neumann', 'John', 'George Bush', 'Jeb Bush', 'Marc Marc', 'Max Planck Max' ] })

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
user.nomUsers.addRule({
	RHS: [ user.plural ],
	personNumber: 'pl',
})
// (people) {user} (follows)
user.nomUsers.addRule({
	RHS: [ user.catSg ],
	personNumber: 'threeSg',
})
// (repos) people (like)
user.nomUsers.addRule({
	RHS: [ user.term ],
	noInsertionIndexes: [ 0 ],
	semantic: allUsersSemantic,
	personNumber: 'pl',
})
// (people) I (follow)
user.nomUsers.addRule({
	RHS: [ oneSg.plain ],
	semantic: oneSg.semantic,
	case: 'nom',
	personNumber: 'oneSg',
})

// No `personNumber` because only used in conjunctions, which are always plural.
var nomPlUsers = g.newSymbol('nom', 'pl', user.namePl)
// (people) people who follow me (and/or I follow)
nomPlUsers.addRule({ RHS: [ user.plural ] })
// (people) {user} (and/or I follow)
nomPlUsers.addRule({ RHS: [ user.catSg ] })
// (people) I (and/or {user} follow)
nomPlUsers.addRule({ RHS: [ oneSg.plain ], semantic: oneSg.semantic, case: 'nom' })

// Lacks person-number properties because used by `[nom-users+]` in conjunctions, enabling correct conjugation of queries such as "people Danny and Aang follow".
var nomPlUsersPlus = conjunctions.create(nomPlUsers, true)
var nomPlUsersAndNomPlUsersPlusNoUnion = nomPlUsersPlus.rules[1]
var nomPlUsersPlusNoUnionOrNomPlUsersPlus = nomPlUsersPlus.rules[2]

// Do not use `conjunctions.create()` because conjunctions must use `[nom-pl-users]`, which lack person-number properties, to enable proper conjugation.
user.nomUsersPlus = g.newSymbol(user.nomUsers.name + '+')
// (people) `[nom-users]` (follow)
user.nomUsersPlus.addRule({
	RHS: [ user.nomUsers ],
})
// Define `personNumber` for conjunctions to enable "people I and Danny follow", using sub-rules which lack person-number properties.
// (people) `[nom-pl-users]` and `[nom-pl-users]` [and `[nom-pl-users]` ...] (follow)
user.nomUsersPlus.addRule({
	RHS: nomPlUsersAndNomPlUsersPlusNoUnion.RHS,
	noInsertionIndexes: nomPlUsersAndNomPlUsersPlusNoUnion.noInsertionIndexes,
	personNumber: 'pl',
})
// (people) `[nom-pl-users]` [and `[nom-pl-users]` ...] or `[nom-pl-users+]` (follow)
user.nomUsersPlus.addRule({
	RHS: nomPlUsersPlusNoUnionOrNomPlUsersPlus.RHS,
	noInsertionIndexes: nomPlUsersPlusNoUnionOrNomPlUsersPlus.noInsertionIndexes,
	semantic: nomPlUsersPlusNoUnionOrNomPlUsersPlus.semantic,
	personNumber: 'pl',
})


// Produces only plural subjects.
// Nearly identical rule structure to rules that `conjunctions.create()` defines, however, prevents `union()` with semantic arguments representing single users (and incorporates `[nom-pl-users+]` from above).
user.nomPlUsersSubj = g.newSymbol(nomPlUsers.name, 'subj')
// (followers) `[user-plural]` (share)
user.nomPlUsersSubj.addRule({
	RHS: [ user.plural ],
	personNumber: 'pl',
})
// (followers) `[nom-pl-users]` and `[nom-pl-users]` [and `[nom-pl-users]` ...] (share)
user.nomPlUsersSubj.addRule({
	RHS: nomPlUsersAndNomPlUsersPlusNoUnion.RHS,
	noInsertionIndexes: nomPlUsersAndNomPlUsersPlusNoUnion.noInsertionIndexes,
	personNumber: 'pl',
})

// Only permit semantic arguments in `union()` for multiple users; i.e., prevent "`{users}` or `{user}`".
// Following logic's order of operations, "and" takes precedence over "or". Hence, segments between "or" are grouped together with `intersect()`, which are then grouped together in `union()`.
var nomPlUsersSubjNoUnion = g.newSymbol(user.nomPlUsersSubj.name, 'no', 'union')
// (followers) my followers (or I and {user} share)
nomPlUsersSubjNoUnion.addRule({
	RHS: [ user.plural ],
})
// (followers) I and {user} (or {user} and {user} share)
nomPlUsersSubjNoUnion.addRule({
	RHS: nomPlUsersAndNomPlUsersPlusNoUnion.RHS,
	noInsertionIndexes: nomPlUsersAndNomPlUsersPlusNoUnion.noInsertionIndexes,
})

// Following logic's order of operations, "and" takes precedence over "or". Hence, segments between "or" are grouped together with `intersect()`, which are then grouped together in `union()`.
var nomPlUsersSubjNoUnionOr = g.newBinaryRule({
	RHS: [ nomPlUsersSubjNoUnion, conjunctions.union ],
	noInsertionIndexes: [ 0, 1 ],
	semantic: conjunctions.intersectSemantic,
})
var nomPlUsersSubjIntersect = g.newSymbol(user.nomPlUsersSubj.name, 'intersect').addRule({
	RHS: [ user.nomPlUsersSubj ],
	semantic: conjunctions.intersectSemantic,
})
// (followers) `[nom-pl-users-subj]` [and `[nom-pl-users-subj]` ...] or `[nom-pl-users-subj+]` (share)
// (followers) I and {user} or {user} and {user} (share); (followers) my followers or people I follow (share)
user.nomPlUsersSubj.addRule({
	RHS: [ nomPlUsersSubjNoUnionOr, nomPlUsersSubjIntersect ],
	noInsertionIndexes: [ 0, 1 ],
	semantic: conjunctions.unionSemantic,
	personNumber: 'pl',
})


// (repos) I <stop> [have-opt] (created)
user.nomUsersPreVerbStopWordHaveOpt = g.newBinaryRule({ RHS: [ [ user.nomUsers, stopWords.preVerb ], auxVerbs.haveOpt ] })
// (repos) I <stop> (contributed to)
user.nomUsersPlusPreVerbStopWord = g.newBinaryRule({ RHS: [ user.nomUsersPlus, stopWords.preVerb ] })

// No insertion for '[have]' to prevent semantically identical trees from being created, such as "repos I like" suggesting "repos I have liked".
// (repos) [nom-users+] have/has (liked)
user.nomUsersPlusHaveNoInsert = g.newBinaryRule({
	RHS: [ user.nomUsersPlus, auxVerbs.have ],
	noInsertionIndexes: [ 1 ],
})
// (repos) [nom-users+] have/has <stop> (contributed to)
user.nomUsersPlusHaveNoInsertPreVerbStopWord = g.newBinaryRule({
	RHS: [ user.nomUsersPlus, auxVerbs.haveNoInsertPreVerbStopWord ],
	noInsertionIndexes: [ 1 ],
})

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

user.objUsers = g.newSymbol('obj', user.namePl)
// (people who follow) {user}/me
user.objUsers.addRule({ RHS: [ user.objUser ] })
// (people who follow) people who...; (people followed by) people who...
user.objUsers.addRule({ RHS: [ user.plural ] })
// (people who follow) people; (people followed by) people
user.objUsers.addRule({
	RHS: [ user.term ],
	noInsertionIndexes: [ 0 ],
	semantic: allUsersSemantic,
})

// (people who follow) me and/or {user}; (people followed by) me and/or {user}
user.objUsersPlus = conjunctions.create(user.objUsers)

// (repos created) by [obj-users]
user.byObjUsers = g.newBinaryRule({ RHS: [ preps.agent, user.objUsers ] })
// (people followed) by [obj-users+]; (repos liked) by [obj-users+]
user.byObjUsersPlus = g.newBinaryRule({ RHS: [ preps.agent, user.objUsersPlus ] })


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

// female (followers of mine); (people who are) female; (my) female (followers)
user.adjective.addRule({ isTerminal: true, RHS: 'female', semantic: usersGenderFemaleSemantic })
// male (followers of mine); (people who are) male; (my) male (followers)
user.adjective.addRule({ isTerminal: true, RHS: 'male', semantic: usersGenderMaleSemantic })

var womenTerm = g.newSymbol('women', 'term').addWord({
	accepted: [ 'women', 'females' ],
})
// women (who follow me); (people who are) women; women
user.head.addRule({ RHS: [ womenTerm ], semantic: usersGenderFemaleSemantic })

var menTerm = g.newSymbol('men', 'term').addWord({
	accepted: [ 'men', 'males' ],
})
// men (who follow me); (people who are) men; men
user.head.addRule({ RHS: [ menTerm ], semantic: usersGenderMaleSemantic })