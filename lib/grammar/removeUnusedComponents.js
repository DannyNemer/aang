var util = require('../util/util')


/**
 * Removes instances of nonterminal symbols, entity categories, integer symbols, or semantics not used by any grammar rule.
 *
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {boolean} [supressWarnings] Specify suppressing warnings from output.
 */
module.exports = function (ruleSets, supressWarnings) {
	var nontermSyms = Object.keys(ruleSets)
	someRule = someRule.bind(null, nontermSyms, ruleSets)

	// Check for unused entity categories.
	removeUnusedEntityCategories(supressWarnings)

	// Check for unused integer symbols.
	removeUnusedIntegerSymbols(supressWarnings)

	// Check for unused semantic functions and arguments.
	removeUnusedSemantics(supressWarnings)

	// Check for nonterminal symbols that do not reach the start symbol (i.e., are unused).
	removeUnusedNonterminalSymbols(ruleSets, nontermSyms, supressWarnings)
}

/**
 * Removes entity categories not used by any grammar rule.
 *
 * @private
 * @static
 * @param {boolean} [supressWarnings] Specify suppressing warnings from output.
 */
function removeUnusedEntityCategories(supressWarnings) {
	var entityCategory = require('./entityCategory')
	var entitySets = entityCategory._entitySets

	for (var entityCatSymbol in entityCategory._creationLines) {
		// Check if a rule produces the entity category symbol.
		if (!symbolIsUsed(entityCatSymbol)) {
			if (!supressWarnings) {
				util.logWarning('Unused entity category:', util.stylize(entityCatSymbol))
				util.log('  ' + entityCategory._creationLines[entityCatSymbol])
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
}

/**
 * Removes integer symbols not used by any grammar rule.
 *
 * @private
 * @static
 * @param {boolean} [supressWarnings] Specify suppressing warnings from output.
 */
function removeUnusedIntegerSymbols(supressWarnings) {
	var intSymbol = require('./intSymbol')
	var intSymbols = intSymbol._intSymbols

	for (var i = 0, intSymbolsLen = intSymbols.length; i < intSymbolsLen; ++i) {
		var integerSymbol = intSymbols[i].name

		// Check if a rule produces the integer symbol.
		if (!symbolIsUsed(integerSymbol)) {
			if (!supressWarnings) {
				util.logWarning('Unused integer symbol:', util.stylize(integerSymbol))
				util.log('  ' + intSymbol._creationLines[integerSymbol])
			}

			// Delete the unused integer symbol.
			intSymbols.splice(i, 1)
			--i
			--intSymbolsLen
		}
	}
}

/**
 * Removes semantics not used by any grammar rule.
 *
 * @private
 * @static
 * @param {boolean} [supressWarnings] Specify suppressing warnings from output.
 */
function removeUnusedSemantics(supressWarnings) {
	var semantic = require('./semantic')
	var semantics = semantic._semantics

	for (var semanticName in semantics) {
		var thisSemantic = semantics[semanticName]

		if (!semanticIsUsed(thisSemantic)) {
			if (!supressWarnings) {
				util.logWarning('Unused semantic:', util.stylize(semanticName + (thisSemantic.isArg ? '' : '()')))
				util.log('  ' + semantic._creationLines[semanticName])
			}

			// Delete the unused semantic.
			delete semantics[semanticName]
		}
	}
}

/**
 * Checks if a rule in the grammar uses `semantic`.
 *
 * @private
 * @static
 * @param {Object[]} semantic The semantic to find.
 * @returns {boolean} Returns `true` if any rule uses `semantic`, else `false`.
 */
function semanticIsUsed(semantic) {
	return someRule(function (rule) {
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
 * Removes nonterminal symbols that do not reach the start symbol (i.e., are unused).
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string[]} nontermSyms The nonterminal symbols in the grammar; i.e., the keys for `ruleSets`.
 * @param {boolean} [supressWarnings] Specify suppressing warnings from output.
 */
function removeUnusedNonterminalSymbols(ruleSets, nontermSyms, supressWarnings) {
	var NSymbol = require('./NSymbol')
	var startSymbol = require('./grammar').startSymbol.name

	for (var s = 0, nontermSymsLen = nontermSyms.length; s < nontermSymsLen; ++s) {
		var nontermSym = nontermSyms[s]
		if (nontermSym === startSymbol) continue

		if (!reachesSymbol(ruleSets, startSymbol, nontermSym)) {
			if (!supressWarnings) {
				util.logWarning('Unused symbol:', util.stylize(nontermSym))
				util.log('  ' + NSymbol._creationLines[nontermSym])
			}

			// Delete the unused nonterminal symbol. Do not bother removing from `nontermSyms` because the collection is not used elsewhere (only before this check).
			delete ruleSets[nontermSym]
		}
	}
}

/**
 * Recursively checks if `symbol` reaches (i.e., can be produced by) `lhsSymbol`, such as the start symbol.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} lhsSymbol The nonterminal symbol to check if it can produce `symbol`.
 * @param {string} symbol The symbol to check.
 * @returns {boolean} Returns `true` if `symbol` reaches `lhsSymbol`, else `false`.
 */
function reachesSymbol(ruleSets, lhsSymbol, symbol, _symsSeen) {
	// Track visited symbols to prevent infinite recursion.
	if (!_symsSeen) {
		_symsSeen = [ lhsSymbol ]
	} else if (_symsSeen.indexOf(lhsSymbol) === -1) {
		_symsSeen.push(lhsSymbol)
	} else {
		return false
	}

	var rules = ruleSets[lhsSymbol]
	var rulesLen = rules.length

	// Check if `lhsSymbol` produces a rule with `symbol` as a RHS symbol.
	for (var r = 0; r < rulesLen; ++r) {
		if (rules[r].rhs.indexOf(symbol) !== -1) {
			return true
		}
	}

	// Recursively check if the RHS symbols of `lhsSymbol`'s rules produce a rule with `symbol` as a RHS symbol.
	for (var r = 0; r < rulesLen; ++r) {
		var rule = rules[r]

		if (!rule.isTerminal) {
			var rhs = rule.rhs

			for (var s = 0, rhsLen = rhs.length; s < rhsLen; ++s) {
				if (reachesSymbol(ruleSets, rhs[s], symbol, _symsSeen)) {
					return true
				}
			}
		}
	}

	return false
}

/**
 * Checks if a rule in the grammar produces `symbol` (as a `rhs` symbol).
 *
 * @private
 * @static
 * @param {Object} symbol The symbol to find.
 * @returns {boolean} Returns `true` if any rule produces `symbol`, else `false`.
 */
function symbolIsUsed(symbol) {
	return someRule(function (rule) {
		return rule.rhs.indexOf(symbol) !== -1
	})
}

/**
 * Checks if `predicate` returns truthy for any rule in `ruleSets`. The function returns as soon as it finds a passing rule and does not iterate over the entire collection. Invokes the predicate with one argument: (rule).
 *
 * @private
 * @static
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