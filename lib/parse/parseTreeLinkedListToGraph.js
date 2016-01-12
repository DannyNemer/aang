/**
 * Converts a reverse linked list `path` output by `pfsearch` when ran with `buildTrees` as `true` (which links each `path` to the previous `path` and its new `ruleProps`) to a graph representation.
 *
 * @static
 * @param {Object} path The parse tree to convert.
 * @param {Object} options The options object.
 * @param {boolean} [options.treeNodeCosts=false] Specify including each node's path cost.
 * @param {boolean} [options.treeTokenRanges=false] Specify including the start and end indexes of each node's token range.
 * @returns {Object} Returns the parse tree graph representation of `path`.
 */
module.exports = function (path, options) {
	// The stack of previous nodes lower in the parse tree (which become child nodes).
	var nodesStack = []

	while (true) {
		var node = path.curNode

		// Terminal rule.
		if (!node) {
			var node = path.prev.curNode

			if (!node) {
				var prevNextItems = path.prev.prev.nextItemList

				// Find last node, skipping the insertion text also stored in `nextNodes`.
				while (prevNextItems.text) {
					prevNextItems = prevNextItems.next
				}

				node = prevNextItems.node
			}

			nodesStack.push({
				props: path.ruleProps,
				children: [ formatNode(node.subs[0].node, options) ],
			})
		}

		// Binary nonterminal rule.
		else if (path.nextItemList && path.nextItemList !== path.prev.nextItemList && path.ruleProps.insertedSymIdx === undefined) {
			nodesStack.push({
				props: path.ruleProps,
				children: [
					formatNode(node, options, nodesStack.pop(), path.minCost),
					// Do not display the cost of the second node because its `mincost` is included in the first node's `mincost`, and after completing the parse of the first node's branch and returning to parse this (second) node, there is no updated `minCost` value that includes the previous branch's total cost.
					formatNode(path.nextItemList.node, options, nodesStack.pop())
				],
			})
		}

		// Unary nonterminal rule.
		else {
			var newNode = formatNode(node, options, nodesStack.pop(), path.minCost)

			// Stop at tree root.
			if (!path.prev) {
				return newNode
			}

			nodesStack.push({
				props: path.ruleProps,
				children: [ newNode ],
			})
		}

		path = path.prev
	}
}

/**
 * Formats `node` for printing within a graph representation.
 *
 * @private
 * @static
 * @param {Object} node The node to convert.
 * @param {Object} options The options object.
 * @param {boolean} [options.treeNodeCosts=false] Specify including each node's path cost.
 * @param {boolean} [options.treeTokenRanges=false] Specify including the start and end indexes of each node's token range.
 * @param {Object} [childNode] The child node of `node`.
 * @param {number} [minCost] The cost of the path + heuristic cost at `node`.
 * @returns {Object} Returns the formatted `node`.
 */
function formatNode(node, options, childNode, minCost) {
	var newNode = {
		symbol: node.sym.name,
	}

	if (options.treeTokenRanges) {
		// Include the start and end indexes of each node's token range.
		newNode.start = node.startIdx
		newNode.end = node.startIdx + node.size
	}

	if (options.treeNodeCosts && minCost !== undefined) {
		// Include each node's path cost. I.e., the cost of the path so far + the heuristic estimate of the cost remaining.
		newNode.minCost = minCost
	}

	// If `node` is nonterminal.
	if (childNode) {
		// Arrange properties to display insertions in order.
		if (childNode.props.insertedSymIdx === 1) {
			newNode.children = childNode.children
			newNode.props = childNode.props
		} else {
			newNode.props = childNode.props
			newNode.children = childNode.children
		}
	}

	return newNode
}