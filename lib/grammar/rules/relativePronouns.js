var g = require('../grammar')


var relPronounSubPreps = g.newTermSequence({
	symbolName: g.hyphenate('relative', 'pronoun', 'substituted', 'prepositions'),
	insertionCost: 0.5,
	type: 'invariable',
	acceptedTerms: [ 'at', 'about', 'by', 'for', 'from', 'in', 'of', 'on', 'to', 'with' ],
})

var relPronounSubRelAdverbs = g.newTermSequence({
	symbolName: g.hyphenate('relative', 'pronoun', 'substituted', 'relative', 'adverbs'),
	type: 'invariable',
	/**
	 * NOTE: Temporarily use alternate substitution, which lacks 'who', 'that', and 'which', until `createEditRules` is extended to prevent the ambiguity the other substitution creates. To prevent ambiguity, `createEditRules` must remove the individual terminal rules for those terms in the terminal rules sets for insertions created from the rule, but keeping them for the original (split) rule.
	 *
	 * Perhaps must do preceding stop-words instead so that "about which" -> "which" instead of "that", the default display text.
	 */
	acceptedTerms: [ 'what', 'when', 'where', 'whom', 'whose', 'why' ],
	// Even with `calcHeuristicCosts` choosing the cheapest sub-node for a term sequence, enabling this still introduces enormous ambiguity: 33% more paths created over entire test suite!.
	// Unused until fixing ambiguity issues:
	// acceptedTerms: [ 'that', 'what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why' ],
})

// (people) who (follow me)
exports.who = g.newTermSequence({
	symbolName: 'who',
	insertionCost: 0.1,
	type: 'invariable',
	acceptedTerms: [ 'who', 'that' ],
	substitutedTerms: [
		[ relPronounSubPreps, relPronounSubRelAdverbs ],
	],
})

// (repos) that (are liked by me)
exports.that = g.newTermSequence({
	symbolName: 'that',
	insertionCost: 0.1,
	type: 'invariable',
	acceptedTerms: [ 'that', 'which' ],
	substitutedTerms: [
		[ relPronounSubPreps, relPronounSubRelAdverbs ],
	],
})