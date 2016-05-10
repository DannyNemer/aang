var g = require('../../grammar')


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
exports.everSemantic = g.newSemantic({
	name: 'ever',
	cost: 0.3,
	minParams: 1,
	maxParams: 1,
})