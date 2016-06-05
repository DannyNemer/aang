var g = require('../../grammar')
var user = require('./user')
var poss = require('./poss')
var oneSg = require('./oneSg')
var conjunction = require('../conjunction')
var auxVerbs = require('../auxVerbs')
var preps = require('../prepositions')
var verbs = require('../verbs')
var terms = require('../terms')


var followersSemantic = g.newSemantic({
	name: 'followers',
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	// (people who follow) my followers and their followers
	isPeople: true,
})

// NOTE: Currently unused.
var userFollow = g.newTermSequence({
	symbolName: g.hyphenate(user.nameSg, 'follow'),
	type: 'verb',
	acceptedTerms: [
		verbs.follow,
		[ verbs.subscribe, preps.to ],
	],
})

var follow = g.newVerbSet({
	symbolName: 'follow',
	insertionCost: 1,
	acceptedVerbTermSets: [ {
		oneSg: 'follow',
		threeSg: 'follows',
		pl: 'follow',
		past: 'followed',
		presentParticiple: 'following',
	}, {
		oneSg: 'subscribe to',
		threeSg: 'subscribes to',
		pl: 'subscribe to',
		past: 'subscribed to',
		presentParticiple: 'subscribing to',
	} ],
})

// NOTE: Manually adds the following two substitution sets temporarily until `terminalRuleSetMethods.neVerb()` is extended to support these substitutions.
// Do not know if should create these forms for all verbs? Do not know if [have|has|had] should only be stop-words befor the gerund.
follow.addSubstitutions([
	// FIXME: Insertion of 'have|has|had been' creates ambiguity with the preceding substitution.
	'have|has|had been following', // present perfect progressive
	'am|is|are|were|was|be following', // present progressive
	// No "have followed" because it can imply people the user no longer follows.
	'have followed', // present perfect
	'has followed', // present perfect
], {
	oneSg: 'follow',
	threeSg: 'follows',
	pl: 'follow',
	past: 'followed',
})

follow.addSubstitutions([
	// FIXME: Insertion of 'have|has|had been' creates ambiguity with the preceding substitution.
	'have|has|had been subscribing to', // present perfect progressive
	'am|is|are|were|was|be subscribing to', // present progressive
	// FIXME: Insertion of 'have|has|had been' creates ambiguity the past tense inflection.
	'have|has|had been subscribed to',
	'am|is|are|were|was|be subscribed to',
	'have subscribed to',  // present perfect
	'has subscribed to', // present perfect
], {
	oneSg: 'subscribe to',
	threeSg: 'subscribes to',
	pl: 'subscribe to',
	past: 'subscribed to',
})

// FOLLOW:
user.addVerbRuleSet({
	verbTerm: follow,
	// Prevent all present perfect rules, which otherwise express both the current state and past occurrences of following users, instead of just the current state. These rules are undesirable because following users is an ongoing state, ergo present perfect tense references both users that currently follow specified users *and* users that previously but no longer follow the same specified users. This implication is unlikely the user's intent, hence the rules' omission:
	//   Stop: (repos) `[nom-users+]` have/has followed
	//   Stop: (repos) `[nom-users+]` have/has not followed
	//   Stop: (people who) have followed `[obj-users+]`
	//   Stop: (people who) have not followed `[obj-users+]`
	noPresentPerfect: true,
	// Verb rules for `users-followed()`:
	//   (people) followed by `[obj-users+]`
	//   (people) `[nom-users+]` follows(s)
	//   (people) `[nom-users+]` do/does not follow
	catVerbSemantic: g.newSemantic({
		name: g.hyphenate(user.namePl, 'followed'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
		// (people who follow) people I follow and their followers
		isPeople: true,
	}),
	// Verb rules for `followers()`:
	//   (people who) follow `[obj-users+]`
	//   (people who) do not follow `[obj-users+]`
	objectSym: user.objUsersPlus,
	userVerbSemantic: followersSemantic,
})


var followers = g.newNoun({
	symbolName: 'followers',
	insertionCost: 2.5,
	acceptedNounTermSets: [ {
		sg: 'follower',
		pl: 'followers',
	}, {
		sg: 'subscriber',
		pl: 'subscribers',
	} ],
})

// (my) followers; followers (of mine)
var userFollowersHead = g.newSymbol(user.nameSg, followers.name, 'head').addRule({
	rhs: [ user.service, followers ],
	noInsert: true,
}).addRule({
	rhs: [ followers ],
	noInsert: true,
})

// my/`{user:'s}`/my-followers' (followers)
var followersPossDeterminer = g.newSymbol(followers.name, poss.determiner.name).addRule({
	rhs: [ poss.determiner ],
	semantic: followersSemantic,
})
// (my) female followers
var userFollowersPossessable = g.newSymbol(user.nameSg, followers.name, 'possessable').addRule({
	rhs: [ user.lhs, userFollowersHead ],
	noInsert: true,
	transpositionCost: 1,
})
user.noRelativePossessive.addRule({
	rhs: [ followersPossDeterminer, userFollowersPossessable ],
})

// followers of `{user:'s}`/mine/[users]
user.head.addRule({
	rhs: [ userFollowersHead, poss.ofPossUsersPlus ],
	semantic: followersSemantic,
})


// (people who follow) my followers
// Enable certain insertions, with a low insertion cost, while preventing drawbacks which would result from removing the `noInsertionIndexes` restriction above.
user.objUsers.addRule({
	isTerminal: true,
	rhs: 'my followers',
	text: 'my followers',
	insertionCost: 0.1,
	restrictInsertion: true,
	semantic: g.reduceSemantic(followersSemantic, oneSg.semanticArg),
})


// NUM FOLLOWERS:
user.addCountRuleSet({
	itemTerm: followers,
	// Count rules for `users-follower-count()`:
	//   (people) with `<int>` followers
	//   (people who) have `<int>` followers
	//   (people who) do not have `<int>` followers
	catCountSemantic: g.newSemantic({
		name: g.hyphenate(user.namePl, 'follower', 'count'),
		cost: 0.5,
		minParams: 1,
		maxParams: 2,
		// (people who follow) people with `<int>` followers (and their followers)
		isPeople: true,
	}),
})


var followersPossessiveTerm = g.newTermSequence({
	symbolName: g.hyphenate(followers.name, 'possessive', 'term'),
	type: 'invariable',
	acceptedTerms: [ 'followers\'', 'subscribers\'' ],
})
// (my/`{user:'s}`) followers' (repos)
var userFollowersPossessiveHead = g.newSymbol(user.nameSg, followers.name, 'possessive', 'head').addRule({
	rhs: [ user.service, followersPossessiveTerm ],
}).addRule({
	rhs: [ followersPossessiveTerm ],
})
// my/`{user:'s}` followers' (repos); my/`{user:'s}` female followers' (repos)
var followersPossessiveDeterminerSg = g.newSymbol(followers.name, 'possessive', poss.determinerSg.name).addRule({
	// Limit to `[poss-determiner-sg]`, instead of `[poss-determiner]`, to limit semantic complexity.
	rhs: [ poss.determinerSg ],
	semantic: followersSemantic,
})
poss.determinerPl.addRule({
	rhs: [ followersPossessiveDeterminerSg, [ user.lhs, userFollowersPossessiveHead ] ],
	// Requires `intersect()` for queries such as "female followers'" in "my female followers' male followers", which has the semantic `intersect(followers(intersect(followers(me),users-gender(female))),users-gender(male))`. Otherwise, parser would reject two instances of `users-gender()`.
	semantic: conjunction.intersectSemantic,
})


// SHARE:
var share = g.newTermSequence({
	symbolName: g.hyphenate(followers.name, 'share'),
	type: 'verb',
	acceptedTerms: [
		verbs.share,
		// `[have]` in common
		[ auxVerbs.have, [ preps.in, terms.common ] ],
	],
})

// followers I and `{user}` share; (people who are) followers I and `{user}` share
// Limit insertions because otherwise decreases performance and introduces unlikely suggestions: "people I follow" -> "followers people I follow share".
user.noRelative.addRule({
	rhs: [
		[ followers, user.nomUsersPluralSubj ],
		share
	],
	semantic: followersSemantic,
	noInsertionIndexes: [ 1 ],
})
// followers I share with `{user}`; followers I and `{user}` share with `{user}` and my followers
user.noRelative.addRule({
	rhs: [
		followers,
		[
			// Define `followers()` on each rule to support `union()`.
			g.newBinaryRule({ rhs: [ user.nomUsersPlus, share ], semantic: followersSemantic }),
			g.newBinaryRule({ rhs: [ preps.associative, user.objUsersPlus ], semantic: followersSemantic })
		],
	],
	noInsertionIndexes: [ 0, 1 ],
})