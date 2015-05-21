var g = require('../grammar')
var oneSg = require('./oneSg')
var preps = require('./prepositions')
var user = require('./user')
var conjunctions = require('./conjunctions')

var possStr = 'poss'

var possDeterminerSg = new g.Symbol(possStr, 'determiner', 'sg')
// my (repositories)
possDeterminerSg.addRule({ RHS: [ oneSg.poss ], semantic: oneSg.semantic })

this.determiner = new g.Symbol(possStr, 'determiner')
// my (repositories)
this.determiner.addRule({ RHS: [ possDeterminerSg ] })

this.determinerOmissible = new g.Symbol(possStr, 'determiner', 'omissible')
// my (followers)
this.determinerOmissible.addRule({ RHS: [ oneSg.possOmissible ], semantic: oneSg.semantic })


// Seperate [poss-user] from [poss-users] if want rules (functions) limited to single people
// Primarily exists, instead of just using [obj-users] to limit functions and "mine"
var possUser = new g.Symbol(possStr, 'user')
// (followers of) {user}
possUser.addRule({ RHS: [ user.catSg ] })
// (followers of) mine
possUser.addRule({ terminal: true, RHS: 'mine', text: 'mine', semantic: oneSg.semantic })

var possUsers = new g.Symbol(possStr, 'users')
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
this.ofPossUsersPlus = new g.Symbol('of', possStr, 'users+')
this.ofPossUsersPlus.addRule({ RHS: [ preps.possessor, possUsersPlus ] })

// (repos of) mine - must use possessorSpecial, otherwise the insertion is too slow
// For categories that a semantic function for possession that limits to one argument: repositories-created()
this.ofPossUsers = new g.Symbol('of', possStr, 'users')
this.ofPossUsers.addRule({ RHS: [ preps.possessorSpecial, possUsers ] })

// (repos of) mine - NOTE: not currently used
// - No insertion for 'of'
this.ofPossUsersPlusSpecial = new g.Symbol('of', possStr, 'users+', 'special')
this.ofPossUsersPlusSpecial.addRule({ RHS: [ preps.possessorSpecial, possUsersPlus ] })