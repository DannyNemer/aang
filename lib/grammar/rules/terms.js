var g = require('../grammar')


var termSymNamePrefix = 'term'

// (companies with `<int>` in) funding
exports.funding = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'funding'),
	insertionCost: 1.5,
	type: g.termTypes.INVARIABLE,
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

// (repos created in) this (week) -> (repos created) this (week)
var thisTerm = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'this'),
	insertionCost: 1,
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'this', 'the' ],
})

// (repos created in this) last (week) -> (repos created) this (week)
var lastTerm = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'last'),
	insertionCost: 1.5,
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'last', 'past' ],
})

var origin = g.newTermSequence({
	symbolName: g.hyphenate('prep', 'origin', 'date'),
	insertionCost: 0.5,
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'in', 'within', 'during' ],
})

// (repos created) this (week|month|year)
exports.thisDate = g.newTermSequence({
	symbolName: g.hyphenate('term', 'this', 'date'),
	insertionCost: 1,
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'this' ],
	// NOTE: Could add a substitution for "last" -> "this" to output more diverse suggestions. Though, better to optimize for additive suggestions rather than substitutive suggestions which can disorient the user by disregarding the input's intent.
	substitutedTerms: [
		// in|within|during this|the
		// Prevent `[prep-origin]` to avoid ambiguous insertion for substitution: "this" -> "in this" -> "this".
		{ term: [ origin, thisTerm ], noInsertionIndexes: [ 0 ] },
		// in|within|during this|the last|past
		{ term: [ origin, [ thisTerm, lastTerm ] ], noInsertionIndexes: [ 0 ] },
	]
})

// (repos created) last (week|month|year)
exports.lastDate = g.newSymbol(termSymNamePrefix, 'last', 'date').addWord({
	insertionCost: 1.5,
	accepted: [ 'last' ],
	// NOTE: Could use a stop-word for "in|within the" and a substitution for "past".
	substitutions: [ { symbol: 'in|within|during this|the last|past', costPenalty: 1 } ],
})

// (repos created this|last) week
exports.week = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'week'),
	insertionCost: 1.5,
	type: g.termTypes.INVARIABLE,
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
	insertionCost: 0.5,
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'year' ],
})