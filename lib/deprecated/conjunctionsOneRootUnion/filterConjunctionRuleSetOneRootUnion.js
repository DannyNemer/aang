/**
 * Creates the nonterminal rule set for `filter` conjunctions.
 *
 * The resulting rule set is identical to the rules which `conjunctions.create()` creates, with additional rules for relative pronouns; e.g., "`[cat-filter]` and who/that ... `[cat-filter+]`".
 *
 * For use by the `Category()` constructor when creating the base rules for a new category.
 *
 * @private
 * @static
 * @param {NSymbol} filter The `Category` `[cat-filter]` `NSymbol`, from which to build the conjunction rule set, `[cat-filter+]`.
 * @param {boolean} [isPerson] Specify the associated category represents a person, which instructs which relative pronoun to use (i.e., "that" vs. "who").
 * @returns {NSymbol} Returns the `NSymbol` that produces the `filter` conjunction rule set.
 */
function createFilterConjunctionRuleSet(filter, isPerson) {
	// Identical rule structure to rules `conjunctions.create()` defines, though defined here to incorporate relative pronouns for "[filter] and who/that ...".
	var filterPlus = g.newSymbol(filter.name + '+')
	// (people who) `[filter]`
	filterPlus.addRule({
		rhs: [ filter ],
	})

	var filterAnd = g.newBinaryRule({
		rhs: [ filter, conjunctions.and ],
		noInsertionIndexes: [ 0 ],
	})
	var filterAndRelPronoun = g.newBinaryRule({
		rhs: [ filter, isPerson ? conjunctions.andWho : conjunctions.andThat ],
		noInsertionIndexes: [ 0 ],
	})

	var filterPlusNoUnion = g.newSymbol(filterPlus.name, 'no', 'union')
	filterPlusNoUnion.addRule({
		rhs: [ filter ],
	}).addRule({
		rhs: [ filterAnd, filterPlusNoUnion ],
		noInsertionIndexes: [ 0, 1 ],
	}).addRule({
		rhs: [ filterAndRelPronoun, filterPlusNoUnion ],
		noInsertionIndexes: [ 0, 1 ],
	})

	// (people who) `[filter]` and [who] `[filter]` [and [who] `[filter]` ...]
	filterPlus.addRule({
		rhs: [ filterAnd, filterPlusNoUnion ],
		noInsertionIndexes: [ 0, 1 ],
	}).addRule({
		rhs: [ filterAndRelPronoun, filterPlusNoUnion ],
		noInsertionIndexes: [ 0, 1 ],
	})

	// Following logic's order of operations, "and" takes precedence over "or". Hence, segments between "or" are grouped together with `intersect()`, which are then grouped together in `union()`.
	var filterPlusNoUnionOr = g.newBinaryRule({
		rhs: [ filterPlusNoUnion, conjunctions.union ],
		noInsertionIndexes: [ 0 ],
		semantic: conjunctions.intersectSemantic,
	})
	var filterPlusNoUnionOrRelPronoun = g.newBinaryRule({
		rhs: [ filterPlusNoUnion, isPerson ? conjunctions.unionWho : conjunctions.unionThat ],
		noInsertionIndexes: [ 0 ],
		semantic: conjunctions.intersectSemantic,
	})

	// When a conjunction subtree involves `union()`, there is one `union()` semantic at the root of the subtree, with instances of `intersect()` separating the arguments.
	var filterPlusNoUnionSemantic = g.newSymbol(filterPlus.name, 'no', 'union', 'semantic')
	filterPlusNoUnionSemantic.addRule({
		rhs: [ filter ],
		semantic: conjunctions.intersectSemantic,
	}).addRule({
		rhs: [ filterAnd, filterPlusNoUnion ],
		noInsertionIndexes: [ 0, 1 ],
		semantic: conjunctions.intersectSemantic,
	}).addRule({
		rhs: [ filterAndRelPronoun, filterPlusNoUnion ],
		noInsertionIndexes: [ 0, 1 ],
		semantic: conjunctions.intersectSemantic,
	}).addRule({
		rhs: [ filterPlusNoUnionOr, filterPlusNoUnionSemantic ],
		noInsertionIndexes: [ 0, 1 ],
	}).addRule({
		rhs: [ filterPlusNoUnionOrRelPronoun, filterPlusNoUnionSemantic ],
		noInsertionIndexes: [ 0, 1 ],
	})

	// (people who) `[filter]` [and `[filter]` ...] or `[filter+]`
	filterPlus.addRule({
		rhs: [ filterPlusNoUnionOr, filterPlusNoUnionSemantic ],
		noInsertionIndexes: [ 0, 1 ],
		semantic: conjunctions.unionSemantic,
	}).addRule({
		rhs: [ filterPlusNoUnionOrRelPronoun, filterPlusNoUnionSemantic ],
		noInsertionIndexes: [ 0, 1 ],
		semantic: conjunctions.unionSemantic,
	})

	return filterPlus
}