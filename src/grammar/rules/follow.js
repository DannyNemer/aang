var g = require('../grammar')
var user = require('./user')
var auxVerbs = require('./auxVerbs')
var poss = require('./poss')
var preps = require('./prepositions')
var count = require('./count')


var followersSemantic = g.newSemantic({ name: 'followers', cost: 0.5, minParams: 1, maxParams: 1 })
var usersFollowedSemantic = g.newSemantic({ name: g.hyphenate(user.namePl, 'followed'), cost: 0.5, minParams: 1, maxParams: 1 })

var follow = g.newSymbol('follow')
follow.addVerb({
	insertionCost: 1,
	oneOrPl: [ 'follow', 'subscribe to' ],
	threeSg: [ 'follows' ],
	past: [ 'followed' ],
	substitutions: [
		'have followed', // No "have followed" becuase implies no longer following?
		'following',
		'have|has|had been following',
		'am|is|are|were|was|be following',
		'subscribed to',
	],
})

// (people) followed by me
user.passive.addRule({ RHS: [ follow, user.byObjUsersPlus ], semantic: usersFollowedSemantic, verbForm: 'past' })
// (people) I follow
user.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWord, follow ], semantic: usersFollowedSemantic })
// (people) I do not follow
user.objFilter.addRule({ RHS: [ user.nomUsersPlusDoPresentNegation, follow ], semantic: g.reduceSemantic(auxVerbs.notSemantic, usersFollowedSemantic), personNumber: 'pl' })
// (people who) follow me
user.subjFilter.addRule({ RHS: [ follow, user.objUsersPlus ], semantic: followersSemantic })
// (people who) do not follow me
var doPresentNegationFollow = g.newBinaryRule({ RHS: [ auxVerbs.doPresentNegation, follow ], personNumber: 'pl' })
user.subjFilter.addRule({ RHS: [ doPresentNegationFollow, user.objUsersPlus ], semantic: g.reduceSemantic(auxVerbs.notSemantic, followersSemantic) })


var followersTerm = g.newSymbol('followers', 'term')
followersTerm.addWord({
	insertionCost: 2.5,
	accepted: [ 'followers', 'subscribers' ],
})

// (my) followers; followers (of mine)
// No insertion
var userFollowersHead = g.newSymbol(user.nameSg, 'followers', 'head')
userFollowersHead.addRule({ RHS: [ user.companyOpt, followersTerm ], noInsertionIndexes: [ 1 ] })

// my followers; my followers' followers
var followersPossDeterminer = g.newSymbol('followers', poss.determiner.name)
followersPossDeterminer.addRule({ RHS: [ poss.determiner ], semantic: followersSemantic })
var userFollowersPossessible = g.newSymbol(user.nameSg, 'followers', 'possessible')
userFollowersPossessible.addRule({ RHS: [ user.lhs, userFollowersHead ], transpositionCost: 1 })
user.noRelativePossessive.addRule({ RHS: [ followersPossDeterminer, userFollowersPossessible ] })

// followers of mine
user.head.addRule({ RHS: [ userFollowersHead, poss.ofPossUsersPlus ], semantic: followersSemantic })


// users with <int> followers
user.inner.addRule({ RHS: [ preps.possessed, count.createForItems(followersTerm) ], semantic: user.semantic })


var followersPossessiveTerm = g.newSymbol('followers', 'possessive', 'term')
followersPossessiveTerm.addWord({
	accepted: [ 'followers\'', 'subscribers\'' ],
})

// (my/{user:'s}) followers' (repos)
var userFollowersPossessiveHead = g.newSymbol(user.nameSg, 'followers', 'possessive', 'head')
userFollowersPossessiveHead.addRule({ RHS: [ user.companyOpt, followersPossessiveTerm ] })

// my/{user:'s} followers' (repos); my/{user:'s} female followers' (repos)
var followersPossessiveDeterminerSg = g.newSymbol('followers', 'possessive', poss.determinerSg.name)
followersPossessiveDeterminerSg.addRule({ RHS: [ poss.determinerSg ], semantic: followersSemantic })
poss.determinerPl.addRule({ RHS: [ followersPossessiveDeterminerSg, [ user.lhs, userFollowersPossessiveHead ] ] })