var util = require('../util/util')
var semantic = require('../grammar/semantic')


/**
 * Prints parse trees output by `pfsearch`.
 *
 * @static
 * @param {Object[]} trees The parse trees to print.
 * @param {Object} [options] The options object.
 * @param {boolean} [options.stats=false] Specify printing `pfsearch` statistics.
 * @param {boolean} [options.costs=false] Specify printing the cost of each parse tree.
 * @param {boolean} [options.trees=false] Specify printing graph representation of `trees`.
 * @param {boolean} [options.treeNodeCosts=false] If `options.trees` is `true`, specify including each node's path cost.
 * @param {boolean} [options.treeTokenRanges=false] If `options.trees` is `true`, specify including the start and end indexes of each node's token range.
 * @param {boolean} [options.objectSemantics=false] Specify printing object representations of the semantics of `trees`.
 */
var printOptionsSchema = {
	// Specify printing `psearch` statistics.
	stats: Boolean,
	// Specify printing the cost of each parse tree.
	costs: Boolean,
	// Specify printing graph representation of `trees`.
	trees: Boolean,
	// If `options.trees` is `true`, specify including in the parse trees each node's path cost. I.e., the cost of the path so far + the heuristic estimate of the cost remaining.
	treeNodeCosts: Boolean,
	// If `options.trees` is `true`, specify including in the parse trees the start and end indexes of each node's token range.
	treeTokenRanges: Boolean,
	// Specify printing object representations of the semantics of `trees`.
	objectSemantics: Boolean,
}

module.exports = function (trees, options) {
	if (!options) {
		options = {}
	} else if (util.illFormedOpts(printOptionsSchema, options)) {
		throw new Error('Ill-formed options')
	}

	// Print `pfsearch` statistics.
	if (options.stats) {
		util.log('Paths created:', trees.pathCount)
		util.log('Ambiguous trees:', trees.ambiguousTreeCount)
	}

	for (var t = 0, treesLen = trees.length; t < treesLen; ++t) {
		var tree = trees[t]

		// Check parse results are correctly sorted by increasing cost.
		// Use `util.cleanFloat()` because of Javascript floating point number precision.
		if (t < treesLen - 1 && util.cleanFloat(tree.cost) > util.cleanFloat(trees[t + 1].cost)) {
			util.logError('\nParse trees not sorted by increasing cost:')

			util.log('  ', tree.text, tree.cost)
			if (options.trees) util.dir(linkedListToGraph(tree, options))

			var nextTree = trees[t + 1]
			util.log('  ', nextTree.text, nextTree.cost)
			if (options.trees) util.dir(linkedListToGraph(nextTree, options))

			throw 'Costs error'
		}

		// Check A* cost heuristic calculation.
		if (tree.cost !== tree.minCost) {
			util.logError('\nCosts incorrect:', 'cost:', tree.cost, 'minCost:', tree.minCost)
			util.log('  ', tree.text)
			if (options.trees) util.dir(linkedListToGraph(tree, options))
			throw 'Costs error'
		}

		// Check display text was conjugated.
		if (/undefined/.test(tree.text)) {
			// Surounds text with quotation marks.
			var text = '\'' + tree.text + '\''

			// Color instances of 'undefined' yelllow and other instances green.
			text = text.replace(/(undefined)|((.(?!undefined))+)/g, function (match, p1, p2) {
				return util.colors[p1 ? 'yellow' : 'green' ](match)
			})

			util.logError('\nUnconjugated text:', text)
			if (options.trees) util.dir(linkedListToGraph(tree, options))
			throw 'Conjugation error'
		}

		// Print display text (and cost).
		util.log.apply(null, options.costs ? [ tree.text, tree.cost ] : [ tree.text ])

		// Check semantic tree was completely reduced.
		if (tree.semanticList.prev) {
			util.logError('\nSemantic tree not reduced:')
			util.dir('  ', tree.semanticList)
		}

		// Check semantic tree begins with a single semantic function.
		if (tree.semanticList.semantic.length > 1) {
			util.logError('\nSemantic tree missing a LHS semantic:')
			util.dir('  ', tree.semanticList)
		}

		// Print semantic.
		util.dir('  ', options.objectSemantics ? semantic.toSimpleObject(tree.semanticList.semantic) : tree.semanticStr)

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
 * Converts a reverse linked list `path` output by `pfsearch` when ran with `buildTrees` as `true` (which links each `path` to the previous `path` and its new `ruleProps`) to a graph representation.
 *
 * @private
 * @static
 * @param {Object} path The parse tree to convert.
 * @param {Object} options The options object.
 * @param {boolean} [options.treeNodeCosts=false] Specify including each node's path cost.
 * @param {boolean} [options.treeTokenRanges=false] Specify including the start and end indexes of each node's token range.
 * @returns {Object} Returns the parse tree graph representation of `path`.
 */
function linkedListToGraph(path, options) {
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
					// Do not display the cost of the second node because its `mincost` is included in the first node's `mincost`, and after completing the parse of the first node's branch and retruning to parse this (second) node, there is no updated `minCost` value that includes the previous branch's total cost.
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
 * Formats `node` for `linkedListToGraph()`.
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