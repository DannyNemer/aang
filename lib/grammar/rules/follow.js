var g = require('../grammar')
var user = require('./user')
var auxVerbs = require('./auxVerbs')
var poss = require('./poss')
var preps = require('./prepositions')
var count = require('./count')


var followersSemantic = g.newSemantic({ name: 'followers', cost: 0.5, minParams: 1, maxParams: 1 })
var usersFollowedSemantic = g.newSemantic({ name: g.hyphenate(user.namePl, 'followed'), cost: 0.5, minParams: 1, maxParams: 1 })

var follow = g.newSymbol('follow').addVerb({
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
user.passive.addRule({ RHS: [ follow, user.byObjUsersPlus ], semantic: usersFollowedSemantic, tense: 'past' })
// (people) I follow
user.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWord, follow ], semantic: usersFollowedSemantic })
// (people) I do not follow
user.objFilter.addRule({ RHS: [ user.nomUsersPlusDoPresentNegation, follow ], semantic: g.reduceSemantic(auxVerbs.notSemantic, usersFollowedSemantic), personNumber: 'pl' })
// (people who) follow me
user.subjFilter.addRule({ RHS: [ follow, user.objUsersPlus ], semantic: followersSemantic })
// (people who) do not follow me
user.subjFilter.addRule({ RHS: [ [ auxVerbs.doPresentNegation, follow ], user.objUsersPlus ], semantic: g.reduceSemantic(auxVerbs.notSemantic, followersSemantic) })


var followersTerm = g.newSymbol('followers', 'term').addWord({
	insertionCost: 2.5,
	accepted: [ 'followers', 'subscribers' ],
	substitutions: [ 'follower', 'subscriber' ],
})

// (my) followers; followers (of mine)
var userFollowersHead = g.newSymbol(user.nameSg, 'followers', 'head')
userFollowersHead.addRule({ RHS: [ user.companyOpt, followersTerm ], noInsertionIndexes: [ 1 ] })

// my followers
var followersPossDeterminer = g.newSymbol('followers', poss.determiner.name)
followersPossDeterminer.addRule({ RHS: [ poss.determiner ], semantic: followersSemantic })
var userFollowersPossessable = g.newSymbol(user.nameSg, 'followers', 'possessable')
userFollowersPossessable.addRule({ RHS: [ user.lhs, userFollowersHead ], transpositionCost: 1 })
user.noRelativePossessive.addRule({ RHS: [ followersPossDeterminer, userFollowersPossessable ] })

// followers of mine
user.head.addRule({ RHS: [ userFollowersHead, poss.ofPossUsersPlus ], semantic: followersSemantic })


// users with <int> followers
user.inner.addRule({ RHS: [ preps.possessed, count.createForItems(followersTerm) ], semantic: user.semantic })


var followersPossessiveTerm = g.newSymbol('followers', 'possessive', 'term').addWord({
	accepted: [ 'followers\'', 'subscribers\'' ],
})
// (my/{user:'s}) followers' (repos)
var userFollowersPossessiveHead = g.newSymbol(user.nameSg, 'followers', 'possessive', 'head')
userFollowersPossessiveHead.addRule({ RHS: [ user.companyOpt, followersPossessiveTerm ] })
// my/{user:'s} followers' (repos); my/{user:'s} female followers' (repos)
var followersPossessiveDeterminerSg = g.newSymbol('followers', 'possessive', poss.determinerSg.name)
followersPossessiveDeterminerSg.addRule({ RHS: [ poss.determinerSg ], semantic: followersSemantic })
poss.determinerPl.addRule({ RHS: [ followersPossessiveDeterminerSg, [ user.lhs, userFollowersPossessiveHead ] ] })


// SHARE:
var share = g.newSymbol('share').addVerb({
	insertionCost: 2,
	oneOrPl: [ 'share' ],
	threeSg: [ 'shares' ],
	past: [ 'shared' ],
}).addVerb({
	// Add synonyms in a separate call so symbols correct to corresponding accepted form.
	oneOrPl: [ 'have in common' ],
	threeSg: [ 'has in common' ],
	substitutions: [ 'had in common' ],
})

// followers I and {user} share; (people who are) followers I and {user} share
// Limit insertions because otherwise decreases performance and introduces unlikely suggestions: "people I follow" -> "followers people I follow share".
user.noRelative.addRule({
	RHS: [
		[ followersTerm, user.nomPlUsersSubj ],
		share
	],
	semantic: followersSemantic,
	noInsertionIndexes: [ 1 ],
})
// followers I share with {user}; followers I and {user} share with {user} and my followers
user.noRelative.addRule({
	RHS: [
		followersTerm,
		[ [ user.nomUsersPlus, share ], [ preps.associative, user.objUsersPlus ] ]
	],
	semantic: followersSemantic,
	noInsertionIndexes: [ 0, 1 ],
})