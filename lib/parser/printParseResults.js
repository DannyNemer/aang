var util = require('../util/util')
var semantic = require('../grammar/semantic')


/**
 * Prints parse trees output by `forestSearch`.
 *
 * @static
 * @memberOf forestSearch
 * @param {Object[]} trees The parse trees to print.
 * @param {Object} [options] The options object.
 * @param {boolean} [options.costs=false] Specify printing the cost of each parse tree.
 * @param {boolean} [options.trees=false] Specify printing a graph representation of `trees`.
 * @param {boolean} [options.treeNodeCosts=false] If `options.trees` is `true`, specify including each node's path cost.
 * @param {boolean} [options.treeTokenRanges=false] If `options.trees` is `true`, specify including the start and end indexes of each node's token range.
 */
var printOptionsSchema = {
	// Specify printing the cost of each parse tree.
	costs: { type: Boolean, optional: true },
	// Specify printing a graph representation of `trees`.
	trees: { type: Boolean, optional: true },
	// If `options.trees` is `true`, specify including in the parse trees each node's path cost. I.e., the cost of the path so far + the heuristic estimate of the cost remaining.
	treeNodeCosts: { type: Boolean, optional: true },
	// If `options.trees` is `true`, specify including in the parse trees the start and end indexes of each node's token range.
	treeTokenRanges: { type: Boolean, optional: true },
}

module.exports = function (trees, options) {
	if (!options) {
		options = {}
	} else if (util.illFormedOpts(printOptionsSchema, options)) {
		throw new Error('forestSearch.print: Ill-formed options')
	}

	for (var t = 0, treesLen = trees.length; t < treesLen; ++t) {
		var tree = trees[t]

		if (tree.semantics.prev) throw new Error('semantics remain')

		// Check parse results are correctly sorted by increasing cost.
		// Clean costs because of JS floating point number precision.
		if (t < treesLen - 1 && util.cleanFloat(tree.cost) > util.cleanFloat(trees[t + 1].cost)) {
			util.logError('Costs out of order:')
		}

		// Check A* cost heuristic calculation.
		if (tree.cost !== tree.costSoFar) {
			util.logError('Costs incorrect:', 'cost: ' + tree.cost + ', costSoFar: ' + tree.costSoFar)
		}

		// Print display text (and cost).
		util.log(tree.text + (options.costs ? ' ' + tree.cost : ''))

		// Print semantic string.
		util.log('  ' + tree.semanticStr)

		// Print additional semantics that produced identical display text.
		if (tree.disambiguation) {
			tree.disambiguation.forEach(function (semanticStr) {
				util.log('  ' + semanticStr)
			})
		}

		// Print trees (if constructed during parse forest search).
		if (options.trees) util.dir(linkedListToGraph(tree, options))
	}
}

/**
 * Converts a linked-list `item` output by `forestSearch` when ran with `buildDebugTrees` as `true` (which links each `item` to the previous `item` and its new `ruleProps`) to a graph representation.
 *
 * @private
 * @static
 * @param {Object} item The parse tree to convert.
 * @param {Object} options The options object.
 * @param {boolean} [options.treeNodeCosts=false] Specify including each node's path cost.
 * @param {boolean} [options.treeTokenRanges=false] Specify including the start and end indexes of each node's token range.
 * @returns {Object} Returns the graph representation of `item`.
 */
function linkedListToGraph(item, options) {
	// The stack of previous nodes lower in the parse tree (which become child nodes).
	var nodesStack = []

	while (true) {
		var node = item.node

		// Terminal rule.
		if (!node) {
			var node = item.prev.node

			if (!node) {
				// Find last node (skipping the insertion text also stored in `nextNodes`).
				var prevNextNodes = item.prev.prev.nextNodes
				while (prevNextNodes.node.constructor !== Object) {
					prevNextNodes = prevNextNodes.prev
				}

				node = prevNextNodes.node
			}

			nodesStack.push({
				props: item.ruleProps,
				children: [ formatNode(node.subs[0].node, options) ],
			})
		}

		// Binary nonterminal rule.
		else if (item.nextNodes && item.nextNodes !== item.prev.nextNodes && item.ruleProps.insertionIdx === undefined) {
			nodesStack.push({
				props: item.ruleProps,
				children: [
					formatNode(node, options, nodesStack.pop(), item.cost),
					formatNode(item.nextNodes.node, options, nodesStack.pop())
				],
			})
		}

		// Unary nonterminal rule.
		else {
			var newNode = formatNode(node, options, nodesStack.pop(), item.cost)

			// Stop at tree root.
			if (!item.prev) {
				return newNode
			}

			nodesStack.push({
				props: item.ruleProps,
				children: [ newNode ],
			})
		}

		item = item.prev
	}
}

/**
 * Formats `node` for `linkedListToGraph()`.
 *
 * @private
 * @static
 * @param {Object} node The node to convert.
 * @param {Object} options The options object.
 * @param {boolean} [options.treeNodeCosts=false] Specify including each node's path cost.
 * @param {boolean} [options.treeTokenRanges=false] Specify including the start and end indexes of each node's token range.
 * @param {Object} [childNode] The child node of `node`.
 * @param {number} [pathCost] The path cost at `node`.
 * @returns {Object} Returns the formatted `node`.
 */
function formatNode(node, options, childNode, pathCost) {
	var newNode = {
		symbol: node.sym.name,
	}

	if (options.treeTokenRanges) {
		// Include the start and end indexes of each node's token range.
		newNode.start = node.start
		newNode.end = node.start + node.size
	}

	if (options.treeNodeCosts && pathCost !== undefined) {
		// Include each node's path cost. I.e., the cost of the path so far + the heuristic estimate of the cost remaining.
		newNode.pathCost = pathCost
	}

	// If `node` is nonterminal.
	if (childNode) {
		// Arrange properties to print insertions in order.
		if (childNode.props.insertionIdx === 1) {
			newNode.children = childNode.children
			newNode.props = childNode.props
		} else {
			newNode.props = childNode.props
			newNode.children = childNode.children
		}
	}

	return newNode
}