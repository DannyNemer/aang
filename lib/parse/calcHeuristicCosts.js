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
		 * If `childSub` is a term set sequence (without text), then create a new `ruleProps` for `childSub` with the following properties:
		 * 1. terminal - Mark the new `ruleProps` as terminal so that `pfsearch` uses `childSub.ruleProps` to generate display text and does not traverse its child nodes.
		 * 2. cost - Use `cost`, the minimum cost for `childSub`, as the new `childSub.ruleProps.cost` because it is identical to the cumulative cost (including any deletion costs) of the subtree that will be inaccessible after assigning this new, terminal `ruleProps`. If there are multiple subtrees, then they are ambiguous because their text and semantics are defined here (identically), and the minimum cost subtree would be chosen anyway.
		 * 3. semantic - Keep `childSub.ruleProps.semantic`, if any. The rules it produces can not have semantics.
		 * 4. text - See below.
		 * 5. tense - See below.
		 */
		else if (childSubRuleProps.isTermSequence) {
			if (childSubRuleProps.insertedSymIdx !== undefined) {
				/**
				 * If `childSub` is a term set sequence with `text` and `insertedSymIdx`, then it is an insertion. Create a new `ruleProps` as explained above, extended as follows:
				 * 4. text - Merge `text` values of the matched terminal rules this subnode's single child node produces with `childSub.ruleProps.text` according to `childSub.ruleProps.insertedSymIdx`.
				 * 5. tense - Get the tense of any matched verb terminal rules `childSub` produces to maintain tense if the parent rule of `childSub` has matching `acceptedTense`.
				 */
				childSub.ruleProps = createTermSeqInsertionRuleProps(childSub, cost)
			} else if (childSubRuleProps.text) {
				/**
				 * If `childSub` is a term set sequence with `text` and no `insertedSymIdx`, then it is a multi-token substitution. Create a new `ruleProps` as explained above, extended as follows:
				 * 4. text - Keep `childSub.ruleProps.text` for `pfsearch` to use as display text instead of the `text` of the matched terminal rules `childSub` produces.
				 * 5. tense - Get the tense of any matched verb terminal rules `childSub` produces to maintain tense for any verb substitutions in `text` if the parent rule of `childSub` has matching `acceptedTense`.
				 */
				childSub.ruleProps = createTermSeqSubstitutionRuleProps(childSub, cost)
			} else {
				/**
				 * If `childSub` is a term set sequence (without text), then create a new `ruleProps` as explained above, extended as follows:
				 * 4. text - Merge the `text` values of the matched terminal rules this subnode's child nodes produces, which `pfsearch` uses as display text.
				 * 5. tense - Get the tense of any matched verb terminal rules `childSub` produces to maintain tense if the parent rule of `childSub` has matching `acceptedTense`.
				 */
				childSub.ruleProps = createTermSeqRuleProps(childSub, cost)
			}
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
 * Creates a new `ruleProps` for term set sequence `subNode` with the following properties:
 * 1. terminal - The new `ruleProps` is marked terminal so that `pfsearch` uses the new `subNode.ruleProps` to generate display text and does not traverse its child nodes.
 * 2. cost - Uses `cost`, the cumulative cost (including any deletion costs) of the subtree `subNode` produces, which will be inaccessible after assigning this new, terminal `ruleProps`
 * 3. semantic - Keeps `subNode.ruleProps.semantic`, if any.
 * 4. text - Merges the `text` values of the matched terminal rules this subnode's child nodes produces, which `pfsearch` uses as display text.
 * 5. tense - Gets the tense of any matched verb terminal rules `subNode` produces to maintain tense if the parent rule of `subNode` has matching `acceptedTense`.
 *
 * @private
 * @static
 * @param {Object} subNode The term set sequence subnode for which to generate a new, terminal `ruleProps`.
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

	var leftSubs = subNode.node.subs
	if (leftSubs.length > 1) {
		printSubNodeErr(subNode, leftSubs, 'Term sequence has > 1 left subnodes')
		throw new Error('Ill-formed term sequence')
	}

	var leftRuleProps = leftSubs[0].ruleProps
	var leftText = leftRuleProps.text
	if (!leftText) {
		printSubNodeErr(subNode, leftSubs, 'Term sequence left subnode lacks `text`')
		throw new Error('Ill-formed term sequence')
	}

	// Check if `subNode` is a binary or unary node.
	var subNodeNext = subNode.next
	if (subNodeNext) {
		/**
		 * `subNode` is a binary node. For example:
		 *   `[contribute-to]` -> `[contribute]` -> "contribute", text: `{contribute-verb-forms}`
		 *                        `[to]`         -> "to"
		 */
		var rightSubs = subNodeNext.node.subs
		if (rightSubs.length > 1) {
			printSubNodeErr(subNode, rightSubs, 'Term sequence has > 1 right subnodes')
			throw new Error('Ill-formed term sequence')
		}

		var rightRuleProps = rightSubs[0].ruleProps
		var rightText = rightRuleProps.text
		if (!rightText) {
			printSubNodeErr(subNode, rightSubs, 'Term sequence right subnode lacks `text`')
			throw new Error('Ill-formed term sequence')
		}

		return {
			cost: cost,
			text: grammarUtil.mergeTextPair(leftText, rightText),
			/**
			 * Currently, the grammar forbids a rule marked `isTermSequence` to produce multiple verbs, thereby preventing multiple instances of `tense`. Hence, this ensures `pfsearch` references the correct `tense` for the correct verb.
			 *
			 * Without this precaution, there could be multiple verb terminal rule sets, yielding multiple verb `text` objects in this resulting merged `text` array. This complicates determining which matched verb terminal rule `tense` applies to which `text` object in the new `text`.
			 */
			tense: leftRuleProps.tense || rightRuleProps.tense,
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
		cost: cost,
		text: leftText,
		tense: leftRuleProps.tense,
		semantic: subNodeRuleProps.semantic,
	}
}

/**
 * Creates a new `ruleProps` for term set sequence substitution `subNode` with the following properties:
 * 1. terminal - The new `ruleProps` is marked terminal so that `pfsearch` uses the new `subNode.ruleProps` to generate display text and does not traverse its child nodes.
 * 2. cost - Uses `cost`, the cumulative cost (including any deletion costs) of the subtree `subNode` produces, which will be inaccessible after assigning this new, terminal `ruleProps`
 * 3. semantic - Keeps `subNode.ruleProps.semantic`, if any.
 * 4. text - Keeps `subNode.ruleProps.text` for `pfsearch` to use as display text instead of the `text` of the matched terminal rules `subNode` produces.
 * 5. tense - Gets the tense of any matched verb terminal rules `subNode` produces to maintain tense for any verb substitutions in `text` if the parent rule of `subNode` has matching `acceptedTense`.
 *
 * @private
 * @static
 * @param {Object} subNode The term set sequence substitution subnode for which to generate a new, terminal `ruleProps`.
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
 *   `[contribute-to]` -> "worked on" (input) -> "contributed to" (past-tense maintained).
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
	var leftSubs = subNode.node.subs
	if (leftSubs.length > 1) {
		printSubNodeErr(subNode, leftSubs, 'Term sequence has > 1 left subnodes')
		throw new Error('Ill-formed term sequence substitution')
	}

	// Check if `subNode` is a binary node, else it is an insertion for a substitution.
	var subNodeNext = subNode.next
	if (subNodeNext) {
		var rightSubs = subNode.next.node.subs
		if (rightSubs.length > 1) {
			printSubNodeErr(subNode, rightSubs, 'Term sequence has > 1 right subnodes')
			throw new Error('Ill-formed term sequence substitution')
		}

		/**
		 * Currently, the grammar forbids a rule marked `isTermSequence` to produce multiple verbs, thereby preventing multiple instances of `tense`. Hence, this ensures `pfsearch` references the correct `tense` for the correct verb.
		 *
		 * Without this precaution, there could be multiple verb terminal rule sets, yielding multiple verb `text` objects in this resulting merged `text` array. This complicates determining which matched verb terminal rule `tense` applies to which `text` object in the new `text`.
		 */
		return leftSubs[0].ruleProps.tense || rightSubs[0].ruleProps.tense
	}

	/**
	 * `subNode` is an insertion for a substitution. For example:
	 *   `[contribute-to]` -> "work" (input) -> `[work]` `[on]`, text: `[ {contribute-verb-forms}, "to" ]`
	 */
	return leftSubs[0].ruleProps.tense
}

/**
 * Creates a new `ruleProps` for term set sequence insertion `subNode` with the following properties:
 * 1. terminal - The new `ruleProps` is marked terminal so that `pfsearch` uses the new `subNode.ruleProps` to generate display text and does not traverse its child nodes.
 * 2. cost - Uses `cost`, the cumulative cost (including any deletion costs) of the subtree `subNode` produces, which will be inaccessible after assigning this new, terminal `ruleProps`
 * 3. semantic - Keeps `subNode.ruleProps.semantic`, if any.
 * 4. text - Merges `text` values of the matched terminal rules this subnode's single child node produces with `subNode.ruleProps.text` according to `subNode.ruleProps.insertedSymIdx`.
 * 5. tense - Gets the tense of any matched verb terminal rules `subNode` produces to maintain tense if the parent rule of `subNode` has matching `acceptedTense`.
 *
 * For example:
 *   `[contribute-to]` -> `[contribute]`, text: "to"
 *                     -> "contribute" (input), text: `{contribute-verb-forms}`
 *                     -> text: `[ {contribute-verb-forms}, "to" ]` (merged text values)
 *
 * @private
 * @static
 * @param {Object} subNode The term set sequence insertion subnode for which to generate a new, terminal `ruleProps`.
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

	var childSubs = subNode.node.subs
	if (childSubs.length > 1) {
		printSubNodeErr(subNode, childSubs, 'Term sequence has > 1 left subnodes')
		throw new Error('Ill-formed term sequence insertion')
	}

	if (subNode.next) {
		util.logError('Insertion subnode is binary:', subNode)
		throw new Error('Ill-formed term sequence insertion')
	}

	var childSubRuleProps = childSubs[0].ruleProps
	var childSubText = childSubRuleProps.text
	if (!childSubText) {
		printSubNodeErr(subNode, childSubs, 'Term sequence insertion subnode lacks `text`')
		throw new Error('Ill-formed term sequence insertion')
	}

	return {
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
		tense: childSubRuleProps.tense,
		semantic: subNodeRuleProps.semantic,
	}
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
 * In addition, support for recursive nodes will enable `pfsearch` to process indefinitely until halted, though it will continue to discard paths for producing duplicate semantics after using every possible variation the insertions enable. This requires extending `pfsearch` with the yet-to-implement exit timer for input queries that do not produce `k` unique, complete parse trees (e.g., unavoidably semantically illegal input queries that require re-parsing with additional deletions).
 */