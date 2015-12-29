var g = require('../../grammar')
var user = require('./user')
var oneSg = require('./oneSg')
var preps = require('./../prepositions')
var conjunctions = require('./../conjunctions')


var possStr = 'poss'

exports.determinerSg = g.newSymbol(possStr, 'determiner', 'sg')
// my (repositories)
exports.determinerSg.addRule({ rhs: [ oneSg.possDet ], semantic: oneSg.semantic })
// {user:'s} (repositories)
exports.determinerSg.addRule({ rhs: [ user.possessive ] })

// my/{user:'s} followers' (repos); my/{user:'s} female followers' (repos)
exports.determinerPl = g.newSymbol(possStr, 'determiner', 'pl')

exports.determiner = g.newSymbol(possStr, 'determiner')
// my/{user:'s} (repositories)
exports.determiner.addRule({ rhs: [ exports.determinerSg ] })
// my/{user:'s} followers' (repos); my/{user:'s} female followers' (repos)
// Requires `intersect()` for queries such as "female followers'" in "my female followers' male followers", which has the semantic `intersect(followers(intersect(followers(me),users-gender(female))),users-gender(male))`.
exports.determiner.addRule({ rhs: [ exports.determinerPl ], semantic: conjunctions.intersectSemantic })


var possUser = g.newSymbol(possStr, 'user')
// (followers of) {user:'s}
possUser.addRule({ rhs: [ user.possessive ] })
// (followers of) {user}
possUser.addRule({ rhs: [ user.catSg ] })
// (followers of) mine
possUser.addRule({ rhs: [ oneSg.possPronoun ], semantic: oneSg.semantic })

var possUsers = g.newSymbol(possStr, 'users')
// (repos of) people who follow me; (repos of) followers of mine; (repos of) my followers
possUsers.addRule({ rhs: [ user.plural ] })
// (repos of) {user:'s}/{user}/mine
possUsers.addRule({ rhs: [ possUser ] })


// (repos) of mine
// Used by categories whose possession is limited to one argument; e.g., `repositories-created()`. Does not support "... of {user} and {user}" because it implies objects owned/authored by both users; though allows collections such as "my followers", which implies objects owned/authored by any members of the collection.
// NOTE: Would like to support "repos mine" -> "repos of mine", but significantly hurts performance elsewhere.
exports.ofPossUsers = g.newBinaryRule({
	rhs: [ preps.possessor, possUsers ],
	noInsertionIndexes: [ 0 ],
})

// Enables "followers of {user} and me" (without enabling "followers of me"), whereas `[poss-users+]` only enables "followers of {user} and mine".
// NOTE: Ambiguous with `[poss-users+]` for  "followers of {user} and {user}" and "followers of {user} and people who...". Cannot restructure rules to avoid the ambiguity because "me" is a substitute for "mine". Though this ambiguity is rare and minute and can be ignored.
// (followers of) me and/or {user}
var possUserPlural = g.newSymbol(possUser.name, 'plural')
// Inherits the conjunction rules from [obj-users+], excluding [obj-users+] -> [obj-users], thereby requiring a conjunction.
Array.prototype.push.apply(possUserPlural.rules, user.objUsersPlus.rules.slice(1))

// (followers) of mine; (followers) of [poss-user] and [poss-user]; followers of [user-plural]
exports.ofPossUsersPlus = g.newBinaryRule({
	rhs: [ preps.possessor, conjunctions.create(possUsers) ],
	// Does not prevent any insertions because does not produce any insertables.
	noInsertionIndexes: [ 1 ],
})
// (followers of) me/{user} and/or me/{user}/[user-plural]
exports.ofPossUsersPlus.addRule({
	rhs: [ preps.possessor, possUserPlural ],
	// Does not prevent any insertions because does not produce any insertables.
	noInsertionIndexes: [ 1 ],
})