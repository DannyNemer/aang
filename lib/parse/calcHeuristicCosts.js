var util = require('../util/util')

/**
 * Calculates the minimum possible cost of a subtree that can be constructed from each node that descends from `startNode`. These values serve as admissible heuristics in the A* search of the parse forest.
 *
 * @static
 * @param {Object} startNode The start node of the parse forest.
 */
module.exports = function (startNode) {
	calcMinCost({ node: startNode })
}

/**
 * Calculates the heuristic estimate of the minimum cost of a path that can follow `parentSub`. The cost of a path is the sum of the minimum cost of all subnodes in the path, excluding `parentSub`'s cost. `parentSub`'s cost is excluded in the sum because there are several possible costs for `parentSub` (to add to the minimum cost of a child path) when there is a `ruleProps` array (i.e., insertions).
 *
 * @private
 * @static
 * @param {Object} parentSub The subnode of which to calculate the minimum cost of a descendant subtree.
 */
function calcMinCost(sub) {
	var childSubs = sub.node.subs
	var minCost

	for (var s = 0, childSubsLen = childSubs.length; s < childSubsLen; ++s) {
		var childSub = childSubs[s]
		var childSubRuleProps = childSub.ruleProps

		// When `ruleProps` is an array of `ruleProps` (for insertions), get the cost of the first element as the minimum cost because they are sorted by increasing cost.
		if (childSubRuleProps.constructor === Array) {
			childSubRuleProps = childSubRuleProps[0]
		}

		// Do not inspect same subnode more than once (a subnode can belong to more than one node).
		// Only nonterminal nodes have a `minCost` (which does not include the cost of the subnode itself).
		if (childSub.minCost === undefined) {
			// Initialize to 0 so that values can be added to it.
			childSub.minCost = 0

			// All nodes where `minCost` is `undefined` have subnodes.
			calcMinCost(childSub)

			// Only nonterminal rules can be binary (hence, the second node has subnodes).
			var childSubNext = childSub.next
			if (childSubNext) {
				// Do not inspect same subnode more than once (a subnode can belong to more than one node).
				if (childSubNext.minCost === undefined) {
					// `childSub.next` will never be terminal (because binary terminal rules are prohibited).
					childSubNext.minCost = 0
					calcMinCost(childSubNext)
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

	// Add for cost of `childSub` and `childSub.next`.
	sub.minCost += minCost
}