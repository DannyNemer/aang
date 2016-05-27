var util = require('../util/util')
var semantic = require('../grammar/semantic')
var checkParseTree = require('./checkParseTree')
var parseTreeLinkedListToGraph = require('./parseTreeLinkedListToGraph')


/**
 * Prints parse results output by `Parser.prototype.parse()`, which includes the k-best parse trees output by `pfsearch` and the associated semantic trees and display texts. Checks every parse tree for errors.
 *
 * @static
 * @param {Object} parseResults The parse results output by `Parser.prototype.parse()`.
 * @param {Object} [options] The options object.
 * @param {boolean} [options.quiet=false] Specify suppressing parse trees from output. If `true`, neither prevents parse tree checks, printing parse warnings, nor printing `pfsearch` statistics.
 * @param {boolean} [options.costs=false] Specify printing the cost of each parse tree.
 * @param {boolean} [options.trees=false] Specify printing graph representation of `parseResults.trees`.
 * @param {boolean} [options.treeNodeCosts=false] If `options.trees` is `true`, specify including in the parse trees each node's path cost. I.e., the cost of the path so far + the heuristic estimate of the cost remaining.
 * @param {boolean} [options.treeTokenRanges=false] If `options.trees` is `true`, specify including in the parse trees the start and end indexes of each node's token range.
 * @param {boolean} [options.objectSemantics=false] Specify printing object representations of the semantics of `parseResults.trees`.
 * @param {boolean} [options.noSemantics=false] Specify not printing the semantics of `parseResults.trees`.
 * @param {string} [options.diffInputQuery] The input query that produced `parseResults.trees`, with which to stylize its differences with the top parse tree's display text.
 */
var printOptionsSchema = {
	quiet: Boolean,
	costs: Boolean,
	trees: Boolean,
	treeNodeCosts: Boolean,
	treeTokenRanges: Boolean,
	objectSemantics: Boolean,
	noSemantics: Boolean,
	diffInputQuery: String,
}

module.exports = function (parseResults, options) {
	// Check arity.
	if (!options) options = {}
	if (util.illFormedOpts(printOptionsSchema, options)) {
		throw new Error('Ill-formed options')
	}

	var trees = parseResults.trees
	if (!trees) {
		util.logError('Failed to reach start node.')
		return
	} else if (trees.length === 0) {
		// Never occurs because marking all tokens as deletable enables avoiding semantically illegal parses.
		util.logError('Failed to find legal parse trees.')
	} else if (parseResults.failedInitStartSym) {
		// Print this error separate from failing to reach the start node on the final parse (because otherwise would be redundant).
		util.logWarning('Failed to reach start node on initial parse.')
	} else if (parseResults.failedInitLegalTrees) {
		util.logWarning('Failed to find legal parse trees on initial parse.')
	}

	util.log('Paths created:', parseResults.pathCount)
	util.log('Ambiguous trees:', parseResults.ambiguousTreeCount)

	for (var t = 0, treesLen = trees.length; t < treesLen; ++t) {
		var tree = trees[t]

		// Check `tree` for errors.
		checkParseTree(tree, trees[t + 1], options)

		if (!options.quiet) {
			// Print `tree`.
			printParseTree(tree, t, options)
		}
	}
}

/**
 * Prints `tree` (output by `pfsearch`), including its semantic tree and display text.
 *
 * @private
 * @static
 * @param {Object} tree The parse tree to print.
 * @param {number} treeIdx The index of `tree` within its set (returned by `pfsearch`).
 * @param {Object} options The options object.
 */
function printParseTree(tree, treeIdx, options) {
	// Diff top parse tree's display text with input query.
	var displayText = tree.text
	if (treeIdx === 0 && options.diffInputQuery !== undefined && options.diffInputQuery !== displayText) {
		var diff = util.diffStrings(options.diffInputQuery, displayText)
		util.log(diff.expected)
		displayText = diff.actual
	}

	// Print display text (and cost).
	util.log.apply(null, options.costs ? [ displayText, tree.cost ] : [ displayText ])

	if (!options.noSemantics) {
		// Print semantic.
		util.dir('  ', options.objectSemantics ? semantic.toSimpleObject(tree.semanticList.semantic) : tree.semanticStr)

		// Print additional semantics that produced identical display text.
		if (tree.ambiguousSemantics) {
			tree.ambiguousSemantics.forEach(function (semanticStr) {
				util.dir('  ', options.objectSemantics ? semantic.toSimpleObject(semantic.stringToObject(semanticStr)) : semanticStr)
			})
		}
	}

	// Print trees (if constructed during parse forest search).
	if (options.trees) {
		util.dir(parseTreeLinkedListToGraph(tree, options))
	}
}