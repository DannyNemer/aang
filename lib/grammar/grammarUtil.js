var util = require('../util/util')


/**
 * Iterates over rules in `ruleSets`, invoking `iteratee` for each rule. Invokes `iteratee` with three arguments: (rule, nontermSym, rules).
 *
 * @static
 * @memberOf grammarUtil
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Function} iteratee The function invoked per rule.
 */
exports.forEachRule = function (ruleSets, iteratee) {
	exports.forEachRuleSet(ruleSets, function (rules, nontermSym) {
		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			iteratee(rules[r], nontermSym, rules)
		}
	})
}

/**
 * Iterates over rule sets in `ruleSets`, invoking `iteratee` for each rule set. Invokes `iteratee` with two arguments: (rules, nontermSym).
 *
 * @static
 * @memberOf grammarUtil
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Function} iteratee The function invoked per rule set.
 */
exports.forEachRuleSet = function (ruleSets, iteratee) {
	var nontermSyms = Object.keys(ruleSets)

	for (var s = 0, nontermSymsLen = nontermSyms.length; s < nontermSymsLen; ++s) {
		var nontermSym = nontermSyms[s]
		iteratee(ruleSets[nontermSym], nontermSym)
	}
}

/**
 * Gets the number of rules in `ruleSets`.
 *
 * @static
 * @memberOf grammarUtil
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @returns {number} Returns the number of rules in `ruleSets`.
 */
exports.getRuleCount = function (ruleSets) {
	return Object.keys(ruleSets).reduce(function (ruleCount, nontermSym) {
		return ruleCount + ruleSets[nontermSym].length
	}, 0)
}

/**
 * Gets the number of entities in `entitySets`.
 *
 * Note: Counts by number of unique entity ids to avoid counting multiple names for the same entity.
 *
 * @static
 * @memberOf grammarUtil
 * @param {Object} entitySets The map of the grammar's entity tokens to entities.
 * @returns {number} Returns the number of entities in `entitySets`.
 */
exports.getEntityCount = function (entitySets) {
	var entityIds = []

	for (var entityToken in entitySets) {
		var entities = entitySets[entityToken]

		for (var e = 0, entitiesLen = entities.length; e < entitiesLen; ++e) {
			var entityId = entities[e].id

			// Count by number of unique entity ids to avoid counting multiple names for the same entity.
			if (entityIds.indexOf(entityId) === -1) {
				entityIds.push(entityId)
			}
		}
	}

	return entityIds.length
}

/**
 * Stringifies the provided rule for printing to console.
 *
 * Formats the string as follows: '[lhs-sym]' -> '[rhs-a]' '[rhs-b]'.
 *
 * @static
 * @memberOf grammarUtil
 * @param {string} nontermSym The LHS (nonterminal) symbol of the rule to stringify.
 * @param {Object} rule The rule to stringify.
 * @returns {string} Returns the stringified rule.
 */
exports.stringifyRule = function (nontermSym, rule) {
	return util.stylize(nontermSym) + ' -> ' + rule.rhs.map(util.unary(util.stylize)).join(' ')
}