var util = require('../util')

var symbol = require('./Symbol')
exports.newSymbol = symbol.newSymbol
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
exports.newSemantic = semantic.newSemantic
exports.hyphenate = semantic.hyphenate
exports.insertSemantic = semantic.insertSemantic

// Extend module with entity-category functions
var entityCategory = require('./entityCategory')
exports.newEntityCategory = entityCategory.newEntityCategory

// Derive rules from insertion and transposition costs, and empty-strings
exports.createEditRules = require('./createEditRules').bind(null, grammar)

// Check for nonterminal symbols and entity categories that are not used in any productions
exports.checkForUnusedSymbols = function () {
	var symbolLines = symbol.creationLines
	for (var entityCategoryName in entityCategory.entityCategoryLines) {
		symbolLines[entityCategoryName] = entityCategory.entityCategoryLines[entityCategoryName]
	}

	Object.keys(symbolLines).forEach(function (symbol) {
		if (symbol === exports.startSymbol.name) return

		for (var otherSymbol in grammar) {
			if (otherSymbol !== symbol) {
				var rules = grammar[otherSymbol]
				for (var r = rules.length; r-- > 0;) {
					var rule = rules[r]
					if (rule.RHS.indexOf(symbol) !== -1) return
				}
			}
		}

		util.printErr('Unused symbol', symbol)
		console.log(symbolLines[symbol])
		throw 'unused symbol'
	})
}

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
exports.printRuleCount = function (outputPath) {
	var fs = require('fs')
	var oldGrammarPath = outputPath + 'grammar.json'

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
exports.writeGrammarToFile = function (outputPath) {
	util.writeJSONFile(outputPath + 'grammar.json', grammar)
	util.writeJSONFile(outputPath + 'semantics.json', semantic.semantics)
	util.writeJSONFile(outputPath + 'entities.json', entityCategory.entities)
}