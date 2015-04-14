var g = require('../grammar')
var user = require('./user')
var stopWords = require('./stopWords')
var poss = require('./poss')

var followersSemantic = new g.Semantic({ name: 'followers', cost: 0.5, minParams: 1, maxParams: 1 })
var usersFollowedSemantic = new g.Semantic({ name: user.namePl + '-followed', cost: 0.5, minParams: 1, maxParams: 1 })

// (people) I follow
var followVerb = g.addVerb({
	symbol: new g.Symbol('follow', 'verb'),
	insertionCost: 1,
	oneOrPl: [ 'follow', 'subscribe to' ],
	threeSg: [ 'follows' ],
	substitutions: [
		'followed',
		'have followed', // No "have followed" becuase implies no longer following?
		'following',
		'have|has|had been following',
		'am|is|are|were|was|be following',
		'subscribed to'
	]
})

// (people who) follow me
var followPlSubj = g.addWord({
	symbol: new g.Symbol('follow', 'pl', 'subj'),
	insertionCost: 1,
	accepted: [ 'follow', 'subscribe to' ],
	substitutions: [
		'follows',
		'followed',
		'have followed',
		'following',
		'have|has|had been following',
		'am|is|are|were|was|be following',
		'subscribed to'
	]
})

// (people) followed by me
var followPast = g.addWord({
	symbol: new g.Symbol('follow', 'past'),
	insertionCost: 1,
	accepted: [ 'followed' ],
	substitutions: [
		'follow',
		'subscribe to',
		'follows',
		'have followed',
		'following',
		'have|has|had been following',
		'am|is|are|were|was|be following',
		'subscribed to'
	]
})


// (people) followed by me
user.passive.addRule({ RHS: [ followPast, user.byObjUsersPlus ], semantic: usersFollowedSemantic })
// (people) I follow
user.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWords, followVerb ], semantic: usersFollowedSemantic })
// (people who) follow me
user.subjFilter.addRule({ RHS: [ followPlSubj, user.objUsersPlus ], semantic: followersSemantic })



var followersTerm = g.addWord({
	symbol: new g.Symbol('followers', 'term'),
	insertionCost: 1,
	accepted: [ 'followers', 'subscribers' ]
})

// (my) followers; followers (of mine)
var userFollowersHead = new g.Symbol(user.nameSg, 'followers', 'head')
userFollowersHead.addRule({ RHS: [ user.companyOpt, followersTerm ] })

// my followers
var userFollowersPossessible = new g.Symbol(user.nameSg, 'followers', 'possessible')
userFollowersPossessible.addRule({ RHS: [ user.lhs, userFollowersHead ], transpositionCost: 1 })
user.noRelativePossessive.addRule({ RHS: [ poss.determinerOmissible, userFollowersPossessible ], semantic: followersSemantic })

// followers of mine
user.head.addRule({ RHS: [ userFollowersHead, poss.ofPossUsersPlus ], semantic: followersSemantic })