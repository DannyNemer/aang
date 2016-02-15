var semanticPotential = require('./semanticPotential')


/**
 * Checks if `insertion` produces a meaningless (i.e., semantic-less) clause, which should be avoided. For use by `createInsertionRules()` and `mergeInsertionSets()` to discard such insertions.
 *
 * Examples of meaningless clause insertions to avoid:
 * • "repos that are" -> "repos that are (repos)"
 * • "repos that are not" -> "repos that are not (repos)"
 * • "repos that" -> "repos that (are repos)"
 * • "repos" -> "repos (that are repos)"
 *
 * Note: The grammar currently does not produce rules with this characteristic because of insertion restrictions in place (e.g., `noInsert`).
 *
 * Without any insertion restrictions, this function stops the following insertions (for each category):
 * 1. [user-filter] -> [be-non-1-sg] [user-no-relative] -> "are [people]"
 * 2. [user-filter] -> [be-non-1-sg-be-non-1-sg-negation] [user-no-relative], not() -> "are not [people]"
 *   • `semanticChecks.isRuleMissingReducedSemantic()` in `editRulesUtil.addRule()` would stop this rule anyway for being unable to produce a semantic required for the parent semantic, `not()`.
 *
 * Stopping these insertions in `mergeInsertionSets()` (in addition to `createInsertionRules()`) prevents their inclusion in larger insertions for which this function's logic can not detect their meaninglessness.
 * For example, the following meaningless clause insertion would not be caught:
 * • "repos" -> "repos (that are repos)"
 * Prevention of the first insertion example above prevents the previous example.
 *
 * @private
 * @static
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {Object} insertion The insertion to inspect, formed from a parse tree that produces a sequence of inserted terminal symbols.
 * @param {string} insertedRHSSym The `rule` RHS symbol to insert that produces `insertion`.
 * @param {string} nontermSym The nonterminal symbol that produces `rule`.
 * @param {Object} rule The nonterminal rule from which to create an insertion rule using `insertion`.
 * @param {boolean} [printWarning] Specify printing a warning if `insertion` produces a meaningless clause.
 * @returns {boolean} Returns `true` if `insertion` produces a meaningless clause and should be discarded, else `false`.
 */
module.exports = function (ruleSets, insertion, insertedRHSSym, nontermSym, rule, printWarning) {
	/**
	 * 1. Check `insertion` produces text; i.e., terminal symbols are not only `<empty>`(s).
	 * 2. Check `insertion` lacks a semantic; i.e., meaningless.
	 */
	if (insertion.text[0] && !insertion.semantic) {
		// The sibling nonterminal symbol of `insertedRHSSym` within the original binary rule's RHS, with which `insertion` is pair when inserted.
		var nonInsertedRHSSym = rule.rhs[Number(!rule.rhs.indexOf(insertedRHSSym))]

		/*
		 * 3. Check `nonInsertedRHSSym` can not produce semantics.
		 *   • If `nonInsertedRHSSym` could produce semantics, then `insertedRHSSym`, which lacks semantics, produces display text that serves as necessary sentence structure for the clause for which `nonInsertedRHSSym` semantics contribute the meaning.
		 *     - Such display text can include prepositions, auxiliary verbs, and relative pronouns.
		 *   • Hence, in that case, `insertion` enables those semantics when only `nonInsertedRHSSym` is matched (by completing the rule).
		 *   • For example, this check avoids discarding the following insertions, where the non-inserted portions produce semantics:
		 *     - "my", repos(me) -> "my (repos)", repos(me)
		 *     - "liked by me", repos-liked(me) -> "(repos) liked by me", repos-liked(me)
		 *     - "open", issues-state(open) -> "open (issues)", issues-state(open)
		 *
		 * 4. Check `insertedRHSSym` could produce a semantic (but does not).
		 *   • Given `nonInsertedRHSSym` can not produce a semantic and `insertedRHSSym` can, then `rule` forms a clause where `nonInsertedRHSSym` produces display text for sentence structure and `insertedRHSSym` semantics contribute the meaning.
		 *   • However, because `insertion` lacks semantics, then the clause that `insertion` forms is meaningless and should be discarded.
		 *   • For example, the following insertions include a category's head, which could include semantics, but do not and are discarded:
		 *     - "repos that" -> "repos that (are repos)"
		 *     - "repos that are" -> "repos that are (repos)"
		 *   • As shown in #3, the semantic-less insertion of a category's head must be possible for cases when `nonInsertedRHSSym` can produce a semantic. For example:
		 *    - "open",issues-state(open) -> "open (issues)",issues-state(open)
		 *      • Without this semantic-less insertion of the category head, "issues", only the following insertion would be possible:
		 *        - "open", issues-state(open) -> "my (open) issues", issues-state(open),issues(me)
		 */
		if (semanticPotential.symCanProduceSemantic(ruleSets, insertedRHSSym) && !semanticPotential.symCanProduceSemantic(ruleSets, nonInsertedRHSSym)) {
			if (printWarning) {
				util.logWarning('Discarded meaningless clause insertion:')
				util.log('  Original rule:', grammarUtil.stringifyRule(nontermSym, rule))
				util.log('  Inserted symbol:', util.stylize(insertedRHSSym))
				util.dir('  Insertion:', insertion)
				util.log()
			}

			return true
		}

		/*
		 * • When neither `insertedRHSSym` nor `nonInsertedRHSSym` can produce semantics, then `rule` does not form a clause but rather provides necessary sentence structure to a clause of which it is a subset. Such insertions should not be discarded. For example:
		 *   - "repos are ..." -> "repos (that) are ..."
		 *   - "repos by my" -> "repos (created by) me"
		 *
		 * • If there is a non-insertion rule with `nonInsertedRHSSym` as its only RHS symbol and the same semantic (or lack thereof) as `rule`, then `rulesAreAmbiguous()` will catch the ambiguity and discard `insertion` because its display text assures it is more expensive.
		 *   - If `insertedRHSSym` were optional (i.e., produces `<empty>`), `rulesAreAmbiguous()` will catch the ambiguity (because both rules produce no semantics for the same RHS) even if added after `insertion` because its lack of display text assures it is cheaper.
		 *
		 * • Another possible meaningless (i.e., semantic-less) clause insertion, though not checked here because such an insertion's construction is avoided by invoking this function in `mergeInsertionSets()`, is demonstrated by the following rules:
		 *     [cat-plural] -> [cat-no-relative]
		 *     [cat-plural] -> [cat-no-relative] [cat-relative-clause]
		 * • Here, both RHS symbols can produce a semantic.
		 * • In addition, the existence of the first rule demonstrates the subtree that `[cat-no-relative]` produces can exist meaningfully without `[cat-relative-clause]`. Therefore, `[cat-relative-clause]` always produces a clause while `[cat-no-relative]` is only assured to sometimes produce a meaningful clause (when solo in the first rule).
		 * • Therefore, semantic-less insertion of `[cat-relative-clause]` should be avoided. For example:
		 *   - [cat-plural] -> [cat-no-relative] ("that are repos") -> "my repos (that are repos)", repos(me)
		 * • In contrast, semantic-less insertion of `[cat-no-relative]` should be enabled, for when it forms a clause with `[cat-relative-clause]` as opposed to a separate clause. For example:
		 *   - [cat-plural] -> ("issues") [cat-relative-clause] -> "(issues) that are open",issues-state(open)
		 */
	}

	return false
}