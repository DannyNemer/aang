var util = require('../util')

// Determine minimum possible cost of a subtree that can be constructed from each node
// Values serve as admissible heuristics in the A* search of the parse forest
module.exports = function (startNode) {
	calcMinCost({}, startNode.subs)
}

/**
 * Determine the heuristic estimate of the minimum cost of a path that can follow `parentSub`. The cost of a path is the sum of the minimum cost of all subnodes in the path, excluding `parentSub`'s cost. `parentSub`'s cost is excluded in the sum because there are several possible costs for `parentSub` (to add to the minimum cost of a child path) when there is a `ruleProps` array (i.e., insertions).
 *
 * @param {Object} parentSub The subnode of which to calculate the minimum cost tree that can be built as a descendant.
 * @param {Array} subs The subnodes of `parentSub` to examine for minimum cost.
 */
function calcMinCost(parentSub, subs) {
	var minCost

	for (var s = 0, subsLen = subs.length; s < subsLen; ++s) {
		var sub = subs[s]

		// Do not inspect same `sub` more than once (subs can be in more than one node)
		if (sub.minCost === undefined) {
			// Initialize to 0 because value will be added to
			sub.minCost = 0

			var childSubs = sub.node.subs
			if (childSubs) {
				// Only nonterminal symbols have a `minCost` (which does not include the cost of the subnode itself)
				calcMinCost(sub, childSubs)

				// Only nonterminal rules are binary (hence, within `childSubs` check)
				var subNext = sub.next
				if (subNext) {
					// `sub.next` will never be terminal (because binary terminal rules are prohibited)
					calcMinCost(sub, subNext.node.subs)
				}
			}
		}

		// Get `sub`'s cost after calling `calcMinCost()` on `sub`'s children and deriving their minimum costs
		// When `ruleProps` is an array of `ruleProps` (for insertions), get the cost of the first element because they are sorted by increasing cost.
		var subRuleProps = sub.ruleProps
		var cost = sub.minCost + (subRuleProps.constructor === Array ? subRuleProps[0].cost : subRuleProps.cost)

		if (minCost === undefined || cost < minCost) {
			minCost = cost
		}
	}

	// Add for cost of `sub` and `sub.next`
	parentSub.minCost += minCost
}