var g = require('../grammar')
var Category = require('./Category')
var stopwords = require('./stopWords')
var oneSg = require('./oneSg')
var preps = require('./prepositions')
var poss = require('./poss')


var user = new Category({ sg: 'user', pl: 'users' })

var peopleTerm = new g.Symbol('people', 'term')
peopleTerm.addRule({ terminal: true, RHS: 'people', insertionCost: 2.5 })
peopleTerm.addRule({ terminal: true, RHS: 'users' })

this.github = new g.Symbol('github')
this.github.addRule({ terminal: true, RHS: g.emptyTermSym })
this.github.addRule({ terminal: true, RHS: 'GitHub' }) // both accepted, though FB doesn't

// |Github users (I follow)
user.head.addRule({ RHS: [ this.github, peopleTerm ] })

var nomUsers = new g.Symbol('nom', 'users')
// (people) I (follow)
nomUsers.addRule({ RHS: [ oneSg.plain ] })
// (people) I'm (following) -> (people) I (follow)
nomUsers.addRule({ RHS: [ oneSg.nom ] })

// FOLLOW:
var follow = new g.Symbol('follow')
follow.addRule({ terminal: true, RHS: 'follow' })
follow.addRule({ terminal: true, RHS: 'followed' })
follow.addRule({ terminal: true, RHS: 'have followed' }) // rejected
follow.addRule({ terminal: true, RHS: 'following' }) // rejected
follow.addRule({ terminal: true, RHS: 'have|has|had been following' }) // rejected
follow.addRule({ terminal: true, RHS: 'am|is|are|were|was|be following' }) // rejected
follow.addRule({ terminal: true, RHS: 'subscribe to' })
follow.addRule({ terminal: true, RHS: 'subscribed to' }) // rejected

// (people I) follow
var stopwordFollow = new g.Symbol('stopword', 'follow')
stopwordFollow.addRule({ RHS: [ stopwords.preVerbStopwords, follow ] })

// (people) I follow
user.objFilter.addRule({ RHS: [ nomUsers, stopwordFollow ] })


// (people followed by) me
var objUser = new g.Symbol('obj', 'user')
objUser.addRule({ RHS: [ oneSg.plain ] })

var objUsers = new g.Symbol('obj', 'users')
// (people who follow) me
objUsers.addRule({ RHS: [ objUser ]})
// (people who follow) people
objUsers.addRule({ RHS: [ user.plural ]})

var objUsersPlus = new g.Symbol('obj', 'users+')
objUsersPlus.addRule({ RHS: [ objUsers ]})

// (people followed) by me
var byObjUsers = new g.Symbol('by', 'obj', 'users')
byObjUsers.addRule({ RHS: [ preps.agent, objUsersPlus ]})

// (people) followed by me
user.passive.addRule({ RHS: [ follow, byObjUsers ] })


// (people who) follow me
user.subjFilter.addRule({ RHS: [ follow, objUsersPlus ]})



var followersTerm = new g.Symbol('followers', 'term')
followersTerm.addRule({ terminal: true, RHS: 'followers' })

// (my) followers
var userFollowersHead = new g.Symbol(user.name, 'followers', 'head')
userFollowersHead.addRule({ RHS: [ this.github, followersTerm ] })

// (my) followers
var userFollowersPossessible = new g.Symbol(user.name, 'followers', 'possessible')
userFollowersPossessible.addRule({ RHS: [ user.lhs, userFollowersHead ] })

// my followers
user.noRelativePossessive.addRule({ RHS: [ poss.determinerOmissible, userFollowersPossessible ] })


// followers of mine
user.head.addRule({ RHS: [ userFollowersHead, poss.ofPossUsers ]})
