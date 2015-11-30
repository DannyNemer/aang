var g = require('../grammar')
var relPronouns = require('./relativePronouns')


exports.intersectSemantic = g.newSemantic({ name: 'intersect', cost: 0, minParams: 1, maxParams: 100 })
exports.unionSemantic = g.newSemantic({ name: 'union', cost: 0.5, minParams: 1, maxParams: 100 })

// Conjunction.
exports.and = g.newSymbol('and').addWord({
	insertionCost: 2,
	accepted: [ 'and' ],
	substitutions: [ 'but' ],
})

// Disjunction.
exports.union = g.newSymbol('union').addWord({
	accepted: [ 'or' ],
	substitutions: [ 'nor' ],
})

// (people who follow me) and/or (who I follow)
exports.andWho = g.newBinaryRule({ RHS: [ exports.and, relPronouns.who ], noInsertionIndexes: [ 1 ] })
exports.unionWho = g.newBinaryRule({ RHS: [ exports.union, relPronouns.who ], noInsertionIndexes: [ 1 ] })

// (repos that I like) and/or that (I contribute to)
exports.andThat = g.newBinaryRule({ RHS: [ exports.and, relPronouns.that ], noInsertionIndexes: [ 1 ] })
exports.unionThat = g.newBinaryRule({ RHS: [ exports.union, relPronouns.that ], noInsertionIndexes: [ 1 ] })

/**
 * Creates rules for "and" + "or" to surround `symbol`.
 *
 * @param {Symbol} symbol The symbol for which to create rules.
 * @param {boolean} noConjunctionInsert Specify forbidding insertions of the conjunction terms: `[and]`, `[union]`.
 * @returns {Symbol} Returns the parent symbol with the new rules.
 */
exports.create = function (symbol, noConjunctionInsert) {
	// (people who follow) [obj-users]
	var symbolPlus = g.newSymbol(symbol.name + '+')
	symbolPlus.addRule({ RHS: [ symbol ] })

	// (people who follow) [obj-users] and [obj-users+]
	var symbolAnd = g.newBinaryRule({
		RHS: [ symbol, exports.and ],
		noInsertionIndexes: noConjunctionInsert ? [ 0, 1 ] : [ 0 ],
	})
	symbolPlus.addRule({
		RHS: [ symbolAnd, symbolPlus ],
		noInsertionIndexes: [ 0, 1 ],
	})

	// (people who follow) [obj-users] or [obj-users+]
	var symbolUnion = g.newBinaryRule({
		RHS: [ symbol, exports.union ],
		noInsertionIndexes: noConjunctionInsert ? [ 0, 1 ] : [ 0 ],
	})
	symbolPlus.addRule({
		RHS: [ symbolUnion, symbolPlus ],
		semantic: exports.unionSemantic,
		noInsertionIndexes: [ 0, 1 ],
	})

	return symbolPlus
}