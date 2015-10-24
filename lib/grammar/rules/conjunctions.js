var g = require('../grammar')
var relPronouns = require('./relativePronouns')


exports.intersectSemantic = g.newSemantic({ name: 'intersect', cost: 0, minParams: 1, maxParams: 100 })
exports.unionSemantic = g.newSemantic({ name: 'union', cost: 0.5, minParams: 1, maxParams: 100 })

// Conjunction.
exports.and = g.newSymbol('and')
exports.and.addWord({
	insertionCost: 2,
	accepted: [ 'and' ],
})

// Disjunction.
exports.union = g.newSymbol('union')
exports.union.addWord({
	accepted: [ 'or' ],
})

// (people who follow me) and/or (who I follow)
exports.andWho = g.newBinaryRule({ RHS: [ exports.and, relPronouns.who ] })
exports.unionWho = g.newBinaryRule({ RHS: [ exports.union, relPronouns.who ] })

// (repos that I like) and/or that (I contribute to)
exports.andThat = g.newBinaryRule({ RHS: [ exports.and, relPronouns.that ] })
exports.unionThat = g.newBinaryRule({ RHS: [ exports.union, relPronouns.that ] })

/**
 * Creates rules for "and" + "or" to surround `symbol`.
 *
 * @param {Symbol} symbol The symbol for which to create rules.
 * @returns {Symbol} Returns the parent symbol with the new rules.
 */
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