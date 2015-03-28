// Basic boolean operations

var g = require('../grammar')

// conjunction
this.and = g.addWord({
	name: 'and',
	insertionCost: 2,
	accepted: [ 'and' ]
})

// disjunction
this.union = g.addWord({
	name: 'union',
	accepted: [ 'or' ]
})