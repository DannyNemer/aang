var fs = require('fs')
var util = require('../util/util')


var symbol = require('./symbol')
// Creates a new `Symbol`.
exports.newSymbol = symbol.new
// Creates a new `Symbol` with a single binary nonterminal rule.
exports.newBinaryRule = symbol.newBinaryRule
// The map of the grammar's nonterminal symbols to rules.
var ruleSets = symbol.ruleSets

var semantic = require('./semantic')
// Creates a new semantic function or argument.
exports.newSemantic = semantic.new
// Applies a completed semantic rule to a more recent semantic tree, joining them together as one semantic tree with a new root function.
exports.reduceSemantic = semantic.reduce
// Merges two reduced (reduced) semantic arrays into a single array, if the merge is semantically legal. Else, returns `-1`.
exports.mergeRHSSemantics = semantic.mergeRHS

var entityCategory = require('./entityCategory')
// Creates a new entity category containing the passed entities.
exports.newEntityCategory = entityCategory.new
// The map of entity tokens to entities.
var entitySets = entityCategory.entitySets

var intSymbol = require('./intSymbol')
// Creates a unique terminal symbol that recognizes integers in input within the specified range.
exports.newIntSymbol = intSymbol.new

// Terms that can be deleted when found in input.
exports.deletables = []

// The start symbol of the grammar.
exports.startSymbol = exports.newSymbol('start')

// The terminal symbol for empty strings. Rules with `<empty>` optionalize their LHS symbols and subsequent unary reductions. Original unary rules with `<empty>` are omitted from `ruleSets` when output.
exports.emptySymbol = '<empty>'

// The terminal symbol used in the second branch of insertion rules only allowed at the end of input. The `Parser` inputs this symbol at the end of parsing the input query to only allow these insertions at the end of input.
exports.blankSymbol = '<blank>'

// Concatenates variadic string arguments with dashes. This is useful for hyphenating strings for options objects.
exports.hyphenate = require('./stringUtil').hyphenate

// Splits the grammar's regex-style terminal symbols into rules that yield only uni-token terminal symbols.
exports.splitRegexTerminalSymbols = require('./splitRegexTerminalSymbols').bind(null, ruleSets)

// Creates grammar rules derived from insertion and transposition costs, and empty strings in `ruleSets`.
exports.createEditRules = require('./createEditRules').bind(null, ruleSets)

// Checks if a rule lacks and cannot produce a RHS semantic needed by itself or an ancestor rule in `ruleSets`.
exports.ruleMissingRHSSemantic = require('./ruleMissingRHSSemantic').bind(null, ruleSets)

// Removes instances of nonterminal symbols, entity categories, integer symbols, or semantics not used by any grammar rule.
exports.removeUnusedComponents = require('./removeUnusedComponents').bind(null, ruleSets)

/**
 * Sorts nonterminal symbols alphabetically and the symbols' rules by increasing cost.
 *
 * Sorts integer symbols by increasing minimum value and then by increasing maximum value.
 *
 * Sorts entity tokens alphabetically and the entities for each token alphabetically.
 *
 * Sorts deletables alphabetically.
 */
exports.sortGrammar = function () {
	// Sort nonterminal symbols alphabetically and each symbols' rules by increasing cost.
	symbol.sortRules()

	// Sort integer symbols by increasing minimum value and then by increasing maximum value.
	intSymbol.sortIntSymbols()

	// Sorts entity tokens (the keys in the map `entitySets`) alphabetically and the entities for each token alphabetically.
	entityCategory.sortEntities()

	// Sort deletables alphabetically.
	exports.deletables.sort()
}

/**
 * Prints the number of rules in the grammar. If `prevOutputFilePath` is provided, prints the difference in the number of rules, if any, since the last grammar generation.
 *
 * @param {string} [prevOutputFilePath] The optional path of the previously generated grammar to compare with this grammar.
 */
exports.printRuleCount = function (prevOutputFilePath) {
	var newRuleCount = exports.getRuleCount(ruleSets)

	if (fs.existsSync(prevOutputFilePath)) {
		var oldRuleCount = exports.getRuleCount(require(util.realpathSync(prevOutputFilePath)).ruleSets)
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
 * Gets the grammar's rules, semantics, entities, and deletables, returned as a single `Object`.
 *
 * @returns {Object} Returns the grammar.
 */
exports.getGrammar = function () {
	return {
		ruleSets: ruleSets,
		semantics: semantic.semantics,
		entitySets: entitySets,
		intSymbols: intSymbol.intSymbols,
		deletables: exports.deletables,
		startSymbol: exports.startSymbol.name,
		blankSymbol: exports.blankSymbol,
	}
}

/**
 * Writes the grammar's rules, semantics, entities, and deletables to a JSON file. This file is used in the instantiation of a `StateTable` (rules, semantics) and a `Parser` (entities, deletables).
 *
 * @param {string} outputFilePath The path to write the file.
 */
exports.writeGrammarToFile = function (outputFilePath) {
	util.writeJSONFile(outputFilePath, exports.getGrammar())
}