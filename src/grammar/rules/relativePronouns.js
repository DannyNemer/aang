var g = require('../grammar')


// (people) who (follow me)
exports.who = g.newSymbol('who')
exports.who.addWord({
	insertionCost: 0.1,
	accepted: [ 'who', 'that' ]
})

// (repos) that (are liked by me)
exports.that = g.newSymbol('that')
exports.that.addWord({
	insertionCost: 0.1,
	accepted: [ 'that', 'which' ]
})