// Basic boolean operations

var g = require('../grammar')

exports.intersectSemantic = g.newSemantic({ name: 'intersect', cost: 0, minParams: 1, maxParams: 100 })
exports.unionSemantic = g.newSemantic({ name: 'union', cost: 0.5, minParams: 1, maxParams: 100 })

// conjunction
exports.and = g.newSymbol('and')
exports.and.addWord({
	insertionCost: 2,
	accepted: [ 'and' ],
})

// disjunction
exports.union = g.newSymbol('union')
exports.union.addWord({
	accepted: [ 'or' ],
})

// Create rules for "and" + "or" to surround `symbol`
exports.addForSymbol = function (symbol) {
	// (people who follow) [obj-users]
	var symbolPlus = g.newSymbol(symbol.name + '+')
	symbolPlus.addRule({ RHS: [ symbol ] })

	// (people who follow) [obj-users] and [obj-users+]
	symbolPlus.addRule({ RHS: [ symbol, [ exports.and, symbolPlus ] ] })

	// (people who follow) [obj-users] or [obj-users+]
	symbolPlus.addRule({ RHS: [ symbol, [ exports.union, symbolPlus ] ], semantic: exports.unionSemantic })

	return symbolPlus
}