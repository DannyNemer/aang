var g = require('../grammar')
var user = require('./user')
var stopWords = require('./stopWords')
var poss = require('./poss')
var preps = require('./prepositions')
var count = require('./count')


var followersSemantic = g.newSemantic({ name: 'followers', cost: 0.5, minParams: 1, maxParams: 1 })
var usersFollowedSemantic = g.newSemantic({ name: user.namePl + '-followed', cost: 0.5, minParams: 1, maxParams: 1 })

var follow = new g.Symbol('follow')
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
		'subscribed to'
	]
})

// (people) followed by me
user.passive.addRule({ RHS: [ follow, user.byObjUsersPlus ], semantic: usersFollowedSemantic, verbForm: 'past' })
// (people) I follow
user.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWords, follow ], semantic: usersFollowedSemantic })
// (people who) follow me
user.subjFilter.addRule({ RHS: [ follow, user.objUsersPlus ], semantic: followersSemantic, personNumber: 'pl' })


// No insertion
var followersTermSpecial = new g.Symbol('followers', 'term', 'special')
followersTermSpecial.addWord({
	accepted: [ 'followers', 'subscribers' ]
})

// (my) followers; followers (of mine)
var userFollowersHead = new g.Symbol(user.nameSg, 'followers', 'head')
userFollowersHead.addRule({ RHS: [ user.companyOpt, followersTermSpecial ] })

// my followers; my followers' followers
var followersPossDeterminer = new g.Symbol('followers', 'poss', 'determiner')
followersPossDeterminer.addRule({ RHS: [ poss.determiner ], semantic: followersSemantic })
var userFollowersPossessible = new g.Symbol(user.nameSg, 'followers', 'possessible')
userFollowersPossessible.addRule({ RHS: [ user.lhs, userFollowersHead ], transpositionCost: 1 })
user.noRelativePossessive.addRule({ RHS: [ followersPossDeterminer, userFollowersPossessible ] })

// followers of mine
user.head.addRule({ RHS: [ userFollowersHead, poss.ofPossUsersPlus ], semantic: followersSemantic })


var followersTerm = new g.Symbol('followers', 'term')
followersTerm.addWord({
	insertionCost: 2.5,
	accepted: [ 'followers', 'subscribers' ]
})
// users with <int> followers
user.inner.addRule({ RHS: [ preps.possessed, count.createForCategoryItems(user, followersTerm) ] })




var followersApostropheTerm = new g.Symbol('followers\'', 'term')
followersApostropheTerm.addWord({
	accepted: [ 'followers\'', 'subscribers\'' ]
})

// my/{user:'s} followers' repos; my/{user:'s} female followers' repos
var followersPossDeterminerSg = new g.Symbol('followers', 'poss', 'determiner', 'sg')
followersPossDeterminerSg.addRule({ RHS: [ poss.determinerSg ], semantic: followersSemantic })
var userLhsFollowers = new g.Symbol(user.nameSg, 'lhs', 'followers\'')
userLhsFollowers.addRule({ RHS: [ user.lhs, followersApostropheTerm ] })
poss.determinerPl.addRule({ RHS: [ followersPossDeterminerSg, userLhsFollowers ] })