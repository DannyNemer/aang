var util = require('../../../util/util')
var g = require('../../grammar')
var user = require('./user')
var oneSg = require('./oneSg')
var anaphora = require('./anaphora')
var conjunction = require('../conjunction')
var preps = require('../prepositions')


var possStr = 'poss'

exports.possDeterminerSg = g.newSymbol(possStr, 'determiner', 'sg')
// my (repositories)
exports.possDeterminerSg.addRule({ rhs: [ oneSg.possDet ], semantic: oneSg.semanticArg })
// `{user:'s}` (repositories)
exports.possDeterminerSg.addRule({ rhs: [ user.sgPossessive ] })
// (people who follow `{user}` and) his|her (followers)
exports.possDeterminerSg.addRule({ rhs: [ anaphora.threeSgPossDet ], anaphoraPersonNumber: 'threeSg' })

// my/`{user:'s}` followers' (repos); my/`{user:'s}` female followers' (repos)
exports.possDeterminerPl = g.newSymbol(possStr, 'determiner', 'pl')
// (people who follow my followers and like) their (repos)
// No `intersect()` needed because will only ever receive a single semantic, which itself can be `intersect()` with multiple semantics (e.g., "my female followers and their followers"). Also, if we enable "`{user}` and `{user}` and their followers", `intersect()` would be reduced with semantic arguments (which is forbidden).
exports.possDeterminerPl.addRule({ rhs: [ anaphora.threePlPossDet ], anaphoraPersonNumber: 'threePl' })

exports.possDeterminer = g.newSymbol(possStr, 'determiner')
// my/`{user:'s}` (repositories)
exports.possDeterminer.addRule({ rhs: [ exports.possDeterminerSg ] })
// my/`{user:'s}` followers' (repos); my/`{user:'s}` female followers' (repos)
exports.possDeterminer.addRule({ rhs: [ exports.possDeterminerPl ] })


var possUsers = g.newSymbol(possStr, user.namePl)
// (followers of) `{user}`
possUsers.addRule({ rhs: [ user.sg ] })
// (followers of) `{user:'s}`
possUsers.addRule({ rhs: [ user.sgPossessive ] })
// (followers of) mine
possUsers.addRule({ rhs: [ oneSg.possPronoun ], semantic: oneSg.semanticArg })
// (people who follow `{user}` and followers of) his|hers
possUsers.addRule({ rhs: [ anaphora.threeSgPossPronoun ], anaphoraPersonNumber: 'threeSg' })
// (repos of) people who follow me
possUsers.addRule({ rhs: [ user.plural ] })
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
exports.ofPossUsersPlus.addRule({
	rhs: [
		preps.possessor,
		objUsersPlusPlural,
	],
	// Note: Could redesign to define `noInsert` within the parent rule's `rhs` instead of here.
	noInsert: true,
})


/**
 * (repos) of `[poss-users]` [or `[poss-users+-disjunction]`]
 *
 * For use by categories who semantic representing possession of instances of that category's associated DB object is defined with `forbidsMultiple`. Prevents the intersection of multiple instances of this ownership semantic because it implies the associated DB object can be owned/authored by multiple users. Only enables the logical disjunction of multiple instances of said semantic.
 *
 * Note: Still enables "repos of my followers", which implies the intersection of repos created by all of "my followers".
 */
var possUsersPlusDisjunction = conjunction.createDisjunctionSet(possUsers)
exports.ofPossUsersPlusDisjunction = g.newSymbol(preps.possessor.name, possUsersPlusDisjunction.name).addRule({
	rhs: [
		// Note: Would like to remove this insertion restriction to support "repos mine" -> "repos of mine", but it significantly hurts performance elsewhere.
		{ symbol: preps.possessor, noInsert: true },
		possUsersPlusDisjunction
	],
})

/**
 * Enable possessive rules for conjugations that use "me" instead of "mine", exactly as for `[of-poss-users+]` above.
 *
 * (repos of) `[obj-users]` or `[obj-users+-disjunction]` -> (...) me or `{user}`
 */
var objUsersPlusDisjunctionPlural = g.newSymbol(user.objUsersPlusDisjunction.name, 'plural')
Array.prototype.push.apply(objUsersPlusDisjunctionPlural.rules, user.objUsersPlusDisjunction.rules.slice(1).map(util.clone))
exports.ofPossUsersPlusDisjunction.addRule({
	rhs: [
		{ symbol: preps.possessor, noInsert: true },
		objUsersPlusDisjunctionPlural
	],
})