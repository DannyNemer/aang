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

	var symbolPlusNoUnion = g.newSymbol(symbolPlus.name, 'no', g.getSemanticName(exports.unionSemantic))
	symbolPlusNoUnion.addRule({
		rhs: [ symbol ],
	}).addRule({
		rhs: [
			{ symbol: symbolAnd, noInsert: true },
			{ symbol: symbolPlusNoUnion, noInsert: true },
		],
	})

	// (people who follow) `[obj-users]` and `[obj-users]` [and `[obj-users]` ...]
	symbolPlus.addRule({
		// Does not produce a rule with `union()` so that when "or" is used, `symbolPlus` uses the rule that puts `union()` at the conjugation root; i.e., `union()` is located at the first instance of `symbolPlus`.
		rhs: [
			{ symbol: symbolAnd, noInsert: true },
			/**
			 * Removing this insertion restriction enables insertions such as the following:
			 *   "repos liked by Danny and <me>"
			 * Though, the additional insertion rules slow the benchmark by 30%. Consider enabling these insertion rules if we have computation to spare (e.g., if transposition edits are removed from the grammar).
			 */
			{ symbol: symbolPlusNoUnion, noInsert: true },
		],
	})

	// Following logic's order of operations, "and" takes precedence over "or". Hence, segments between "or" are grouped together with `intersect()`, which are then grouped together in `union()`.
	var symbolPlusNoUnionOr = g.newBinaryRule({
		rhs: [
			symbolPlusNoUnion,
			{ symbol: exports.or, noInsert: !!noConjunctionInsert },
		],
		// Use `intersect()` to group semantics for the parent `union()` semantic.
		semantic: exports.intersectSemantic,
	})
	var symbolPlusIntersect = g.newSymbol(symbolPlus.name, g.getSemanticName(exports.intersectSemantic)).addRule({
		rhs: [ symbolPlus ],
		// Use `intersect()` to group semantics for the parent `union()` semantic.
		// When `symbolPlus` returns a semantic tree with `intersect()` at its root, it indicates to `reduceUnion()` to not distribute the LHS semantic that precedes the `union()` that precedes this semantic among the arguments of that `intersect()`.
		semantic: exports.intersectSemantic,
	})

	// (people who follow) `[obj-users]` [and `[obj-users]` ...] or `[obj-users+]`
	symbolPlus.addRule({
		// Produce `symbolPlusNoUnionOr`, in contrast to `symbolAnd` produced in the previous `symbolPlus` rule, to set `union()` at the disjunction root.
		rhs: [
			{ symbol: symbolPlusNoUnionOr, noInsert: true },
			symbolPlusIntersect,
		],
		semantic: exports.unionSemantic,
	})

	return symbolPlus
}

// Substitutes "and" -> "or" in input.
// For use by `conjunction.createDisjunctionSet()` with rule sets whose associated semantic forbids multiple instances of that semantic within an `intersect()` using `forbidsMultipleIntersection`, and therefore forbids logical conjunctions.
var orSubstitutedAnd = g.newTermSequence({
	symbolName: g.hyphenate(exports.or.name, 'substituted', exports.and.name),
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ exports.or ],
	// No substitution cost penalty because if "and" is restricted though matched in input, then the user's semantic intention was likely "or". Also, `union()` has a 0.5 cost penalty while `intersect()` has none.
	substitutedTerms: [ exports.and ],
})

/**
 * Creates a logical disjunction set that produces recursive rules for multiple instances of `symbol` separated (only) by "or" (`union()`).
 *
 * For use by rule sets whose associated semantic forbids multiple instances of that semantic within an `intersect()` using `forbidsMultipleIntersection` (e.g., `repositories-created()`), and therefore forbids logical conjunctions. That semantic is to use the semantics this new disjunction rule set produces as its semantic arguments (except for `union()`, which is moved up the semantic tree to distribute the outer LHS semantic among the `union()` semantic arguments).
 *
 * Substitutes "and" -> "or" in input.
 *
 * @memberOf conjunction
 * @param {NSymbol} symbol The symbol for which to create the disjunction rule set.
 * @returns {NSymbol} Returns the parent symbol for the `symbol` disjunction rule set.
 */
exports.createDisjunctionSet = function (symbol) {
	var symbolPlusDisjunction = g.newSymbol(symbol.name + '+', 'disjunction')

	// (repos liked by) `[obj-users]`
	symbolPlusDisjunction.addRule({
		rhs: [ symbol ],
	})

	// Following logic's order of operations, "and" takes precedence over "or". Hence, segments between "or" are grouped together with `intersect()` (for when `symbol` produces multiple semantics), which are then grouped together in `union()`.
	var symbolOr = g.newBinaryRule({
		// Use of `symbol` is identical to `symbolPlusDisjunction` without `union()` (i.e., without the last `symbolPlusDisjunction` rule).
		rhs: [ symbol, orSubstitutedAnd ],
		// Use `intersect()` to group semantics `symbol` produces for the parent `union()` semantic.
		semantic: exports.intersectSemantic,
	})
	var symbolPlusDisjunctionIntersect = g.newSymbol(symbolPlusDisjunction.name, g.getSemanticName(exports.intersectSemantic)).addRule({
		rhs: [ symbolPlusDisjunction ],
		// Use `intersect()` to group semantics for the parent `union()` semantic.
		// When `symbolPlusDisjunction` returns a semantic tree with `intersect()` at its root, it indicates to `reduceUnion()` to not distribute the LHS semantic that precedes the `union()` that precedes this semantic among the arguments of that `intersect()`.
		semantic: exports.intersectSemantic,
	})

	// (repos liked by) `[obj-users]` [or `[obj-users]` ...] or `[obj-users+-disjunction]`
	// (repos liked by) `[obj-users]` and `[obj-users+-disjunction]` -> ... or `[obj-users+-disjunction]`
	symbolPlusDisjunction.addRule({
		rhs: [
			{ symbol: symbolOr, noInsert: true },
			symbolPlusDisjunctionIntersect,
		],
		semantic: exports.unionSemantic,
	})

	return symbolPlusDisjunction
}