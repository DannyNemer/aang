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
exports.andWho = g.newBinaryRule({ rhs: [ exports.and, relPronouns.who ], noInsertionIndexes: [ 1 ] })
exports.unionWho = g.newBinaryRule({ rhs: [ exports.union, relPronouns.who ], noInsertionIndexes: [ 1 ] })

// (repos that I like) and/or that (I contribute to)
exports.andThat = g.newBinaryRule({ rhs: [ exports.and, relPronouns.that ], noInsertionIndexes: [ 1 ] })
exports.unionThat = g.newBinaryRule({ rhs: [ exports.union, relPronouns.that ], noInsertionIndexes: [ 1 ] })

/**
 * Creates rules for "and" + "or" to surround `symbol`.
 *
 * @param {Symbol} symbol The symbol for which to create rules.
 * @param {boolean} [noConjunctionInsert] Specify forbidding insertions of the conjunction terms: `[and]`, `[union]`.
 * @returns {Symbol} Returns the parent symbol with the new rules.
 */
exports.create = function (symbol, noConjunctionInsert) {
	var symbolPlus = g.newSymbol(symbol.name + '+')
	// (people who follow) `[obj-users]`
	symbolPlus.addRule({
		rhs: [ symbol ],
	})

	var newRule = {
		rhs: [ symbol, exports.and ],
	}
	if (noConjunctionInsert) {
		newRule.noInsertionIndexes = [ 0, 1 ]
	}
	var symbolAnd = g.newBinaryRule(newRule)

	var symbolPlusNoUnion = g.newSymbol(symbolPlus.name, 'no', 'union')
	symbolPlusNoUnion.addRule({
		rhs: [ symbol ],
	}).addRule({
		rhs: [ symbolAnd, symbolPlusNoUnion ],
		noInsertionIndexes: [ 0, 1 ],
	})

	// (people who follow) `[obj-users]` and `[obj-users]` [and `[obj-users]` ...]
	symbolPlus.addRule({
		// Does not produce a rule with `union()` so that when "or" is used, `symbolPlus` uses the rule that puts `union()` at the conjugation root; i.e., `union()` is located at the first instance of `symbolPlus`.
		rhs: [ symbolAnd, symbolPlusNoUnion ],
		noInsertionIndexes: [ 0, 1 ],
	})

	// Following logic's order of operations, "and" takes precedence over "or". Hence, segments between "or" are grouped together with `intersect()`, which are then grouped together in `union()`.
	var symbolPlusNoUnionOr = g.newBinaryRule({
		rhs: [ symbolPlusNoUnion, exports.union ],
		noInsertionIndexes: noConjunctionInsert ? [ 0, 1 ] : [ 0 ],
		// Use `intersect()` to group semantics for the parent `union()` semantic.
		semantic: exports.intersectSemantic,
	})
	var symbolPlusIntersect = g.newSymbol(symbolPlus.name, 'intersect').addRule({
		rhs: [ symbolPlus ],
		// Use `intersect()` to group semantics for the parent `union()` semantic.
		semantic: exports.intersectSemantic,
	})

	// (people who follow) `[obj-users]` [and `[obj-users]` ...] or `[obj-users+]`
	symbolPlus.addRule({
		// Produce `symbolPlusNoUnionOr` in contrast to `symbolAnd` produced in the previous `symbolPlus` rule to set `union()` at the conjungation root.
		rhs: [ symbolPlusNoUnionOr, symbolPlusIntersect ],
		noInsertionIndexes: [ 0, 1 ],
		semantic: exports.unionSemantic,
	})

	return symbolPlus
}