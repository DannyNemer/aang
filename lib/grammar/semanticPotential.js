/**
 * Checks if `nontermSym` can produce a rule with any semantic (i.e., reduced or non-reduced).
 *
 * For use by `createEditRules` to define the property `rhsCanProduceSemantic` for all grammar rules, which `pfsearch` uses to determine the earliest it can semantically reduce a parse path.
 *
 * For use by `isUselessInsertion()` to discard insertions that produce meaningless clauses.
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