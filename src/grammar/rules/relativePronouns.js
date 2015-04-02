var g = require('../grammar')

// (people) who (follow me)
this.who = g.addWord({
	symbol: new g.Symbol('who'),
	insertionCost: 0.1,
	accepted: [ 'who', 'that' ]
})

// (repos) that (are liked by me)
this.that = g.addWord({
	symbol: new g.Symbol('that'),
	insertionCost: 0.1,
	accepted: [ 'that', 'which' ]
})