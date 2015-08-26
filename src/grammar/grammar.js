var fs = require('fs')
var util = require('../util')


var symbol = require('./symbol')
exports.newSymbol = symbol.new
exports.newBinaryRule = symbol.newBinaryRule
exports.hyphenate = symbol.hyphenate
var grammar = symbol.grammar

exports.startSymbol = exports.newSymbol('start')

// Empty-string
// Rules with <empty> optionalize their LHS symbols and subsequent unary reductions
// Original rules with <empty> are omitted from output grammar
exports.emptySymbol = '<empty>'

// Integers in input
// Terminal rules with <int> are assigned minimum and maximum values
exports.intSymbol = '<int>'

// Extend Symbol with rule functions
require('./ruleFunctions')

// Extend module with semantic functions
var semantic = require('./semantic')
exports.newSemantic = semantic.new
exports.reduceSemantic = semantic.reduce

// Extend module with entity-category functions
var entityCategory = require('./entityCategory')
exports.newEntityCategory = entityCategory.new

// Check for unused nonterminal symbols, entity categories, or semantic functions and arguments not used in any rules
exports.checkForUnusedComponents = require('./checkForUnusedComponents').bind(null, grammar)

// Derive rules from insertion and transposition costs, and empty-strings
exports.createEditRules = require('./createEditRules').bind(null, grammar)

// Checks if `rule` lacks and cannot produce a RHS semantic needed by this rule or an ancestor
// Used by `createEditRules()`
exports.ruleMissingNeededRHSSemantic = require('./ruleMissingNeededRHSSemantic').bind(null, grammar)

// Check for instances of ambiguity in the grammar
exports.checkForAmbiguity = require('./checkForAmbiguity').bind(null, grammar)

/**
 * Sort nonterminal symbols alphabetically.
 * Sort symbols' rules by increasing cost.
 */
exports.sortGrammar = function () {
	Object.keys(grammar).sort().forEach(function (symbolName) {
		// Sort rules by increasing cost
		var rules = grammar[symbolName].sort(function (ruleA, ruleB) {
			return ruleA.cost - ruleB.cost
		})

		// Sort nonterminal symbols alphabetically
		delete grammar[symbolName]
		grammar[symbolName] = rules
	})
}

// Print the total count of rules in the grammar
// Print change if `prevOutputFilePath` exists
exports.printRuleCount = function (prevOutputFilePath) {
	var newRuleCount = exports.ruleCount(grammar)

	if (fs.existsSync(prevOutputFilePath)) {
		var oldRuleCount = exports.ruleCount(require(fs.realpathSync(prevOutputFilePath)).grammar)
		if (oldRuleCount !== newRuleCount) {
			console.log('Rules:', oldRuleCount, '->', newRuleCount)
			return
		}
	}

	console.log('Rules:', newRuleCount)
}

// Return number of rules in grammar
exports.ruleCount = function (grammar) {
	return Object.keys(grammar).reduce(function (prev, cur) {
		return prev + grammar[cur].length
	}, 0)
}

// Write grammar and semantics to files
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