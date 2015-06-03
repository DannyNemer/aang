var util = require('../util')

// A mapping of symbols to productions
exports.grammar = {}
// A mapping of symbol names to creation lines; used for error reporting
exports.creationLines = {}

exports.Symbol = require('./Symbol')

exports.startSymbol = new exports.Symbol('start')

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
exports.createEditRules = require('./createEditRules')

// Check for nonterminal symbols and entity categories that are not used in any production
exports.checkForUnusedSymbols = function () {
	// Merge entityCategory creation lines with nonterminal symbols for error checking
	for (var entityCategoryName in entityCategory.creationLines) {
		exports.creationLines[entityCategoryName] = entityCategory.creationLines[entityCategoryName]
	}

	Object.keys(exports.creationLines).forEach(function (symbol) {
		if (symbol === exports.startSymbol.name) return

		for (var otherSymbol in exports.grammar) {
			if (otherSymbol !== symbol) {
				var rules = exports.grammar[otherSymbol]
				for (var r = rules.length; r-- > 0;) {
					var rule = rules[r]
					if (rule.RHS.indexOf(symbol) !== -1) return
				}
			}
		}

		util.printErr('Unused symbol', symbol)
		console.log(exports.creationLines[symbol])
		throw 'unused symbol'
	})
}

// Check for semantic functions and arguments that are not used in any production
exports.checkForUnusedSemantics = function () {
	Object.keys(semantic.semantics).forEach(function (semanticName) {
		var thisSemantic = semantic.semantics[semanticName]

		for (var sym in exports.grammar) {
			var rules = exports.grammar[sym]
			for (var r = rules.length; r-- > 0;) {
				var rule = rules[r]
				if (rule.semantic) {
					// Initialize stack with rule.semantic, an array (possible of multiple semantic nodes)
					var semanticStack = rule.semantic.slice()
					while (semanticStack.length) {
						var semanticNode = semanticStack.pop()
						if (semanticNode.semantic === thisSemantic) return
						if (semanticNode.children) {
							Array.prototype.push.apply(semanticStack, semanticNode.children)
						}
					}
				}
			}
		}

		util.printErr('Unused semantic', semanticName)
		console.log(semantic.creationLines[semanticName])
		throw 'unused semantic'
	})
}

// Sort nonterminal symbols alphabetically
exports.sortGrammar = function () {
	Object.keys(exports.grammar).sort().forEach(function (symbol) {
		var rules = exports.grammar[symbol]
		delete exports.grammar[symbol]
		exports.grammar[symbol] = rules
	})
}

// Print the total count of rules in the grammar
// Print change if 'oldGrammarPath' passed
exports.printRuleCount = function (outputFilePath) {
	var fs = require('fs')

	var newRuleCount = exports.ruleCount(exports.grammar)

	if (fs.existsSync(outputFilePath)) {
		var oldRuleCount = exports.ruleCount(require(fs.realpathSync(outputFilePath)).grammar)
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
		grammar: exports.grammar,
		semantics: semantic.semantics,
		entities: entityCategory.entities
	})
}