var g = require('../../grammar')
var user = require('./user')
var poss = require('./poss')
var oneSg = require('./oneSg')
var auxVerbs = require('../auxVerbs')
var preps = require('../prepositions')
var count = require('../count')


var followersSemantic = g.newSemantic({
	name: 'followers',
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	isPeople: true,
})
var usersFollowedSemantic = g.newSemantic({
	name: g.hyphenate(user.namePl, 'followed'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	isPeople: true,
})

var follow = g.newSymbol('follow').addVerb({
	insertionCost: 1,
	oneSg: 'follow',
	threeSg: 'follows',
	pl: 'follow',
	past: 'followed',
	substitutions: [
		'following',
		// FIXME: Insertion of 'have|has|had been' creates ambiguity with the preceding substitution.
		'have|has|had been following',
		'am|is|are|were|was|be following',
		// No "have followed" because it can imply people the user no longer follows.
		'have followed',
		'has followed',
	],
}).addVerb({
	oneSg: 'subscribe to',
	threeSg: 'subscribes to',
	pl: 'subscribe to',
	past: 'subscribed to',
	substitutions: [
		'subscribing to',
		// FIXME: Insertion of 'have|has|had been' creates ambiguity with the preceding substitution.
		'have|has|had been subscribing to',
		'am|is|are|were|was|be subscribing to',
		// FIXME: Insertion of 'have|has|had been' creates ambiguity the past tense inflection.
		'have|has|had been subscribed to',
		'am|is|are|were|was|be subscribed to',
		'have subscribed to',
		'has subscribed to',
	],
})

// (people) followed by me
user.passive.addRule({ rhs: [ follow, user.byObjUsersPlus ], semantic: usersFollowedSemantic, tense: 'past' })
// (people) I follow
user.objFilter.addRule({ rhs: [ user.nomUsersPlusPreVerbStopWord, follow ], semantic: usersFollowedSemantic })
// (people) I do not follow
user.objFilter.addRule({ rhs: [ user.nomUsersPlusDoPresentNegation, follow ], semantic: g.reduceSemantic(auxVerbs.notSemantic, usersFollowedSemantic), personNumber: 'pl' })
// (people who) follow me
user.subjFilter.addRule({ rhs: [ follow, user.objUsersPlus ], semantic: followersSemantic })
// (people who) do not follow me
user.subjFilter.addRule({ rhs: [ [ auxVerbs.doPresentNegation, follow ], user.objUsersPlus ], semantic: g.reduceSemantic(auxVerbs.notSemantic, followersSemantic) })


var followersTerm = g.newSymbol('followers', 'term').addWord({
	insertionCost: 2.5,
	accepted: [ 'followers', 'subscribers' ],
	substitutions: [ 'follower', 'subscriber' ],
})

// (my) followers; followers (of mine)
var userFollowersHead = g.newSymbol(user.nameSg, 'followers', 'head').addRule({
	rhs: [ user.companyOpt, followersTerm ],
	noInsert: true
})

// my/{user:'s}/my-followers' (followers)
var followersPossDeterminer = g.newSymbol('followers', poss.determiner.name).addRule({
	rhs: [ poss.determiner ],
	semantic: followersSemantic,
})
// (my) female followers
var userFollowersPossessable = g.newSymbol(user.nameSg, 'followers', 'possessable').addRule({
	rhs: [ user.lhs, userFollowersHead ],
	transpositionCost: 1,
})
user.noRelativePossessive.addRule({
	rhs: [ followersPossDeterminer, userFollowersPossessable ],
})

// followers of {user:'s}/mine/[users]
user.head.addRule({
	rhs: [ userFollowersHead, poss.ofPossUsersPlus ],
	semantic: followersSemantic,
})


// (people who follow) my followers
// Enable certain insertions, with a low insertion cost, while preventing drawbacks which would result from removing the `noInsertionIndexes` restriction above.
user.objUsers.addRule({
	isTerminal: true,
	rhs: 'my followers',
	insertionCost: 0.1,
	restrictInsertion: true,
	semantic: g.reduceSemantic(followersSemantic, oneSg.semanticArg),
})

// users with <int> followers
user.inner.addRule({ rhs: [ preps.possessed, count.createForItems(followersTerm) ], semantic: user.semantic })


var followersPossessiveTerm = g.newSymbol('followers', 'possessive', 'term').addWord({
	accepted: [ 'followers\'', 'subscribers\'' ],
})
// (my/{user:'s}) followers' (repos)
var userFollowersPossessiveHead = g.newSymbol(user.nameSg, 'followers', 'possessive', 'head').addRule({
	rhs: [ user.companyOpt, followersPossessiveTerm ],
})
// my/{user:'s} followers' (repos); my/{user:'s} female followers' (repos)
var followersPossessiveDeterminerSg = g.newSymbol('followers', 'possessive', poss.determinerSg.name).addRule({
	rhs: [ poss.determinerSg ],
	semantic: followersSemantic,
})
poss.determinerPl.addRule({
	rhs: [ followersPossessiveDeterminerSg, [ user.lhs, userFollowersPossessiveHead ] ],
})


// SHARE:
var share = g.newSymbol('share').addVerb({
	insertionCost: 2,
	oneSg: 'share',
	threeSg: 'shares',
	pl: 'share',
	past: 'shared',
}).addVerb({
	// Add synonyms in a separate call so symbols correct to corresponding accepted form.
	oneSg: 'have in common',
	threeSg: 'has in common',
	pl: 'have in common',
	past: 'had in common',
})

// followers I and {user} share; (people who are) followers I and {user} share
// Limit insertions because otherwise decreases performance and introduces unlikely suggestions: "people I follow" -> "followers people I follow share".
user.noRelative.addRule({
	rhs: [
		[ followersTerm, user.nomUsersPluralSubj ],
		share
	],
	semantic: followersSemantic,
	noInsertionIndexes: [ 1 ],
})
// followers I share with {user}; followers I and {user} share with {user} and my followers
user.noRelative.addRule({
	rhs: [
		followersTerm,
		[
			// Define `followers()` on each rule to support `union()`.
			g.newBinaryRule({ rhs: [ user.nomUsersPlus, share ], semantic: followersSemantic }),
			g.newBinaryRule({ rhs: [ preps.associative, user.objUsersPlus ], semantic: followersSemantic })
		],
	],
	noInsertionIndexes: [ 0, 1 ],
})