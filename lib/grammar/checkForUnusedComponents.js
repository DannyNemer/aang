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


	// Check for nonterminal symbols that do not reach the start symbol (i.e., are unused).
	var symbolCreationLines = require('./symbol').creationLines
	var startSymbol = require('./grammar').startSymbol.name

	for (var nontermSym in ruleSets) {
		if (nontermSym === startSymbol) continue

		if (!reachesSymbol(ruleSets, startSymbol, nontermSym)) {
			util.logWarning('Unused symbol:', util.stylize(nontermSym))
			util.log('  ' + symbolCreationLines[nontermSym])

			delete ruleSets[nontermSym]
		}
	}


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

/**
 * Recursively checks if `symbol` reaches (i.e., can be produced by) `lhsSymbol`, such as the start symbol.
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} lhsSymbol The parent symbol to check if it can produce `symbol`.
 * @param {string} symbol The symbol to check.
 * @returns {Boolean} Returns `true` if `symbol` reaches `lhsSymbol`, else `false`.
 */
function reachesSymbol(ruleSets, lhsSymbol, symbol, __symsSeen) {
	__symsSeen = __symsSeen || []
	__symsSeen.push(lhsSymbol)

	var rules = ruleSets[lhsSymbol]
	var rulesLen = rules.length

	// Check if `lhsSymbol` produces a rule with `symbol` as a RHS symbol.
	for (var r = 0; r < rulesLen; ++r) {
		var rule = rules[r]

		if (rule.RHS.indexOf(symbol) !== -1) {
			return true
		}
	}

	// Recursively check if the RHS symbols of `lhsSymbol`'s rules produce a rule with `symbol` as a RHS symbol.
	for (var r = 0; r < rulesLen; ++r) {
		var rule = rules[r]

		if (!rule.isTerminal)  {
			var rhs = rule.RHS
			var rhsLen = rhs.length

			for (var s = 0; s < rhsLen; ++s) {
				var rhsSym = rhs[s]
				if (__symsSeen.indexOf(rhsSym) === -1 && reachesSymbol(ruleSets, rhsSym, symbol, __symsSeen)) {
					return true
				}
			}
		}
	}

	return false
}