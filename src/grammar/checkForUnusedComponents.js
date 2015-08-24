var util = require('../util')
var startSymbol = require('./grammar').startSymbol
var symbolCreationLines = require('./symbol').creationLines
var entityCategoryCreationLines = require('./entityCategory').creationLines
var semantic = require('./semantic')


// Check for unused nonterminal symbols, entity categories, or semantic functions and arguments not used in any rules
module.exports = function (grammar) {
	// Check for nonterminal symbols not used in any rules
	Object.keys(symbolCreationLines).forEach(function (symbolName) {
		if (symbolName === startSymbol.name) return

		for (var otherSymbol in grammar) {
			if (otherSymbol !== symbolName) {
				var rules = grammar[otherSymbol]
				for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
					if (rules[r].RHS.indexOf(symbolName) !== -1) return
				}
			}
		}

		util.printWarning('Unused symbol:', symbolName)
		console.log('  ' + symbolCreationLines[symbolName])
	})

	// Check for entity categories not used in any rules
	Object.keys(entityCategoryCreationLines).forEach(function (categorySymbolName) {
		for (var otherSymbol in grammar) {
			var rules = grammar[otherSymbol]
			for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
				if (rules[r].RHS.indexOf(categorySymbolName) !== -1) return
			}
		}

		util.printWarning('Unused entity category:', categorySymbolName)
		console.log('  ' + entityCategoryCreationLines[categorySymbolName])
	})

	// Check for semantic functions and arguments not used in any rules
	Object.keys(semantic.creationLines).forEach(function (semanticName) {
		var thisSemantic = semantic.semantics[semanticName]

		for (var sym in grammar) {
			var rules = grammar[sym]
			for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
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

		util.printWarning('Unused semantic:', semanticName)
		console.log('  ' + semantic.creationLines[semanticName])
	})
}