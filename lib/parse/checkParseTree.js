var util = require('../util/util')
var semantic = require('../grammar/semantic')
var parseTreeLinkedListToGraph = require('./parseTreeLinkedListToGraph')


/**
 * Checks `tree` (output by `pfsearch`) for errors. If found, throws an exception.
 *
 * Checks the following cases are true:
 * • Parse trees sorted by increasing costs.
 * • A* cost heuristic sum equals actual cost sum.
 * • Display text successfully conjugated.
 * • Semantic properly reduced and well-formed.
 *
 * @static
 * @param {Object} tree The parse tree to check for errors.
 * @param {Object|undefined} nextTree The next parse tree within the set, if any (to check sorting).
 * @param {Object} options The `printParseResults` options object.
 */
module.exports = function (tree, nextTree, options) {
	// Check A* cost heuristic calculation.
	if (Number.isNaN(tree.cost) || Number.isNaN(tree.minCost) || tree.cost !== tree.minCost) {
		util.logError('\nCosts incorrect:', 'cost:', tree.cost, 'minCost:', tree.minCost)
		util.log('  ', tree.text)

		if (options.trees) {
			util.dir(parseTreeLinkedListToGraph(tree, options))
		}

		throw 'Costs error'
	}

	// Check parse trees are correctly sorted by increasing cost.
	// Use `util.cleanFloat()` to handle cost differences due to JavaScript floating point number precision.
	if (nextTree && util.cleanFloat(tree.cost) > util.cleanFloat(nextTree.cost)) {
		util.logError('\nParse trees not sorted by increasing cost:')

		util.log('  ', tree.text, tree.cost)
		if (options.trees) {
			util.dir(parseTreeLinkedListToGraph(tree, options), '\n')
		}

		util.log('  ', nextTree.text, nextTree.cost)
		if (options.trees) {
			util.dir(parseTreeLinkedListToGraph(nextTree, options))
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

	// Check there are no multiple instances of a semantic marked `forbidsMultipleIntersection` within an `intersect()`.
	checkForbiddenMultiple(tree.semanticList.semantic, tree, options)

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
 * Checks for multiple instances of a semantic marked `forbidsMultipleIntersection` within an `intersect()`. If found, throws an exception.
 *
 * @private
 * @static
 * @param {string} semanticArray The semantic to check.
 * @param {Object} tree The parse tree owner of `semanticArray`.
 * @param {Object} options The module options object.
 */
function checkForbiddenMultiple(semanticArray, tree, options) {
	checkEachSemanticNode(semanticArray, tree, options, 'multiple instances of a semantic marked `forbidsMultipleIntersection`', function (semanticNode) {
		// Check for multiple instances of a semantic marked `forbidsMultipleIntersection` within an `intersect()`.
		if (semanticNode.semantic.name === 'intersect') {
			var semanticChildren = semanticNode.children
			var hasForbiddenMultiple = false

			for (var a = 0, semanticChildrenLen = semanticChildren.length; a < semanticChildrenLen; ++a) {
				var childSemanticNodeA = semanticChildren[a]
				var childSemanticDef = childSemanticNodeA.semantic

				if (childSemanticDef.forbidsMultipleIntersection) {
					for (var b = a + 1; b < semanticChildrenLen; ++b) {
						var childSemanticNodeB = semanticChildren[b]

						// Check for multiple instance of `childSemanticDef`, which is marked `forbidsMultipleIntersection`.
						if (childSemanticNodeB.semantic === childSemanticDef) {
							/**
							 * Clone and colorize violating child semantic within `intersect()` for printing, if not already colorized. (Cloning is necessary because the semantic definition object is shared.)
							 *
							 * Does not impact future semantic comparisons within this iteration because this does not mutate `childSemanticDef`.
							 */
							if (childSemanticNodeA.semantic === childSemanticDef) {
								childSemanticNodeA.semantic = {
									name: util.colors.red(childSemanticDef.name),
								}

								hasForbiddenMultiple = true
							}

							// Clone and colorize violating child semantic within `intersect()` for printing.
							childSemanticNodeB.semantic = {
								name: util.colors.red(childSemanticDef.name),
							}
						}
					}
				}
			}

			if (hasForbiddenMultiple) {
				// Clone and colorize violating `intersect()` semantic function for printing.
				semanticNode.semantic = {
					name: util.colors.cyan(semanticNode.semantic.name),
				}

				return true
			}
		}
	})
}

/**
 * Checks the number of semantic arguments within each semantic conforms to that semantic's parameter bounds defined in the grammar. If not, throws an exception.
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
 * Checks instances of `intersect()`, `union()`, and `not()` do not contain non-function semantic arguments (e.g., entities, `me`). If found, throws an exception.
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
 * Checks if `predicate` returns truthy for any semantic nodes in `semanticArray`. If so, prints an error and throws an exception.
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
 * Prints a semantic error for `tree`, and throws an exception.
 *
 * @private
 * @static
 * @param {Object} tree The parse tree with the semantic error.
 * @param {Object} options The module options object.
 * @param {Function} customizer The function invoked after printing `tree.text` (and `tree.cost` if `options.costs`) and before (printing the parse tree graph if `options.trees` and) throwing an exception.
 * @param {boolean} [printSemanticTree] Specify printing the unformatted semantic tree, `tree.semanticList.semantic`.
 */
function semanticError(tree, options, customizer, printSemanticTree) {
	util.log.apply(null, options.costs ? [ tree.text, tree.cost ] : [ tree.text ])

	if (printSemanticTree) {
		util.dir(tree.semanticList.semantic)
	}

	customizer()

	if (options.trees) {
		util.dir('\n', parseTreeLinkedListToGraph(tree, options))
	}

	// Print trailing newline.
	util.log()

	throw new Error('Semantic error')
}