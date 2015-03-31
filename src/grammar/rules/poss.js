var g = require('../grammar')
var oneSg = require('./oneSg')
var preps = require('./prepositions')

var possStr = 'poss'

var possDeterminerSg = new g.Symbol(possStr, 'determiner', 'sg')
// my (repositories)
possDeterminerSg.addRule({ RHS: [ oneSg.poss ] })

this.determiner = new g.Symbol(possStr, 'determiner')
// my (repositories)
this.determiner.addRule({ RHS: [ possDeterminerSg ] })

this.determinerOmissible = new g.Symbol(possStr, 'determiner', 'omissible')
// my (followers)
this.determinerOmissible.addRule({ RHS: [ oneSg.possOmissible ]})


// Seperate [poss-user] from [poss-users] if want rules (functions) limited to single people
// Primarily exists, instead of just using [obj-users] to limit functions and "mine"
var possUser = new g.Symbol(possStr, 'user')
// (followers of) mine - manually add text here because [poss-user] will also produce nonterminal rules
possUser.addRule({ terminal: true, RHS: 'mine', text: 'mine' })

var possUsers = new g.Symbol(possStr, 'users')
possUsers.addRule({ RHS: [ possUser ] })

var possUsersPlus = new g.Symbol(possStr, 'users+')
possUsersPlus.addRule({ RHS: [ possUsers] })

// (followers of) mine
this.ofPossUsers = new g.Symbol('of', possStr, 'users')
this.ofPossUsers.addRule({ RHS: [ preps.possessor, possUsersPlus ] })

// (repos of) mine
// - No insertion for 'of'
this.ofPossUsersSpecial = new g.Symbol('of', possStr, 'users', 'special')
this.ofPossUsersSpecial.addRule({ RHS: [ preps.possessorSpecial, possUsersPlus ] })