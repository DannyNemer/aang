var util = require('../util/util')
var grammarUtil = require('./grammarUtil')
var removeIllFormedRulesAndSyms = require('./removeIllFormedRulesAndSyms')


/**
 * Removes ill-formed and unused instances of nonterminal symbols, nonterminal rules, entity categories, integer symbols, and semantics from the grammar.
 *
 * Invoke this module before `createEditRules` to avoid creating edit-rules from these components.
 *
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {boolean} [printWarnings] Specify printing warnings for unused grammar components.
 * @returns {boolean} Returns `true` if removed any (unused) components from the grammar, else `false`.
 */
module.exports = function (ruleSets, printWarnings) {
	// Remove nonterminal symbols without rules, rules whose RHS symbols include those symbols, rules that lack and can not produce a reduced semantic required for themselves or ancestor rules, and any rule-less or unreachable (via the start symbol) nonterminal symbols that result. Invoke this module before removing any other components, because its removal of rules can render other grammar components unused.
	var componentRemoved = removeIllFormedRulesAndSyms(ruleSets, printWarnings)

	// Remove unused entity categories.
	componentRemoved = removeUnusedEntityCategories(ruleSets, printWarnings) || componentRemoved

	// Remove unused integer symbols.
	componentRemoved = removeUnusedIntegerSymbols(ruleSets, printWarnings) || componentRemoved

	// Remove unused semantic functions and arguments.
	componentRemoved = removeUnusedSemantics(ruleSets, printWarnings) || componentRemoved

	return componentRemoved
}

/**
 * Removes entity categories not used by any rule in `ruleSets`.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules to iterate over.
 * @param {boolean} [printWarnings] Specify printing warnings for unused entity categories.
 * @returns {boolean} Returns `true` if removed any entity categories, else `false`.
 */
function removeUnusedEntityCategories(ruleSets, printWarnings) {
	var entityCategory = require('./entityCategory')
	var entityCategories = entityCategory.categoryNames
	var entitySets = entityCategory._entitySets
	var entityCategoryRemoved = false

	for (var c = 0, entityCategoriesLen = entityCategories.length; c < entityCategoriesLen; ++c) {
		var entityCatSymbol = entityCategories[c]

		// Check if a rule in `ruleSets` uses `entityCatSymbol`.
		if (!isUsedSymbol(ruleSets, entityCatSymbol)) {
			if (printWarnings) {
				util.logWarning('Unused entity category:', util.stylize(entityCatSymbol))
				util.log('  ' + entityCategory._defLines[entityCatSymbol])
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
 * @param {boolean} [printWarnings] Specify printing warnings for unused integer symbols.
 * @returns {boolean} Returns `true` if removed any integer symbols, else `false`.
 */
function removeUnusedIntegerSymbols(ruleSets, printWarnings) {
	var intSymbol = require('./intSymbol')
	var intSymbols = intSymbol._intSymbols
	var intSymbolRemoved = false

	for (var i = 0, intSymbolsLen = intSymbols.length; i < intSymbolsLen; ++i) {
		var integerSymbol = intSymbols[i].name

		// Check if a rule in `ruleSets` uses `integerSymbol`.
		if (!isUsedSymbol(ruleSets, integerSymbol)) {
			if (printWarnings) {
				util.logWarning('Unused integer symbol:', util.stylize(integerSymbol))
				util.log('  ' + intSymbol._defLines[integerSymbol])
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
 * @param {boolean} [printWarnings] Specify printing warnings for unused semantics.
 * @returns {boolean} Returns `true` if removed any semantics, else `false`.
 */
function removeUnusedSemantics(ruleSets, printWarnings) {
	var semantic = require('./semantic')
	var semantics = semantic._semantics
	var semanticRemoved = false

	for (var semanticName in semantics) {
		var thisSemantic = semantics[semanticName]

		// Checks if a rule in `ruleSets` uses `thisSemantic`.
		if (!isUsedSemantic(ruleSets, thisSemantic)) {
			if (printWarnings) {
				util.logWarning('Unused semantic:', util.stylize(semanticName + (thisSemantic.isArg ? '' : '()')))
				util.log('  ' + semantic._defLines[semanticName])
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
 * @param {Object[]} semantic The semantic to find.
 * @returns {boolean} Returns `true` if any rule uses `semantic`, else `false`.
 */
function isUsedSemantic(ruleSets, semantic) {
	return grammarUtil.someRule(ruleSets, function (rule) {
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
 * Checks if a rule in `ruleSets` produces `symbol` (as a RHS symbol).
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules to iterate over.
 * @param {Object} symbol The symbol to find.
 * @returns {boolean} Returns `true` if any rule produces `symbol`, else `false`.
 */
function isUsedSymbol(ruleSets, symbol) {
	return grammarUtil.someRule(ruleSets, function (rule) {
		return rule.rhs.indexOf(symbol) !== -1
	})
}