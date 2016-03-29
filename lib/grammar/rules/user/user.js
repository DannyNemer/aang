var g = require('../../grammar')
var oneSg = require('./oneSg')
var anaphora = require('./anaphora')
var preps = require('../prepositions')
var conjunctions = require('../conjunctions')
var stopWords = require('../stopWords')
var auxVerbs = require('../auxVerbs')


var user = g.newCategory({
	sg: 'user',
	pl: 'users',
	isPerson: true,
	entities: [
		'Danny',
		'Aang',
		'John',
		// Test ambiguity with entities. E.g., "people who follow John".
		'John von Neumann',
		// Test scoring multi-token entity matches. E.g., "John Neumann" matches "John von Neumann" with a higher score (i.e., cheaper cost) than "John" and "Neumann".
		'Neumann',
		// Test deletables in entity names.
		'John not Neumann',
		// Test ambiguity with overlapping entity matches. E.g., "people who follow George Bush" -> "people who follow George <Bush and Jeb> Bush".
		'George Bush',
		'Jeb Bush',
		// Test duplicate entity tokens within the same entity.
		'Marc Marc',
		// Test rejection of incorrect count of token matches. E.g., "Max Max" is accepted and "Max Max Max" is rejected though the same number of tokens.
		'Max Planck Max',
		'Richard Feynman',
		'Elizabeth Cady Stanton',
		// Test ambiguity where multi-token names for the same entity contain an identical token. A match to only that token matches both names, which both map to the same entity (id and display text). E.g., "people who follow Alan".
		{ display: 'Alan Kay', names: [ 'Alan Kay', 'Alan Curtis' ] },
		// Test ambiguity where a multi-token name contains a token that is also a uni-token name for the same entity. A match to only that token matches both names, which both map to the same entity (id and display text). E.g., "people who follow Iroh".
		{ display: 'Iroh', names: [ 'Iroh', 'General Iroh', 'Uncle Iroh' ] },
		'Marvin Minsky',
		'John McCarthy',
	],
})

// repos people like; repos liked by people; people who follow anyone
var allUsersSemantic = g.reduceSemantic(
	g.newSemantic({ name: 'all', cost: 0.5, minParams: 1, maxParams: 1 }),
	g.newSemantic({ isArg: true, name: user.nameSg, cost: 0 })
)

user.term.addWord({
	insertionCost: 2.5,
	accepted: [ 'people', 'users' ],
})

// |GitHub users (I follow)
user.service = g.newSymbol(user.namePl, 'service')
user.serviceOpt = user.service.createNonterminalOpt()
user.head.addRule({ rhs: [ user.serviceOpt, user.term ] })

// Person-number property exists only for nominative case.
// (repos) I/`{user}`/people-who... (created)
user.nomUsers = g.newSymbol('nom', user.namePl)
// (repos) people who follow me (like)
user.nomUsers.addRule({
	rhs: [ user.plural ],
	personNumber: 'pl',
})
// (people) `{user}` (follows)
user.nomUsers.addRule({
	rhs: [ user.sg ],
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
	grammaticalForm: 'nom',
	personNumber: 'oneSg',
})
// (repos `{user}` likes that) he/she (contributed to)
user.nomUsers.addRule({
	rhs: [ anaphora.threeSg ],
	grammaticalForm: 'nom',
	personNumber: 'threeSg',
	anaphoraPersonNumber: 'threeSg',
})
// (repos my followers like that) they (contributed to)
user.nomUsers.addRule({
	rhs: [ anaphora.threePl ],
	grammaticalForm: 'nom',
	personNumber: 'pl',
	anaphoraPersonNumber: 'threePl',
})

// No `personNumber` because only used in conjunctions, which are always plural.
var nomUsersPlural = g.newSymbol('nom', user.namePl, 'plural')
// (people) people who follow me (and/or I follow)
nomUsersPlural.addRule({ rhs: [ user.plural ] })
// (people) `{user}` (and/or I follow)
nomUsersPlural.addRule({ rhs: [ user.sg ] })
// (people) I (and/or `{user}` follow)
nomUsersPlural.addRule({ rhs: [ oneSg.pronoun ], semantic: oneSg.semanticArg, grammaticalForm: 'nom' })
// ({user:'s} followers) he (and/or I follow)
nomUsersPlural.addRule({ rhs: [ anaphora.threeSg ], grammaticalForm: 'nom', anaphoraPersonNumber: 'threeSg' })
// (my followers' repos liked by people) they (and/or I follow)
nomUsersPlural.addRule({ rhs: [ anaphora.threePl ], grammaticalForm: 'nom', anaphoraPersonNumber: 'threePl' })

// Lacks person-number properties because used by `[nom-users+]` in conjunctions, enabling correct conjugation of queries such as "people Danny and Aang follow".
var nomUsersPluralPlus = conjunctions.create(nomUsersPlural, true)
var nomUsersPluralAndNomUsersPluralPlusNoUnionRule = nomUsersPluralPlus.rules[1]
var nomUsersPluralPlusNoUnionNomUsersPluralPlusRule = nomUsersPluralPlus.rules[2]

// Do not use `conjunctions.create()` because conjunctions must use `[nom-users-plural]`, which lack person-number properties, to enable proper conjugation.
// (repos) I/`{user}`/people-who... [and/or `[nom-users+]`] (liked)
user.nomUsersPlus = g.newSymbol(user.nomUsers.name + '+')
// (people) `[nom-users]` (follow)
user.nomUsersPlus.addRule({
	rhs: [ user.nomUsers ],
})
// Define `personNumber` for conjunctions to enable "people I and Danny follow", using sub-rules which lack person-number properties.
// (people) `[nom-users-plural]` and `[nom-users-plural]` [and `[nom-users-plural]` ...] (follow)
user.nomUsersPlus.addRule({
	rhs: nomUsersPluralAndNomUsersPluralPlusNoUnionRule.rhs,
	noInsertionIndexes: nomUsersPluralAndNomUsersPluralPlusNoUnionRule.noInsertionIndexes,
	personNumber: 'pl',
})
// (people) `[nom-users-plural]` [and `[nom-users-plural]` ...] or `[nom-pl-users+]` (follow)
user.nomUsersPlus.addRule({
	rhs: nomUsersPluralPlusNoUnionNomUsersPluralPlusRule.rhs,
	noInsertionIndexes: nomUsersPluralPlusNoUnionNomUsersPluralPlusRule.noInsertionIndexes,
	semantic: nomUsersPluralPlusNoUnionNomUsersPluralPlusRule.semantic,
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
// (repos created by my followers) followers they share like
user.nomUsersPluralSubj.addRule({
	rhs: [ anaphora.threePl ],
	grammaticalForm: 'nom',
	personNumber: 'pl',
	anaphoraPersonNumber: 'threePl',
})
// (followers) `[nom-users-plural]` and `[nom-users-plural]` [and `[nom-users-plural]` ...] (share)
user.nomUsersPluralSubj.addRule({
	rhs: nomUsersPluralAndNomUsersPluralPlusNoUnionRule.rhs,
	noInsertionIndexes: nomUsersPluralAndNomUsersPluralPlusNoUnionRule.noInsertionIndexes,
	personNumber: 'pl',
})

// Only permit semantic arguments in `union()` for multiple users; i.e., prevent "`{users}` or ``{user}``".
// Following logic's order of operations, "and" takes precedence over "or". Hence, segments between "or" are grouped together with `intersect()`, which are then grouped together in `union()`.
var nomUsersPluralSubjNoUnion = g.newSymbol(user.nomUsersPluralSubj.name, 'no', 'union')
// (followers) my followers (or I and `{user}` share)
nomUsersPluralSubjNoUnion.addRule({
	rhs: [ user.plural ],
})
// (repos created by my followers followers) they (or I and `{user}` share like)
nomUsersPluralSubjNoUnion.addRule({
	rhs: [ anaphora.threePl ],
	grammaticalForm: 'nom',
	anaphoraPersonNumber: 'threePl',
})
// (followers) I and `{user}` (or `{user}` and `{user}` share)
nomUsersPluralSubjNoUnion.addRule({
	rhs: nomUsersPluralAndNomUsersPluralPlusNoUnionRule.rhs,
	noInsertionIndexes: nomUsersPluralAndNomUsersPluralPlusNoUnionRule.noInsertionIndexes,
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
// (followers) I and `{user}` or `{user}` and `{user}` (share); (followers) my followers or people I follow (share)
user.nomUsersPluralSubj.addRule({
	rhs: [ nomUsersPluralSubjNoUnionOr, nomUsersPluralSubjIntersect ],
	noInsertionIndexes: [ 0, 1 ],
	semantic: conjunctions.unionSemantic,
	personNumber: 'pl',
})


/**
 * Regarding the following two rules:
 * - No insertion for `[have]` to prevent creating multiple semantically identical trees, where this suggestion would be discarded for its higher cost. For example, if were this insertion enabled, it would enable the following suggestion: "repos I like" -> "repos I have liked".
 * - Temporarily removed `[pre-verb-stop-word]` from before `[have]`.
 */
// (repos) `[nom-users]` have/has (created)
user.nomUsersHaveNoInsert = g.newBinaryRule({
	rhs: [ user.nomUsers, auxVerbs.have ],
	noInsertionIndexes: [ 1 ],
})
// (repos) `[nom-users+]` have/has (liked)
user.nomUsersPlusHaveNoInsert = g.newBinaryRule({
	rhs: [ user.nomUsersPlus, auxVerbs.have ],
	noInsertionIndexes: [ 1 ],
})

// (repos) `[nom-users]` did not (`[verb]`)
// NOTE: Not currently in use.
user.nomUsersDoPresentNegation = g.newBinaryRule({ rhs: [ user.nomUsers, auxVerbs.doPresentNegation ] })
// (repos) `[nom-users+]` do/does not (like)
user.nomUsersPlusDoPresentNegation = g.newBinaryRule({ rhs: [ user.nomUsersPlus, auxVerbs.doPresentNegation ] })

// (repos) `[nom-users]` did not (create)
user.nomUsersDoPastNegation = g.newBinaryRule({ rhs: [ user.nomUsers, auxVerbs.doPastNegation ] })
// (repos) `[nom-users+]` did not (fork)
user.nomUsersPlusDoPastNegation = g.newBinaryRule({ rhs: [ user.nomUsersPlus, auxVerbs.doPastNegation ] })

/**
 * For the following two rules, no insertion for `[have]` to prevent creating multiple semantically identical trees. For example, were this insertion possible, it would enable the following semantically duplicate suggestions:
 *   "repos I not" -> "repos I have not", "repos I do not"
 */
// (repos) `[nom-users]` have/has not (`[verb]`)
// NOTE: Not currently in use.
user.nomUsersHaveNoInsertNegation = g.newBinaryRule({ rhs: [ user.nomUsers, auxVerbs.haveNoInsertNegation ] })
// (repos) `[nom-users+]` have/has not (liked)
user.nomUsersPlusHaveNoInsertNegation = g.newBinaryRule({ rhs: [ user.nomUsersPlus, auxVerbs.haveNoInsertNegation ] })


user.objUser = g.newSymbol('obj', user.nameSg)
// (people who follow) anyone
user.objUser.addRule({ isTerminal: true, rhs: 'anyone', semantic: allUsersSemantic })
// (people who follow) `{user}`; (people followed by) `{user}`
user.objUser.addRule({ rhs: [ user.sg ] })
// (people who follow) me; (people followed by) me
user.objUser.addRule({ rhs: [ oneSg.pronoun ], semantic: oneSg.semanticArg, grammaticalForm: 'obj' })
// ({user:'s} followers who follow) him/her; ({user:'s} followers followed by) him/her
user.objUser.addRule({ rhs: [ anaphora.threeSg ], grammaticalForm: 'obj', anaphoraPersonNumber: 'threeSg' })

// (repos created by) me/`{user}`/people-who...
user.objUsers = g.newSymbol('obj', user.namePl)
// (people who follow) `{user}`/me
user.objUsers.addRule({ rhs: [ user.objUser ] })
// (people who follow) people who...; (people followed by) people who...
user.objUsers.addRule({ rhs: [ user.plural ] })
// (my followers' followers who follow) them; (my followers' repos liked by) them
user.objUsers.addRule({ rhs: [ anaphora.threePl ], grammaticalForm: 'obj', anaphoraPersonNumber: 'threePl' })
// (people who follow) people; (people followed by) people
user.objUsers.addRule({
	rhs: [ user.term ],
	noInsertionIndexes: [ 0 ],
	semantic: allUsersSemantic,
})

// (people who follow) me/`{user}`/people-who... [and/or `[obj-users+]`]
// (repos liked by) me/`{user}`/people-who... [and/or `[obj-users+]`]
user.objUsersPlus = conjunctions.create(user.objUsers)

// (repos created) by me/`{user}`/people-who...
user.byObjUsers = g.newBinaryRule({ rhs: [ preps.agent, user.objUsers ] })
// (repos liked) by me/`{user}`/people-who... [and/or `[obj-users+]`]
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

// Export `user` `Category`, which include the above rules saved to the category.
module.exports = user

// Load `user`-specific rules.
require('./followers')
require('./gender')