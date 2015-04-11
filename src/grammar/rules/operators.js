// Basic boolean operations
// Could call conjunctions

var g = require('../grammar')

this.intersectSemantic = new g.Semantic({ name: 'intersect', cost: 0, minParams: 1, maxParams: 100 })
this.unionSemantic = new g.Semantic({ name: 'union', cost: 0.5, minParams: 1, maxParams: 100 })

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