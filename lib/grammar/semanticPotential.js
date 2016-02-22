var grammarUtil = require('./grammarUtil')


/**
 * Checks if `nontermSym` can produce a rule with any semantic (i.e., reduced or non-reduced).
 *
 * For use by `createEditRules` to define the property `rhsCanProduceSemantic` for all grammar rules, which `pfsearch` uses to determine the earliest it can semantically reduce a parse path.
 *
 * For use by `isSemanticlessClauseInsertion()` to discard insertions that produce meaningless clauses.
 *
 * @static
 * @memberOf semanticPotential
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} nontermSym The nonterminal symbol to check.
 * @returns {boolean} Returns `true` if `nontermSym` can produce a rule with a semantic, else `false`.
 */
exports.symCanProduceSemantic = function (ruleSets, nontermSym, _symsSeen) {
	// Track checked symbols to prevent infinite recursion.
	if (!_symsSeen) {
		_symsSeen = [ nontermSym ]
	} else if (_symsSeen.indexOf(nontermSym) === -1) {
		_symsSeen.push(nontermSym)
	} else {
		return false
	}

	// Check all rules `nontermSym` produces.
	var rules = ruleSets[nontermSym]
	for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
		var rule = rules[r]
		if (exports.ruleHasSemantic(rule)) {
			return true
		} else if (exports.rhsCanProduceSemantic(ruleSets, rule, _symsSeen)) {
			return true
		}
	}

	return false
}

/**
 * Checks if `semanticPotential.symCanProduceSemantic()` returns truthy for any nonterminal symbol in `rule.rhs`. Stops iteration once `semanticPotential.symCanProduceSemantic()` returns truthy.
 *
 * @static
 * @memberOf semanticPotential
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Object} rule The nonterminal rule with the RHS symbols to check.
 * @returns {boolean} Returns `true` if `rule.rhs` can produce a rule with a semantic, else `false`.
 */
exports.rhsCanProduceSemantic = function (ruleSets, rule, _symsSeen) {
	if (!rule.isTerminal) {
		var rhsSyms = rule.rhs
		for (var s = 0, rhsSymsLen = rhsSyms.length; s < rhsSymsLen; ++s) {
			if (exports.symCanProduceSemantic(ruleSets, rhsSyms[s], _symsSeen)) {
				return true
			}
		}
	}

	return false
}

/**
 * Checks if `rule` has any semantic (i.e., reduced or non-reduced).
 *
 * Returns `true` if `rule` has any of the following conditions:
 * 1. Is defined with a semantic.
 * 2. Is a placeholder that generates a reduced semantic argument from input.
 * 3. Is anaphoric and will copy an antecedent (reduced) semantic.
 *
 * @static
 * @memberOf semanticPotential
 * @param {Object} rule The rule to check.
 * @returns {boolean} Returns `true` if `rule` has a semantic, else `false`.
 */
exports.ruleHasSemantic = function (rule) {
	return rule.semantic || rule.isPlaceholder || rule.anaphoraPersonNumber
}

/**
 * Checks if `nontermSym` can produce a rule with a reduced semantic.
 *
 * @static
 * @memberOf semanticPotential
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} nontermSym The nonterminal symbol to check.
 * @returns {boolean} Returns `true` if `nontermSym` can produce a rule with a reduced semantic, else `false`.
 */
exports.symCanProduceReducedSemantic = function (ruleSets, nontermSym, _symsSeen) {
	// Track checked symbols to prevent infinite recursion.
	if (!_symsSeen) {
		_symsSeen = [ nontermSym ]
	} else if (_symsSeen.indexOf(nontermSym) === -1) {
		_symsSeen.push(nontermSym)
	} else {
		return false
	}

	// Check all rules `nontermSym` produces.
	var rules = ruleSets[nontermSym]
	for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
		var rule = rules[r]
		if (exports.ruleHasReducedSemantic(rule)) {
			return true
		} else if (exports.rhsCanProduceReducedSemantic(ruleSets, rule, _symsSeen)) {
			return true
		}
	}

	return false
}

/**
 * Checks if `semanticPotential.symCanProduceReducedSemantic()` returns truthy for any nonterminal symbol in `rule.rhs`. Stops iteration once `semanticPotential.symCanProduceReducedSemantic()` returns truthy.
 *
 * @static
 * @memberOf semanticPotential
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Object} rule The nonterminal rule with the RHS symbols to check.
 * @returns {boolean} Returns `true` if `rule.rhs` can produce a rule with a reduced semantic, else `false`.
 */
exports.rhsCanProduceReducedSemantic = function (ruleSets, rule, _symsSeen) {
	if (!rule.isTerminal) {
		var rhsSyms = rule.rhs
		for (var s = 0, rhsSymsLen = rhsSyms.length; s < rhsSymsLen; ++s) {
			if (exports.symCanProduceReducedSemantic(ruleSets, rhsSyms[s], _symsSeen)) {
				return true
			}
		}
	}

	return false
}

/**
 * Checks if `rule` has a reduced semantic.
 *
 * Returns `true` if `rule` has any of the following conditions:
 * 1. Is defined with a reduced semantic.
 * 2. Has an inserted (reduced) semantic,
 * 3. Is a placeholder that generates a reduced semantic argument from input.
 * 4. Is anaphoric and will copy an antecedent (reduced) semantic.
 *
 * @static
 * @memberOf semanticPotential
 * @param {Object} rule The rule to check.
 * @returns {boolean} Returns `true` if `rule` has a reduced semantic, else `false`.
 */
exports.ruleHasReducedSemantic = function (rule) {
	return rule.semanticIsReduced || rule.insertedSemantic || rule.isPlaceholder || rule.anaphoraPersonNumber
}

/**
 * Defines the property `rule.rhsCanProduceSemantic` for each nonterminal rule in `ruleSets`, which specifies if each rule's RHS symbols can produce a semantic. If `false`, then `pfsearch` can reduce the rule's semantic with a parse tree's preceding LHS semantic before parsing the RHS symbols because no semantics can follow that particular node/branch.
 *
 * Defines the property `rule.secondRHSCanProduceSemantic` for each nonterminal binary rule in `ruleSets`, which specifies if each rule's second RHS symbol can produce a semantic. If `false`, then there will never be a semantic down the second branch of the binary rule, and `pfsearch` can freely reduce a RHS semantic in the first branch with any preceding LHS semantic found before the rule. Else, `pfearch` prevents the first branch's RHS semantic(s) from reducing with LHS semantics found before the rule until parsing the second branch's semantic(s).
 *
 * These values enable `pfsearch` to find and discard semantically illegal parses earlier than otherwise.
 *
 * Invoke this method after removing ill-formed nonterminal symbols and rules in `removeIllFormedRulesAndSyms()`, and before adding edit-rules which inherit the semantic properties of their original (non-edit) rules.
 *
 * @static
 * @memberOf semanticPotential
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
exports.assignSemanticPotentials = function (ruleSets) {
	grammarUtil.forEachRule(ruleSets, function (rule) {
		if (!rule.isTerminal) {
			// Define property here, as `undefined`, to ensure preferred object property order.
			rule.rhsCanProduceSemantic = undefined

			if (rule.rhs.length === 2) {
				// Defines if the binary nonterminal rule's second RHS symbol can produce a semantic.
				rule.secondRHSCanProduceSemantic = exports.symCanProduceSemantic(ruleSets, rule.rhs[1])
			}

			// Defines if any of the rule's RHS symbols can produce a semantic.
			rule.rhsCanProduceSemantic = rule.secondRHSCanProduceSemantic || exports.symCanProduceSemantic(ruleSets, rule.rhs[0])

			// A rule can have a reduced semantic (i.e., `rule.semanticIsReduced` is `true`) and also have `rule.rhsCanProduceSemantic` as `true`. If so, `pfsearch` will property the rule's reduced semantic with the semantic(s) its RHS produces, to form a semantic array of RHS semantic arguments. Though the grammar lacks any non-edit rule defined as such, this is how `pfsearch` handles insertion rules with reduced semantics.
		}
	})
}