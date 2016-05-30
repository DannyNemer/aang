var util = require('../util/util')
var grammarUtil = require('../grammar/grammarUtil')


/**
 * Calculates and assigns the heuristic estimate of the minimum cost of a complete subtree (i.e., reaches terminal nodes) that can be constructed from each node that descends from `parentNode` (via one of its subnodes). These values serve as admissible heuristics in the A* search of the parse forest.
 *
 * The cost of a subtree/path is the sum of the minimum cost of all node in the subtree, excluding the cost of `parentNode`. The parent node's cost is excluded in the sum because there are several possible costs for the node (to add to the minimum cost of a path in `pfsearch`) when there is a `ruleProps` array (i.e., multiple insertions).
 *
 * @private
 * @static
 * @param {Object} parentNode The node for which to calculate and assign the minimum cost of a descendant subtree (from one of its subnodes).
 * @returns {number} Returns the minimum cost of a subtree that descends from `parentNode`.
 */
module.exports = function calcMinCost(parentNode) {
	var childSubs = parentNode.subs
	var minCost

	for (var s = 0, childSubsLen = childSubs.length; s < childSubsLen; ++s) {
		var childSub = childSubs[s]
		var childSubRuleProps = childSub.ruleProps

		// When `ruleProps` is an array of `ruleProps` (for insertions), has property `cost` (assigned in `StateTable` generation), which is the cost from its first element because the array is sorted by increasing cost (in grammar generation).
		var cost = childSubRuleProps.cost

		// Check all three conditions instead of enclosing them within a single `childNode.subs` block and then checking because it yields 25% fewer checks.

		/**
		 * Get the minimum cost of a complete subtree (i.e., reaches terminal nodes) that descends from `childSub.node`. The `minCost` does not include the cost of the node itself, because that varies for `ruleProps` arrays (i.e., multiple insertions).
		 *
		 * `minCost` is only `undefined` for nonterminal rules; hence, `childNode.subs` exists.
		 *
		 * Check `minCost` is `undefined` to avoid inspecting the same node multiple times. Can leave `minCost` as `undefined` while traversing its descendant nodes because a node will never be a subnode of itself (i.e., recursive). See "Recursive Node Restriction" below for an explanation.
		 */
		var childNode = childSub.node
		cost += childNode.minCost === undefined ? calcMinCost(childNode) : childNode.minCost

		// If binary, get the minimum cost of a complete subtree that descends from its second branch.
		var childSubNext = childSub.next
		if (childSubNext) {
			var childNodeNext = childSubNext.node
			cost += childNodeNext.minCost === undefined ? calcMinCost(childNodeNext) : childNodeNext.minCost
		}

		// If `childSub` is nonterminal yet its subnodes produces neither display text nor semantics, then reduce its subnodes' costs (which include deletion costs on the terminal nodes). This includes nonterminal substitutions and stop-words created from regex-style terminal rules, and rules that produce only stop-words.
		if (childSubRuleProps.rhsDoesNotProduceText) {
			/**
			 * Exclude `isNonterminal` property to prevent traversing this node, which contains subnodes with text (from shared rules) that is intended to be avoided because this node's rule defines the text instead (e.g., substitution, stop-word).
			 *
			 * Use `cost`, the minimum cost for `childSub`, as the new `childSub.ruleProps.cost` because it is identical to the cumulative cost (including any deletion costs) of the subtree `childSub` produces, which will be inaccessible after assigning this new, terminal `ruleProps`. If there are multiple subtrees, then they are ambiguous because their text and semantics are defined here (identically), and the minimum cost subtree would be chosen anyway.
			 */
			childSub.ruleProps = {
				cost: cost,
				text: childSubRuleProps.text,
				// Save `tense` for the `acceptedTense` property on the parent nonterminal rule, which accepts the specified tense if input when conjugating, but does not conjugate to that tense if not input.
				tense: childSubRuleProps.tense,
				semantic: childSubRuleProps.semantic,
			}
		}

		/**
		 * If `childSub` is a term sequence (without text), then create a new `ruleProps` for `childSub` with the following properties:
		 * 1. terminal - Mark the new `ruleProps` as terminal so that `pfsearch` uses `childSub.ruleProps` to generate display text and does not traverse its child nodes.
		 * 2. cost - Use `cost`, the minimum cost for `childSub`, as the new `childSub.ruleProps.cost` because it is identical to the cumulative cost (including any deletion costs) of the subtree that will be inaccessible after assigning this new, terminal `ruleProps`. If there are multiple subtrees, then they are ambiguous because their text and semantics are defined here (identically), and the minimum cost subtree would be chosen anyway.
		 * 3. semantic - `childSub.ruleProps.semantic`, if defined. The rules it produces can not have semantics.
		 * 4. text - See below.
		 * 5. tense - See below.
		 *
		 * The new `ruleProps` excludes the following properties which the original `ruleProps` can contain prior to flattening, because all are specific to nonterminal nodes:
		 * • isTermSequence - Used to mark `childNode` that have yet to be flattened.
		 * • isNonterminal - Excluded to mark the flattened term sequences as terminal to prevent `pfsearch` from traversing their child nodes.
		 * • semanticIsReduced - Excluded because `pfsearch` knows all semantics on terminal nodes are reduced.
		 * • insertedSymIdx - Excluded because flattening term sequences into terminal nodes removes the need to traverse the node's children.
		 * • secondRHSCanProduceSemantic - Excluded because only applicable to binary nonterminal nodes.
		 */
		else if (childSubRuleProps.isTermSequence) {
			if (childSubRuleProps.insertedSymIdx !== undefined) {
				/**
				 * If `childSub` is a term sequence with `text` and `insertedSymIdx`, then it is an insertion. Create a new `ruleProps` as explained above, extended as follows:
				 * 4. text - Merge `text` values of the matched terminal rules this subnode's single child node produces with `childSub.ruleProps.text` according to `childSub.ruleProps.insertedSymIdx`.
				 * 5. tense - The tense of any matched verb terminal rules `childSub` produces to maintain tense if the parent rule of `childSub` has matching `acceptedTense`.
				 */
				childSub.ruleProps = createTermSeqInsertionRuleProps(childSub, cost)
			} else if (childSubRuleProps.text) {
				/**
				 * If `childSub` is a term sequence with `text` and no `insertedSymIdx`, then it is a multi-token substitution. Create a new `ruleProps` as explained above, extended as follows:
				 * 4. text - Keep `childSub.ruleProps.text` for `pfsearch` to use as display text instead of the `text` of the matched terminal rules `childSub` produces.
				 * 5. tense - The tense of any matched verb terminal rules `childSub` produces to maintain tense for any verb substitutions in `text` if the parent rule of `childSub` has matching `acceptedTense`.
				 */
				childSub.ruleProps = createTermSeqSubstitutionRuleProps(childSub, cost)
			} else {
				/**
				 * If `childSub` is a term sequence (without text), then create a new `ruleProps` as explained above, extended as follows:
				 * 4. text - Merge the `text` values of the matched terminal rules this subnode's child nodes produces, which `pfsearch` uses as display text.
				 * 5. tense - The tense of any matched verb terminal rules `childSub` produces to maintain tense if the parent rule of `childSub` has matching `acceptedTense`.
				 * 6. personNumber - The grammatical person-number, if any, with which to conjugate nominative verbs that follow `childSub` within its subtree.
				 */
				childSub.ruleProps = createTermSeqRuleProps(childSub, cost)
			}
		}

		/**
		 * When reparsing with all tokens marked deletable (after failing the initial parse), avoid double counting the cost of term sequence child nodes.
		 *
		 * On the initial parse, `calcHeuristicCosts` adds the cost of the term sequences' child nodes to the flattened term sequences' `ruleProps` because `pfsearch` does not visit the child nodes afterward. To avoid double counting the cost of those child nodes (already in `childSubRuleProps.cost`), overwrite `cost` with the previously calculated `childSubRuleProps.cost`.
		 *
		 * Even though reparsing with all tokens marked deletable introduces new parse trees to the parse forest, this will not change any term sequences because any new term sequence subtree is ambiguous (because all lack semantics). The new subtree is guaranteed to have deletion costs and can neither possibly be the cheapest subtree to contribute the `minCost` nor be used in `pfsearch`.
		 */
		else if (childSubRuleProps.wasTermSequence) {
			// Before this reassignment, `cost` is higher than `childSubRuleProps.cost` because `cost` is `childSubRuleProps.cost` plus the cost of its child nodes, though that cost is already in `childSubRuleProps.cost`. Reassigning here prevents double counting the cost of the child nodes.
			cost = childSubRuleProps.cost

			// Need not mark `wasTermSequence` as `false` to prevent multiple assignment to the same `childSubRuleProps` instance because the assignment of `childNode.minCost` above prevents multiple visits to the `childSub` that owns it `childSubRuleProps`.
		}

		// Get `childSub`'s minimum cost, including its cost, after deriving its subnode's minimum cost to determine its parent node's minimum child cost.
		if (minCost === undefined || cost < minCost) {
			minCost = cost
		}
	}

	// Assign minimum cost.
	return parentNode.minCost = minCost
}

/**
 * Creates a new `ruleProps` for term sequence `subNode` with the following properties:
 * 1. terminal - The new `ruleProps` is marked terminal so that `pfsearch` uses the new `subNode.ruleProps` to generate display text and does not traverse its child nodes.
 * 2. cost - Uses `cost`, the cumulative cost (including any deletion costs) of the subtree `subNode` produces, which will be inaccessible after assigning this new, terminal `ruleProps`
 * 3. semantic - `subNode.ruleProps.semantic`, if defined.
 * 4. text - Merges the `text` values of the matched terminal rules this subnode's child nodes produces, which `pfsearch` uses as display text.
 * 5. tense - The tense of any matched verb terminal rules `subNode` produces to maintain tense if the parent rule of `subNode` has matching `acceptedTense`.
 * 6. personNumber - The grammatical person-number, if any, with which to conjugate nominative verbs that follow `subNode` within its subtree.
 *
 * @private
 * @static
 * @param {Object} subNode The term sequence subnode for which to generate a new, terminal `ruleProps`.
 * @param {number} cost The cumulative cost of the subtree `subNode` produces.
 * @returns {Object} Returns the new, terminal `ruleProps` for `subNode`.
 */
function createTermSeqRuleProps(subNode, cost) {
	var subNodeRuleProps = subNode.ruleProps
	if (!subNodeRuleProps.isTermSequence) {
		util.logError('`createTermSeqRuleProps()` invoked on subnode without `isTermSequence`:', subNode)
		throw new Error('Ill-formed term sequence')
	}

	if (subNodeRuleProps.insertedSymIdx !== undefined) {
		util.logError('`createTermSeqRuleProps()` invoked on subnode with `insertedSymIdx` (should use `createTermSeqInsertionRuleProps()`):', subNode)
		throw new Error('Ill-formed term sequence')
	}

	if (subNodeRuleProps.text) {
		util.logError('`createTermSeqRuleProps()` invoked on subnode with substitution text (should use `createTermSeqSubstitutionRuleProps()`):', subNode)
		throw new Error('Ill-formed term sequence')
	}

	var leftSub = getChildSub(subNode)
	var leftText = getSubNodeText(leftSub)

	// Check if `subNode` is a binary or unary node.
	var subNodeNext = subNode.next
	if (subNodeNext) {
		/**
		 * `subNode` is a binary node. For example:
		 *   `[contribute-to]` -> `[contribute]` -> "contribute", text: `{contribute-verb-forms}`
		 *                     -> `[to]`         -> "to"
		 */
		var rightSub = getChildSub(subNodeNext)
		var rightText = getSubNodeText(rightSub)

		return {
			// The cumulative cost (including any deletion costs) of the subtree `subNode` produces.
			cost: cost,
			text: grammarUtil.mergeTextPair(leftText, rightText),
			/**
			 * Currently, the grammar forbids a rule marked `isTermSequence` to produce multiple verbs, thereby preventing multiple instances of `tense`. Hence, this ensures `pfsearch` references the correct `tense` for the correct verb.
			 *
			 * Without this precaution, there could be multiple verb terminal rule sets, yielding multiple verb `text` objects in this resulting merged `text` array. This complicates determining which matched verb terminal rule `tense` applies to which `text` object in the new `text`.
			 */
			tense: leftSub.ruleProps.tense || rightSub.ruleProps.tense,
			semantic: subNodeRuleProps.semantic,
		}
	}

	/**
	 * `subNode` is a unary node. For example:
	 *   `[like]` -> `[love]` -> "love", text: `{love-verb-forms}`
	 *
	 * Even though such a rule does not require `text` merging, the `text` value still must be brought up one level for `gramProps` conjugation, which only conjugates the immediate child nodes (without this step, the `text` object is two levels below the parent rule with `gramProps`).
	 */
	return {
		// The cumulative cost (including any deletion costs) of the subtree `subNode` produces.
		cost: cost,
		text: leftText,
		tense: leftSub.ruleProps.tense,
		semantic: subNodeRuleProps.semantic,
		/**
		 * `subNodeRuleProps.personNumber` only exists for the following term sequence:
		 *   `[nom-users]` -> `[users-term]`, `all(user)`, personNumber: "pl"
		 * This property conjugates nominative verbs that follow `subNode` within its subtree
		 */
		personNumber: subNodeRuleProps.personNumber,
	}
}

/**
 * Creates a new `ruleProps` for term sequence substitution `subNode` with the following properties:
 * 1. terminal - The new `ruleProps` is marked terminal so that `pfsearch` uses the new `subNode.ruleProps` to generate display text and does not traverse its child nodes.
 * 2. cost - Uses `cost`, the cumulative cost (including any deletion costs) of the subtree `subNode` produces, which will be inaccessible after assigning this new, terminal `ruleProps`
 * 3. semantic - `subNode.ruleProps.semantic`, if defined.
 * 4. text - Keeps `subNode.ruleProps.text` for `pfsearch` to use as display text instead of the `text` of the matched terminal rules `subNode` produces.
 * 5. tense - The tense of any matched verb terminal rules `subNode` produces to maintain tense for any verb substitutions in `text` if the parent rule of `subNode` has matching `acceptedTense`.
 *
 * @private
 * @static
 * @param {Object} subNode The term sequence substitution subnode for which to generate a new, terminal `ruleProps`.
 * @param {number} cost The cumulative cost of the subtree `subNode` produces.
 * @returns {Object} Returns the new, terminal `ruleProps` for `subNode`.
 */
function createTermSeqSubstitutionRuleProps(subNode, cost) {
	var subNodeRuleProps = subNode.ruleProps
	if (!subNodeRuleProps.isTermSequence) {
		util.logError('`createTermSeqSubstitutionRuleProps()` invoked on subnode without `isTermSequence`:', subNode)
		throw new Error('Ill-formed term sequence substitution')
	}

	if (!subNodeRuleProps.text) {
		util.logError('`createTermSeqSubstitutionRuleProps()` invoked on subnode without substitution text (should use `createTermSeqRuleProps()`):', subNode)
		throw new Error('Ill-formed term sequence substitution')
	}

	if (subNodeRuleProps.insertedSymIdx !== undefined) {
		util.logError('`createTermSeqSubstitutionRuleProps()` invoked on subnode with `insertedSymIdx` (should use `createTermSeqInsertionRuleProps()`):', subNode)
		throw new Error('Ill-formed term sequence substitution')
	}

	return {
		// The cumulative cost (including any deletion costs) of the subtree `subNode` produces.
		cost: cost,
		text: subNodeRuleProps.text,
		tense: getNonterminalSubstitutionInputTense(subNode),
		semantic: subNodeRuleProps.semantic,
	}
}

/**
 * Gets the input tense of any verb terminal rules `subNode` produces to maintain tense for any verb substitutions whose parent rule has matching `acceptedTense`.
 *
 * For example:
 *   `[contribute-to]` -> "worked on" (input) -> "contributed to" (past tense maintained).
 *
 * `subNode` can be an insertion for a substitution. For example:
 *   `[contribute-to]` -> "work" (input) -> `[work]` `[on]`, text: `[ {contribute-verb-forms}, "to" ]`
 *
 * @private
 * @static
 * @param {Object} subNode The subnode for which to get the `tense` value of any matched verb terminal rule it produces.
 * @returns {string|undefined} Returns the `tense` of any matched verb terminal rule `subNode` produces, else `undefined`.
 */
function getNonterminalSubstitutionInputTense(subNode) {
	var leftSub = getChildSub(subNode)

	// Check if `subNode` is a binary node, else it is an insertion for a substitution.
	var subNodeNext = subNode.next
	if (subNodeNext) {
		var rightSub = getChildSub(subNodeNext)

		/**
		 * Currently, the grammar forbids a rule marked `isTermSequence` to produce multiple verbs, thereby preventing multiple instances of `tense`. Hence, this ensures `pfsearch` references the correct `tense` for the correct verb.
		 *
		 * Without this precaution, there could be multiple verb terminal rule sets, yielding multiple verb `text` objects in this resulting merged `text` array. This complicates determining which matched verb terminal rule `tense` applies to which `text` object in the new `text`.
		 */
		return leftSub.ruleProps.tense || rightSub.ruleProps.tense
	}

	/**
	 * `subNode` is an insertion for a substitution. For example:
	 *   `[contribute-to]` -> "work" (input) -> `[work]` `[on]`, text: `[ {contribute-verb-forms}, "to" ]`
	 */
	return leftSub.ruleProps.tense
}

/**
 * Creates a new `ruleProps` for term sequence insertion `subNode` with the following properties:
 * 1. terminal - The new `ruleProps` is marked terminal so that `pfsearch` uses the new `subNode.ruleProps` to generate display text and does not traverse its child nodes.
 * 2. cost - Uses `cost`, the cumulative cost (including any deletion costs) of the subtree `subNode` produces, which will be inaccessible after assigning this new, terminal `ruleProps`
 * 3. semantic - `subNode.ruleProps.semantic`, if defined.
 * 4. text - Merges `text` values of the matched terminal rules this subnode's single child node produces with `subNode.ruleProps.text` according to `subNode.ruleProps.insertedSymIdx`.
 * 5. tense - The tense of any matched verb terminal rules `subNode` produces to maintain tense if the parent rule of `subNode` has matching `acceptedTense`.
 *
 * For example:
 *   `[contribute-to]` -> `[contribute]`, text: "to"
 *                     -> "contribute" (input), text: `{contribute-verb-forms}`
 *                     -> text: `[ {contribute-verb-forms}, "to" ]` (merged text values)
 *
 * @private
 * @static
 * @param {Object} subNode The term sequence insertion subnode for which to generate a new, terminal `ruleProps`.
 * @param {number} cost The cumulative cost of the subtree `subNode` produces.
 * @returns {Object} Returns the new, terminal `ruleProps` for `subNode`.
 */
function createTermSeqInsertionRuleProps(subNode, cost) {
	var subNodeRuleProps = subNode.ruleProps
	if (!subNodeRuleProps.isTermSequence) {
		util.logError('`createTermSeqInsertionRuleProps()` invoked on subnode without `isTermSequence`:', subNode)
		throw new Error('Ill-formed term sequence insertion')
	}

	if (!subNodeRuleProps.text) {
		util.logError('`createTermSeqInsertionRuleProps()` invoked on subnode without insertion text (should use `createTermSeqRuleProps()`):', subNode)
		throw new Error('Ill-formed term sequence insertion')
	}

	if (subNodeRuleProps.insertedSymIdx === undefined) {
		util.logError('`createTermSeqInsertionRuleProps()` invoked on subnode without `insertedSymIdx` (should use `createTermSeqSubstitutionRuleProps()`):', subNode)
		throw new Error('Ill-formed term sequence insertion')
	}

	if (subNode.next) {
		util.logError('Insertion subnode is binary:', subNode)
		throw new Error('Ill-formed term sequence insertion')
	}

	var childSub = getChildSub(subNode)
	var childSubText = getSubNodeText(childSub)

	// Excludes `insertedSymIdx` because this flattens the term sequence into a terminal node, removing the need to traverse the node's children.
	return {
		// The cumulative cost (including any deletion costs) of the subtree `subNode` produces.
		cost: cost,
		// Merge insertion `text` with matched terminal rule `text` according to `insertedSymIdx`.
		text: subNodeRuleProps.insertedSymIdx === 1
			? grammarUtil.mergeTextPair(childSubText, subNodeRuleProps.text)
			: grammarUtil.mergeTextPair(subNodeRuleProps.text, childSubText),
		/**
		 * Save the input tense of any verb terminal rule `subNode` produces to maintain optional tense if the parent rule of `subNode` has matching `acceptedTense`. For example:
		 *   `[contribute-to]` -> `[contribute]`, text: "to"
		 *                     -> "contributed" (input), text: `{contribute-verb-forms}`
		 *                     -> text: "contributed to" (merged text values)
		 */
		tense: childSub.ruleProps.tense,
		semantic: subNodeRuleProps.semantic,
	}
}

/**
 * Gets the child subnode the term sequence `subNode` produces (i.e., in `subNode.node.subs`).
 *
 * `subNode` almost always produces a single child subnode, but in the rare cases (documented in `getCheapestChildSub()`) of multiple child subnodes, the term sequence is ambiguous (because semantically identical) and the cheapest must be chosen.
 *
 * @private
 * @static
 * @param {Object} subNode The term sequence subnode.
 * @returns {Object} Returns the subnode `subNode` produces.
 */
function getChildSub(subNode) {
	var childSubs = subNode.node.subs
	return childSubs.length === 1 ? childSubs[0] : getCheapestChildSub(subNode)
}

/**
 * Gets the cheapest child subnode the ambiguous term sequence `subNode` produces (i.e., in `subNode.node.subs`).
 *
 * For use by `getChildSub()` on term sequences that produce multiple child subnodes. Such subnodes are ambiguous because term sequences lack semantics, which makes them semantically identical. Only occurs in rare cases, documented below.
 *
 * @private
 * @static
 * @param {Object} subNode The ambiguous term sequence subnode.
 * @returns {Object} Returns the cheapest child subnode `subNode` produces.
 */
function getCheapestChildSub(subNode) {
	/**
	 * `subNode` produces multiples subnodes. Choose the cheapest.
	 *
	 * This only occurs when the term sequence `subNode` is ambiguous, because term sequences can not produce semantics; they only differ by cost and display text. Ideally, term sequence subnodes are never ambiguous, but the overhead to avoid every cause of such ambiguity outweighs the cost of its rarity.
	 *
	 * The following are causes of term sequence ambiguity. Some can and should be avoided, and others can not:
	 * 1. Ambiguous grammar rules. For example, consider the term sequence `X`:
	 *      X -> "a"
	 *      X -> Y -> "a"
	 *    When "a" is matched in input, the term sequence `X` will have two subnodes. The grammar design causes this, and the grammar generator should prevent this.
	 *
	 * 2. Terminal symbol deletions, which can occur in two way:
	 *   A. Deleltables defined in the grammar.
	 *   B. After `Parser` fails to reach the start node or `pfsearch` fails to generate legal parse trees (due to contradictory semantics) on the initial parse, as a last resort, `Parser` reparses the input query with all tokens marked deletable.
	 *
	 *   These deletions enable the following possible instances of term sequence ambiguity:
	 *   A. Consider the binary RHS `X1 X2`, where `X2` produces a term sequence:
	 *        X1, X2 -> Y -> A -> "a"
	 *                    -> B -> "b"
	 *        X1, X2 -> Y -> A, text: "b" -> "a"
	 *      The rule `X2 -> Y` is a term sequence because every RHS symbol (i.e., just `Y`) produces a term sequence. `calcCostHeuratistics` flattens `Y` by merging the `text` of the rules it produces, and assigning the text to the rule `X2 -> Y` with a new, terminal `ruleProps`.
	 *      As shown, the term sequence `Y` recognizes the input "a b" and "a" with insertion text "b". Provided the input "a b", and with "b" marked deletable, `Y` will have two matches for the same token span: "a b", "a <b>" (where "b" is deleted).
	 *      The grammar generator should prevent this by forbidding unary term sequences (but, might be difficult for insertion rules within nested term sequences). This example would not occur if `Y` replaces `X2` in the initial binary rule.
	 *
	 *   B. Consider the following input:
	 *        "followers of my mine"
	 *      Consider a terminal rule set produces both "my" and "mine" (though both have display text "my"), and all tokens are marked deletable. This yields a node for the term sequence with two subnodes, each of which spans the last two input tokens, but contains different terminal rules: "my <mine>", "<my> mine". This is unavoidable in the grammar.
	 *
	 *   C. Consider the following input:
	 *        "followers of mine mine"
	 *      "mine" and "mine" will obviously be the same terminal rule. With "mine" marked deletable, there will be two subnodes for the same LHS symbol, spanning the last two input tokens: "mine <mine>", "<mine> mine". This is unavoidable in the grammar.
	 *      A terminal node table in `Parser.prototype.addTermRuleNodes()` could detect these duplicate instances of the same LHS symbol over the same span, similar to the nonterminal node table used in `Parser.prototype.addSub()`, but the overhead is too great for such rarity (even if the table is only used during the second parse).
	 *
	 *
	 * `calcHeuristicCosts` must choose the cheapest subnode for ambiguous term sequence matches, as opposed to when `Parser.prototype.addSub()` first adds these subnodes:
	 * 1. These cost comparisons will not always work in `Parser.prototype.addSub()` because the comparisons require completing all reductions of a subnode to know its cheapest subnode (i.e., a nested term sequence) before reducing with its parent term sequence node. However, `Parser` may reduce a parent node with a given node before reducing all of the latter node's child nodes. Moreover, `Parser` can not determine if all reductions for a node are complete until parsing completes. Hence, a comparison at that state might have an inaccurate minimum cost. For example, consider the term sequence `X`:
	 *     X -> A -> "z", cost: 0.5
	 *     X -> B -> "z", cost: 1
	 *          B -> C -> "z", cost: 0
	 *   Suppose `Parser` compares the reduction for `X -> B -> "z"` against `X -> A -> "z"`, finds the former more expensive, and discards it. Later, `Parser` reduces the third rule sequence above, `B -> C -> "z"`, which makes the reduction `X -> B` cheaper than `X -> A`; however, it is too late because the reduction `X -> B` was already discarded and will not reappear.
	 *
	 * 2. Though `Parser.prototype.addSub()` could catch most instances of term sequence ambiguity (i.e., #1 is uncommon), it would be inefficient to search for the cheapest term sequence for parser nodes that might never reach the start node. In contrast, every term sequence subnode comparison in `calcHeuristicCosts` had to have reached the start node.
	 */

	 /**
	  * Check the ambiguous term sequence includes a terminal symbol deletion: spans multiple input tokens and has the minimum deletion cost (1 for grammar-defined deletables).
	  *
	  * Does not catch all grammar-induced instances of term sequence ambiguity. E.g., a multi-token term sequence with high non-edit rule costs will evade this check. Though, unlikely because term sequences lack semantics.
	  * • Can be tracked absolutely with `ruleProps.hasDeleltion`, but it is best to avoid the complexity for such a rare error which ideally is caught in grammar generation.
	  */
	if (subNode.size === 1 || subNode.node.minCost < 1) {
		util.logError('Term sequence ambiguity caused by ill-formed grammar (i.e., not caused by deletion):', subNode)
		throw new Error('Ill-formed term sequence')
	}

	/**
	 * Choose the cheapest subnode for the ambiguous term sequence.
	 *
	 * The cheapest subnode is the same child node that set `subNode.minCost` in `calcHeuristicCosts()`.
	 *
	 * All subnodes here likely have identical display text (and input tense) by the nature of the possible sources of this ambiguity, documented above.
	 */
	var cheapestChildSub = childSubs[0]
	var cheapestChildSubCost = cheapestChildSub.ruleProps.cost
	for (var s = 1; s < childSubsLen; ++s) {
		var childSub = childSubs[s]
		var childSubCost = childSub.ruleProps.cost

		// Compare `childSub.ruleProps.cost`, not `childSub.node.minCost`, because `calcHeuristicCosts` already traversed and flattened `subNode.node.subs`, merging their `minCost` with their `ruleProps.cost` on their new, terminal `ruleProps`. Also, `ruleProps.cost` of binary nodes includes the cost of both subnodes.
		if (childSubCost < cheapestChildSubCost) {
			cheapestChildSub = childSub
			cheapestChildSubCost = childSubCost
		}
	}

	return cheapestChildSub
}

/**
 * Gets the display text `subNode` produces (i.e., `subNode.ruleProps.text`).
 *
 * Throws an exception if `subNode` lacks display text.
 *
 * @private
 * @static
 * @param {Object} subNode The term sequence subnode.
 * @returns {string} Returns the display text `subNode` produces.
 */
function getSubNodeText(subNode) {
	var text = subNode.ruleProps.text
	if (text) {
		return text
	}

	printSubNodeErr(subNode, subNode.node.subs, 'Term sequence subnode lacks `text`')
	throw new Error('Ill-formed term sequence')
}

/**
 * Prints an error to the console for `subNode` and `childSubs` with `errMsg`.
 *
 * @private
 * @static
 * @param {Object} subNode The parser subnode.
 * @param {Object[]} childSubs The problematic child sub node set of `subNode` to print.
 * @param {string} errMsg The error message to print.
 */
function printSubNodeErr(subNode, childSubs, errMsg) {
	// Append ":" to `errMsg` if lacks.
	if (errMsg[errMsg.length - 1] !== ':') {
		errMsg += ':'
	}

	util.logError(errMsg, stringifySubNode(subNode))
	util.logObjectAtDepth(childSubs, 3)
}

/**
 * Creates a string representation of `subNode` for printing to the console.
 *
 * Formats the node as follows: '[rhs-a]' '[rhs-b]'.
 *
 * @private
 * @static
 * @param {Object} subNode The subnode (unary or binary) to stringify.
 * @returns {string} Returns the subnode string representation.
 */
function stringifySubNode(subNode) {
	var leftSymName = util.stylize(subNode.node.sym.name)

	// Check if `subNode` is binary.
	var subNodeNext = subNode.next
	if (subNodeNext) {
		return leftSymName + ' ' + util.stylize(subNodeNext.node.sym.name)
	}

	// `subNode` is unary.
	return leftSymName
}

/**
 * Recursive Node Restriction:
 *
 * A unique node is created for each instance of a nonterminal symbol with a unique input token index or unique input token span. Hence, a node could only every be a subnode of itself (i.e., recursive) if a nonterminal symbol made multiple appearances at the same input token index with the same input token span. This is only possible if a nonterminal symbol produces itself via a recursive sequence of unary rules (i.e., reductions); e.g., "X -> Y -> X".
 *
 * The grammar generator currently forbids such rules until `calcHeuristicCosts` is extended to support recursive unary reductions. This calculation is possible, though difficult to design due to the complexity of the interdependence of the minimum cost heuristics. E.g., a node's minimum cost (heuristic) is a function of its descendants' minimum costs, yet the minimum cost of the recursive descendant node is a function of the original (ancestor) node's minimum cost to which it points. There is no implementation because its difficulty was debilitating and demoralizing in the face of all other remaining work the system requires.
 *
 * Furthermore, handling this complexity might decrease the operation's performance disproportionately for such an obscure edge case (i.e., the case that needs the insertion rules that require the recursion). One potential implementation removes `calcHeuristicCosts` and calculates the cost heuristics while reducing in `Parser`: In `Parser.prototype.addNode()`, determine if a node's minimum cost is lower than its parent node's previous minimum cost; if so, traverse up the vertices updating the minimum costs of parent nodes.
 *
 * If a solution were implemented, the grammar generator will only forbid recursive sequences of unary non-edit rules; i.e., sequences that involve at least one insertion rule will be permitted because otherwise multiple traversal by `pfsearch` of the same path of non-edit rules guarantees semantic duplicity.
 *
 * In addition, support for recursive nodes will enable `pfsearch` to process indefinitely until halted, though it will continue to discard paths for producing duplicate semantics after using every possible variation the insertions enable. This requires extending `pfsearch` with the yet-to-implement exit timer for input queries that do not produce `k` unique, complete parse trees (e.g., unavoidably semantically illegal input queries that require reparsing with additional deletions).
 */