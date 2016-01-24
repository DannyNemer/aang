const g = require('../../grammar')
const user = require('./user')
const oneSg = require('./oneSg')
const anaphora = require('./anaphora')
const preps = require('../prepositions')
const conjunctions = require('../conjunctions')


const possStr = 'poss'

exports.determinerSg = g.newSymbol(possStr, 'determiner', 'sg')
// my (repositories)
exports.determinerSg.addRule({ rhs: [ oneSg.possDet ], semantic: oneSg.semanticArg })
// {user:'s} (repositories)
exports.determinerSg.addRule({ rhs: [ user.possessive ] })
// (people who follow {user} and) his/her (followers)
exports.determinerSg.addRule({ rhs: [ anaphora.threeSgPossDet ], anaphoraPersonNumber: 'threeSg' })

// my/{user:'s} followers' (repos); my/{user:'s} female followers' (repos)
exports.determinerPl = g.newSymbol(possStr, 'determiner', 'pl')
// (people who follow my followers and like) their (repos)
// No `intersect()` needed because will only ever receive a single semantic, which itself can be `intersect()` with multiple semantics (e.g., "my female followers and their followers"). Also, if we enable "{user} and {user} and their followers", `intersect()` would be reduced with semantic arguments (which is forbidden).
exports.determinerPl.addRule({ rhs: [ anaphora.threePlPossDet ], anaphoraPersonNumber: 'threePl' })

exports.determiner = g.newSymbol(possStr, 'determiner')
// my/{user:'s} (repositories)
exports.determiner.addRule({ rhs: [ exports.determinerSg ] })
// my/{user:'s} followers' (repos); my/{user:'s} female followers' (repos)
exports.determiner.addRule({ rhs: [ exports.determinerPl ] })


const possUser = g.newSymbol(possStr, 'user')
// (followers of) {user:'s}
possUser.addRule({ rhs: [ user.possessive ] })
// (followers of) {user}
possUser.addRule({ rhs: [ user.catSg ] })
// (followers of) mine
possUser.addRule({ rhs: [ oneSg.possPronoun ], semantic: oneSg.semanticArg })
// (people who follow {user} and followers of) his/hers
possUser.addRule({ rhs: [ anaphora.threeSgPossPronoun ], anaphoraPersonNumber: 'threeSg' })

const possUsers = g.newSymbol(possStr, 'users')
// (repos of) people who follow me; (repos of) followers of mine; (repos of) my followers
possUsers.addRule({ rhs: [ user.plural ] })
// (repos of) {user:'s}/{user}/mine
possUsers.addRule({ rhs: [ possUser ] })
// (people who follow my followers and followers of) theirs
possUsers.addRule({ rhs: [ anaphora.threePlPossPronoun ], anaphoraPersonNumber: 'threePl' })


// (repos) of mine
// Used by categories whose possession is limited to one argument; e.g., `repositories-created()`. Does not support "... of {user} and {user}" because it implies objects owned/authored by both users; though allows collections such as "my followers", which implies objects owned/authored by any members of the collection.
// NOTE: Would like to support "repos mine" -> "repos of mine", but significantly hurts performance elsewhere.
exports.ofPossUsers = g.newBinaryRule({
	rhs: [ preps.possessor, possUsers ],
	noInsertionIndexes: [ 0 ],
})


// (followers) of mine; (followers) of [poss-user] and [poss-user]; followers of [user-plural]
exports.ofPossUsersPlus = g.newBinaryRule({
	rhs: [ preps.possessor, conjunctions.create(possUsers) ],
	// Does not prevent any insertions because does not produce any insertables.
	noInsertionIndexes: [ 1 ],
})

// Enables "followers of {user} and me" (without enabling "followers of me"), whereas `[poss-users+]` only enables "followers of {user} and mine".
// NOTE: Ambiguous with `[poss-users+]` for  "followers of {user} and {user}" and "followers of {user} and people who...". Cannot restructure rules to avoid the ambiguity because "me" is a substitute for "mine". Though this ambiguity is rare and minute and can be ignored.
// (followers of) me and/or {user}
const possUserPlural = g.newSymbol(possUser.name, 'plural')
// Inherits the conjunction rules from [obj-users+], excluding [obj-users+] -> [obj-users], thereby requiring a conjunction.
Array.prototype.push.apply(possUserPlural.rules, user.objUsersPlus.rules.slice(1))

// (followers of) me/{user} and/or me/{user}/[user-plural]
exports.ofPossUsersPlus.addRule({
	rhs: [ preps.possessor, possUserPlural ],
	// Does not prevent any insertions because does not produce any insertables.
	noInsertionIndexes: [ 1 ],
})