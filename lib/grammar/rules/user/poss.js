var util = require('../../../util/util.js')
var g = require('../../grammar')
var user = require('./user')
var oneSg = require('./oneSg')
var anaphora = require('./anaphora')
var preps = require('../prepositions')
var conjunction = require('../conjunction')


var possStr = 'poss'

exports.determinerSg = g.newSymbol(possStr, 'determiner', 'sg')
// my (repositories)
exports.determinerSg.addRule({ rhs: [ oneSg.possDet ], semantic: oneSg.semanticArg })
// `{user:'s}` (repositories)
exports.determinerSg.addRule({ rhs: [ user.possessive ] })
// (people who follow `{user}` and) his|her (followers)
exports.determinerSg.addRule({ rhs: [ anaphora.threeSgPossDet ], anaphoraPersonNumber: 'threeSg' })

// my/`{user:'s}` followers' (repos); my/`{user:'s}` female followers' (repos)
exports.determinerPl = g.newSymbol(possStr, 'determiner', 'pl')
// (people who follow my followers and like) their (repos)
// No `intersect()` needed because will only ever receive a single semantic, which itself can be `intersect()` with multiple semantics (e.g., "my female followers and their followers"). Also, if we enable "`{user}` and `{user}` and their followers", `intersect()` would be reduced with semantic arguments (which is forbidden).
exports.determinerPl.addRule({ rhs: [ anaphora.threePlPossDet ], anaphoraPersonNumber: 'threePl' })

exports.determiner = g.newSymbol(possStr, 'determiner')
// my/`{user:'s}` (repositories)
exports.determiner.addRule({ rhs: [ exports.determinerSg ] })
// my/`{user:'s}` followers' (repos); my/`{user:'s}` female followers' (repos)
exports.determiner.addRule({ rhs: [ exports.determinerPl ] })


var possUser = g.newSymbol(possStr, user.nameSg)
// (followers of) `{user:'s}`
possUser.addRule({ rhs: [ user.possessive ] })
// (followers of) `{user}`
possUser.addRule({ rhs: [ user.sg ] })
// (followers of) mine
possUser.addRule({ rhs: [ oneSg.possPronoun ], semantic: oneSg.semanticArg })
// (people who follow `{user}` and followers of) his|hers
possUser.addRule({ rhs: [ anaphora.threeSgPossPronoun ], anaphoraPersonNumber: 'threeSg' })

var possUsers = g.newSymbol(possStr, user.namePl)
// (repos of) people who follow me
possUsers.addRule({ rhs: [ user.plural ] })
// (repos of) `{user:'s}`/`{user}`/mine
possUsers.addRule({ rhs: [ possUser ] })
// (people who follow my followers and followers of) theirs
possUsers.addRule({ rhs: [ anaphora.threePlPossPronoun ], anaphoraPersonNumber: 'threePl' })


/**
 * (repos) of mine
 *
 * Used by categories whose possession is limited to one argument; e.g., `repositories-created()`. Does not support "... of `{user}` and `{user}`" because it implies objects owned/authored by both users; though allows collections such as "my followers", which implies objects owned/authored by any members of the collection.
 *
 * Note: Would like to support "repos mine" -> "repos of mine", but significantly hurts performance elsewhere.
 */
exports.ofPossUsers = g.newBinaryRule({
	rhs: [
		{ symbol: preps.possessor, noInsert: true },
		possUsers,
	],
})


// (followers) of `[poss-users]` [and/or `[poss-users+]`]
var possUsersPlus = conjunction.create(possUsers)
exports.ofPossUsersPlus = g.newSymbol(preps.possessor.name, possUsersPlus.name).addRule({
	rhs: [
		preps.possessor,
		possUsersPlus,
	],
	// Note: Could redesign to define `noInsert` within the parent rule's `rhs` instead of here. Will do so after abstracting the creation of possession rules for each `Category`.
	noInsert: true,
})

/**
 * Enable possessive rules for conjugations that use "me" instead of "mine". I.e., enables "followers of `{user}` and me" without enabling "followers of me", whereas `[poss-users+]` only enables "followers of `{user}` and mine".
 *
 * Inherits the conjunction rules from `[obj-users+]`, excluding `[obj-users+]` -> `[obj-users]`, thereby only producing rules with multiple subjects/possessors.
 *
 * Note: Ambiguous with `[poss-users+]` for any conjugations that do not use "mine" or `{user:'s}`. E.g., "followers of `{user}` and `{user}`". Can not restructure rules to avoid the ambiguity because "me" is a substitute for "mine".
 *
 * Note: Should refactor this operation to avoid manually manipulating `NSymbol.rules`.
 *
 * (followers of) `[obj-users]` and/or `[obj-users+]` -> (...) me and/or `{user}`
 */
var objUsersPlusPlural = g.newSymbol(user.objUsersPlus.name, 'plural')
Array.prototype.push.apply(objUsersPlusPlural.rules, user.objUsersPlus.rules.slice(1).map(util.clone))

// (followers of) `[obj-users]` and/or `[obj-users+]` -> (...) me and/or `{user}`
exports.ofPossUsersPlus.addRule({
	rhs: [
		preps.possessor,
		objUsersPlusPlural,
	],
	// Note: Could redesign to define `noInsert` within the parent rule's `rhs` instead of here.
	noInsert: true,
})


/**
 * (repos) of `[poss-users]` [or `[poss-users+-no-intersect]`]
 *
 * For use by categories who semantic representing possession of instances of that category's associated DB object is defined with `forbidsMultiple`. Prevents the intersection of multiple instances of this ownership semantic because it implies the associated DB object can be owned/authored by multiple users. Only enables the logical disjunction of multiple instances of said semantic.
 *
 * Note: Still enables "repos of my followers", which implies the intersection of repos created by all of "my followers".
 */
var possUsersPlusNoIntersect = conjunction.createDisjunctionSet(possUsers)
exports.ofPossUsersPlusNoIntersect = g.newSymbol(preps.possessor.name, possUsersPlusNoIntersect.name).addRule({
	rhs: [
		preps.possessor,
		possUsersPlusNoIntersect
	],
	// Note: Could redesign to define `noInsert` within the parent rule's `rhs` instead of here.
	noInsert: true
})

// Enable possessive rules for conjugations that use "me" instead of "mine", exactly as for `[of-poss-users+]` above.
var objUsersPlusPluralNoIntersect = g.newSymbol(objUsersPlusPlural.name, 'no', 'intersect')
Array.prototype.push.apply(objUsersPlusPluralNoIntersect.rules, user.objUsersPlusNoIntersect.rules.slice(1).map(util.clone))
// (repos of) `[obj-users]` or `[obj-users+-no-intersect]` -> (...) me or `{user}`
exports.ofPossUsersPlusNoIntersect.addRule({
	rhs: [
		preps.possessor,
		objUsersPlusPluralNoIntersect
	],
	// Note: Could redesign to define `noInsert` within the parent rule's `rhs` instead of here.
	noInsert: true
})
