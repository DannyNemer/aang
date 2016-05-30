var util = require('../util/util')
var flattenTermSequence = require('./flattenTermSequence')


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
		 * If `childSub` is a term sequence, then create a new, flattened `ruleProps` for `childSub`.
		 *
		 * The new, flattened, terminal `childSub.ruleProp` has the following properties:
		 * 1. terminal - Mark the new `ruleProps` as terminal so that `pfsearch` uses `childSub.ruleProps` to generate display text and does not traverse its child nodes.
		 *   • Do not bother deleting `childSub.node.subs`, which would be wasteful because the absence of `ruleProps.isNonterminal` prevents `pfsearch` from checking `childSub.node.subs` anyway. Also, `childSub.node.subs` are needed in the rare case of reparsing, which reuses existing nodes.
		 * 2. cost - Use `cost`, the minimum cost for `childSub`, as the new `childSub.ruleProps.cost` because it is identical to the cumulative cost (including any deletion costs) of the subtree that will be inaccessible after assigning this new, terminal `ruleProps`.
		 *   • If there are multiple subtrees, then they are ambiguous because their text and semantics are defined here (identically), and the minimum cost subtree would be chosen anyway.
		 * 3. semantic - `childSub.ruleProps.semantic`, if defined. The rules it produces can not have semantics.
		 * 4. text - See `flattenTermSequence`.
		 * 5. tense - See `flattenTermSequence`.
		 */
		else if (childSubRuleProps.isTermSequence) {
			childSub.ruleProps = flattenTermSequence(childSub, cost)
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