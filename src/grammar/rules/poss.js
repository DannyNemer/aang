var g = require('../grammar')
var oneSg = require('./oneSg')
var preps = require('./prepositions')

this.determinerOmissible = new g.Symbol('poss', 'determiner', 'omissible')
// my (followers)
this.determinerOmissible.addRule({ RHS: [ oneSg.possOmissible ]})


var possUser = new g.Symbol('poss', 'user')
// (followers of) mine
possUser.addRule({ terminal: true, RHS: 'mine' })

var possUsers = new g.Symbol('poss', 'users')
possUsers.addRule({ RHS: [ possUser ] })

var possUsersPlus = new g.Symbol('poss', 'users+')
possUsersPlus.addRule({ RHS: [ possUsers] })

this.ofPossUsers = new g.Symbol('of', 'poss', 'users')
this.ofPossUsers.addRule({ RHS: [ preps.possessor, possUsersPlus ] })