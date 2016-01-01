var util = require('../util/util')

/**
 * Finds and prints instances of nonterminal symbols, entity categories, integer symbols, or semantic functions and arguments not used in any rules of `ruleSets`. Removes unused nonterminal symbols from grammar.
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {boolean} [supressWarnings] Specify suppressing warnings from output.
 */
module.exports = function (ruleSets, supressWarnings) {
	var nontermSyms = Object.keys(ruleSets)

	// Check for unused entity categories.
	var entityCategory = require('./entityCategory')
	var entitySets = entityCategory.entitySets

	for (var entityCatSymbol in entityCategory.creationLines) {
		// Check if a rule produces the entity category symbol.
		if (!symbolIsUsed(nontermSyms, ruleSets, entityCatSymbol)) {
			if (!supressWarnings) {
				util.logWarning('Unused entity category:', util.stylize(entityCatSymbol))
				util.log('  ' + entityCategory.creationLines[entityCatSymbol])
			}

			// Delete every entity in the unused entity category.
			for (var entToken in entitySets) {
				var entities = entitySets[entToken]

				for (var e = 0, entitiesLen = entities.length; e < entitiesLen; ++e) {
					var entity = entities[e]
					if (entity.category === entityCatSymbol) {
						entities.splice(e, 1)
						--e
						--entitiesLen
					}
				}

				if (entitiesLen === 0) {
					delete entitySets[entToken]
				}
			}
		}
	}


	// Check for unused integer symbols.
	var intSymbol = require('./intSymbol')
	var intSymbols = intSymbol.intSymbols

	for (var i = 0, intSymbolsLen = intSymbols.length; i < intSymbolsLen; ++i) {
		var integerSymbol = intSymbols[i].name

		// Check if a rule produces the entity category symbol.
		if (!symbolIsUsed(nontermSyms, ruleSets, integerSymbol)) {
			if (!supressWarnings) {
				util.logWarning('Unused integer symbol:', util.stylize(integerSymbol))
				util.log('  ' + intSymbol.creationLines[integerSymbol])
			}

			// Delete the unused integer symbol.
			intSymbols.splice(i, 1)
			--i
			--intSymbolsLen
		}
	}

	// Check for unused semantic functions and arguments.
	var semantic = require('./semantic')
	var semantics = semantic.semantics

	for (var semanticName in semantics) {
		var thisSemantic = semantics[semanticName]

		if (!semanticIsUsed(nontermSyms, ruleSets, thisSemantic)) {
			if (!supressWarnings) {
				util.logWarning('Unused semantic:', util.stylize(semanticName + (thisSemantic.isArg ? '' : '()')))
				util.log('  ' + semantic.creationLines[semanticName])
			}

			// Delete the unused semantic.
			delete semantics[semanticName]
		}
	}


	// Check for nonterminal symbols that do not reach the start symbol (i.e., are unused).
	var symbol = require('./symbol')
	var startSymbol = require('./grammar').startSymbol.name

	for (var s = 0, nontermSymsLen = nontermSyms.length; s < nontermSymsLen; ++s) {
		var nontermSym = nontermSyms[s]
		if (nontermSym === startSymbol) continue

		if (!reachesSymbol(ruleSets, startSymbol, nontermSym)) {
			if (!supressWarnings) {
				util.logWarning('Unused symbol:', util.stylize(nontermSym))
				util.log('  ' + symbol.creationLines[nontermSym])
			}

			// Delete the unused nonterminal symbol. Do not bother removing from `nontermSyms` because the collection is not used elsewhere (only before this check).
			delete ruleSets[nontermSym]
		}
	}
}

/**
 * Checks if a rule in `ruleSets` produces `symbol` (as a `rhs` symbol).
 *
 * @param {string[]} nontermSyms The nonterminal symbols in the grammar; i.e., the keys for `ruleSets`.
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {[type]} symbol The symbol to find.
 * @returns {boolean} Returns `true` if any rule produces `symbol`, else `false`.
 */
function symbolIsUsed(nontermSyms, ruleSets, symbol) {
	return someRule(nontermSyms, ruleSets, function (rule) {
		return rule.rhs.indexOf(symbol) !== -1
	})
}

/**
 * Checks if a rule in `ruleSets` uses `semantic`.
 *
 * @param {string[]} nontermSyms The nonterminal symbols in the grammar; i.e., the keys for `ruleSets`.
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {[type]} semantic The semantic to find.
 * @returns {boolean} Returns `true` if any rule uses `semantic`, else `false`.
 */
function semanticIsUsed(nontermSyms, ruleSets, semantic) {
	return someRule(nontermSyms, ruleSets, function (rule) {
		if (rule.semantic) {
			// Initialize stack with `rule.semantic`, an array of semantic nodes.
			var semanticStack = rule.semantic.slice()

			while (semanticStack.length > 0) {
				var semanticNode = semanticStack.pop()

				if (semanticNode.semantic === semantic) {
					return true
				}

				if (semanticNode.children) {
					Array.prototype.push.apply(semanticStack, semanticNode.children)
				}
			}
		}

		return false
	})
}

/**
 * Checks if `predicate` returns truthy for any rule in `ruleSets`. The function returns as soon as it finds a passing rule and does not iterate over the entire collection. Invokes the predicate with one argument: (rule).
 *
 * @param {string[]} nontermSyms The nonterminal symbols in the grammar; i.e., the keys for `ruleSets`.
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if any rule passes the predicate check, else `false`.
 */
function someRule(nontermSyms, ruleSets, predicate) {
	for (var s = 0, nontermSymsLen = nontermSyms.length; s < nontermSymsLen; ++s) {
		var rules = ruleSets[nontermSyms[s]]

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			if (predicate(rules[r])) return true
		}
	}

	return false
}

/**
 * Recursively checks if `symbol` reaches (i.e., can be produced by) `lhsSymbol`, such as the start symbol.
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} lhsSymbol The parent symbol to check if it can produce `symbol`.
 * @param {string} symbol The symbol to check.
 * @returns {boolean} Returns `true` if `symbol` reaches `lhsSymbol`, else `false`.
 */
function reachesSymbol(ruleSets, lhsSymbol, symbol, __symsSeen) {
	__symsSeen = __symsSeen || []
	__symsSeen.push(lhsSymbol)

	var rules = ruleSets[lhsSymbol]
	var rulesLen = rules.length

	// Check if `lhsSymbol` produces a rule with `symbol` as a RHS symbol.
	for (var r = 0; r < rulesLen; ++r) {
		var rule = rules[r]

		if (rule.rhs.indexOf(symbol) !== -1) {
			return true
		}
	}

	// Recursively check if the RHS symbols of `lhsSymbol`'s rules produce a rule with `symbol` as a RHS symbol.
	for (var r = 0; r < rulesLen; ++r) {
		var rule = rules[r]

		if (!rule.isTerminal) {
			var rhs = rule.rhs
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