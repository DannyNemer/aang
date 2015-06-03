var g = require('../grammar')
var oneSg = require('./oneSg')
var preps = require('./prepositions')
var user = require('./user')
var conjunctions = require('./conjunctions')

var possStr = 'poss'

exports.determinerSg = g.newSymbol(possStr, 'determiner', 'sg')
// my (repositories)
exports.determinerSg.addRule({ RHS: [ oneSg.poss ], semantic: oneSg.semantic })
// {user:'s} (repositories)
exports.determinerSg.addRule({ RHS: [ user.possessive ] })


// my/{user:'s} followers' repos; my/{user:'s} female followers' repos
exports.determinerPl = g.newSymbol(possStr, 'determiner', 'pl')


exports.determiner = g.newSymbol(possStr, 'determiner')
// my/{user:'s} (repositories)
exports.determiner.addRule({ RHS: [ exports.determinerSg ] })
// my followers' repos; {user:'s} followers' repos
exports.determiner.addRule({ RHS: [ exports.determinerPl ], semantic: conjunctions.intersectSemantic })


// Seperate [poss-user] from [poss-users] if want rules (functions) limited to single people
// Primarily exists, instead of just using [obj-users] to limit functions and "mine"
var possUser = g.newSymbol(possStr, 'user')
// (followers of) {user:'s}
possUser.addRule({ RHS: [ user.possessive ] })
// (followers of) {user}
possUser.addRule({ RHS: [ user.catSg ] })
// (followers of) mine
possUser.addRule({ terminal: true, RHS: 'mine', text: 'mine', semantic: oneSg.semantic })

var possUsers = g.newSymbol(possStr, 'users')
// (repos of) people who follow me
possUsers.addRule({ RHS: [ user.plural ] })
// (repos of) {user}/mine
possUsers.addRule({ RHS: [ possUser ] })
// (repos of) followers of mine
possUsers.addRule({ RHS: [ user.head ] })
// (repos of) my followers
possUsers.addRule({ RHS: [ user.noRelativePossessive ] })

var possUsersPlus = conjunctions.addForSymbol(possUsers)


// (followers of) mine
exports.ofPossUsersPlus = g.newSymbol('of', possStr, 'users+')
exports.ofPossUsersPlus.addRule({ RHS: [ preps.possessor, possUsersPlus ] })

// (repos of) mine - must use possessorSpecial, otherwise the insertion is too slow
// For categories that a semantic function for possession that limits to one argument; ex: repositories-created()
exports.ofPossUsers = g.newSymbol('of', possStr, 'users')
exports.ofPossUsers.addRule({ RHS: [ preps.possessorSpecial, possUsers ] })