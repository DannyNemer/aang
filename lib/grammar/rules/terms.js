var g = require('../grammar')
var preps = require('./prepositions')


var termSymNamePrefix = 'term'

// (companies with `<int>` in) funding
exports.funding = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'funding'),
	type: g.termTypes.INVARIABLE,
	insertionCost: 1.5,
	acceptedTerms: [ 'funding' ],
})

// (issues/pull-requests with `<int>`) comments
exports.comments = g.newNoun({
	symbolName: 'comments',
	insertionCost: 3,
	acceptedNounTermSets: [ {
		sg: 'comment',
		pl: 'comments'
	} ],
})

// Do not use insertion costs for the following two substituted terms because the vast majority of suggestions output by the insertions (which become substitutions) are too different from input and unhelpful.
// (repos created in) this (week) -> (repos created) this (week)
var termThisSubstituted = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'this', 'substituted'),
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'this', 'the' ],
})
// (repos created in this) last (week) -> (repos created) this (week)
var termLastSubstituted = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'last', 'substituted'),
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'last', 'past' ],
})
var thisLastTermSubstituted = g.newTermSequenceBinarySymbol({
	type: g.termTypes.INVARIABLE,
	termPair: [ termThisSubstituted, termLastSubstituted ],
})

// (repos created) this (week|month|year)
exports.thisDate = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'this', 'date'),
	type: g.termTypes.INVARIABLE,
	insertionCost: 1,
	acceptedTerms: [ 'this' ],
	// Note: Could add a substitution for "last" -> "this" to output more diverse suggestions. Though, better to optimize for additive suggestions rather than substitutive suggestions which can disorient the user by disregarding the input's intent.
	substitutedTerms: [
		// in|within|during this|the
		// Prevent `[prep-origin]` insertion which would otherwise enable an ambiguous insertion for this substitution: "this" -> "in this" -> "this".
		{ term: [ preps.origin, termThisSubstituted ], noInsertionIndexes: [ 0 ] },
		// in|within|during this|the last|past
		{ term: [ preps.origin, thisLastTermSubstituted ], noInsertionIndexes: [ 0 ] },
	]
})

// (repos created) last (week|month|year)
exports.lastDate = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'last', 'date'),
	type: g.termTypes.INVARIABLE,
	insertionCost: 1.5,
	acceptedTerms: [ 'last' ],
	substitutedTerms: [
		// in|within|during this|the last|past
		// Note: Could restructure as a stop-word for "in|within|during this|the" and a substitution for "past".
		// Prevent `[prep-origin]` insertion which would otherwise enable an ambiguous insertion for this substitution: "last" -> "in this last" -> "last".
		{ term: [ preps.origin, thisLastTermSubstituted ], noInsertionIndexes: [ 0 ], costPenalty: 1 },
	]
})

// (repos created this|last) week
exports.week = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'week'),
	type: g.termTypes.INVARIABLE,
	insertionCost: 1.5,
	acceptedTerms: [ 'week' ],
})

// (repos created this|last) month
exports.month = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'month'),
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'month' ],
})

// (repos created this|last) year
exports.year = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'year'),
	type: g.termTypes.INVARIABLE,
	insertionCost: 0.5,
	acceptedTerms: [ 'year' ],
})