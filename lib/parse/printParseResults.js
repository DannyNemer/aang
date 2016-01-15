var util = require('../util/util')
var semantic = require('../grammar/semantic')
var checkParseResult = require('./checkParseResult')
var parseTreeLinkedListToGraph = require('./parseTreeLinkedListToGraph')


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

	var trees = parseResults.trees

	if (parseResults.failedInitStartSym) {
		util.logWarning('Failed to reach start node on initial parse.')
	} else if (parseResults.failedInitLegalTrees) {
		util.logWarning('Failed to find legal parse trees on initial parse.')
	}

	// Print `pfsearch` statistics.
	if (options.stats) {
		util.log('Paths created:', parseResults.pathCount)
		util.log('Ambiguous trees:', parseResults.ambiguousTreeCount)
	}

	if (trees) {
		for (var t = 0, treesLen = trees.length; t < treesLen; ++t) {
			var tree = trees[t]

			// Check `tree` for errors.
			checkParseResult(tree, trees[t + 1], options)

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
			if (tree.ambiguousSemantics) {
				tree.ambiguousSemantics.forEach(function (semanticStr) {
					util.dir('  ', options.objectSemantics ? semantic.toSimpleObject(semantic.stringToObject(semanticStr)) : semanticStr)
				})
			}

			// Print trees (if constructed during parse forest search).
			if (options.trees) util.dir(parseTreeLinkedListToGraph(tree, options))
		}
	}
}