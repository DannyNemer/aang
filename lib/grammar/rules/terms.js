var g = require('../grammar')


var termSymNamePrefix = 'term'

// (companies with `<int>` in) funding
exports.funding = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'funding'),
	insertionCost: 1.5,
	type: 'invariable',
	acceptedTerms: [ 'funding' ],
})

// (followers `[nom-users-plural-subj]` have in) common
exports.common = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'common'),
	type: 'invariable',
	acceptedTerms: [ 'common' ],
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

// (repos created) this (week|month|year)
exports.thisDate = g.newSymbol(termSymNamePrefix, 'this', 'date').addWord({
	insertionCost: 1,
	accepted: [ 'this' ],
	substitutions: [ 'in|within this', 'in|within the last|past' ],
})

// (repos created) last (week|month|year)
exports.lastDate = g.newSymbol(termSymNamePrefix, 'last', 'date').addWord({
	insertionCost: 1.5,
	accepted: [ 'last' ],
	// NOTE: Could use a stop-word for "in|within the" and a substitution for "past".
	substitutions: [ { symbol: 'in|within the last|past', costPenalty: 1 } ],
})

// (repos created this|last) week
exports.week = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'week'),
	insertionCost: 1.5,
	type: 'invariable',
	acceptedTerms: [ 'week' ],
})

// (repos created this|last) month
exports.month = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'month'),
	type: 'invariable',
	acceptedTerms: [ 'month' ],
})

// (repos created this|last) year
exports.year = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'year'),
	insertionCost: 0.5,
	type: 'invariable',
	acceptedTerms: [ 'year' ],
})

// (repos created) earlier (than `[date-value]`)
exports.earlier = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'earlier'),
	type: 'invariable',
	acceptedTerms: [ 'earlier' ],
})

// (repos created) prior|up (to `[date-value]`)
exports.prior = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'prior'),
	type: 'invariable',
	acceptedTerms: [ 'prior', 'up' ],
})

// (repos created) later (than `[date-value]`)
exports.later = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'later'),
	type: 'invariable',
	acceptedTerms: [ 'later' ],
})

// (repos created) subsequent (to `[date-value]`)
exports.subsequent = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'subsequent'),
	type: 'invariable',
	acceptedTerms: [ 'subsequent' ],
})

// (issues with) greater|more (than `<int>` comments)
exports.greater = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'greater'),
	type: 'invariable',
	acceptedTerms: [ 'greater', 'more' ],
})

// (issues with) fewer|less (than `<int>` comments)
exports.fewer = g.newTermSequence({
	symbolName: g.hyphenate(termSymNamePrefix, 'fewer'),
	type: 'invariable',
	acceptedTerms: [ 'fewer', 'less' ],
})