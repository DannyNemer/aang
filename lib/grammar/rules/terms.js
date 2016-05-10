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

// (repos created this/last) week
exports.week = g.newInvariableTerm({
	symbolName: g.hyphenate(termSymNamePrefix, 'week'),
	insertionCost: 1.5,
	acceptedTerms: [ 'week' ],
})

// (repos created this/last) month
exports.month = g.newInvariableTerm({
	symbolName: g.hyphenate(termSymNamePrefix, 'month'),
	acceptedTerms: [ 'month' ],
})