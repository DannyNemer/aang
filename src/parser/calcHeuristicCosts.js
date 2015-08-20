var util = require('../util')

// Determine minimum possible cost of a subtree that can be constructed from each node
// Values serve as admissible heuristics in the A* search of the parse forest
module.exports = function (startNode) {
	calcMinCost({ node: startNode })
}

/**
 * Determine the heuristic estimate of the minimum cost of a path that can follow `parentSub`. The cost of a path is the sum of the minimum cost of all subnodes in the path, excluding `parentSub`'s cost. `parentSub`'s cost is excluded in the sum because there are several possible costs for `parentSub` (to add to the minimum cost of a child path) when there is a `ruleProps` array (i.e., insertions).
 *
 * @param {Object} parentSub The subnode of which to calculate the minimum cost of a descendant subtree.
 */
function calcMinCost(sub) {
	var childSubs = sub.node.subs
	var minCost

	for (var s = 0, childSubsLen = childSubs.length; s < childSubsLen; ++s) {
		var childSub = childSubs[s]

		// Do not inspect same subnode more than once (a subnode can belong to more than one node)
		if (childSub.minCost === undefined) {
			// Initialize to 0 because value will be added to
			childSub.minCost = 0

			if (childSub.node.subs) {
				// Only nonterminal nodes have a `minCost` (which does not include the cost of the subnode itself)
				calcMinCost(childSub)

				// Only nonterminal rules can be binary (hence, within `childSubs` check)
				var childSubNext = childSub.next
				if (childSubNext) {
					// `childSub.next` will never be terminal (because binary terminal rules are prohibited)
					childSubNext.minCost = 0
					calcMinCost(childSubNext)
					childSub.minCost += childSubNext.minCost
				}
			}
		}

		// Get `childSub`'s cost after calling `calcMinCost()` on `childSub`'s children and deriving their minimum costs.
		// When `ruleProps` is an array of `ruleProps` (for insertions), get the cost of the first element because they are sorted by increasing cost.
		var childSubRuleProps = childSub.ruleProps
		var cost = childSub.minCost + (childSubRuleProps.constructor === Array ? childSubRuleProps[0].cost : childSubRuleProps.cost)

		if (minCost === undefined || cost < minCost) {
			minCost = cost
		}
	}

	// Add for cost of `childSub` and `childSub.next`
	sub.minCost += minCost
}