var util = require('../util/util')
var removeIllFormedRulesAndSyms = require('./removeIllFormedRulesAndSyms')


/**
 * Removes ill-formed and unused instances of nonterminal symbols, nonterminal rules, entity categories, integer symbols, and semantics from the grammar.
 *
 * Invoke this module before `createEditRules` to avoid creating edit-rules from these components.
 *
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {boolean} [suppressWarnings] Specify suppressing warnings from output.
 * @returns {boolean} Returns `true` if removed any (unused) components from the grammar, else `false`.
 */
module.exports = function (ruleSets, suppressWarnings) {
	// Remove nonterminal symbols without rules, rules whose RHS symbols include those symbols, rules that lack and can not produce a reduced semantic required for themselves or ancestor rules, and any rule-less or unreachable (via the start symbol) nonterminal symbols that result. Invoke this module before removing any other components, because its removal of rules can render other grammar components unused.
	var componentRemoved = removeIllFormedRulesAndSyms(ruleSets, suppressWarnings)

	// Cache `ruleSets` keys for faster iterations.
	var nontermSyms = Object.keys(ruleSets)

	// Remove unused entity categories.
	componentRemoved = removeUnusedEntityCategories(ruleSets, nontermSyms, suppressWarnings) || componentRemoved

	// Remove unused integer symbols.
	componentRemoved = removeUnusedIntegerSymbols(ruleSets, nontermSyms, suppressWarnings) || componentRemoved

	// Remove unused semantic functions and arguments.
	componentRemoved = removeUnusedSemantics(ruleSets, nontermSyms, suppressWarnings) || componentRemoved

	return componentRemoved
}

/**
 * Removes entity categories not used by any rule in `ruleSets`.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules to iterate over.
 * @param {string[]} nontermSyms The nonterminal symbols in the grammar; i.e., the keys for `ruleSets`.
 * @param {boolean} [suppressWarnings] Specify suppressing warnings from output.
 * @returns {boolean} Returns `true` if removed any entity categories, else `false`.
 */
function removeUnusedEntityCategories(ruleSets, nontermSyms, suppressWarnings) {
	var entityCategory = require('./entityCategory')
	var entityCategories = entityCategory.categoryNames
	var entitySets = entityCategory._entitySets
	var entityCategoryRemoved = false

	for (var c = 0, entityCategoriesLen = entityCategories.length; c < entityCategoriesLen; ++c) {
		var entityCatSymbol = entityCategories[c]

		// Check if a rule in `ruleSets` uses `entityCatSymbol`.
		if (!symbolIsUsed(ruleSets, nontermSyms, entityCatSymbol)) {
			if (!suppressWarnings) {
				util.logWarning('Unused entity category:', util.stylize(entityCatSymbol))
				util.log('  ' + entityCategory._creationLines[entityCatSymbol])
			}

			// Remove every entity in the unused entity category.
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

			// Remove category from list.
			entityCategories.splice(c, 1)
			--c
			--entityCategoriesLen
			entityCategoryRemoved = true
		}
	}

	return entityCategoryRemoved
}

/**
 * Removes integer symbols not used by any rule in `ruleSets`.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules to iterate over.
 * @param {string[]} nontermSyms The nonterminal symbols in the grammar; i.e., the keys for `ruleSets`.
 * @param {boolean} [suppressWarnings] Specify suppressing warnings from output.
 * @returns {boolean} Returns `true` if removed any integer symbols, else `false`.
 */
function removeUnusedIntegerSymbols(ruleSets, nontermSyms, suppressWarnings) {
	var intSymbol = require('./intSymbol')
	var intSymbols = intSymbol._intSymbols
	var intSymbolRemoved = false

	for (var i = 0, intSymbolsLen = intSymbols.length; i < intSymbolsLen; ++i) {
		var integerSymbol = intSymbols[i].name

		// Check if a rule in `ruleSets` uses `integerSymbol`.
		if (!symbolIsUsed(ruleSets, nontermSyms, integerSymbol)) {
			if (!suppressWarnings) {
				util.logWarning('Unused integer symbol:', util.stylize(integerSymbol))
				util.log('  ' + intSymbol._creationLines[integerSymbol])
			}

			// Remove the unused integer symbol.
			intSymbols.splice(i, 1)
			--i
			--intSymbolsLen
			intSymbolRemoved = true
		}
	}

	return intSymbolRemoved
}

/**
 * Removes semantics not used by any rule in `ruleSets`.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules to iterate over.
 * @param {string[]} nontermSyms The nonterminal symbols in the grammar; i.e., the keys for `ruleSets`.
 * @param {boolean} [suppressWarnings] Specify suppressing warnings from output.
 * @returns {boolean} Returns `true` if removed any semantics, else `false`.
 */
function removeUnusedSemantics(ruleSets, nontermSyms, suppressWarnings) {
	var semantic = require('./semantic')
	var semantics = semantic._semantics
	var semanticRemoved = false

	for (var semanticName in semantics) {
		var thisSemantic = semantics[semanticName]

		// Checks if a rule in `ruleSets` uses `thisSemantic`.
		if (!semanticIsUsed(ruleSets, nontermSyms, thisSemantic)) {
			if (!suppressWarnings) {
				util.logWarning('Unused semantic:', util.stylize(semanticName + (thisSemantic.isArg ? '' : '()')))
				util.log('  ' + semantic._creationLines[semanticName])
			}

			// Remove the unused semantic.
			delete semantics[semanticName]
			semanticRemoved = true
		}
	}

	return semanticRemoved
}

/**
 * Checks if a rule in `ruleSets` uses `semantic`.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules to iterate over.
 * @param {string[]} nontermSyms The nonterminal symbols in the grammar; i.e., the keys for `ruleSets`.
 * @param {Object[]} semantic The semantic to find.
 * @returns {boolean} Returns `true` if any rule uses `semantic`, else `false`.
 */
function semanticIsUsed(ruleSets, nontermSyms, semantic) {
	return someRule(ruleSets, nontermSyms, function (rule) {
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
 * Checks if a rule in `ruleSets` produces `symbol` (as a `rhs` symbol).
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules to iterate over.
 * @param {string[]} nontermSyms The nonterminal symbols in the grammar; i.e., the keys for `ruleSets`.
 * @param {Object} symbol The symbol to find.
 * @returns {boolean} Returns `true` if any rule produces `symbol`, else `false`.
 */
function symbolIsUsed(ruleSets, nontermSyms, symbol) {
	return someRule(ruleSets, nontermSyms, function (rule) {
		return rule.rhs.indexOf(symbol) !== -1
	})
}

/**
 * Checks if `predicate` returns truthy for any rule in `ruleSets`. The function returns as soon as it finds a passing rule and does not iterate over the entire collection. Invokes the predicate with one argument: (rule).
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules to iterate over.
 * @param {string[]} nontermSyms The nonterminal symbols in the grammar; i.e., the keys for `ruleSets`.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if any rule passes the predicate check, else `false`.
 */
function someRule(ruleSets, nontermSyms, predicate) {
	for (var s = 0, nontermSymsLen = nontermSyms.length; s < nontermSymsLen; ++s) {
		var rules = ruleSets[nontermSyms[s]]

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			if (predicate(rules[r])) return true
		}
	}

	return false
}