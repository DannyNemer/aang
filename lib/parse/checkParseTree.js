var util = require('../util/util')
var semantic = require('../grammar/semantic')
var parseTreeLinkedListToGraph = require('./parseTreeLinkedListToGraph')


/**
 * Checks `tree` (output by `pfsearch`) for errors. Throws an exception if found.
 *
 * Checks the following cases are true:
 * - Parse trees sorted by increasing costs.
 * - A* cost heuristic sum equals actual cost sum.
 * - Display text successfully conjugated.
 * - Semantic properly reduced and well-formed.
 *
 * @static
 * @param {Object} tree The parse tree to check for errors.
 * @param {Object|undefined} nextTree The next parse tree within the set, if any (to check sorting).
 * @param {Object} options The `printParseResults` options object.
 */
module.exports = function (tree, nextTree, options) {
	// Check parse trees are correctly sorted by increasing cost.
	// Use `util.cleanFloat()` to handle cost differences due to JavaScript floating point number precision.
	if (nextTree && util.cleanFloat(tree.cost) > util.cleanFloat(nextTree.cost)) {
		util.logError('\nParse trees not sorted by increasing cost:')

		util.log('  ', tree.text, tree.cost)
		if (options.trees) {
			util.dir('\n', parseTreeLinkedListToGraph(tree, options))
		}

		util.log('  ', nextTree.text, nextTree.cost)
		if (options.trees) util.dir(parseTreeLinkedListToGraph(nextTree, options))

		throw 'Costs error'
	}

	// Check A* cost heuristic calculation.
	if (Number.isNaN(tree.cost) || Number.isNaN(tree.minCost) || tree.cost !== tree.minCost) {
		util.logError('\nCosts incorrect:', 'cost:', tree.cost, 'minCost:', tree.minCost)
		util.log('  ', tree.text)

		if (options.trees) {
			util.dir('\n', parseTreeLinkedListToGraph(tree, options))
		}

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

		if (options.trees) {
			util.dir('\n', parseTreeLinkedListToGraph(tree, options))
		}

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

	// Check the number of semantic arguments conforms to the parameter bounds defined in the grammar.
	checkSemanticParams(tree.semanticList.semantic, tree, options)

	// Check instances of `intersect()`, `union()`, and `not()` do not contain non-function semantic arguments (e.g., entities, `me`).
	checkForbiddenSemanticArgs(tree.semanticList.semantic, tree, options)

	if (tree.ambiguousSemantics) {
		tree.ambiguousSemantics.forEach(function (semanticStr) {
			var semanticArray = semantic.stringToObject(semanticStr)

			checkSemanticParams(semanticArray, tree, options)
			checkForbiddenSemanticArgs(semanticArray, tree, options)
		})
	}
}

/**
 * Checks the number of semantic arguments conforms to the parameter bounds defined in the grammar.
 *
 * @private
 * @static
 * @param {string} semanticArray The semantic to check.
 * @param {Object} tree The parse tree owner of `semanticArray`.
 * @param {Object} options The module options object.
 */
function checkSemanticParams(semanticArray, tree, options) {
	checkEachSemanticNode(semanticArray, tree, options, 'illegal number of semantic arguments', function (semanticNode) {
		if (semanticNode.children) {
			var semanticDef = semanticNode.semantic
			var childrenLen = semanticNode.children.length

			if (childrenLen < semanticDef.minParams || childrenLen > semanticDef.maxParams) {
				// Clone and colorize violating semantic function for printing. (Cloning is necessary because the semantic definition object is shared.)
				semanticNode.semantic = {
					name: util.colors.red(semanticDef.name)
				}

				return true
			}
		}
	})
}

/**
 * Checks instances of `intersect()`, `union()`, and `not()` do not contain non-function semantic arguments (e.g., entities, `me`).
 *
 * @private
 * @static
 * @param {string} semanticArray The semantic to check.
 * @param {Object} tree The parse tree owner of `semanticArray`.
 * @param {Object} options The module options object.
 */
function checkForbiddenSemanticArgs(semanticArray, tree, options) {
	checkEachSemanticNode(semanticArray, tree, options, 'non-function semantic arguments', function (semanticNode) {
		// Check for non-function semantic arguments (e.g., entities, `me`) in `intersect()`, `union()`, or `not()`.
		if (/\b(intersect|union|not)\b/.test(semanticNode.semantic.name)) {
			var semanticChildren = semanticNode.children
			var semanticHasArgs = false

			for (var c = 0, semanticChildrenLen = semanticChildren.length; c < semanticChildrenLen; ++c) {
				var childSemanticNode = semanticChildren[c]

				if (!childSemanticNode.children) {
					// Clone and colorize violating semantic argument for printing. (Cloning is necessary because the semantic definition object is shared.)
					childSemanticNode.semantic = {
						name: util.colors.red(childSemanticNode.semantic.name),
					}

					semanticHasArgs = true
				}
			}

			if (semanticHasArgs) {
				// Clone and colorize violating semantic function for printing.
				semanticNode.semantic = {
					name: util.colors.cyan(semanticNode.semantic.name),
				}

				return true
			}
		}
	})
}

/**
 * Checks if `predicate` returns truthy for any semantic nodes in `semanticArray`. If so, prints an error and throws an exception.@constructor
 *
 * The printed error includes the names of the semantics for which `predicate` returned truthy in the format "${semanticViolator} contains ${description}:", the entire semantic (preserving any colorization of semantic names that occur in `predicate`), and associated `tree` properties.
 *
 * Iterates over the entire semantic, and invokes `predicate` with one argument: (semanticNode).
 *
 * @private
 * @static
 * @param {Object[]} semanticArray The semantic to check.
 * @param {Object} tree The parse tree owner of `semanticArray`.
 * @param {Object} options The module options object.
 * @param {string} description The check description included in the error message, if any.
 * @param {Function} predicate The function invoked per semantic node.
 */
function checkEachSemanticNode(semanticArray, tree, options, description, predicate) {
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
 * @private
 * @static
 * @param {Object} tree The parse tree with the semantic error.
 * @param {Object} options The module options object.
 * @param {Function} customizer The function invoked after printing `tree.text` (and `tree.cost` if `options.costs`) and before (printing the parse tree graph if `options.trees` and) throwing an exception.
 */
function semanticError(tree, options, customizer) {
	util.log.apply(null, options.costs ? [ tree.text, tree.cost ] : [ tree.text ])

	customizer()

	if (options.trees) {
		util.dir('\n', parseTreeLinkedListToGraph(tree, options))
	}

	// Print trailing newline.
	util.log()

	throw new Error('Semantic error')
}