var g = require('../../grammar')
var user = require('./user')
var oneSg = require('./oneSg')
var conjunction = require('../conjunction')
var auxVerbs = require('../auxVerbs')
var preps = require('../prepositions')
var verbs = require('../verbs')
var adjectives = require('../adjectives')
var terms = require('../terms')
var nouns = require('../nouns')


var followersSemantic = g.newSemantic({
	name: 'followers',
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	// (people who follow) my followers and their followers
	isPeople: true,
})

// Note: Currently unused.
var userFollow = g.newTermSequence({
	symbolName: g.hyphenate(user.nameSg, 'follow'),
	type: g.termTypes.VERB,
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

// Note: Manually adds the following two substitution sets temporarily until `terminalRuleSetMethods.neVerb()` is extended to support these substitutions.
// Do not know if should create these forms for all verbs? Do not know if [have|has|had] should only be stop-words befor the gerund.
// Some of these will become pre-verb-stop-words: "have been liking" -> "have liked".
follow.addSubstitutions([
	// FIXME: Insertion of 'have|has|had been' creates ambiguity with the preceding substitution.
	'have|has|had been following', // present perfect progressive
	'am|is|are|were|was|be following', // present progressive
	// No "have followed" because it can imply people the user no longer follows.
	'have|has followed', // present perfect
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
	'have|has subscribed to',  // present perfect
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


var followers = g.newTermSequence({
	symbolName: g.hyphenate('followers', 'term'),
	type: g.termTypes.NOUN,
	acceptedTerms: [
		nouns.followers,
		nouns.subscribers,
	],
})

// (my) followers; followers (of mine)
var userFollowersHead = g.newSymbol(user.nameSg, 'followers', 'head').addRule({
	rhs: [ user.service, followers ],
}).addRule({
	rhs: [ followers ],
})

// (`[poss-determiner]`) followers
// (`[poss-determiner]`) female followers
user.noRelativePossessive.addRule({
	rhs: [
		g.newSymbol('followers', user.possDeterminer.name).addRule({
			rhs: [ user.possDeterminer ],
			semantic: followersSemantic,
		}), {
			symbol: g.newBinaryRule({
				rhs: [ user.lhs, userFollowersHead ],
				transpositionCost: 1,
			}),
			noInsert: true,
		},
	],
})

// (followers) of `[poss-users]` [and/or `[poss-users+]`]
user.head.addRule({
	rhs: [
		{ symbol: userFollowersHead, noInsert: true },
		{ symbol: user.ofPossUsersPlus, noInsert: true },
	],
	semantic: followersSemantic,
})


var followersPossessiveTerm = g.newTermSequence({
	symbolName: g.hyphenate('followers', 'possessive', 'term'),
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'followers\'', 'subscribers\'' ],
})
// (my/`{user:'s}`) followers' (repos)
var userFollowersPossessiveHead = g.newSymbol(user.nameSg, 'followers', 'possessive', 'head').addRule({
	rhs: [ user.service, followersPossessiveTerm ],
}).addRule({
	rhs: [ followersPossessiveTerm ],
})
// my/`{user:'s}` followers' (repos)
// my/`{user:'s}` female followers' (repos)
var followersPossessiveDeterminerSg = g.newSymbol('followers', 'possessive', user.possDeterminerSg.name).addRule({
	// Limit to `[poss-determiner-sg]`, instead of `[poss-determiner]`, to limit semantic complexity.
	rhs: [ user.possDeterminerSg ],
	semantic: followersSemantic,
})
user.possDeterminerPl.addRule({
	rhs: [ followersPossessiveDeterminerSg, [ user.lhs, userFollowersPossessiveHead ] ],
	/**
	 * Requires `intersect()` for queries such as the following:
	 *   "my female followers' male followers"
	 *   intersect(
	 *     followers(
	 *       intersect(
	 *         followers(me),
	 *         users-gender(female) ) ),
	 *     users-gender(male) )
	 *
	 * Without `intersect()`, `users-gender(female)` would not be grouped with `followers(me)`, yielding a logically equivalent query though far more inefficient for DB-lookup and intersection.
	 */
	semantic: conjunction.intersectSemantic,
})


// (people who follow) my followers
// Enable certain insertions, with a low insertion cost, while preventing drawbacks which would result from removing the `noInsert` restriction above.
user.objUsers.addRule({
	isTerminal: true,
	rhs: 'my followers',
	text: 'my followers',
	insertionCost: 0.1,
	semantic: g.reduceSemantic(followersSemantic, oneSg.semanticArg),
})


// NUM FOLLOWERS:
user.addCountRuleSet({
	itemNoun: followers,
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


// SHARE:
var share = g.newTermSequence({
	symbolName: g.hyphenate('followers', 'share'),
	type: g.termTypes.VERB,
	acceptedTerms: [
		verbs.share,
		// `[have]` in common
		[ auxVerbs.have, [ preps.in, adjectives.common ] ],
	],
})

/**
 * followers I and `{user}` share
 *
 * Limit insertions because otherwise decreases performance and introduces unlikely suggestions. For example:
 *   "people I follow" -> "followers people I follow share".
 */
user.noRelative.addRule({
	rhs: [
		// `[nom-users-plural]` only produces plural subjects (e.g., "people who ...") or conjunctions with multiple subjects (e.g., "`{user}` and me").
		[ followers, user.nomUsersPlural ],
		{ symbol: share, noInsert: true },
	],
	semantic: followersSemantic,
})
// followers I share with `{user}`
// followers I and `{user}` share with `{user}` and my followers
user.noRelative.addRule({
	rhs: [
		{ symbol: followers, noInsert: true },
		{
			symbol: [
				// Define `followers()` on each rule to support `union()`.
				g.newBinaryRule({ rhs: [ user.nomUsersPlus, share ], semantic: followersSemantic }),
				g.newBinaryRule({ rhs: [ preps.associative, user.objUsersPlus ], semantic: followersSemantic })
			],
			noInsert: true,
	} ],
})