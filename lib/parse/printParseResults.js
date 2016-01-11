var util = require('../util/util')
var semantic = require('../grammar/semantic')


/**
 * Prints parse results output by `Parser.prototype.parse()`, which includes the k-best parse trees output by `pfsearch`. Checks every parse tree for errors.
 *
 * @static
 * @param {Object} parseResults The parse results output by `Parser.prototype.parse()`.
 * @param {Object} [options] The options object.
 * @param {boolean} [options.stats=false] Specify printing `pfsearch` statistics.
 * @param {boolean} [options.costs=false] Specify printing the cost of each parse tree.
 * @param {boolean} [options.trees=false] Specify printing graph representation of `parseResults.trees`.
 * @param {boolean} [options.treeNodeCosts=false] If `options.trees` is `true`, specify including each node's path cost.
 * @param {boolean} [options.treeTokenRanges=false] If `options.trees` is `true`, specify including the start and end indexes of each node's token range.
 * @param {boolean} [options.objectSemantics=false] Specify printing object representations of the semantics of `parseResults.trees`.
 * @param {string} [options.diffInputQuery] The input query that produced `parseResults.trees`, with which to stylize its differences with the top parse result's display text.
 */
var printOptionsSchema = {
	// Specify printing `psearch` statistics.
	stats: Boolean,
	// Specify printing the cost of each parse tree.
	costs: Boolean,
	// Specify printing graph representation of `parseResults.trees`.
	trees: Boolean,
	// If `options.trees` is `true`, specify including in the parse trees each node's path cost. I.e., the cost of the path so far + the heuristic estimate of the cost remaining.
	treeNodeCosts: Boolean,
	// If `options.trees` is `true`, specify including in the parse trees the start and end indexes of each node's token range.
	treeTokenRanges: Boolean,
	// Specify printing object representations of the semantics of `parseResults.trees`.
	objectSemantics: Boolean,
	// The input query that produced `parseResults.trees`, with which to stylize its differences with the top parse result's display text.
	diffInputQuery: String
}

module.exports = function (parseResults, options) {
	if (!options) {
		options = {}
	} else if (util.illFormedOpts(printOptionsSchema, options)) {
		throw new Error('Ill-formed options')
	}

	// Print `pfsearch` statistics.
	if (options.stats) {
		util.log('Paths created:', parseResults.pathCount)
		util.log('Ambiguous trees:', parseResults.ambiguousTreeCount)
	}

	var trees = parseResults.trees
	for (var t = 0, treesLen = trees.length; t < treesLen; ++t) {
		var tree = trees[t]

		// Check `tree` for errors.
		checkTree(tree, trees[t + 1], options)

		// Diff top parse result's display text with input query.
		var displayText = tree.text
		if (t === 0 && options.diffInputQuery !== undefined && options.diffInputQuery !== displayText) {
			var diff = util.diffStrings(options.diffInputQuery, displayText)
			util.log(diff.expected)
			displayText = diff.actual
		}

		// Print display text (and cost).
		util.log.apply(null, options.costs ? [ displayText, tree.cost ] : [ displayText ])

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
 * Checks a `tree` for errors. Throws an exception if found.
 *
 * Checks the following cases are true:
 * - Parse results sorted by increasing costs.
 * - A* cost heuristic sum equals actual cost sum.
 * - Display text successfully conjugated.
 * - Semantic properly reduced and well-formed.
 *
 * @private
 * @static
 * @param {Object} tree The parse tree to check for errors.
 * @param {Object|undefined} nextTree The next parse tree in the results, if any.
 * @param {Object} options The module options object.
 */
function checkTree(tree, nextTree, options) {
	// Check parse results are correctly sorted by increasing cost.
	// Use `util.cleanFloat()` because of JavaScript floating point number precision.
	if (nextTree && util.cleanFloat(tree.cost) > util.cleanFloat(nextTree.cost)) {
		util.logError('\nParse trees not sorted by increasing cost:')

		util.log('  ', tree.text, tree.cost)
		if (options.trees) util.dir(linkedListToGraph(tree, options))

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
		// Surround text with quotation marks.
		var text = '\'' + tree.text + '\''

		// Color instances of 'undefined' yellow and other instances green.
		text = text.replace(/(undefined)|((.(?!undefined))+)/g, function (match, p1, p2) {
			return util.colors[p1 ? 'yellow' : 'green' ](match)
		})

		util.logError('\nUnconjugated text:', text)

		if (options.trees) util.dir(linkedListToGraph(tree, options))
		throw 'Conjugation error'
	}

	// Check semantic tree was completely reduced.
	if (tree.semanticList.prev) {
		semanticError(tree, options, function () {
			util.logError('\nSemantic tree not reduced:')
			util.dir('  ', tree.semanticList)
		})
	}

	// Check semantic tree begins with a single semantic function.
	if (tree.semanticList.semantic.length > 1) {
		semanticError(tree, options, function () {
			util.logError('\nSemantic tree missing a LHS semantic:')
			util.dir('  ', tree.semanticList)
		})
	}

	// Check instances of `intersect()`, `union()`, and `not()` do not contain non-function semantic arguments (e.g., entities, `me`).
	checkForbiddenSemanticArgs(tree.semanticStr, tree, options)
	if (tree.disambiguation) {
		tree.disambiguation.forEach(function (semanticStr) {
			checkForbiddenSemanticArgs(semanticStr, tree, options)
		})
	}

	// Check instances of `intersect()` and `union()` have at least two arguments.
	checkSemanticOperatorsMinParams(tree.semanticStr, tree, options)
	if (tree.disambiguation) {
		tree.disambiguation.forEach(function (semanticStr) {
			checkSemanticOperatorsMinParams(semanticStr, tree, options)
		})
	}
}

/**
 * Checks instances of `intersect()`, `union()`, and `not()` do not contain non-function semantic arguments (e.g., entities, `me`).
 *
 * @private
 * @static
 * @param {string} semanticStr The semantic string to check.
 * @param {Object} tree The parse tree owner of `semanticStr`.
 * @param {Object} options The module options object.
 */
function checkForbiddenSemanticArgs(semanticStr, tree, options) {
	checkEachSemanticNode(semanticStr, tree, options, 'non-function semantic arguments', function (semanticNode) {
		var thisSemantic = semanticNode.semantic

		// Check for non-function semantic arguments (e.g., entities, `me`) in `intersect()`, `union()`, or `not()`.
		if (/\b(intersect|union|not)\b/.test(thisSemantic.name)) {
			var semanticChildren = semanticNode.children
			var semanticHasArgs = false

			for (var c = 0, semanticChildrenLen = semanticChildren.length; c < semanticChildrenLen; ++c) {
				var childSemantic = semanticChildren[c].semantic

				if (childSemantic.isArg) {
					// Colorize violating semantic argument for printing.
					childSemantic.name = util.colors.red(childSemantic.name)
					semanticHasArgs = true
				}
			}

			if (semanticHasArgs) {
				// Colorize violating semantic function for printing.
				thisSemantic.name = util.colors.cyan(thisSemantic.name)

				return true
			}
		}
	})
}

/**
 * Checks instances of `intersect()` and `union()` have at least two arguments.
 *
 * Though the definition of `union()` has `minParams` defined as 2, and reduction with `intersect()` specifically avoids a RHS semantic of length 1, both semantics entail complex and intricate operations across semantic reduction, the grammar's structure, and parse forest search, thereby warranting this additional check.
 *
 * @private
 * @static
 * @param {string} semanticStr The semantic string to check.
 * @param {Object} tree The parse tree owner of `semanticStr`.
 * @param {Object} options The module options object.
 */
function checkSemanticOperatorsMinParams(semanticStr, tree, options) {
	checkEachSemanticNode(semanticStr, tree, options, 'less than 2 semantic arguments', function (semanticNode) {
		var thisSemantic = semanticNode.semantic

		// Check instances of `intersect()` and `union()` have at least two arguments.
		if (/\b(intersect|union)\b/.test(thisSemantic.name)) {
			if (semanticNode.children.length < 2) {
				// Colorize violating semantic function for printing.
				thisSemantic.name = util.colors.red(thisSemantic.name)

				return true
			}
		}
	})
}

/**
 * Checks if `predicate` returns truthy for any semantic nodes in `semanticStr`. If any, prints an error with the names of the semantics for which `predicate` returned truthy in the format "${semanticViolator} contains ${description}:" the entire semantic (preserving any colorization of semantic names that occur in `predicate`), and associated `tree` properties. The function also throws an exception after printing the error, if any.
 *
 * Iterates over the entire semantic, and invokes `predicate` with one argument: (semanticNode).
 *
 * @private
 * @static
 * @param {string} semanticStr The semantic string to check.
 * @param {Object} tree The parse tree owner of `semanticStr`.
 * @param {Object} options The module options object.
 * @param {string} description The check description included in the error message, if any.
 * @param {Function} predicate The function invoked per semantic node.
 */
function checkEachSemanticNode(semanticStr, tree, options, description, predicate) {
	// Accept a semantic string to convert to the original object array format instead of accepting the original semantic already in that format because `pfsearch` does not store the original format of the ambiguous semantics.
	var semanticArray = semantic.stringToObject(semanticStr)
	var semanticStack = semanticArray.slice()
	var semanticViolators = []

	for (var s = 0, stackLen = semanticStack.length; s < stackLen; ++s) {
		var semanticNode = semanticStack[s]

		// Check if `predicate()` returns truthy for `semanticNode`.
		if (predicate(semanticNode)) {
			// Save violating semantic function name to include in error message. Strip any color styling added in `predicate()`.
			var semanticName = util.colors.stripColor(semanticNode.semantic.name)
			if (semanticViolators.indexOf(semanticName) === -1) {
				semanticViolators.push(semanticName)
			}
		}

		// Check semantic node children.
		var semanticChildren = semanticNode.children
		if (semanticChildren) {
			Array.prototype.push.apply(semanticStack, semanticChildren)
			stackLen += semanticChildren.length
		}
	}

	// Print error message if `predicate()` returned truthy for any semantic nodes.
	if (semanticViolators.length > 0) {
		semanticError(tree, options, function () {
			var semanticViolatorNames = semanticViolators.map(function (semanticName) {
				return util.colors.cyan(semanticName + '()')
			}).join(' and ')

			util.logError('\n', semanticViolatorNames, semanticViolators.length === 1 ? 'contains' : 'contain', description + ':')
			util.log('  ', semantic.toString(semanticArray))
		})
	}
}

/**
 * Logs a semantic error for `tree`, and throws an exception.
 *
 * @param {Object} tree The parse tree with the semantic error.
 * @param {Object} options The module options object.
 * @param {Function} customizer The function invoked after printing `tree.text` (and `tree.cost` if `options.costs`) and before (printing the parse tree graph if `options.trees` and) throwing an exception.
 */
function semanticError(tree, options, customizer) {
	util.log.apply(null, options.costs ? [ tree.text, tree.cost ] : [ tree.text ])

	customizer()

	if (options.trees) util.dir(linkedListToGraph(tree, options))
	throw 'Semantic error'
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