var fs = require('fs')
var util = require('../util/util')


var symbol = require('./symbol')
// Creates a new `Symbol`.
exports.newSymbol = symbol.new
// Creates a new `Symbol` with a single binary nonterminal rule.
exports.newBinaryRule = symbol.newBinaryRule
// Extend `Symbol` with functions for predefined sets of rules (e.g., verbs, stop words).
require('./ruleFunctions')
// The map of the grammar's nonterminal symbols to rules.
var ruleSets = symbol.ruleSets

var semantic = require('./semantic')
// Creates a new semantic function or argument.
exports.newSemantic = semantic.new
// Applies a completed semantic rule to a more recent semantic tree, joining them together as one semantic tree with a new root function.
exports.reduceSemantic = semantic.reduce

var entityCategory = require('./entityCategory')
// Creates a new entity category containing the passed entities.
exports.newEntityCategory = entityCategory.new

var intSymbol = require('./intSymbol')
// Creates a unique terminal symbol that recognizes integers in input within the specified range.
exports.newIntSymbol = intSymbol.new

// Terms that can be deleted when found in input.
exports.deletables = []

// The start symbol of the grammar.
exports.startSymbol = exports.newSymbol('start')

// The terminal symbol for empty strings. Rules with '<empty>' optionalize their LHS symbols and subsequent unary reductions. Original unary rules with '<empty>' are omitted from `ruleSets` when output.
exports.emptySymbol = '<empty>'

// Concatenates variadic string arguments with dashes. This is useful for hyphenating strings for options objects.
exports.hyphenate = require('./stringUtil').hyphenate

// Creates grammar rules derived from insertion and transposition costs, and empty strings in `ruleSets`.
exports.createEditRules = require('./createEditRules').bind(null, ruleSets)

// Determines if a rule lacks and cannot produce a RHS semantic needed by itself or an ancestor rule in `ruleSets`.
exports.ruleMissingNeededRHSSemantic = require('./ruleMissingNeededRHSSemantic').bind(null, ruleSets)

// Finds and prints instances of nonterminal symbols, entity categories, or semantic functions and arguments not used in any rules in `ruleSets`.
exports.checkForUnusedComponents = require('./checkForUnusedComponents').bind(null, ruleSets)

// Finds and prints instances of ambiguity in `ruleSets`.
exports.checkForAmbiguity = require('./checkForAmbiguity').bind(null, ruleSets)

/**
 * Sorts grammar's nonterminal symbols alphabetically and the symbols' rules by increasing cost.
 *
 * Sorts grammar's integer symbols by increasing minimum value and then by increasing maximum value.
 *
 * Sorts grammar's deletables alphabetically.
 */
exports.sortGrammar = function () {
	Object.keys(ruleSets).sort().forEach(function (symbolName) {
		// Sort rules by increasing cost.
		var rules = ruleSets[symbolName].sort(function (ruleA, ruleB) {
			return ruleA.cost - ruleB.cost
		})

		// Sort nonterminal symbols alphabetically.
		delete ruleSets[symbolName]
		ruleSets[symbolName] = rules
	})

	// Sort integer symbols by increasing minimum value and then by increasing maximum value.
	intSymbol.intSymbols.sort(function (a, b) {
		// Sort `a` before `b`.
		if (a.min < b.min) return -1

		// Sort `a` after `b`.
		if (a.min > b.min) return 1

		// Sort `a` before `b`.
		if (a.max < b.max) return -1

		// Sort `a` after `b`.
		if (a.max > b.max) return 1

		else throw new Error('Integer symbols with identical ranges')
	})

	// Sort deletables alphabetically.
	exports.deletables.sort()
}

/**
 * Prints the number of rules in the grammar to the console. If `prevOutputFilePath` is provided, prints the difference in the number of rules, if any, since the last grammar generation.
 *
 * @param {string} [prevOutputFilePath] The optional path of the previously generated grammar to compare with this grammar.
 */
exports.printRuleCount = function (prevOutputFilePath) {
	var newRuleCount = exports.getRuleCount(ruleSets)

	if (fs.existsSync(prevOutputFilePath)) {
		var oldRuleCount = exports.getRuleCount(require(fs.realpathSync(prevOutputFilePath)).ruleSets)
		if (oldRuleCount !== newRuleCount) {
			util.log('Rules:', oldRuleCount, '->', newRuleCount)
			return
		}
	}

	util.log('Rules:', newRuleCount)
}

/**
 * Gets the number of rules in `ruleSets`.
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @returns {number} Returns the number of rules in `ruleSets`.
 */
exports.getRuleCount = function (ruleSets) {
	return Object.keys(ruleSets).reduce(function (prev, cur) {
		return prev + ruleSets[cur].length
	}, 0)
}

/**
 * Writes the rules, semantics, entities, and deletables to a JSON file. This file is used in the instantiation of a `StateTable` (rules, semantics) and a `Parser` (entities, deletables).
 *
 * @param {string} outputFilePath The path to write the file.
 */
exports.writeGrammarToFile = function (outputFilePath) {
	util.writeJSONFile(outputFilePath, {
		startSymbol: exports.startSymbol.name,
		intSymbols: intSymbol.intSymbols,
		ruleSets: ruleSets,
		deletables: exports.deletables,
		semantics: semantic.semantics,
		entities: entityCategory.entities,
	})
}