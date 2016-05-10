var g = require('../grammar')


var termSymNamePrefix = 'term'

// (companies with `<int>` in) funding
exports.funding = g.newInvariableTerm({
	symbolName: g.hyphenate(termSymNamePrefix, 'funding'),
	insertionCost: 1.5,
	acceptedTerms: [ 'funding' ],
})

// (followers `[nom-users-plural-subj]` have in) common
exports.common = g.newInvariableTerm({
	symbolName: g.hyphenate(termSymNamePrefix, 'common'),
	acceptedTerms: [ 'common' ],
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
	substitutions: [ { symbol: 'in|within the last|past', costPenalty: 1 } ],
})

// (repos created this|last) week
exports.week = g.newInvariableTerm({
	symbolName: g.hyphenate(termSymNamePrefix, 'week'),
	insertionCost: 1.5,
	acceptedTerms: [ 'week' ],
})

// (repos created this|last) month
exports.month = g.newInvariableTerm({
	symbolName: g.hyphenate(termSymNamePrefix, 'month'),
	acceptedTerms: [ 'month' ],
})

// (repos created this|last) year
exports.year = g.newInvariableTerm({
	symbolName: g.hyphenate(termSymNamePrefix, 'year'),
	insertionCost: 0.5,
	acceptedTerms: [ 'year' ],
})