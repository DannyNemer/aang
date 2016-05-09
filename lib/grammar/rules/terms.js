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