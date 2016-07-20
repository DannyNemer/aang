var g = require('../grammar')
var relPronouns = require('./relativePronouns')


exports.intersectSemantic = g.newSemantic({ name: 'intersect', cost: 0, minParams: 2, maxParams: 100 })
exports.unionSemantic = g.newSemantic({ name: 'union', cost: 0.5, minParams: 2, maxParams: 100 })

// Conjunction.
exports.and = g.newTermSequence({
	symbolName: 'and',
	type: g.termTypes.INVARIABLE,
	insertionCost: 2,
	acceptedTerms: [ 'and' ],
	substitutedTerms: [ 'but' ],
})

// Disjunction.
exports.or = g.newTermSequence({
	symbolName: 'or',
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'or' ],
	substitutedTerms: [ 'nor' ],
})

// (people who follow me) and/or (who I follow)
exports.andWho = g.newBinaryRule({
	rhs: [
		exports.and,
		{ symbol: relPronouns.who, noInsert: true },
	],
})
exports.orWho = g.newBinaryRule({
	rhs: [
		exports.or,
		{ symbol: relPronouns.who, noInsert: true },
	],
})

// (repos that I like) and/or that (I contribute to)
exports.andThat = g.newBinaryRule({
	rhs: [
		exports.and,
		{ symbol:  relPronouns.that, noInsert: true },
	],
})
exports.orThat = g.newBinaryRule({
	rhs: [
		exports.or,
		{ symbol: relPronouns.that, noInsert: true },
	],
})

/**
 * Creates a conjunction set that produces recursive rules for multiple instances of `symbol` separated by "and" (conjunction - `intersect()`) or "or" (disjunction - `union()`).
 *
 * For rules with `union()`, `semantic.reduce()` moves the `union()` up their semantic tree to distribute the outer LHS semantic among the `union()` semantic arguments. For example:
 *  "repos I or Danny and my followers like"
 *  LHS: `repos-liked()`
 *  RHS: `union(me,intersect(0,followers(me)))`
 *  -> `union(repos-liked(me),intersect(repos-liked(0),repos-liked(followers(me))))`
 *
 * @memberOf conjunction
 * @param {NSymbol} symbol The symbol for which to create the conjunction rule set.
 * @param {boolean} [noConjunctionInsert] Specify forbidding insertions of the conjunction terms: `[and]`, `[or]`.
 * @returns {NSymbol} Returns the parent symbol for the `symbol` conjunction rule set.
 */
exports.create = function (symbol, noConjunctionInsert) {
	var symbolPlus = g.newSymbol(symbol.name + '+')
	// (people who follow) `[obj-users]`
	symbolPlus.addRule({
		rhs: [ symbol ],
	})

	var symbolAnd = g.newBinaryRule({
		rhs: [
			{ symbol: symbol, noInsert: !!noConjunctionInsert },
			{ symbol: exports.and, noInsert: !!noConjunctionInsert },
		],
	})

	var symbolPlusNoUnion = g.newSymbol(symbolPlus.name, 'no', 'union')
	symbolPlusNoUnion.addRule({
		rhs: [ symbol ],
	}).addRule({
		rhs: [
			{ symbol: symbolAnd, noInsert: true },
			{ symbol: symbolPlusNoUnion,  noInsert: true },
		],
	})

	// (people who follow) `[obj-users]` and `[obj-users]` [and `[obj-users]` ...]
	symbolPlus.addRule({
		// Does not produce a rule with `union()` so that when "or" is used, `symbolPlus` uses the rule that puts `union()` at the conjugation root; i.e., `union()` is located at the first instance of `symbolPlus`.
		rhs: [
			{ symbol: symbolAnd, noInsert: true },
			{ symbol: symbolPlusNoUnion,  noInsert: true },
		],
	})

	// Following logic's order of operations, "and" takes precedence over "or". Hence, segments between "or" are grouped together with `intersect()`, which are then grouped together in `union()`.
	var symbolPlusNoUnionOr = g.newBinaryRule({
		rhs: [
			{ symbol: symbolPlusNoUnion, noInsert: true },
			{ symbol: exports.or, noInsert: !!noConjunctionInsert },
		],
		// Use `intersect()` to group semantics for the parent `union()` semantic.
		semantic: exports.intersectSemantic,
	})
	var symbolPlusIntersect = g.newSymbol(symbolPlus.name, 'intersect').addRule({
		rhs: [ symbolPlus ],
		// Use `intersect()` to group semantics for the parent `union()` semantic.
		// When `symbolPlus` returns a semantic tree with `intersect()` at its root, it indicates to `reduceUnion()` in `semantic` to not distribute the LHS semantic that precedes the `union()` semantic that precedes this semantic among that `intersect()` semantic's arguments.
		semantic: exports.intersectSemantic,
	})

	// (people who follow) `[obj-users]` [and `[obj-users]` ...] or `[obj-users+]`
	symbolPlus.addRule({
		// Produce `symbolPlusNoUnionOr`, in contrast to `symbolAnd` produced in the previous `symbolPlus` rule, to set `union()` at the disjunction root.
		rhs: [
			{ symbol: symbolPlusNoUnionOr, noInsert: true },
			{ symbol: symbolPlusIntersect,  noInsert: true },
		],
		semantic: exports.unionSemantic,
	})

	return symbolPlus
}