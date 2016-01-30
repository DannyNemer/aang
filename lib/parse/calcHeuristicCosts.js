var util = require('../util/util')

/**
 * Calculates the minimum possible cost of a subtree that can be constructed from each node that descends from `startNode`. These values serve as admissible heuristics in the A* search of the parse forest.
 *
 * @static
 * @param {Object} startNode The start node of the parse forest.
 */
module.exports = function (startNode) {
	calcMinCost(startNode)
}

/**
 * Calculates and assigs the heuristic estimate of the minimum cost of a complete subtree (i.e., reaches terminal nodes) that descends from `parentNode` (via one of its subnodes).
 *
 * The cost of a subtree/path is the sum of the minimum cost of all node in the subtree, excluding the cost of `parentNode`. The parent node's cost is excluded in the sum because there are several possible costs for the node (to add to the minimum cost of a path in `pfsearch`) when there is a `ruleProps` array (i.e., multiple insertions).
 *
 * @private
 * @static
 * @param {Object[]} parentNode The node for which to calculate and assign the minimum cost of a descendant subtree (from one of its subnodes).
 * @returns {number} Returns the minimum cost of a subtree that descends from `parentNode`.
 */
function calcMinCost(parentNode) {
	var childSubs = parentNode.subs
	var minCost

	for (var s = 0, childSubsLen = childSubs.length; s < childSubsLen; ++s) {
		var childSub = childSubs[s]
		var childSubRuleProps = childSub.ruleProps

		// When `ruleProps` is an array of `ruleProps` (for insertions), get the cost of the first element as the minimum cost because they are sorted by increasing cost (in grammar generation).
		var cost = childSubRuleProps.constructor === Array ? childSubRuleProps[0].cost : childSubRuleProps.cost

		// Check all three conditions instead of putting them in a single `childNode.subs` block and then checking because it yields 25% fewer checks.

		// Get the minimum cost of a complete subtree (i.e., reaches terminal nodes) that descends from `childSub.node`. The `minCost` does not include the cost of the node itself, because that varies for `ruleProps` arrays (i.e., multiple insertions).
		var childNode = childSub.node
		// Do not inspect same node more than once.
		// `minCost` is only `undefined` for nonterminal rules; hence, `childNode.subs` exists.
		// Can leave `minCost` `undefined` while traversing because this node cannot be a subnode of itself because a unique node is created for each instance of a nonterminal symbol with a different size/span.
		cost += childNode.minCost === undefined ? calcMinCost(childNode) : childNode.minCost

		// If binary, get the minimum cost of a complete subtree that descends from its second branch.
		var childSubNext = childSub.next
		if (childSubNext) {
			var childNodeNext = childSubNext.node
			cost += childNodeNext.minCost === undefined ? calcMinCost(childNodeNext) : childNodeNext.minCost
		}

		// If `childSub` is nonterminal yet its subnodes produces neither display text nor semantics, then reduce its subnodes' costs (which include deletion costs on the terminal nodes). This includes nonterminal substitutions and stop-words created from regex-style terminal rules, and rules that produce only stop-words.
		if (childSubRuleProps.rhsDoesNotProduceText) {
			// Exclude `isNonterminal` property to prevent traversing this node, which contains subnodes with text (from shared rules) that is intended to be avoided because this node's rule defines the text instead (e.g., substitution, stop-word).
			// Use minimum cost because if there are multiple subtrees, then they are ambiguous because their text and semantics are defined here, and its minimum cost subtree will be chosen anyway.
			childSub.ruleProps = {
				cost: cost,
				text: childSubRuleProps.text,
				tense: childSubRuleProps.tense,
				semantic: childSubRuleProps.semantic,
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