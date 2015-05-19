var util = require('../util')

var grammar = {}

exports.Symbol = require('./Symbol').bind(null, grammar)

exports.startSymbol = new exports.Symbol('start')

// Empty-string
// Rules with <empty> optionalize their LHS symbols and subsequent unary reductions
// Original rules with <empty> are omitted from output grammar
exports.emptySymbol = '<empty>'

// Extend module with rule functions
require('./ruleFunctions')

// Extend module with semantic functions
var semantic = require('./semantic')
exports.newSemantic = semantic.newSemantic
exports.hyphenate = semantic.hyphenate
exports.insertSemantic = semantic.insertSemantic

// Derive rules from insertion and transposition costs, and empty-strings
exports.createEditRules = require('./createEditRules').bind(null, grammar)

// Sort nonterminal symbols alphabetically
exports.sortGrammar = function () {
	Object.keys(grammar).sort().forEach(function (symbol) {
		var rules = grammar[symbol]
		delete grammar[symbol]
		grammar[symbol] = rules
	})
}

// Print the total count of rules in the grammar
// Print change if 'oldGrammarPath' passed
exports.printRuleCount = function (oldGrammarPath) {
	var fs = require('fs')

	var newRuleCount = exports.ruleCount(grammar)

	if (fs.existsSync(oldGrammarPath)) {
		var oldRuleCount = exports.ruleCount(require(fs.realpathSync(oldGrammarPath)))
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
exports.writeGrammarToFile = function (grammarPath, semanticsPath) {
	util.writeJSONFile(grammarPath, grammar)
	util.writeJSONFile(semanticsPath, semantic.semantics)
}