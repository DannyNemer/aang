// Basic boolean operations

var g = require('../grammar')

// conjunction
this.and = g.addWord({
	symbol: new g.Symbol('and'),
	insertionCost: 2,
	accepted: [ 'and' ]
})

// disjunction
this.union = g.addWord({
	symbol: new g.Symbol('union'),
	accepted: [ 'or' ]
})