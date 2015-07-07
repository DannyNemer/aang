var util = require('../util')

// Determine minimum possible cost of subtree that can be constructed from each node
// Values serve as heuristics in A* search of parse forest
module.exports = function (startNode) {
	for (var subs = startNode.subs, s = subs.length; s-- > 0;) {
		var sub = subs[s]

		// Initialize to 0 because value will be added to
		sub.minCost = 0
		reduce(sub, sub.node.subs)
	}
}

// Determine the minimum cost of 'parentSub' by exaxming each of its 'subs'
function reduce(parentSub, subs) {
	var minCost

	for (var s = 0, subsLen = subs.length; s < subsLen; ++s) {
		var sub = subs[s]

		// Do not inspect same sub more than once (subs can be in more than one node)
		if (sub.minCost === undefined) {
			// Initialize to 0 because value will be added to
			sub.minCost = 0

			var childSubs = sub.node.subs
			if (childSubs) {
				reduce(sub, childSubs)

				// Only nonterminal rules are binary (hence, within childSubs check)
				var subNext = sub.next
				if (subNext) {
					// sub.next will never be terminal (because all binary rules are nonterminal)
					reduce(sub, subNext.node.subs)
				}
			}
		}

		// Get cost after calling reduce() on children and derving their minimum costs
		var subRuleProps = sub.ruleProps
		var cost = sub.minCost + (subRuleProps.constructor === Array ? subRuleProps[0].cost : subRuleProps.cost)

		if (minCost === undefined || cost < minCost) {
			minCost = cost
		}
	}

	// Add for cost of sub and sub.next
	parentSub.minCost += minCost
}