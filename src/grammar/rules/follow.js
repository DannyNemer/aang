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

// my followers
var userFollowersPossessible = new g.Symbol(user.nameSg, 'followers', 'possessible')
userFollowersPossessible.addRule({ RHS: [ user.lhs, userFollowersHead ], transpositionCost: 1 })
user.noRelativePossessive.addRule({ RHS: [ poss.determinerOmissible, userFollowersPossessible ], semantic: followersSemantic, onlyInsertFirstRHSSemantic: true })

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
// my followers' repos; my female followers' repos
poss.determinerPl.addRule({ RHS: [ poss.oneSgPossUserLhs, followersApostropheTerm ], semantic: followersSemantic, onlyInsertFirstRHSSemantic: true })
// {user:'s} followers' repos; {user:'s} female followers' repos
poss.determinerPl.addRule({ RHS: [ poss.userApostropheSUserLhs, followersApostropheTerm ], semantic: followersSemantic, onlyInsertFirstRHSSemantic: true })