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


var possUser = g.newSymbol(possStr, 'user')
// (followers of) `{user:'s}`
possUser.addRule({ rhs: [ user.possessive ] })
// (followers of) `{user}`
possUser.addRule({ rhs: [ user.sg ] })
// (followers of) mine
possUser.addRule({ rhs: [ oneSg.possPronoun ], semantic: oneSg.semanticArg })
// (people who follow `{user}` and followers of) his|hers
possUser.addRule({ rhs: [ anaphora.threeSgPossPronoun ], anaphoraPersonNumber: 'threeSg' })

var possUsers = g.newSymbol(possStr, 'users')
// (repos of) people who follow me; (repos of) followers of mine; (repos of) my followers
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
 * Enables "followers of `{user}` and me" (without enabling "followers of me"), whereas `[poss-users+]` only enables "followers of `{user}` and mine".
 *
 * Note: Ambiguous with `[poss-users+]` for  "followers of `{user}` and`{user}`" and "followers of `{user}` and people who...". Can not restructure rules to avoid the ambiguity because "me" is a substitute for "mine". Though this ambiguity is rare and can be ignored.
 *
 * (followers of) me and/or`{user}`
 */
var possUserPlural = g.newSymbol(possUser.name, 'plural')

/**
 * Inherits the conjunction rules from `[obj-users+]`, excluding `[obj-users+]` -> `[obj-users]`, thereby only producing rules with multiple subjects/possessors.
 *
 * Note: Should refactor this operation to avoid manually manipulating `NSymbol.rules`.
 */
Array.prototype.push.apply(possUserPlural.rules, user.objUsersPlus.rules.slice(1).map(util.clone))

// (followers of) me/`{user}` and/or me/`{user}`/[user-plural]
exports.ofPossUsersPlus.addRule({
	rhs: [
		preps.possessor,
		// Does not prevent any insertions because `possUserPlural` does not produce any insertables.
		{ symbol: possUserPlural, noInsert: true },
	],
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