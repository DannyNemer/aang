var util = require('../util/util')

/**
 * Calculates the minimum possible cost of a subtree that can be constructed from each node that descends from `startNode`. These values serve as admissible heuristics in the A* search of the parse forest.
 *
 * @static
 * @param {Object} startNode The start node of the parse forest.
 */
module.exports = function (startNode) {
	calcMinCost(startNode.subs)
}

/**
 * Calculates the heuristic estimate of the minimum cost of a complete subtree (i.e., reaches terminal nodes) that descends from `childSubs`, which is assigned to the corresponding parent subnode (of `childSubs`).
 *
 * The cost of a subtree/path is the sum of the minimum cost of all subnodes in the subtree, excluding the parent subnode's cost. The parent subnode's cost is excluded in the sum because there are several possible costs for the subnode (to add to the minimum cost of a child path in `pfsearch`) when there is a `ruleProps` array (i.e., insertions).
 *
 * @private
 * @static
 * @param {Object[]} childSubs The subnodes of which to calculate the minimum cost of a descendant subtree.
 * @returns {number} Return the minimum cost of a subtree that descends from `childSubs`, to assign to the corresponding parent subnode (of `childSubs`).
 */
function calcMinCost(childSubs) {
	var minCost

	for (var s = 0, childSubsLen = childSubs.length; s < childSubsLen; ++s) {
		var childSub = childSubs[s]
		var childSubRuleProps = childSub.ruleProps

		// When `ruleProps` is an array of `ruleProps` (for insertions), get the cost of the first element as the minimum cost because they are sorted by increasing cost (in grammar generation).
		if (childSubRuleProps.constructor === Array) {
			childSubRuleProps = childSubRuleProps[0]
		}

		// Do not inspect same subnode more than once (a subnode can belong to more than one node).
		// Only nonterminal nodes have a `minCost` (which does not include the cost of the subnode itself).
		if (childSub.minCost === undefined) {
			// All nodes where `minCost` is `undefined` have subnodes. Can leave property `undefined` because this sub-node will not cannot be a sub-node of itself because a unique node is created for each instance of a nonterminal symbol with a different size/span.
			childSub.minCost = calcMinCost(childSub.node.subs)

			// Only nonterminal rules can be binary (hence, the second node has subnodes).
			var childSubNext = childSub.next
			if (childSubNext) {
				// Do not inspect same subnode more than once (a subnode can belong to more than one node).
				if (childSubNext.minCost === undefined) {
					// `childSub.next` will never be terminal (because binary terminal rules are prohibited).
					childSubNext.minCost = calcMinCost(childSubNext.node.subs)
				}

				childSub.minCost += childSubNext.minCost
			}

			// If `childSub` is nonterminal yet produces neither display text nor semantics, then reduce its subnodes' costs (which include deletion costs on the terminal nodes). This includes nonterminal substitutions and stop-words created from regex-style terminal rules, and rules that produce only stop-words.
			if (childSubRuleProps.rhsDoesNotProduceText) {
				// Reduce this node's subnodes' costs.
				var cost = childSubRuleProps.cost + childSub.minCost
				childSub.minCost = 0

				childSub.ruleProps = {
					cost: cost,
					text: childSubRuleProps.text,
					tense: childSubRuleProps.tense,
					semantic: childSubRuleProps.semantic,
				}

				if (minCost === undefined || cost < minCost) {
					minCost = cost
				}

				continue
			}
		}

		// Get `childSub`'s cost after calling `calcMinCost()` on `childSub`'s children and deriving their minimum costs.
		var cost = childSub.minCost + childSubRuleProps.cost
		if (minCost === undefined || cost < minCost) {
			minCost = cost
		}
	}

	return minCost
}