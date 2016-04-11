var g = require('../../grammar')


// Returns objects associated with a date in the past, present, or future.
// (companies) worked at by `[obj-users+]`
exports.everSemantic = g.newSemantic({
	name: 'ever',
	cost: 0.3,
	minParams: 1,
	maxParams: 1,
})