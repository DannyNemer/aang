var util = require('../util/util')

/**
 * Calculates the minimum possible cost of a subtree that can be constructed from each node that descends from `startNode`. These values serve as admissible heuristics in the A* search of the parse forest.
 *
 * @static
 * @param {Object} startNode The start node returned by `Parser.prototype.parse()`.
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

		// Do not inspect same subnode more than once (a subnode can belong to more than one node).
		// Requires terminal node's `minCost` be `undefined` (not 0).
		if (childSub.minCost === undefined) {
			// Initialize minimum cost with rule's cost.
			childSub.minCost = (childSubRuleProps.constructor === Array ? childSubRuleProps[0].cost : childSubRuleProps.cost)

			if (childSub.node.subs) {
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
					childSub.minCost = cost

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

				// Create a new sub node for each `ruleProps` insertion.
				else if (childSubRuleProps.constructor === Array) {
					childSub.ruleProps = childSubRuleProps[0]
					var baseMinCost = childSub.minCost - childSub.ruleProps.cost
					for (var r = 1, rulePropsLen = childSubRuleProps.length; r < rulePropsLen; ++r) {
						var ruleProps = childSubRuleProps[r]
						childSubs.push({
							node: childSub.node,
							size: childSub.size,
							ruleProps: ruleProps,
							minCost: baseMinCost + ruleProps.cost,
						})
					}
				}
			}
		}

		// Determine the minimum cost of all subnodes.
		if (minCost === undefined || childSub.minCost < minCost) {
			minCost = childSub.minCost
		}
	}

	// Sort child sub nodes by increasing cost.
	childSubs.sort(function (a, b) {
		return a.minCost - b.minCost
	})

	// Add for cost of `childSub` and `childSub.next`.
	sub.minCost += minCost
}