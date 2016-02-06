var fs = require('fs')
var util = require('../util/util')
var grammarUtil = require('./grammarUtil')


var NSymbol = require('./NSymbol')
// Instantiates a new `NSymbol`, which adds a new nonterminal symbol to the grammar.
exports.newSymbol = NSymbol
// Instantiates a new `NSymbol` with a single binary nonterminal rule.
exports.newBinaryRule = NSymbol.newBinaryRule

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

var intSymbol = require('./intSymbol')
// Creates a unique terminal symbol that recognizes integers in input within the specified range.
exports.newIntSymbol = intSymbol.new

// Terms that can be deleted when found in input.
exports.deletables = []

// The start symbol of the grammar.
exports.startSymbol = exports.newSymbol('start')

// The terminal symbol for empty strings. Rules with `<empty>` optionalize their LHS symbols and subsequent unary reductions. Original unary rules with `<empty>` are omitted from `NSymbol._ruleSets` when output.
exports.emptySymbol = '<empty>'

// The terminal symbol used in the second branch of insertion rules only allowed at the end of input. The `Parser` inputs this symbol at the end of parsing the input query to only allow these insertions at the end of input.
exports.blankSymbol = '<blank>'

// Concatenates variadic string arguments with dashes. This is useful for hyphenating strings for options objects.
exports.hyphenate = require('./stringUtil').hyphenate

// Instantiates a new `Category`, which adds several base symbols and rules for a new database object category to the grammar.
exports.newCategory = require('./rules/Category')

// Converts the grammar's regex-style terminal symbols into rules that yield only uni-token terminal symbols. This is necessary to enable partial matches and deletions within what would otherwise be regex-style terminal symbols. Invoke this module before `createEditRules` because it adds `<empty>` rules to the grammar.
exports.splitRegexTerminalSymbols = require('./splitRegexTerminalSymbols').bind(null, NSymbol._ruleSets)

// Removes ill-formed and unused instances of nonterminal symbols, nonterminal rules, entity categories, integer symbols, and semantics from the grammar. Invoke this module before `createEditRules` to avoid creating edit-rules from these components.
exports.removeUnusedComponents = require('./removeUnusedComponents').bind(null, NSymbol._ruleSets)

// Creates grammar edit-rules derived from insertion and transposition costs, and empty strings in existing rules. Invoke this module and after invoking `removeIllFormedRulesAndSyms()` to remove ill-formed nonterminal rules and symbols.
exports.createEditRules = require('./createEditRules').bind(null, NSymbol._ruleSets)

// Removes the temporary rules and rule properties used for grammar generation from `ruleSets` to exclude them from the output grammar. Invoke this module at the conclusion of grammar generation.
exports.removeTempGrammarPropsAndRules = require('./removeTempGrammarPropsAndRules').bind(null, NSymbol._ruleSets)

/**
 * Sorts nonterminal symbols alphabetically and the symbols' rules by increasing cost.
 *
 * Sorts integer symbols by increasing minimum value and then by increasing maximum value.
 *
 * Sorts entity tokens alphabetically and the entities for each token alphabetically.
 *
 * Sorts deletables alphabetically.
 *
 * Invoke this method at the conclusion of grammar generation.
 *
 * @memberOf grammar
 */
exports.sortGrammar = function () {
	// Sort nonterminal symbols alphabetically and each symbols' rules by increasing cost.
	NSymbol.sortRules()

	// Sort integer symbols by increasing minimum value and then by increasing maximum value.
	intSymbol.sortIntSymbols()

	// Sorts entity tokens (the keys in the map `entityCategory._entitySets`) alphabetically and the entities for each token alphabetically.
	entityCategory.sortEntities()

	// Sort deletables alphabetically.
	exports.deletables.sort()
}

/**
 * Prints the number of rules and entities in the grammar. If `prevOutputFilePath` is provided, prints the differences, if any, since the last grammar generation.
 *
 * @memberOf grammar
 * @param {string} [prevOutputFilePath] The path of the previously generated grammar to compare.
 */
exports.printStats = function (prevOutputFilePath) {
	var newRuleCount = grammarUtil.getRuleCount(NSymbol._ruleSets)
	var newEntityCount = grammarUtil.getEntityCount(entityCategory._entitySets)

	// Check if previous output grammar file exists.
	if (fs.accessSync(prevOutputFilePath)) {
		var oldGrammar = require(util.realpathSync(prevOutputFilePath))

		var oldRuleCount = grammarUtil.getRuleCount(oldGrammar.ruleSets)
		if (oldRuleCount !== newRuleCount) {
			util.log('Rules:', oldRuleCount, '->', newRuleCount)
		} else {
			util.log('Rules:', newRuleCount)
		}

		var oldEntityCount = grammarUtil.getEntityCount(oldGrammar.entitySets)
		if (oldEntityCount !== newEntityCount) {
			util.log('Entities:', oldEntityCount, '->', newEntityCount)
		} else {
			util.log('Entities:', oldEntityCount)
		}
	} else {
		util.log('Rules:', newRuleCount)
		util.log('Entities:', newEntityCount)
	}
}

/**
 * Gets the grammar's rules, semantics, entities, and deletables, returned as a single `Object`.
 *
 * @memberOf grammar
 * @returns {Object} Returns the grammar.
 */
exports.getGrammar = function () {
	return {
		ruleSets: NSymbol._ruleSets,
		semantics: semantic._semantics,
		entitySets: entityCategory._entitySets,
		intSymbols: intSymbol._intSymbols,
		deletables: exports.deletables,
		startSymbol: exports.startSymbol.name,
		blankSymbol: exports.blankSymbol,
	}
}

/**
 * Writes the grammar's rules, semantics, entities, and deletables to a JSON file. This file is used in the instantiation of a `StateTable` (rules, semantics) and a `Parser` (entities, deletables).
 *
 * @memberOf grammar
 * @param {string} outputFilePath The path to write the file.
 */
exports.writeGrammarToFile = function (outputFilePath) {
	util.writeJSONFile(outputFilePath, exports.getGrammar())
}