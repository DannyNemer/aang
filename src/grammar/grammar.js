var util = require('../util')


var symbol = require('./symbol')
exports.newSymbol = symbol.new
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
exports.createEditRules = require('./createEditRules')

// Check for nonterminal symbols that are not used in any production
exports.checkForUnusedSymbols = function () {
	Object.keys(symbol.creationLines).forEach(function (symbolName) {
		if (symbolName === exports.startSymbol.name) return

		for (var otherSymbol in grammar) {
			if (otherSymbol !== symbolName) {
				var rules = grammar[otherSymbol]
				for (var r = rules.length; r-- > 0;) {
					var rule = rules[r]
					if (rule.RHS.indexOf(symbolName) !== -1) return
				}
			}
		}

		util.printErr('Unused symbol', symbolName)
		console.log(symbol.creationLines[symbolName])
		throw 'unused symbol'
	})
}

// Check for entity categories that are not used in any production
exports.checkForUnusedEntityCategories = function () {
	Object.keys(entityCategory.creationLines).forEach(function (categorySymbolName) {
		for (var otherSymbol in grammar) {
			var rules = grammar[otherSymbol]
			for (var r = rules.length; r-- > 0;) {
				var rule = rules[r]
				if (rule.RHS.indexOf(categorySymbolName) !== -1) return
			}
		}

		util.printErr('Unused entity category', categorySymbolName)
		console.log(entityCategory.creationLines[categorySymbolName])
		throw 'unused entity category'
	})
}

// Check for semantic functions and arguments that are not used in any production
exports.checkForUnusedSemantics = function () {
	Object.keys(semantic.semantics).forEach(function (semanticName) {
		var thisSemantic = semantic.semantics[semanticName]

		for (var sym in grammar) {
			var rules = grammar[sym]
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
	Object.keys(grammar).sort().forEach(function (symbolName) {
		var rules = grammar[symbolName]
		delete grammar[symbolName]
		grammar[symbolName] = rules
	})
}

// Print the total count of rules in the grammar
// Print change if 'oldGrammarPath' passed
exports.printRuleCount = function (outputFilePath) {
	var fs = require('fs')

	var newRuleCount = exports.ruleCount(grammar)

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
		grammar: grammar,
		semantics: semantic.semantics,
		entities: entityCategory.entities
	})
}