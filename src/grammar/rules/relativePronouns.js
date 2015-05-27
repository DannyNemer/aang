var g = require('../grammar')

// (people) who (follow me)
exports.who = new g.Symbol('who')
exports.who.addWord({
	insertionCost: 0.1,
	accepted: [ 'who', 'that' ]
})

// (repos) that (are liked by me)
exports.that = new g.Symbol('that')
exports.that.addWord({
	insertionCost: 0.1,
	accepted: [ 'that', 'which' ]
})