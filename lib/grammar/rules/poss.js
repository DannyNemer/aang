var g = require('../grammar')
var oneSg = require('./oneSg')
var preps = require('./prepositions')
var user = require('./user')
var conjunctions = require('./conjunctions')


var possStr = 'poss'

exports.determinerSg = g.newSymbol(possStr, 'determiner', 'sg')
// my (repositories)
exports.determinerSg.addRule({ RHS: [ oneSg.possDet ], semantic: oneSg.semantic })
// {user:'s} (repositories)
exports.determinerSg.addRule({ RHS: [ user.possessive ] })

// my/{user:'s} followers' repos; my/{user:'s} female followers' repos
exports.determinerPl = g.newSymbol(possStr, 'determiner', 'pl')

exports.determiner = g.newSymbol(possStr, 'determiner')
// my/{user:'s} (repositories)
exports.determiner.addRule({ RHS: [ exports.determinerSg ] })
// my followers' repos; {user:'s} followers' repos
exports.determiner.addRule({ RHS: [ exports.determinerPl ], semantic: conjunctions.intersectSemantic })


var possUser = g.newSymbol(possStr, 'user')
// (followers of) {user:'s}
possUser.addRule({ RHS: [ user.possessive ] })
// (followers of) {user}
possUser.addRule({ RHS: [ user.catSg ] })
// (followers of) mine
possUser.addRule({ RHS: [ oneSg.possPronoun ], semantic: oneSg.semantic })

// FIXME: Creates ambiguity with `[poss-users+]`.
var possUserPlural = g.newSymbol(possUser.name, 'plural')
// (followers of) me and Danny
possUserPlural.addRule({
	RHS: [ [ user.objUser, conjunctions.and ], user.objUsersPlus ],
	noInsertionIndexes: [ 0 ],
})
// (followers of) me or Danny
possUserPlural.addRule({
	RHS: [ [ user.objUser, conjunctions.union ], user.objUsersPlus ],
	noInsertionIndexes: [ 0 ],
	semantic: conjunctions.unionSemantic,
})

var possUsers = g.newSymbol(possStr, 'users')
// (repos of) people who follow me; (repos of) followers of mine; (repos of) my followers
possUsers.addRule({ RHS: [ user.plural ] })
// (repos of) {user:'s}/{user}/mine
possUsers.addRule({ RHS: [ possUser ] })
// (followers of) me and/or Danny
possUsers.addRule({ RHS: [ possUserPlural ] })

var possUsersPlus = conjunctions.addForSymbol(possUsers)

// (repos) of mine
// Used by categories whose possession is limited to one argument; e.g., `repositories-created()`.
exports.ofPossUsers = g.newBinaryRule({ RHS: [ preps.possessor, possUsers ], noInsertionIndexes: [ 0 ] })
// (followers) of mine, of Danny and Aang
exports.ofPossUsersPlus = g.newBinaryRule({ RHS: [ preps.possessor, possUsersPlus ], noInsertionIndexes: [ 1 ] })