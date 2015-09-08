var fs = require('fs')
var util = require('../util')


var symbol = require('./symbol')
// Creates a new `Symbol`.
exports.newSymbol = symbol.new
// Creates a new `Symbol` with a single binary nonterminal rule.
exports.newBinaryRule = symbol.newBinaryRule
// The grammar.
var grammar = symbol.grammar

// The start symbol of `grammar`.
exports.startSymbol = exports.newSymbol('start')

// The terminal symbol for empty strings. Rules with '<empty>' optionalize their LHS symbols and subsequent unary reductions. Original unary rules with '<empty>' are omitted from `grammar` when output.
exports.emptySymbol = '<empty>'

// The terminal symbol for integers. Terminal rules with <int> are assigned minimum and maximum values.
exports.intSymbol = '<int>'

// Concatenates variadic string arguments (including `Symbol.name`) with dashes.
exports.hyphenate = require('./stringUtil').hyphenate

// Extend `Symbol` with functions for predefined sets of rules (e.g., verbs, stop words).
require('./ruleFunctions')

var semantic = require('./semantic')
// Creates a new semantic function or argument.
exports.newSemantic = semantic.new
// Applies a completed semantic rule to a more recent semantic tree, joining them together as one semantic tree with a new root function.
exports.reduceSemantic = semantic.reduce

var entityCategory = require('./entityCategory')
// Creates a new entity category containing the passed entities.
exports.newEntityCategory = entityCategory.new

// Creates grammar rules derived from insertion and transposition costs, and empty strings in `grammar`.
exports.createEditRules = require('./createEditRules').bind(null, grammar)

// Determines if a rule lacks and cannot produce a RHS semantic needed by itself or an ancestor rule in `grammar`.
exports.ruleMissingNeededRHSSemantic = require('./ruleMissingNeededRHSSemantic').bind(null, grammar)

// Finds and prints instances of nonterminal symbols, entity categories, or semantic functions and arguments not used in any rules of `grammar`.
exports.checkForUnusedComponents = require('./checkForUnusedComponents').bind(null, grammar)

// Finds and prints instances of ambiguity in `grammar`.
exports.checkForAmbiguity = require('./checkForAmbiguity').bind(null, grammar)

/**
 * Sorts `grammar`'s nonterminal symbols alphabetically and the symbols' rules by increasing cost.
 */
exports.sortGrammar = function () {
	Object.keys(grammar).sort().forEach(function (symbolName) {
		// Sort rules by increasing cost.
		var rules = grammar[symbolName].sort(function (ruleA, ruleB) {
			return ruleA.cost - ruleB.cost
		})

		// Sort nonterminal symbols alphabetically.
		delete grammar[symbolName]
		grammar[symbolName] = rules
	})
}

/**
 * Prints the number of rules in `grammar` to the console. If `prevOutputFilePath` is provided, prints the difference in the number of rules, if any, since the last build of `grammar`.
 *
 * @param {string} [prevOutputFilePath] The optional path of the previously generated grammar to compare with this grammar.
 */
exports.printRuleCount = function (prevOutputFilePath) {
	var newRuleCount = exports.getRuleCount(grammar)

	if (fs.existsSync(prevOutputFilePath)) {
		var oldRuleCount = exports.getRuleCount(require(fs.realpathSync(prevOutputFilePath)).grammar)
		if (oldRuleCount !== newRuleCount) {
			console.log('Rules:', oldRuleCount, '->', newRuleCount)
			return
		}
	}

	console.log('Rules:', newRuleCount)
}

/**
 * Gets the number of rules in a grammar.
 *
 * @param {Object} grammar The grammar to count.
 * @returns {number} Returns the number of rules in `grammar`.
 */
exports.getRuleCount = function (grammar) {
	return Object.keys(grammar).reduce(function (prev, cur) {
		return prev + grammar[cur].length
	}, 0)
}

/**
 * Writes the grammar, semantics, entities, and deletables to a JSON file. This file is used in the instantiation of a `StateTable` (grammar, semantics) and a `Parser` (entities, deletables).
 *
 * @param {string} outputFilePath The path to write the file.
 */
exports.writeGrammarToFile = function (outputFilePath) {
	util.writeJSONFile(outputFilePath, {
		startSymbol: exports.startSymbol.name,
		intSymbol: exports.intSymbol,
		grammar: grammar,
		deletables: require('./deletables'),
		semantics: semantic.semantics,
		entities: entityCategory.entities,
	})
}