var util = require('../../../util/util')
var g = require('../../grammar')
var oneSg = require('./oneSg')
var anaphora = require('./anaphora')
var preps = require('../prepositions')
var conjunction = require('../conjunction')
var stopWords = require('../stopWords')
var auxVerbs = require('../auxVerbs')


var user = g.newCategory({
	sg: 'user',
	pl: 'users',
	isPerson: true,
	headTerm: g.newTermSequence({
		symbolName: g.hyphenate('users', 'term'),
		type: g.termTypes.INVARIABLE,
		insertionCost: 2.5,
		acceptedTerms: [ 'people', 'users' ],
	}),
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
		// Test ambiguity where a multi-token name contains a token that is also a single-token name for the same entity. A match to only that token matches both names, which both map to the same entity (id and display text). E.g., "people who follow Iroh".
		{ display: 'Iroh', names: [ 'Iroh', 'General Iroh', 'Uncle Iroh' ] },
		'Marvin Minsky',
		'John McCarthy',
	],
})


// |GitHub users (I follow)
user.head.addRule({ rhs: [ user.term ] })
user.service = g.newSymbol(user.namePl, 'service')
user.head.addRule({ rhs: [ user.service, user.term ] })

// The grammatical person-number property, `personNumber`, exists only for the nominative case to conjugate the verbs that follow.
var nomUsers = g.newSymbol('nom', user.namePl)
// (repos) people who follow me (like)
nomUsers.addRule({
	rhs: [ user.plural ],
	personNumber: 'pl',
})
// (people) `{user}` (follows)
nomUsers.addRule({
	rhs: [ user.sg ],
	personNumber: 'threeSg',
})
// (people) I (follow)
nomUsers.addRule({
	rhs: [ {
		symbol: oneSg.pronoun,
		grammaticalForm: 'nom',
  } ],
	personNumber: 'oneSg',
	semantic: oneSg.semanticArg,
})
// (repos `{user}` likes that) he|she (contributed to)
nomUsers.addRule({
	rhs: [ {
		symbol: anaphora.threeSg,
		grammaticalForm: 'nom',
	} ],
	personNumber: 'threeSg',
	anaphoraPersonNumber: 'threeSg',
})
// (repos my followers like that) they (contributed to)
nomUsers.addRule({
	rhs: [ {
		symbol: anaphora.threePl,
		grammaticalForm: 'nom',
	} ],
	personNumber: 'pl',
	anaphoraPersonNumber: 'threePl',
})

/**
 * The `[nom-users-sans-person-number]` rule set is identical to `[nom-users]` without the `personNumber` rule properties.
 *
 * For use in multi-subject conjunctions within `[nom-users+]` to conjugate the nominative verbs that follow to their plural form. The base conjunction rules in `[nom-users+]` that produce at least two subjects have the necessary `personNumber` value, 'pl', while all sub-rules (i.e., `[nom-users-sans-person-number]`) in the conjunctions lack `personNumber` conjugation properties.
 *
 * `[nom-users-sans-person-number]` includes the following rules:
 *   `[user-plural]` => (people) people who follow me (and/or I follow)
 *   `[user]` => (people) `{user}` (and/or I follow)
 *   `[1-sg]` => (people) I (and/or `{user}` follow)
 *   `[3-sg]` => (`{user:'s}` followers) he (and/or I follow)
 *   `[3-pl]` => (my followers' repos liked by people) they (and/or I follow)
 *
 * Note: Should refactor this operation to avoid manually manipulating `NSymbol.rules`.
 */
var nomUsersSansPersonNumber = g.newSymbol(nomUsers.name, 'sans', 'person', 'number')
Array.prototype.push.apply(nomUsersSansPersonNumber.rules, nomUsers.rules.map(function (rule) {
	var ruleClone = util.clone(rule)
	delete ruleClone.personNumber
	return ruleClone
}))


// Lacks person-number properties because used by `[nom-users+]` in conjunctions, enabling correct conjugation of queries such as "people Danny and Aang follow".
var nomUsersSansPersonNumberPlus = conjunction.create(nomUsersSansPersonNumber, true)
var nomUsersSansPersonNumberPlusConjunctionRule = nomUsersSansPersonNumberPlus.rules[1]
var nomUsersSansPersonNumberPlusDisjunctionRule = nomUsersSansPersonNumberPlus.rules[2]

// Do not use `conjunction.create(nomUsers)` because the conjunction rules must use `[nom-users-sans-person-number]`, which lacks `personNumber` properties on the sub-rules to enable proper conjugation. This set's conjunction rules, which produces at least two subjects, have `personNumber: 'pl'` at the conjunction roots.
// (repos) I/`{user}`/people-who... [and/or `[nom-users+]`] (liked)
user.nomUsersPlus = g.newSymbol(nomUsers.name + '+')
// (people) `[nom-users]` (follow)
user.nomUsersPlus.addRule({
	// Use `[nom-users]`, which has the appropriate `personNumber` values on the sub-rules, unlike `[nom-users-sans-person-number]`, which has no `personNumber` properties (only the base `[nom-users+]` has the `personNumber` properties).
	rhs: [ nomUsers ],
})
/**
 * Define `personNumber` for conjunctions to enable "people I and Danny follow", using sub-rules that lack `personNumber` properties. As a result, `personNumber` exists only at the root of conjunctions.
 *
 * (people) `[nom-users-sans-person-number]` and `[nom-users-sans-person-number]` [and `[nom-users-sans-person-number]` ...] (follow)
 * (people) `[nom-users-sans-person-number]` [and `[nom-users-sans-person-number]` ...] or `[nom-users+]` (follow)
 *
 * Note: Should refactor this operation to avoid manually manipulating `NSymbol.rules`.
 */
Array.prototype.push.apply(user.nomUsersPlus.rules, nomUsersSansPersonNumberPlus.rules.slice(1).map(function (rule) {
	var ruleClone = util.clone(rule)
	ruleClone.personNumber = 'pl'
	return ruleClone
}))

// Manually create a disjunction rule set manually, instead of using `conjunction.createDisjunctionSet(nomUsers)`, to enable proper `personNumber` conjugation for the same reasons as `[nom-users+]`.
// For use with semantics with `forbidsMultiple`.
user.nomUsersPlusNoIntersect = g.newSymbol(user.nomUsersPlus.name, 'no', 'intersect')
// (repos) `[nom-users]` (created)
user.nomUsersPlusNoIntersect.addRule({
	rhs: [ nomUsers ],
})
// (repos) `[nom-users-sans-person-number]` or `[nom-users-sans-person-number]` [or `[nom-users-sans-person-number]` ...] (created)
// (repos) `[nom-users-sans-person-number]` and `[nom-users-sans-person-number]` (...) -> ... or `[nom-users-sans-person-number]` (...)
var nomUsersSansPersonNumberPlusNoIntersect = conjunction.createDisjunctionSet(nomUsersSansPersonNumber)
Array.prototype.push.apply(user.nomUsersPlusNoIntersect.rules, nomUsersSansPersonNumberPlusNoIntersect.rules.slice(1).map(function (rule) {
	var ruleClone = util.clone(rule)
	ruleClone.personNumber = 'pl'
	return ruleClone
}))


// Produces only plural subjects.
// Nearly identical rule structure to rules that `conjunction.create()` defines, however, prevents `union()` with semantic arguments representing single users (and incorporates `[nom-pl-users+]` from above).
user.nomUsersPluralSubj = g.newSymbol(nomUsers.name, 'plural', 'subj')
// (followers) `[user-plural]` (share)
user.nomUsersPluralSubj.addRule({
	rhs: [ user.plural ],
	personNumber: 'pl',
})
// (repos created by my followers) followers they share like
user.nomUsersPluralSubj.addRule({
	rhs: [ {
		symbol: anaphora.threePl,
		grammaticalForm: 'nom',
	} ],
	personNumber: 'pl',
	anaphoraPersonNumber: 'threePl',
})
// (followers) `[nom-users-sans-person-number]` and `[nom-users-sans-person-number]` [and `[nom-users-sans-person-number]` ...] (share)
// Note: Should refactor this operation to avoid manually manipulating `NSymbol.rules`.
var nomUsersSansPersonNumberPlusConjunctionRuleClone = util.clone(nomUsersSansPersonNumberPlusConjunctionRule)
nomUsersSansPersonNumberPlusConjunctionRuleClone.personNumber = 'pl'
user.nomUsersPluralSubj.rules.push(nomUsersSansPersonNumberPlusConjunctionRuleClone)

// Only permit semantic arguments in `union()` for multiple users; i.e., prevent "`{users}` or `{user}`".
// Following logic's order of operations, "and" takes precedence over "or". Hence, segments between "or" are grouped together with `intersect()`, which are then grouped together in `union()`.
var nomUsersPluralSubjNoUnion = g.newSymbol(user.nomUsersPluralSubj.name, 'no', 'union')
// (followers) my followers (or I and `{user}` share)
nomUsersPluralSubjNoUnion.addRule({
	rhs: [ user.plural ],
})
// (repos created by my followers followers) they (or I and `{user}` share like)
nomUsersPluralSubjNoUnion.addRule({
	rhs: [ {
		symbol: anaphora.threePl,
		grammaticalForm: 'nom',
	} ],
	anaphoraPersonNumber: 'threePl',
})
/**
 * (followers) I and `{user}` (or `{user}` and `{user}` share)
 *
 * Clone the reused rule, though without modifications, to ensure different (diversified) `cost` values.
 * Note: Should refactor this operation to avoid manually manipulating `NSymbol.rules`.
 */
nomUsersPluralSubjNoUnion.rules.push(util.clone(nomUsersSansPersonNumberPlusConjunctionRule))

// Following logic's order of operations, "and" takes precedence over "or". Hence, segments between "or" are grouped together with `intersect()`, which are then grouped together in `union()`.
var nomUsersPluralSubjNoUnionOr = g.newBinaryRule({
	rhs: [
		{ symbol: nomUsersPluralSubjNoUnion, noInsert: true },
		{ symbol: conjunction.or, noInsert: true },
	],
	semantic: conjunction.intersectSemantic,
})
var nomUsersPluralSubjIntersect = g.newSymbol(user.nomUsersPluralSubj.name, 'intersect').addRule({
	rhs: [ user.nomUsersPluralSubj ],
	semantic: conjunction.intersectSemantic,
})
// (followers) `[nom-pl-users-subj]` [and `[nom-pl-users-subj]` ...] or `[nom-pl-users-subj+]` (share)
// (followers) I and `{user}` or `{user}` and `{user}` (share); (followers) my followers or people I follow (share)
user.nomUsersPluralSubj.addRule({
	rhs: [
		{ symbol: nomUsersPluralSubjNoUnionOr, noInsert: true },
		{ symbol: nomUsersPluralSubjIntersect, noInsert: true },
	],
	personNumber: 'pl',
	semantic: conjunction.unionSemantic,
})


/**
 * Regarding the following `[have]` rules:
 * • No insertion for `[have]` to prevent creating multiple semantically identical trees, where this suggestion would be discarded for its higher cost. For example, were `[have]` insertable, it would enable the following semantically duplicate suggestions:
 *     "repos I like" -> "repos I have liked"
 *     "repos I not" -> "repos I have not", "repos I do not"
 * • Temporarily removed `[pre-verb-stop-word]` from before `[have]`.
 * • These rules are possibly inefficient. Rather, `[have]` should be paired with the verbs it precedes as part of a single term sequence to enable more term sequence flattening. This would reduce the number of paths `pfsearch` creates, through requires more grammar rules, which yields slightly more parser reductions, but is ultimately favorable.
 */
// (repos) `[nom-users+]` have/has (liked)
user.nomUsersPlusHaveNoInsert = g.newBinaryRule({
	rhs: [
		user.nomUsersPlus,
		{ symbol: auxVerbs.have, noInsert: true },
	],
})
// (repos) `[nom-users+-no-intersect]` have/has (created)
user.nomUsersPlusNoIntersectHaveNoInsert = g.newBinaryRule({
	rhs: [
		user.nomUsersPlusNoIntersect,
		{ symbol: auxVerbs.have, noInsert: true },
	],
})
// (repos) `[nom-users+]` have/has not (liked)
user.nomUsersPlusHaveNoInsertNegation = g.newBinaryRule({
	rhs: [ user.nomUsersPlus, auxVerbs.haveNoInsertNegation ],
})
// (repos) `[nom-users+-no-intersect]` have/has not (`[verb]`)
user.nomUsersPlusNoIntersectHaveNoInsertNegation = g.newBinaryRule({
	// Prevent `[have]` insertion to stop semantically duplicate suggestions (and yield to insertion of `[do]` for a semantically identical suggestion):
	//   "repos I not" -> "repos I have not", "repos I do not"
	rhs: [ user.nomUsersPlusNoIntersect, auxVerbs.haveNoInsertNegation ],
})


user.objUser = g.newSymbol('obj', user.nameSg)
// (people who follow) `{user}`; (people followed by) `{user}`
user.objUser.addRule({
	rhs: [ user.sg ],
})
// (people who follow) me; (people followed by) me
user.objUser.addRule({
	rhs: [ {
		symbol: oneSg.pronoun,
		grammaticalForm: 'obj',
	} ],
	semantic: oneSg.semanticArg,
})
// (`{user:'s}` followers followed by) him|her
user.objUser.addRule({
	rhs: [ {
		symbol: anaphora.threeSg,
		grammaticalForm: 'obj',
	} ],
	anaphoraPersonNumber: 'threeSg',
})

// (repos created by) me/`{user}`/people-who...
user.objUsers = g.newSymbol('obj', user.namePl)
// (people who follow) `{user}`/me
user.objUsers.addRule({
	rhs: [ user.objUser ],
})
// (people who follow) people who...; (people followed by) people who...
user.objUsers.addRule({
	rhs: [ user.plural ],
})
// (my followers' followers who follow) them; (my followers' repos liked by) them
user.objUsers.addRule({
	rhs: [ {
		symbol: anaphora.threePl,
		grammaticalForm: 'obj',
	} ],
	anaphoraPersonNumber: 'threePl',
})

// (people who follow) me/`{user}`/people-who... [and/or `[obj-users+]`]
// (repos liked by) me/`{user}`/people-who... [and/or `[obj-users+]`]
user.objUsersPlus = conjunction.create(user.objUsers)

// (repos liked) by me/`{user}`/people-who... [and/or `[obj-users+]`]
user.byObjUsersPlus = g.newBinaryRule({
	rhs: [ preps.agent, user.objUsersPlus ],
})
// (repos created) by me/`{user}`/people-who... [or `[obj-users+-no-intersect]`]
// For use with semantics with `forbidsMultiple`.
user.objUsersPlusNoIntersect = conjunction.createDisjunctionSet(user.objUsers)
user.byObjUsersPlusNoIntersect = g.newBinaryRule({
	rhs: [ preps.agent, user.objUsersPlusNoIntersect ],
})


// `{user:'s}` (repositories); (followers of) `{user:'s}`
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


/**
 * The following user subjects and objects are excluded from the grammar because they are nearly semantically useless:
 *   1. `[nom-users]` -> "people", `all(users)` => "(repos) people (like)"
 *   2. `[obj-user]`  -> "anyone", `all(users)` => "(people who follow) anyone", "(people followed by) anyone"
 *   3. `[obj-users]` -> "people", `all(users)` => "(people who follow) people", "(people followed by) people"
 *
 * They are excluded because, for example, "repos people like" returns the same (database) results as "(all) repos", though the grammar does not support the latter query.
 */


// Export `user` `Category`, which includes the above rules saved to the category.
module.exports = user

// Load `user`-specific rules.
require('./userTense')
require('./followers')
require('./gender')