var g = require('../grammar')


var relPronounSubPreps = g.newTermSequence({
	symbolName: g.hyphenate('relative', 'pronoun', 'substituted', 'prepositions'),
	insertionCost: 0.5,
	acceptedTerms: [ 'at', 'about', 'by', 'for', 'from', 'in', 'of', 'on', 'to', 'with' ],
})

var relPronounSubRelAdverbs = g.newTermSequence({
	symbolName: g.hyphenate('relative', 'pronoun', 'substituted', 'relative', 'adverbs'),
	/**
	 * NOTE: Temporarily use alternate substitution, which lacks 'who', 'that', and 'which', until `createEditRules` is extended to prevent the ambiguity the other substitution creates. To prevent ambiguity, `createEditRules` must remove the individual terminal rules for those terms in the terminal rules sets for insertions created from the rule, but keeping them for the original (split) rule.
	 *
	 * Missing terms (until fixing ambiguity issues): 'who', 'that', 'which'
	 */
	acceptedTerms: [ 'what', 'when', 'where', 'whom', 'whose', 'why' ],
})

// (people) who (follow me)
exports.who = g.newTermSequence({
	symbolName: 'who',
	insertionCost: 0.1,
	acceptedTerms: [ 'who', 'that' ],
	substitutedTerms: [
		[ relPronounSubPreps, relPronounSubRelAdverbs ],
	],
})

// (repos) that (are liked by me)
exports.that = g.newTermSequence({
	symbolName: 'that',
	insertionCost: 0.1,
	acceptedTerms: [ 'that', 'which' ],
	substitutedTerms: [
		[ relPronounSubPreps, relPronounSubRelAdverbs ],
	],
})