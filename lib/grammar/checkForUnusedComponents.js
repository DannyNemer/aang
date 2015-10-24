var util = require('../util/util')

/**
 * Finds and prints instances of nonterminal symbols, entity categories, integer symbols, or semantic functions and arguments not used in any rules of `ruleSets`. Removes unused nonterminal symbols from grammar.
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
module.exports = function (ruleSets) {
	// Check for unused entity categories.
	var entityCategoryCreationLines = require('./entityCategory').creationLines

	Object.keys(entityCategoryCreationLines).forEach(function (categorySymbol) {
		for (var otherSymbol in ruleSets) {
			var rules = ruleSets[otherSymbol]
			for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
				if (rules[r].RHS.indexOf(categorySymbol) !== -1) return
			}
		}

		util.logWarning('Unused entity category:', util.stylize(categorySymbol))
		util.log('  ' + entityCategoryCreationLines[categorySymbol])
		delete ruleSets[categorySymbol]
	})


	// Check for unused integer symbols.
	var intSymbolsCreationLines = require('./intSymbol').creationLines

	Object.keys(intSymbolsCreationLines).forEach(function (integerSymbol) {
		for (var sym in ruleSets) {
			var rules = ruleSets[sym]
			for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
				if (rules[r].RHS.indexOf(integerSymbol) !== -1) return
			}
		}

		util.logWarning('Unused integer symbol:', util.stylize(integerSymbol))
		util.log('  ' + intSymbolsCreationLines[integerSymbol])
	})


	// Check for unused nonterminal symbols.
	var symbolCreationLines = require('./symbol').creationLines
	var startSymbol = require('./grammar').startSymbol

	// Iterate until no longer finding unused nonterminal symbols. I.e., delete a symbol on the first iteration, then delete any symbols it produced that now appear unused on the second iteration.
	do {
		var deletedSymbol = false

		Object.keys(symbolCreationLines).forEach(function (symbol) {
			if (symbol === startSymbol.name) return

			for (var otherSymbol in ruleSets) {
				if (otherSymbol !== symbol) {
					var rules = ruleSets[otherSymbol]
					for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
						if (rules[r].RHS.indexOf(symbol) !== -1) return
					}
				}
			}

			util.logWarning('Unused symbol:', util.stylize(symbol))
			util.log('  ' + symbolCreationLines[symbol])
			delete ruleSets[symbol]
			delete symbolCreationLines[symbol]
			deletedSymbol = true
		})
	} while (deletedSymbol)


	// Check for unused semantic functions and arguments.
	var semantic = require('./semantic')

	Object.keys(semantic.creationLines).forEach(function (semanticName) {
		var thisSemantic = semantic.semantics[semanticName]

		for (var sym in ruleSets) {
			var rules = ruleSets[sym]

			for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
				var rule = rules[r]

				if (rule.semantic) {
					// Initialize stack with rule.semantic, an array (possible of multiple semantic nodes).
					var semanticStack = rule.semantic.slice()

					while (semanticStack.length) {
						var semanticNode = semanticStack.pop()

						if (semanticNode.semantic === thisSemantic) {
							return
						}

						if (semanticNode.children) {
							Array.prototype.push.apply(semanticStack, semanticNode.children)
						}
					}
				}
			}
		}

		util.logWarning('Unused semantic:', util.stylize(semanticName))
		util.log('  ' + semantic.creationLines[semanticName])
	})
}