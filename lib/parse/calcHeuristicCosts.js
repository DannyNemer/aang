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
 * Calculates the heuristic estimate of the minimum cost of a complete subtree (i.e., reaches terminal nodes) that descends from `childSubs`, which is assigned to the corresponding parent node (of `childSubs`).
 *
 * The cost of a subtree/path is the sum of the minimum cost of all node in the subtree, excluding the parent subnode's cost. The parent subnode's cost is excluded in the sum because there are several possible costs for the subnode (to add to the minimum cost of a child path in `pfsearch`) when there is a `ruleProps` array (i.e., insertions).
 *
 * @private
 * @static
 * @param {Object[]} childSubs The subnodes of which to calculate the minimum cost of a descendant subtree.
 * @returns {number} Returns the minimum cost of a subtree that descends from `childSubs` to assign to the corresponding parent node (of `childSubs`).
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

		// Get the minimum cost of a complete subtree (i.e., reaches terminal nodes) that descends from `childSub`. For binary rules, `childSub.minCost` is the sum if its `minCost` and `childSub.next.node.minCost`.
		// Do not inspect same subnode more than once (a subnode can belong to more than one node).
		// Only nonterminal nodes and subnodes have a `minCost` (which does not include the cost of the subnode/node itself).
		if (childSub.minCost === undefined) {
			// All nodes where `minCost` is `undefined` have subnodes.
			// Can leave property `undefined` while traversing because this subnode cannot be a subnode of itself because a unique node is created for each instance of a nonterminal symbol with a different size/span.
			var childNode = childSub.node
			if (childNode.minCost === undefined) {
				childSub.minCost = childNode.minCost = calcMinCost(childNode.subs)
			} else {
				childSub.minCost = childNode.minCost
			}

			// Only nonterminal rules can be binary (hence, the second node has subnodes).
			var childSubNext = childSub.next
			if (childSubNext) {
				// Do not assign mincost to subnode because it is identical to the node, whereas the first subnode needs mincost because it is the sum of both nodes for binary rules.
				var childNodeNext = childSubNext.node
				// Do not inspect same node more than once.
				if (childNodeNext.minCost === undefined) {
					childSub.minCost += childNodeNext.minCost = calcMinCost(childNodeNext.subs)
				} else {
					childSub.minCost += childNodeNext.minCost
				}
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