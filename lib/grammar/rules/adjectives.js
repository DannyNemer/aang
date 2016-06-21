var g = require('../grammar')


var adjSymNamePrefix = 'adj'

// (followers `[nom-users-plural-subj]` have in) common
exports.common = g.newTermSequence({
	symbolName: g.hyphenate(adjSymNamePrefix, 'common'),
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'common' ],
})

// (repos created) earlier (than `[date-value]`)
exports.earlier = g.newTermSequence({
	symbolName: g.hyphenate(adjSymNamePrefix, 'earlier'),
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'earlier' ],
})

// (repos created) prior|up (to `[date-value]`)
exports.prior = g.newTermSequence({
	symbolName: g.hyphenate(adjSymNamePrefix, 'prior'),
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'prior', 'up' ],
})

// (repos created) later (than `[date-value]`)
exports.later = g.newTermSequence({
	symbolName: g.hyphenate(adjSymNamePrefix, 'later'),
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'later' ],
})

// (repos created) subsequent (to `[date-value]`)
exports.subsequent = g.newTermSequence({
	symbolName: g.hyphenate(adjSymNamePrefix, 'subsequent'),
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'subsequent' ],
})

// (issues with) greater|more (than `<int>` comments)
exports.greater = g.newTermSequence({
	symbolName: g.hyphenate(adjSymNamePrefix, 'greater'),
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'greater', 'more' ],
})

// (issues with) fewer|less (than `<int>` comments)
exports.fewer = g.newTermSequence({
	symbolName: g.hyphenate(adjSymNamePrefix, 'fewer'),
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'fewer', 'less' ],
})