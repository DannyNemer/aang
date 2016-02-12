var g = require('./grammar')
var grammarUtil = require('./grammarUtil')


/**
 * Removes the temporary rules and rule properties used for grammar generation from `ruleSets` to exclude them from the output grammar.
 *
 * Invoke this module at the conclusion of grammar generation.
 *
 * @static
 * @param {boolean} [includeTrees] Specify including the insertion rules' parse trees in the output grammar.
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
module.exports = function (ruleSets, includeTrees) {
	// Remove the temporary rules that produce the empty symbol, `<empty>`.
	removeEmptySymbolRules(ruleSets)

	// Remove the temporary rule properties used for grammar generation from each rule.
	removeTempRuleProps(ruleSets, includeTrees)

	// Check `removeUnusedComponents` removes no components to ensure the module correctly removed all unused components when initially invoked before `createEditRules`. Invoke after `removeTempRuleProps()` removes instances of `semanticSafe`. This check adds 400 ms to `buildGrammar`.
	if (g.removeUnusedComponents()) {
		throw 'Removed grammar components on second check'
	}

	// Remove `semanticSafe` which `removeUnusedComponents` added above.
	removeTempRuleProps(ruleSets, includeTrees)
}

/**
 * Removes the temporary rules from `ruleSets` that produce the empty symbol, `<empty>`, to exclude them from the output grammar. `createEditRules` used these rules to generate optional rules via insertions that lack text and semantics, and hence insert nothing and are not defined as insertions.
 *
 * Invoke this function after finding and saving insertions for rules with `<empty>` in `findTerminalRuleInsertions()` in `createEditRules`.
 *
 * Do not need to invoke `removeIllFormedRulesAndSyms()` after removing these rules for the following reasons:
 * - The `<empty>` rule removals can not create rule-less symbols because nonterminal symbols are forbidden from producing `<empty>` as their only rule, else throws an exception
 * - The `<empty>` rule removals can not render other symbols unreachable via the start symbol because `<empty>` only exists on terminal (unary) rules.
 * - The `<empty>` rule removals can not prevent other rules from producing required semantics because rules with `<empty>` are forbidden from having a semantic.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 */
function removeEmptySymbolRules(ruleSets) {
	grammarUtil.forEachRuleSet(ruleSets, function (rules, nontermSym) {
		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]
			if (rule.rhs[0] === g.emptySymbol) {
				rules.splice(r, 1)
				--r
				--rulesLen

				// Check for rules with `<empty>` that have a semantic. Also checked by `NSymbol.prototype.newTerminalRule()`.
				if (rule.semantic) {
					var errMsg = 'Rule with `<empty>` has semantic'
					util.logError(errMsg + ':', grammarUtil.stringifyRule(nontermSym, rule))
					throw new Error(errMsg)
				}

				// Check for nonterminal symbols whose only rule is `<empty>`. This check must occur here, after removing any rules in `removeIllFormedRulesAndSyms()`.
				if (rulesLen === 0) {
					var errMsg = 'Nonterminal symbol produces only `<empty>`'
					util.logError(errMsg + ':', grammarUtil.stringifyRule(nontermSym, rule))
					throw new Error(errMsg)
				}
			}
		}
	})
}

/**
 * Iterates over rules in `ruleSets`, removing the temporary rule properties used for grammar generation from each rule to exclude them from the output grammar.
 *
 * Invoke this function at the conclusion of grammar generation.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {boolean} [includeTrees] Specify including the insertion rules' parse trees in the output grammar.
 */
function removeTempRuleProps(ruleSets, includeTrees) {
	grammarUtil.forEachRule(ruleSets, function (rule) {
		// `semanticChecks.ruleMissingReducedSemantic()` used the following property in console warning messages when removing rules that failed to produce a required reduced semantic.
		delete rule.line

		// `splitRegexTerminalSymbols` used the following two properties to define nonterminal rules created from splitting multi-token terminal symbols as `rhsDoesNotProduceText`, which tells `pfsearch` to get the display text, `text`, from those nonterminal rules and to not traverse their child nodes (i.e., RHS symbols). I.e., `pfsearch` only needs (and uses) `rhsDoesNotProduceText`.
		delete rule.isSubstitution
		delete rule.isStopWord

		// `semanticChecks.ruleMissingReducedSemantic()` in `removeIllFormedRulesAndSyms` used the following property to track which rules it has evaluated while recursively evaluating parent rules. The method checks parent rules first in order to only remove the problematic rules that always fail, and not the descendant rules that only fail sometimes because of the problematic ancestor rule.
		delete rule.semanticSafe

		// Remove `rule.gramProps` objects that lack any defined properties. `NSymbol.prototype.newNonterminalRule()` added a `gramProps` object to every nonterminal rule, even when empty, to simplify copying `gramProps` to new edit-rules `createEditRules`.
		// Note: `Array.prototype.every()` returns `true` even if `rule.gramProps` has no properties because the method always returns `true` when invoked on an empty array.
		var gramProps = rule.gramProps
		if (gramProps && Object.keys(gramProps).every(prop => gramProps[prop] === undefined)) {
			delete rule.gramProps
		}

		// When `buildGrammar` is invoked without the command line option '--trees', remove the `rule.tree` property, which is the parse tree graph of the rules used to construct an insertion rule. It is necessary to always build `rule.tree` in `createEditRules` and then remove the property if not optionally saved to the output grammar (via '--trees') so that `createEditRules` can include the trees in error messages.
		if (!includeTrees) {
			delete rule.tree
		}
	})
}