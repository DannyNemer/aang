var g = require('../../grammar')
var user = require('./user')


// Returns objects associated with a date in the present.
// (companies) `[nom-users+]` work(s) at, `present()`
exports.presentSemantic = g.newSemantic({
	name: 'present',
	cost: 0,
	minParams: 1,
	maxParams: 1,
})

// Returns objects associated with a date in the past, present, or future.
// (companies) worked at by `[obj-users+]`, `ever()`
// (companies) `[nom-users+]` have/has worked at, `ever()`
exports.everSemantic = g.newSemantic({
	name: 'ever',
	cost: 0.3,
	minParams: 1,
	maxParams: 1,
})

// Returns objects associated with a date in the past or present.
// (companies) `[nom-users+]` worked at, `ever-past()`
exports.everPastSemantic = g.newSemantic({
	name: g.hyphenate('ever', 'past'),
	cost: 0.3,
	minParams: 1,
	maxParams: 1,
})

// Returns objects associated with a date in the past.
// (companies) `[nom-users+]` previously worked at, `past()`
exports.pastSemantic = g.newSemantic({
	name: 'past',
	cost: 0,
	minParams: 1,
	maxParams: 1,
})

// (companies `[nom-users+]`) previously (worked at), `past()`
var previouslyTerm = g.newTermSequence({
	symbolName: g.hyphenate('term', 'previously'),
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'previously', 'formerly' ],
})

// (companies) `[nom-users+]` previously (worked at), `past()`
exports.nomUsersPlusPreviously = g.newBinaryRule({
	rhs: [ user.nomUsersPlus, previouslyTerm ],
})