/**
 * Constructs conjunction rule sets to only use a single `union()` semantic for conjunction subtrees with however many instances of `[union]`. Uses `intersect()` to separate the `union()` arguments.
 *
 * This grammar design, as well as the derivate designs for `[nom-users-plural-subj]` in `user` and `[cat-filter+]` in `Category`, provide no benefit.
 *
 * First, semantic reduction still requires to flatten instances of `union()` to detect duplicate semantic arguments. For example, the first query below uses two conjunction subtrees, and will need flattening of nested `union()` even with this rule design to detect its semantic equivalence to the second query:
 * 		"my repos I or Danny like or my followers like"
 * 		"my repos I or Danny or my followers like"
 *
 * Second, the use of these rule increases `Parser.prototype.addNode()` invocations for the `union` tests in the test suite by 5.5%, and the total benchmark time for the `union` tests increases by 5% (i.e., 5% slower).
 *
 * Third, the hypothesis that knowing every `union()` instance is the root of a conjunction subtree does not aid in determining how to properly distribute LHS semantics that among the `union()` semantic children.
 */

var g = require('../grammar')
var relPronouns = require('./relativePronouns')


exports.intersectSemantic = g.newSemantic({ name: 'intersect', cost: 0, minParams: 2, maxParams: 100 })
exports.unionSemantic = g.newSemantic({ name: 'union', cost: 0, minParams: 2, maxParams: 100 })

// Conjunction.
exports.and = g.newSymbol('and').addWord({
	insertionCost: 2,
	accepted: [ 'and' ],
	substitutions: [ 'but' ],
})

// Disjunction.
// Assign a `costPenalty` of 0.5 because the `union()` semantic can not provide an accurate cost penalty, because multiple instances of "or" within a single conjunction subtree will only have one `union()` semantic at the root.
exports.union = g.newSymbol('union').addRule({
	isTerminal: true,
	costPenalty: 0.5,
	rhs: 'or',
}).addRule({
	isTerminal: true,
	costPenalty: 0.5,
	rhs: 'nor',
	text: 'or'
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
 * @memberOf conjunctions
 * @param {NSymbol} symbol The symbol for which to create rules.
 * @param {boolean} [noConjunctionInsert] Specify forbidding insertions of the conjunction terms: `[and]`, `[union]`.
 * @returns {NSymbol} Returns the parent symbol with the new rules.
 */
exports.create = function (symbol, noConjunctionInsert) {
	var symbolPlus = g.newSymbol(symbol.name + '+')
	// (people who follow) `[obj-users]`
	symbolPlus.addRule({
		rhs: [ symbol ],
	})

	var symbolAndRule = {
		rhs: [ symbol, exports.and ],
	}
	if (noConjunctionInsert) {
		symbolAndRule.noInsertionIndexes = [ 0, 1 ]
	}
	var symbolAnd = g.newBinaryRule(symbolAndRule)

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

	// When a conjunction subtree involves `union()`, there is one `union()` semantic at the root of the subtree, with instances of `intersect()` separating the arguments.
	var symbolPlusNoUnionSemantic = g.newSymbol(symbolPlus.name, 'no', 'union', 'semantic')
	symbolPlusNoUnionSemantic.addRule({
		rhs: [ symbol ],
		// Need `intersect()` for "(repos I like or) Danny and my followers (like)".
		semantic: exports.intersectSemantic,
	}).addRule({
		rhs: [ symbolAnd, symbolPlusNoUnion ],
		noInsertionIndexes: [ 0, 1 ],
		semantic: exports.intersectSemantic,
	}).addRule({
		rhs: [ symbolPlusNoUnionOr, symbolPlusNoUnionSemantic ],
		noInsertionIndexes: [ 0, 1 ],
		// No union semantic.
	})

	// (people who follow) `[obj-users]` [and `[obj-users]` ...] or `[obj-users+]`
	symbolPlus.addRule({
		// Produce `symbolPlusNoUnionOr` in contrast to `symbolAnd` produced in the previous `symbolPlus` rule to set `union()` at the conjunction root.
		rhs: [ symbolPlusNoUnionOr, symbolPlusNoUnionSemantic ],
		noInsertionIndexes: [ 0, 1 ],
		semantic: exports.unionSemantic,
	})

	return symbolPlus
}