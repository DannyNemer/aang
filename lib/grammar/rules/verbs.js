var g = require('../grammar')
var preps = require('./prepositions')


// (people `[nom-users+]`) follow
exports.follow = g.newVerb({
	insertionCost: 1,
	verbFormsTermSet: {
		oneSg: 'follow',
		threeSg: 'follows',
		pl: 'follow',
		past: 'followed',
		presentParticiple: 'following',
	},
})

// (people `[nom-users+]`) subscribe (to)
exports.subscribe = g.newVerb({
	verbFormsTermSet: {
		oneSg: 'subscribe',
		threeSg: 'subscribes',
		pl: 'subscribe',
		past: 'subscribed',
		presentParticiple: 'subscribing',
	},
})

// (followers `[nom-users-plural-subj]`) share
exports.share = g.newVerb({
	insertionCost: 2,
	verbFormsTermSet: {
		oneSg: 'share',
		threeSg: 'shares',
		pl: 'share',
		past: 'shared',
		presentParticiple: 'sharing',
	},
})

// (repos/pull-requests/issues `[nom-users+-disjunction]`) created
exports.create = g.newVerb({
	insertionCost: 0.5,
	verbFormsTermSet: {
		oneSg: 'create',
		threeSg: 'creates',
		pl: 'create',
		past: 'created',
		presentParticiple: 'creating',
	},
})

// (repos/pull-requests/issues `[nom-users+-disjunction]`) made -> `[verb-create]`
exports.make = g.newVerb({
	verbFormsTermSet: {
		oneSg: 'make',
		threeSg: 'makes',
		pl: 'make',
		past: 'made',
		presentParticiple: 'making',
	},
})

// (repos/pull-requests `[nom-users+-disjunction]`) created
exports.createSet = g.newTermSequence({
	symbolName: g.hyphenate(exports.create.name, 'set'),
	type: g.termTypes.VERB,
	acceptedTerms: [
		exports.create,
	],
	substitutedTerms: [
		exports.make,
	],
})

// (issues `[nom-users+-disjunction]`) opened
exports.open = g.newVerb({
	// Use identical `insertionCost` as `[verb-create]` to ensure insertion rules for `[issue-open]` insert `[verb-open]` instead of its accepted synonym, `[verb-create]`.
	insertionCost: exports.create.insertionCost,
	verbFormsTermSet: {
		oneSg: 'open',
		threeSg: 'opens',
		pl: 'open',
		past: 'opened',
		presentParticiple: 'opening',
	},
})

// (repos `[nom-users+]`) liked(s)/liked
exports.like = g.newVerb({
	insertionCost: 0.8,
	verbFormsTermSet: {
		oneSg: 'like',
		threeSg: 'likes',
		pl: 'like',
		past: 'liked',
		presentParticiple: 'liking',
	},
})

// (repos `[nom-users+]`) starred -> `[verb-like]`
exports.star = g.newVerb({
	verbFormsTermSet: {
		oneSg: 'star',
		threeSg: 'stars',
		pl: 'star',
		past: 'starred',
		presentParticiple: 'starring',
	},
})

// (repos `[nom-users+]`) bookmarked -> `[verb-like]`
exports.bookmark  = g.newVerb({
	verbFormsTermSet: {
		oneSg: 'bookmark',
		threeSg: 'bookmarks',
		pl: 'bookmark',
		past: 'bookmarked',
		presentParticiple: 'bookmarking',
	},
})

// (repos `[nom-users+]`) contribute(s)/contributed (to)
exports.contribute = g.newVerb({
	insertionCost: 0.7,
	verbFormsTermSet: {
		oneSg: 'contribute',
		threeSg: 'contributes',
		pl: 'contribute',
		past: 'contributed',
		presentParticiple: 'contributing',
	},
})

// (repos `[nom-users+]`) forked
exports.fork = g.newVerb({
	insertionCost: 2,
	verbFormsTermSet: {
		oneSg: 'fork',
		threeSg: 'forks',
		pl: 'fork',
		past: 'forked',
		presentParticiple: 'forking',
	},
})

// (repos) pushed (`[date]`)
exports.push = g.newVerb({
	verbFormsTermSet: {
		oneSg: 'push',
		threeSg: 'pushes',
		pl: 'push',
		past: 'pushed',
		presentParticiple: 'pushing',
	},
})

// (issues) updated (`[date]`)
exports.update = g.newVerb({
	insertionCost: 2,
	verbFormsTermSet: {
		oneSg: 'update',
		threeSg: 'updates',
		pl: 'update',
		past: 'updated',
		presentParticiple: 'updating',
	},
})

// (pull-requests/issues that) mention (`[obj-users+]`)
// (pull-requests/issues `[nom-users+]` `[be]`) mentioned (in)
// (people) mentioned (in `[mentioners+]`)
exports.mention = g.newVerb({
	insertionCost: 1,
	verbFormsTermSet: {
		oneSg: 'mention',
		threeSg: 'mentions',
		pl: 'mention',
		past: 'mentioned',
		presentParticiple: 'mentioning',
	},
})

// (pull-requests/issues) assigned (to `[obj-users+]`)
// (pull-requests/issues `[nom-users+]` `[be]`) assigned (to)
// (people) assigned (to `[mentioners+]`)
exports.assign = g.newVerb({
	insertionCost: 0.7,
	verbFormsTermSet: {
		oneSg: 'assign',
		threeSg: 'assigns',
		pl: 'assign',
		past: 'assigned',
		presentParticiple: 'assigning',
	},
})

// (pull-requests/issues `[nom-users+]` `[be]`) assigned to
// (pull-requests/issues) assigned to (`[obj-users+]`)
exports.assignedTo = g.newBinaryRule({
	rhs: [ {
			symbol: exports.assign,
			grammaticalForm: 'past',
		},
		preps.to,
	],
})

// (companies `[nom-users+]`) founded
exports.found = g.newVerb({
	insertionCost: 2.25,
	verbFormsTermSet: {
		oneSg: 'found',
		threeSg: 'founds',
		pl: 'found',
		past: 'founded',
		presentParticiple: 'founding',
	},
})

// (companies `[nom-users+]`) started -> `[verb-found]`
exports.start = g.newVerb({
	verbFormsTermSet: {
		oneSg: 'start',
		threeSg: 'starts',
		pl: 'start',
		past: 'started',
		presentParticiple: 'starting',
	},
})

// (companies `[nom-users+]`) finds -> `[verb-found]`
// Temporarily include past tense verb form "found", though ambiguous with `[verb-found]`. Will later extend `g.newTermSequence()` to detect the ambiguity and exclude the terminal symbol automatically when flattening unary rules (only alert for multi-token ambiguity). For now, avoid using a present tense verb (created by `g.newVerb()`) in a non-present term sequence, to enable proper checks.
exports.find = g.newVerb({
	verbFormsTermSet: {
		oneSg: 'find',
		threeSg: 'finds',
		pl: 'find',
		// Use "dummyfound" to temporarily avoid the ambiguity error in `flattenTermSequence`.
		past: 'dummyfound',
		presentParticiple: 'finding',
	},
})

// (companies that) raised (`<int>` in funding)
exports.raise = g.newVerb({
	insertionCost: 2.5,
	verbFormsTermSet: {
		oneSg: 'raise',
		threeSg: 'raises',
		pl: 'raise',
		past: 'raised',
		presentParticiple: 'raising',
	},
})

// (companies `[nom-users+]`) invested (in)
exports.invest = g.newVerb({
	// Ensure insertion cost + `[prep-in]` insertion cost < `[verb-fund]` insertion cost.
	insertionCost: 1.4,
	verbFormsTermSet: {
		oneSg: 'invest',
		threeSg: 'invests',
		pl: 'invest',
		past: 'invested',
		presentParticiple: 'investing',
	},
})

// (companies `[nom-users+]`) funded
exports.fund = g.newVerb({
	verbFormsTermSet: {
		oneSg: 'fund',
		threeSg: 'funds',
		pl: 'fund',
		past: 'funded',
		presentParticiple: 'funding',
	},
})

// (companies `[nom-users+]`) financed -> `[invest-in]
exports.finance = g.newVerb({
	verbFormsTermSet: {
		oneSg: 'finance',
		threeSg: 'finances',
		pl: 'finance',
		past: 'financed',
		presentParticiple: 'financing',
	},
})

// (companies `{company}`) acquired
// Note: Not currently in use.
exports.acquire = g.newVerb({
	verbFormsTermSet: {
		oneSg: 'acquire',
		threeSg: 'acquires',
		pl: 'acquire',
		past: 'acquired',
		presentParticiple: 'acquiring',
	},
})

// (companies `{company}`) bought -> `[verb-acquire]`
// Note: Not currently in use.
exports.buy = g.newVerb({
	verbFormsTermSet: {
		oneSg: 'buy',
		threeSg: 'buys',
		pl: 'buy',
		past: 'bought',
		presentParticiple: 'buying',
	},
})

/**
 * Separate present and past tense verb forms to restrict matches to rules of the same tense. Otherwise, past tense "worked" yields the following suggestions with scarcely distinguishable display text (though different semantics):
 *   "companies I worked at", `ever-past()`
 *   Stop: "companies I worked->work at" , `present()`
 *
 * work.noTense: (repos `[nom-users+]`) work(s)/work (on) -> `[verb-contribute]` (to)
 * work.present: (companies `[nom-users+]`) work(s) (at)
 * work.past: (companies) worked (at by `[obj-users+]`)
 */
exports.work = g.newTenseVerb({
	insertionCost: 1.4,
	verbFormsTermSet: {
		oneSg: 'work',
		threeSg: 'works',
		pl: 'work',
		past: 'worked',
		presentParticiple: 'working',
	},
})

/**
 * Separate present and past tense verb forms to restrict matches to rules of the same tense.
 *
 * consult.present: (companies `[nom-users+]`) consult(s) (at) -> `[verb-work-present]` (at)
 * consult.past: (companies) consulted (at by `[obj-users+]`) -> `[verb-work-past] (at by `[obj-users+]`)
 */
exports.consult = g.newTenseVerb({
	verbFormsTermSet: {
		oneSg: 'consult',
		threeSg: 'consults',
		pl: 'consult',
		past: 'consulted',
		presentParticiple: 'consulting',
	},
})