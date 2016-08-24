var util = require('../util/util')
var grammarUtil = require('../grammar/grammarUtil')


/**
 * Creates a new, flattened `ruleProps` for the term sequence `subnode`.
 *
 * The new, flattened, terminal `ruleProp` has the following properties:
 * 1. terminal - Mark the new `ruleProps` as terminal so that `pfsearch` uses `subnode.ruleProps` to generate display text and does not traverse its child nodes.
 *   • Do not bother deleting `subnode.node.subs`, which would be wasteful because the absence of `ruleProps.isNonterminal` prevents `pfsearch` from checking `subnode.node.subs` anyway. Also, `subnode.node.subs` are needed in the rare case of reparsing, which reuses existing nodes.
 * 2. cost - `cost`, the minimum cost for `subnode` as a complete subtree: the cumulative cost (including any deletion costs) of the subtree that will be inaccessible after assigning this new, terminal `ruleProps`.
 *   • If there are multiple subtrees, then they are ambiguous because their text and semantics are defined here (identically), and the minimum cost subtree would be chosen anyway.
 * 3. semantic - `subnode.ruleProps.semantic`, if defined. The rules it produces can not have semantics.
 * 4. text - See below.
 * 5. tense - See below.
 *
 * The new `ruleProps` excludes the following properties which the original `ruleProps` can contain prior to flattening, because all are specific to nonterminal nodes:
 * • isTermSequence - Marks `childNode` that have yet to be flattened.
 * • isNonterminal - Excluded to mark the flattened term sequences as terminal to prevent `pfsearch` from traversing their child nodes.
 * • gramProps - Conjugates the term sequence's display text and discarded thereafter.
 * • insertedSymIdx - Excluded because flattening term sequences into terminal nodes removes the need to traverse the node's children.
 * • semanticIsReduced - Excluded because `pfsearch` knows all semantics on terminal nodes are reduced.
 * • secondRHSCanProduceSemantic - Excluded because only applicable to binary nonterminal nodes.
 *
 * For use by `calcHeuristicCosts` while traversing the parse forest to calculate the A* heuristic estimate.
 *
 * @static
 * @param {Object} subnode The term sequence subnode for which to generate a new, terminal `ruleProps`.
 * @param {number} cost The cumulative cost of the subtree `subnode` produces.
 * @returns {Object} Returns the new, flattened, terminal `ruleProps` for `subnode`.
 */
module.exports = function (subnode, cost) {
	var subnodeRuleProps = subnode.ruleProps

	/**
	 * If `subnode` is a term sequence with `text` and `insertedSymIdx`, then it is an insertion. Create a new `ruleProps` as explained above, extended as follows:
	 * 4. text - Merge `text` values of the matched terminal rules this subnode's single child node produces with `subnode.ruleProps.text` according to `subnode.ruleProps.insertedSymIdx`.
	 * 5. tense - The tense of a matched verb terminal rule `subnode` produces, for which the associated text object remains unconjugated, to maintain tense if the parent rule of `subnode` has matching `acceptedTense`.
	 */
	if (subnodeRuleProps.insertedSymIdx !== undefined) {
		return createTermSequenceInsertionRuleProps(subnode, cost)
	}

	/**
	 * If `subnode` is a term sequence with `text` and no `insertedSymIdx`, then it is a multi-token substitution. Create a new `ruleProps` as explained above, extended as follows:
	 * 4. text - Keep `subnode.ruleProps.text` for `pfsearch` to use as display text instead of the `text` of the matched terminal rules `subnode` produces.
	 * 5. tense - The tense of a matched verb terminal rule `subnode` produces, for which the associated text object remains unconjugated, to maintain tense for a verb substitution in `text` if the parent rule of `subnode` has matching `acceptedTense`.
	 */
	if (subnodeRuleProps.text) {
		return createTermSeqSubstitutionRuleProps(subnode, cost)
	}

	/**
	 * If `subnode` is a term sequence (without text), then create a new `ruleProps` as explained above, extended as follows:
	 * 4. text - Merge the `text` values of the matched terminal rules this subnode's child nodes produces, which `pfsearch` uses as display text.
	 * 5. tense - The tense of a matched verb terminal rule `subnode` produces, for which the associated text object remains unconjugated, to maintain tense if the parent rule of `subnode` has matching `acceptedTense`.
	 * 6. personNumber - The grammatical person-number, if any, with which to conjugate nominative verbs that follow `subnode` within its subtree.
	 */
	return createTermSequenceRuleProps(subnode, cost)
}

/**
 * Creates a new `ruleProps` for term sequence `subnode` with the following properties:
 * 1. terminal - The new `ruleProps` is marked terminal so that `pfsearch` uses the new `subnode.ruleProps` to generate display text and does not traverse its child nodes.
 * 2. cost - Uses `cost`, the cumulative cost (including any deletion costs) of the subtree `subnode` produces, which will be inaccessible after assigning this new, terminal `ruleProps`
 * 3. semantic - `subnode.ruleProps.semantic`, if defined.
 * 4. text - Merges the `text` values of the matched terminal rules this subnode's child nodes produces, which `pfsearch` uses as display text.
 * 5. tense - The tense of a matched verb terminal rule `subnode` produces, for which the associated text object remains unconjugated, to maintain tense if the parent rule of `subnode` has matching `acceptedTense`.
 * 6. personNumber - The grammatical person-number, if any, with which to conjugate nominative verbs that follow `subnode` within its subtree.
 * 7. anaphoraPersonNumber - The grammatical person-number for anaphoric rules, if any, with which to match and copy an antecedent semantic of the same person-number.
 *
 * @private
 * @static
 * @param {Object} subnode The term sequence subnode for which to generate a new, flattened, terminal `ruleProps`.
 * @param {number} cost The cumulative cost of the subtree `subnode` produces.
 * @returns {Object} Returns the new, flattened, terminal `ruleProps` for `subnode`.
 */
function createTermSequenceRuleProps(subnode, cost) {
	if (isIllFormedTermSequence(subnode)) {
		throw new Error('Ill-formed term sequence')
	}

	var subnodeRuleProps = subnode.ruleProps
	var leftSub = getChildSub(subnode)

	// Get the display text `leftSub` produces, and conjugate with the grammatical properties specific to its RHS index, `parentGramProps[0]`, if any.
	var parentGramProps = subnodeRuleProps.gramProps
	var text = getSubnodeText(leftSub, parentGramProps && parentGramProps[0])
	/**
	 * If `text` remains unconjugated, save input tense from `leftSub`, otherwise its `tense` was used in its conjugation.
	 *
	 * This check is identical to `!parentGramProps[0]`, because `conjugateTextObject()` throws an exception if `parentGramProps[0]` exists and it can not conjugate the display text.
	 *
	 * It will never be the case where `text` is an array containing a conjugative text object, yet the text associated with `leftSub.ruleProps.tense` was conjugated, because that would require a term sequence with multiple text objects (e.g., a pronoun and a verb), which the grammar generator prevents.
	 */
	var tense = text.constructor !== String && leftSub.ruleProps.tense

	// Check if `subnode` is a binary node.
	var subnodeNext = subnode.next
	if (subnodeNext) {
		/**
		 * `subnode` is a binary node. For example:
		 *   `[contribute-to]` -> `[contribute]` -> "contribute", text: `{contribute-verb-forms}`
		 *                     -> `[to]`         -> "to"
		 */
		var rightSub = getChildSub(subnodeNext)

		// Get the display text `rightSub` produces, and conjugate with the grammatical properties specific to its RHS index, `parentGramProps[1]`, if any.
		var rightText = getSubnodeText(rightSub, parentGramProps && parentGramProps[1])
		text = grammarUtil.mergeTextPair(text, rightText)

		// If `text` remains unconjugated, save input input tense from `rightSub`, otherwise its `tense` was used in its conjugation.
		if (rightText.constructor !== String) {
			var rightTense = rightSub.ruleProps.tense

			/**
			 * Alert if both subnodes in a binary rule are verbs with `tense` that this rule can not conjugate.
			 *
			 * The grammar generator forbids a rule marked `ruleProps.isTermSequence` to produce multiple verbs without `ruleProps.gramProps` to conjugate at least one of the verbs. Prevents merging two conjugative verb text objects, each of which can have an input `tense`, and passing the merged text array up to a parent node without knowing to which text object which input `tense` applies.
			 */
			if (rightTense && tense) {
				printSubnodeErr(subnode, subnode.node.subs, 'Term sequence subnode lacks `text`')
				throw new Error('Ill-formed term sequence')
			}

			tense = rightTense
		}
	}

	/**
	 * `subnode` is a unary node. For example:
	 *   `[like]` -> `[love]` -> "love", text: `{love-verb-forms}`
	 *
	 * Even though such a rule does not require `text` merging, the `text` value still must be brought up one level for `gramProps` conjugation, which only conjugates the immediate child nodes (without this step, the `text` object is two levels below the parent rule with `gramProps`).
	 */
	return {
		// The cumulative cost (including any deletion costs) of the subtree `subnode` produces.
		cost: cost,
		text: text,
		// Save `tense` associated with the conjugative verb text object in `text`, if any. `tense` is assigned above only when its associated verb remains unconjugated, and throws an exception if there are multiple (conflicting) `tense` values.
		tense: tense,
		// Exclude `semanticIsReduced` and `secondRHSCanProduceSemantic`, which are specific to nonterminal nodes.
		semantic: subnodeRuleProps.semantic,
		/**
		 * The person-number property of `[nom-users]` subjects that conjugates nominative verbs that follow `subnode` within its subtree. For example:
		 *   `[nom-users]` -> `[1-sg]`, `me`, personNumber: "oneSg"
		 */
		personNumber: subnodeRuleProps.personNumber,
		/**
		 * The grammatical person-number for anaphoric rules with which to match and copy an antecedent semantic of the same person-number.
		 *
		 * For example: "(people who follow `{user}` and like) his|her (repos)"
		 *   `[poss-determiner-sg]` -> `[3-sg-poss-det]` -> "his"
		 *                          -> anaphoraPersonNumber: "threeSg"
		 *
		 * For example: "(people who follow my followers and like) their (repos)"
		 *   `[poss-determiner-pl]` -> `[3-pl-poss-det]` -> "their"
		 *                          -> anaphoraPersonNumber: "threePl"
		 */
		anaphoraPersonNumber: subnodeRuleProps.anaphoraPersonNumber,
	}
}

/**
 * Checks if `subnode`, which was passed to `createTermSequenceRuleProps()`, is ill-formed. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} subnode The `createTermSequenceRuleProps()` term sequence subnode to inspect.
 * @returns {boolean} Returns `true` if `subnode` is ill-formed, else `false`.
 */
function isIllFormedTermSequence(subnode) {
	var subnodeRuleProps = subnode.ruleProps
	if (!subnodeRuleProps.isTermSequence) {
		util.logError('`createTermSequenceRuleProps()` invoked on subnode without `isTermSequence`:', subnode)
		return true
	}

	if (subnodeRuleProps.insertedSymIdx !== undefined) {
		util.logError('`createTermSequenceRuleProps()` invoked on subnode with `insertedSymIdx` (should use `createTermSequenceInsertionRuleProps()`):', subnode)
		return true
	}

	if (subnodeRuleProps.text) {
		util.logError('`createTermSequenceRuleProps()` invoked on subnode with substitution text (should use `createTermSeqSubstitutionRuleProps()`):', subnode)
		return true
	}

	return false
}

function createPartialTermSequenceRuleProps(subnode, cost) {
	if (isIllFormedPartialTermSequence(subnode)) {
		throw new Error('Ill-formed partial term sequence')
	}
}

/**
 * Checks if `subnode`, which was passed to `createPartialTermSequenceRuleProps()`, is ill-formed. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} subnode The `createPartialTermSequenceRuleProps()` partial term sequence subnode to inspect.
 * @returns {boolean} Returns `true` if `subnode` is ill-formed, else `false`.
 */
function isIllFormedPartialTermSequence(subnode) {
	if (!subnode.next) {
		util.logError('Partial term sequence subnode is unary:', subnode)
		return true
	}

	var subnodeRuleProps = subnode.ruleProps
	if (!subnodeRuleProps.rhsTermSequenceIndexes) {
		util.logError('Partial term sequence subnode lacks `rhsTermSequenceIndexes`:', subnode)
		return true
	}

	if (subnodeRuleProps.rhsTermSequenceIndexes[0] && subnodeRuleProps.rhsTermSequenceIndexes[1]) {
		util.logError('Partial term sequence subnode specifies both RHS symbols as term sequences:', subnode)
		return true
	}

	if (subnodeRuleProps.isTermSequence) {
		util.logError('Partial term sequence subnode has `isTermSequence`, which is for complete term sequences:', subnode)
		return true
	}

	if (subnodeRuleProps.insertedSymIdx !== undefined) {
		util.logError('Partial term sequence has `insertedSymIdx`:', subnode)
		return true
	}

	if (subnodeRuleProps.text) {
		util.logError('Partial term sequence has substitution `text`:', subnode)
		return true
	}

	return false
}

/**
 * Creates a new `ruleProps` for term sequence substitution `subnode` with the following properties:
 * 1. terminal - The new `ruleProps` is marked terminal so that `pfsearch` uses the new `subnode.ruleProps` to generate display text and does not traverse its child nodes.
 * 2. cost - Uses `cost`, the cumulative cost (including any deletion costs) of the subtree `subnode` produces, which will be inaccessible after assigning this new, terminal `ruleProps`
 * 3. semantic - `subnode.ruleProps.semantic`, if defined.
 * 4. text - Keeps `subnode.ruleProps.text` for `pfsearch` to use as display text instead of the `text` of the matched terminal rules `subnode` produces.
 * 5. tense - The tense of a matched verb terminal rule `subnode` produces, for which the associated text object remains unconjugated, to maintain tense for a verb substitution in `text` if the parent rule of `subnode` has matching `acceptedTense`.
 *
 * @private
 * @static
 * @param {Object} subnode The term sequence substitution subnode for which to generate a new, flattened, terminal `ruleProps`.
 * @param {number} cost The cumulative cost of the subtree `subnode` produces.
 * @returns {Object} Returns the new, flattened, terminal `ruleProps` for `subnode`.
 */
function createTermSeqSubstitutionRuleProps(subnode, cost) {
	if (isIllFormedTermSequenceSubstitution(subnode)) {
		throw new Error('Ill-formed term sequence substitution')
	}

	var subnodeRuleProps = subnode.ruleProps

	return {
		// The cumulative cost (including any deletion costs) of the subtree `subnode` produces.
		cost: cost,
		text: subnodeRuleProps.text,
		/**
		 * Save the input tense of any verb terminal rule `subnode` produces to maintain optional tense in substitution `text` if the parent rule of `subnode` has matching `acceptedTense`. For example:
		 *   `[contribute-to]` -> "worked on" (input) -> "contributed to" (past tense maintained)
		 */
		tense: getNonterminalSubstitutionInputTense(subnode),
		// Exclude `semanticIsReduced` and `secondRHSCanProduceSemantic`, which are specific to nonterminal nodes.
		semantic: subnodeRuleProps.semantic,
	}
}

/**
 * Gets the input tense of any verb terminal rules `subnode` produces to maintain tense for any verb substitutions whose parent rule has matching `acceptedTense`.
 *
 * For example:
 *   `[contribute-to]` -> "worked on" (input) -> "contributed to" (past tense maintained).
 *
 * `subnode` can be an insertion for a substitution. For example:
 *   `[contribute-to]` -> "work" (input) -> `[work]` `[on]`, text: `[ {contribute-verb-forms}, "to" ]`
 *
 * @private
 * @static
 * @param {Object} subnode The subnode for which to get the `tense` value of any matched verb terminal rule it produces.
 * @returns {string|undefined} Returns the `tense` of any matched verb terminal rule `subnode` produces, else `undefined`.
 */
function getNonterminalSubstitutionInputTense(subnode) {
	var leftSub = getChildSub(subnode)

	// Check if `subnode` is a binary node, else it is an insertion for a substitution.
	var subnodeNext = subnode.next
	if (subnodeNext) {
		var rightSub = getChildSub(subnodeNext)

		/**
		 * The grammar generator forbids a rule marked `ruleProps.isTermSequence` to produce multiple verbs without `ruleProps.gramProps`. Prevents merging two conjugative verb text objects, each of which can have an input `tense`, and passing the merged text array up to a parent node without knowing to which text object which input `tense` applies.
		 */
		return leftSub.ruleProps.tense || rightSub.ruleProps.tense
	}

	/**
	 * `subnode` is an insertion for a substitution. For example:
	 *   `[contribute-to]` -> "work" (input) -> `[work]` `[on]`, text: `[ {contribute-verb-forms}, "to" ]`
	 */
	return leftSub.ruleProps.tense
}

/**
 * Checks if `subnode`, which was passed to `createTermSeqSubstitutionRuleProps()`, is ill-formed. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} subnode The `createTermSeqSubstitutionRuleProps()` term sequence substitution subnode to inspect.
 * @returns {boolean} Returns `true` if `subnode` is ill-formed, else `false`.
 */
function isIllFormedTermSequenceSubstitution(subnode) {
	var subnodeRuleProps = subnode.ruleProps
	if (!subnodeRuleProps.isTermSequence) {
		util.logError('`createTermSeqSubstitutionRuleProps()` invoked on subnode without `isTermSequence`:', subnode)
		return true
	}

	if (!subnodeRuleProps.text) {
		util.logError('`createTermSeqSubstitutionRuleProps()` invoked on subnode without substitution text (should use `createTermSequenceRuleProps()`):', subnode)
		return true
	}

	if (subnodeRuleProps.insertedSymIdx !== undefined) {
		util.logError('`createTermSeqSubstitutionRuleProps()` invoked on subnode with `insertedSymIdx` (should use `createTermSequenceInsertionRuleProps()`):', subnode)
		return true
	}

	if (subnodeRuleProps.gramProps) {
		util.logError('`gramProps` exists on term sequence substitution, which should have conjugated `text` during grammar generation and then discarded:', subnode)
		return true
	}

	return false
}

/**
 * Creates a new `ruleProps` for term sequence insertion `subnode` with the following properties:
 * 1. terminal - The new `ruleProps` is marked terminal so that `pfsearch` uses the new `subnode.ruleProps` to generate display text and does not traverse its child nodes.
 * 2. cost - Uses `cost`, the cumulative cost (including any deletion costs) of the subtree `subnode` produces, which will be inaccessible after assigning this new, terminal `ruleProps`
 * 3. semantic - `subnode.ruleProps.semantic`, if defined.
 * 4. text - Merges `text` values of the matched terminal rules this subnode's single child node produces with `subnode.ruleProps.text` according to `subnode.ruleProps.insertedSymIdx`.
 * 5. tense - The tense of a matched verb terminal rule `subnode` produces, for which the associated text object remains unconjugated, to maintain tense if the parent rule of `subnode` has matching `acceptedTense`.
 *
 * For example:
 *   `[contribute-to]` -> `[contribute]`, text: "to"
 *                     -> "contribute" (input), text: `{contribute-verb-forms}`
 *                     -> text: `[ {contribute-verb-forms}, "to" ]` (merged text values)
 *
 * @private
 * @static
 * @param {Object} subnode The term sequence insertion subnode for which to generate a new, flattened, terminal `ruleProps`.
 * @param {number} cost The cumulative cost of the subtree `subnode` produces.
 * @returns {Object} Returns the new, flattened, terminal `ruleProps` for `subnode`.
 */
function createTermSequenceInsertionRuleProps(subnode, cost) {
	if (isIllFormedTermSequenceInsertion(subnode)) {
		throw new Error('Ill-formed term sequence insertion')
	}

	var subnodeRuleProps = subnode.ruleProps
	var childSub = getChildSub(subnode)

	/**
	 * Get the display text `childSub` produces, and conjugate with the grammatical properties specific to its RHS index, if any. For example, in order of conjugative property priority:
	 * • If `subnodeRuleProps.gramProps[0].acceptedTense` and input tense, `childSub.ruleProps.tense`, exist and match:
	 *   rhs: [ `[like]` ],
	 *   gramProps: { 0: { acceptedTense: "past" } },
	 *   childSub.ruleProps.tense: "past",
	 *     => "liked"
	 *
	 * • Else if `subnodeRuleProps.gramProps[0].form` exists:
	 *   rhs: [ `[create]` ],
	 *   gramProps: { 0: { form: "past" } },
	 *     => "created"
	 *
	 * • Else if `subnodeRuleProps.insertedSymIdx` is 0 and `subnodeRuleProps.personNumber` exists; i.e., when the inserted `text` was generated from a nominative subject:
	 *   rhs: [ `[have]` ],
	 *   insertedSymIdx: 0,
	 *   personNumber: "oneSg",
	 *     => "have"
	 */
	var parentGramProps = subnodeRuleProps.gramProps
	var insertedPersonNumber = subnodeRuleProps.insertedSymIdx === 0 && subnodeRuleProps.personNumber
	var childSubText = getSubnodeText(childSub, parentGramProps && parentGramProps[0], insertedPersonNumber)

	// Excludes `insertedSymIdx` because this flattens the term sequence into a terminal node, removing the need to traverse the node's children.
	return {
		// The cumulative cost (including any deletion costs) of the subtree `subnode` produces.
		cost: cost,
		// Merge insertion `text` with matched terminal rule `text` according to `insertedSymIdx`.
		text: subnodeRuleProps.insertedSymIdx === 1
			? grammarUtil.mergeTextPair(childSubText, subnodeRuleProps.text)
			: grammarUtil.mergeTextPair(subnodeRuleProps.text, childSubText),
		/**
		 * Save the input tense of any verb terminal rule `subnode` produces that this rule can not conjugate, to maintain optional tense if the parent rule of `subnode` has matching `acceptedTense`. For example:
		 *   `[contribute-to]` -> `[contribute]`, text: "to"
		 *                     -> "contributed" (input), text: `{contribute-verb-forms}`
		 *                     -> text: "contributed to" (merged text values)
		 *
		 * If `childSubText` remains unconjugated, save input tense from `childSub`, otherwise its `tense` was used in its conjugation.
		 */
		tense: childSubText.constructor !== String && childSub.ruleProps.tense,
		// Exclude `semanticIsReduced` and `secondRHSCanProduceSemantic`, which are specific to nonterminal nodes.
		semantic: subnodeRuleProps.semantic,
		/**
		 * Do not save `subnodeRuleProps.personNumber` from a term sequence insertion because it has yet to needed.
		 *
		 * Were `personNumber` needed, would likely be when `insertedSymIdx` is 1. If 0, then the `personNumber` value would have been from the inserted branch and used in conjugation above of the non-inserted portion, after which the subtree to which that `personNumber` applied would be complete.
		 *
		 * Ideally, however, should always save `personNumber` because the property could have been assigned to the insertion's original base rule instead of derived from its inserted portion, which is indistinguishable. If the former, then the property applies beyond this subtree.
		 */
		// personNumber: subnodeRuleProps.insertedSymIdx === 1 && subnodeRuleProps.personNumber,
	}
}

/**
 * Checks if `subnode`, which was passed to `createTermSequenceInsertionRuleProps()`, is ill-formed. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} subnode The `createTermSequenceInsertionRuleProps()` term sequence insertion subnode to inspect.
 * @returns {boolean} Returns `true` if `subnode` is ill-formed, else `false`.
 */
function isIllFormedTermSequenceInsertion(subnode) {
	var subnodeRuleProps = subnode.ruleProps
	if (!subnodeRuleProps.isTermSequence) {
		util.logError('`createTermSequenceInsertionRuleProps()` invoked on subnode without `isTermSequence`:', subnode)
		return true
	}

	if (!subnodeRuleProps.text) {
		util.logError('`createTermSequenceInsertionRuleProps()` invoked on subnode without insertion text (should use `createTermSequenceRuleProps()`):', subnode)
		return true
	}

	if (subnodeRuleProps.insertedSymIdx === undefined) {
		util.logError('`createTermSequenceInsertionRuleProps()` invoked on subnode without `insertedSymIdx` (should use `createTermSeqSubstitutionRuleProps()`):', subnode)
		return true
	}

	// Check for instances of `personNumber` on term sequence insertions when `insertedSymIdx` is 1. This has not been seen and consequently `createTermSequenceInsertionRuleProps()` does not currently check for it.
	if (subnodeRuleProps.personNumber && subnodeRuleProps.insertedSymIdx === 1) {
		util.logError('`personNumber` found on term sequence insertion with `insertedSymIdx` of 1:', subnode)
		return true
	}

	// Do not check because insertions with `[blank-inserted]` are binary nodes.
	// if (subnode.next) {
	// 	util.logError('Insertion subnode is binary:')
	// 	util.logObjectAtDepth(subnode, 3)
	// 	return true
	// }

	return false
}

/**
 * Gets the child subnode the term sequence `subnode` produces (i.e., in `subnode.node.subs`).
 *
 * `subnode` almost always produces a single child subnode, but in the rare cases (documented in `getCheapestChildSub()`) of multiple child subnodes, the term sequence is ambiguous (because semantically identical) and the cheapest must be chosen.
 *
 * @private
 * @static
 * @param {Object} subnode The term sequence subnode.
 * @returns {Object} Returns the subnode `subnode` produces.
 */
function getChildSub(subnode) {
	var childSubs = subnode.node.subs
	var childSub = childSubs.length === 1 ? childSubs[0] : getCheapestChildSub(subnode)

	// Check for unsupported properties on term sequence child subnodes.
	if (isIllFormedChildSubnode(childSub, subnode)) {
		throw new Error('Ill-formed term sequence child subnode')
	}

	return childSub
}

/**
 * Gets the cheapest child subnode the ambiguous term sequence `subnode` produces (i.e., in `subnode.node.subs`).
 *
 * For use by `getChildSub()` on term sequences that produce multiple child subnodes. Such subnodes are ambiguous because term sequences lack semantics, which makes them semantically identical. Only occurs in rare cases, documented below.
 *
 * @private
 * @static
 * @param {Object} subnode The ambiguous term sequence subnode.
 * @returns {Object} Returns the cheapest child subnode `subnode` produces.
 */
function getCheapestChildSub(subnode) {
	var childSubs = subnode.node.subs
	var childSubsLen = childSubs.length
	if (childSubsLen < 2) {
		util.logError('`getCheapestChildSub()` invoked on (unambiguous) subnode that does not have multiple child subnodes:', subnode)
		throw new Error('Ill-formed ambiguous term sequence')
	}

	/**
	 * `subnode` produces multiples subnodes. Choose the cheapest.
	 *
	 * This only occurs when the term sequence `subnode` is ambiguous, because term sequences can not produce semantics; they only differ by cost and display text. Ideally, term sequence subnodes are never ambiguous, but the overhead to avoid every cause of such ambiguity outweighs the cost of its rarity.
	 *
	 * The following are causes of term sequence ambiguity. Some can and should be avoided, and others can not:
	 * 1. Ambiguous grammar rules. For example, consider the term sequence `X`:
	 *      X -> "a"
	 *      X -> Y -> "a"
	 *    When "a" is matched in input, the term sequence `X` will have two subnodes. The grammar design causes this, and the grammar generator should prevent this.
	 *
	 * 2. Terminal symbol deletions, which can occur in two way:
	 *   A. Deleltables defined in the grammar.
	 *   B. After `Parser` fails to reach the start node or `pfsearch` fails to generate legal parse trees (due to contradictory semantics) on the initial parse, as a last resort, `Parser` reparses the input query with all tokens marked deletable.
	 *
	 *   These deletions enable the following possible instances of term sequence ambiguity:
	 *   A. Consider the binary RHS `X1 X2`, where `X2` produces a term sequence:
	 *        X1, X2 -> Y -> A -> "a"
	 *                    -> B -> "b"
	 *        X1, X2 -> Y -> A, text: "b" -> "a"
	 *      The rule `X2 -> Y` is a term sequence because every RHS symbol (i.e., just `Y`) produces a term sequence. `calcCostHeuratistics` flattens `Y` by merging the `text` of the rules it produces, and assigning the text to the rule `X2 -> Y` with a new, terminal `ruleProps`.
	 *      As shown, the term sequence `Y` recognizes the input "a b" and "a" with insertion text "b". Provided the input "a b", and with "b" marked deletable, `Y` will have two matches for the same token span: "a b", "a <b>" (where "b" is deleted).
	 *      The grammar generator should prevent this by forbidding unary term sequences (but, might be difficult for insertion rules within nested term sequences). This example would not occur if `Y` replaces `X2` in the initial binary rule.
	 *
	 *   B. Consider the following input:
	 *        "followers of my mine"
	 *      Consider a terminal rule set produces both "my" and "mine" (though both have display text "my"), and all tokens are marked deletable. This yields a node for the term sequence with two subnodes, each of which spans the last two input tokens, but contains different terminal rules: "my <mine>", "<my> mine". This is unavoidable in the grammar.
	 *
	 *   C. Consider the following input:
	 *        "followers of mine mine"
	 *      "mine" and "mine" will obviously be the same terminal rule. With "mine" marked deletable, there will be two subnodes for the same LHS symbol, spanning the last two input tokens: "mine <mine>", "<mine> mine". This is unavoidable in the grammar.
	 *      A terminal node table in `Parser.prototype.addTermRuleNodes()` could detect these duplicate instances of the same LHS symbol over the same span, similar to the nonterminal node table used in `Parser.prototype.addSub()`, but the overhead is too great for such rarity (even if the table is only used during the second parse).
	 *
	 *
	 * `calcHeuristicCosts` must choose the cheapest subnode for ambiguous term sequence matches, as opposed to when `Parser.prototype.addSub()` first adds these subnodes:
	 * 1. These cost comparisons will not always work in `Parser.prototype.addSub()` because the comparisons require completing all reductions of a subnode to know its cheapest subnode (i.e., a nested term sequence) before reducing with its parent term sequence node. However, `Parser` may reduce a parent node with a given node before reducing all of the latter node's child nodes. Moreover, `Parser` can not determine if all reductions for a node are complete until parsing completes. Hence, a comparison at that state might have an inaccurate minimum cost. For example, consider the term sequence `X`:
	 *     X -> A -> "z", cost: 0.5
	 *     X -> B -> "z", cost: 1
	 *          B -> C -> "z", cost: 0
	 *   Suppose `Parser` compares the reduction for `X -> B -> "z"` against `X -> A -> "z"`, finds the former more expensive, and discards it. Later, `Parser` reduces the third rule sequence above, `B -> C -> "z"`, which makes the reduction `X -> B` cheaper than `X -> A`; however, it is too late because the reduction `X -> B` was already discarded and will not reappear.
	 *
	 * 2. Though `Parser.prototype.addSub()` could catch most instances of term sequence ambiguity (i.e., #1 is uncommon), it would be inefficient to search for the cheapest term sequence for parse nodes that might never reach the start node. In contrast, every term sequence subnode comparison in `calcHeuristicCosts` had to have reached the start node.
	 */

	 /**
	  * Check the ambiguous term sequence includes a terminal symbol deletion: spans multiple input tokens and has the minimum deletion cost (1 for grammar-defined deletables).
	  * • Check every child subnode has the minimum deletion cost, instead of only checking `subnode.node.minCost`, to avoid halting for a grammar-defined stop-word that is ambiguous with a term marked `Parser` marked as deletable on a reparse.
	  *
	  * Does not catch all grammar-induced instances of term sequence ambiguity. E.g., a multi-token term sequence with high non-edit rule costs will evade this check. Though, unlikely because term sequences lack semantics.
	  * • Can be tracked absolutely with `ruleProps.hasDeleltion`, but it is best to avoid the complexity for such a rare error which ideally is caught in grammar generation.
	  */
	if (subnode.size === 1 || childSubs.every(childSub => childSub.ruleProps.cost < 1)) {
		util.logError('Term sequence ambiguity caused by ill-formed grammar (not deletion):', subnode)
		util.log.apply(null, [ '\nAmbiguous child subnodes:' ].concat(childSubs))
		throw new Error('Ill-formed term sequence')
	}

	/**
	 * Choose the cheapest subnode for the ambiguous term sequence.
	 *
	 * The cheapest subnode is the same child node that set `subnode.minCost` in `calcHeuristicCosts()`.
	 *
	 * All subnodes here likely have identical display text (and input tense) by the nature of the possible sources of this ambiguity, documented above.
	 */
	var cheapestChildSub = childSubs[0]
	var cheapestChildSubCost = cheapestChildSub.ruleProps.cost
	for (var s = 1; s < childSubsLen; ++s) {
		var childSub = childSubs[s]
		var childSubCost = childSub.ruleProps.cost

		// Compare `childSub.ruleProps.cost`, not `childSub.node.minCost`, because `calcHeuristicCosts` already traversed and flattened `subnode.node.subs`, merging their `minCost` with their `ruleProps.cost` on their new, terminal `ruleProps`. Also, `ruleProps.cost` of binary nodes includes the cost of both subnodes.
		if (childSubCost < cheapestChildSubCost) {
			cheapestChildSub = childSub
			cheapestChildSubCost = childSubCost
		}
	}

	return cheapestChildSub
}

/**
 * Checks if term sequence child subnode `childSub` has unsupported `ruleProps` properties. If so, prints an error.
 *
 * These properties have yet to be seen on child subnodes, though would be easy to support.
 *
 * @private
 * @static
 * @param {Object} childSub The term sequence child subnode to inspect.
 * @param {Object} subnode The term sequence subnode that produces `childSub`.
 * @returns {boolean} Returns `true` if `childSub` is ill-formed, else `false`.
 */
function isIllFormedChildSubnode(childSub, subnode) {
	var childRuleProps = childSub.ruleProps
	var forbiddenChildProps = [ 'personNumber', 'anaphoraPersonNumber', 'semantic' ]

	for (var p = 0; p < 3; ++p) {
		var propName = forbiddenChildProps[p]
		if (childRuleProps[propName]) {
			util.logError('Term sequence child subnode has forbidden property `', propName, '`:')
			util.log('  subnode:', subnode)
			util.log('  child:', childSub)
			return true
		}
	}

	return false
}

/**
 * Gets the display text `subnode` produces (i.e., `subnode.ruleProps.text`).
 *
 * If `parentGramProps` is defined and `subnode.ruleProps.text` is a conjugative display text object or array, returns the conjugated text string.
 * • If `parentGramProps.acceptedTense` and input tense, `subnode.ruleProps.tense`, exist and match, conjugates the verb with the optional tense accepted when input. If `subnode` itself has nested term sequences (i.e., is multi-token), then `subnode.ruleProps.tense` is an input tense that has propagated upward. For example:
 *   subnode: `[like]`,
 *   subnode.ruleProps.tense: "past",
 *   parentGramProps: { acceptedTense: "past" },
 *     => "liked"
 * • Else if `parentGramProps.form` exists, conjugates the verb. For example:
 *   subnode `[create]`,
 *   parentGramProps: { form: "past" },
 *     => "created"
 * • `flattenTermSequence` does not check if a parent node has `gramProps` that goes unused, and thus should be checked in grammar generation.
 *
 * Else if `insertedPersonNumber` is defined and `subnode.ruleProps.text` is a conjugative display text object or array, returns the conjugated text string.
 * • For use by `createTermSequenceInsertionRuleProps()` when the parent node of `subnode` is an insertion with `ruleProps.insertedSymIdx` of 0 and the inserted (leading) text, to which the text this function returns will be appended, was generated from a nominative subject (e.g., "I" -> "oneSg"). For example:
 *   subnode: `[have]`,
 *   personNumber: "oneSg",
 *     => "have"
 * • For use by `createTermSequenceInsertionRuleProps()` when the parent node of `subnode` is an insertion with `ruleProps.insertedSymIdx` of 0, for which the inserted text was generated from a nominative subject.
 *
 * Else if `parentGramProps` is defined and `subnode.ruleProps.text` is a non-conjugative string, then `parentGramProps` is intended for another term within the same term sequence. In the following example, `gramProps.form` is intended for the child node [verb-contribute]`, not `[prep-to]`:
 *   `[contribute-to]`, gramProps.form: "past" -> `[verb-contribute]` `[prep-to]`
 *
 * Else if `subnode.ruleProps.text` is a conjugative display text object or array but `parentGramProps` is `undefined`, returns the text object or array to be conjugated by a `gramProps` of an ancestor rule higher in its tree or a `personNumber` property in a preceding nominative rule in its tree.
 *
 * Throws an exception if `subnode` lacks display text.
 *
 * @private
 * @static
 * @param {Object} subnode The term sequence subnode.
 * @param {Object} [parentGramProps] The `ruleProps.gramProps` of the parent subnode that produces `subnode`.
 * @param {string} [insertedPersonNumber] The `ruleProps.personNumber` of the parent insertion subnode that has `ruleProps.insertedSymIdx` of 0. For use by `createTermSequenceInsertionRuleProps()` when the parent subnode's inserted (leading) text was generated from a nominative subject.
 * @returns {Object|string} Returns the display text `subnode` produces, conjugated if possible.
 */
function getSubnodeText(subnode, parentGramProps, insertedPersonNumber) {
	var text = subnode.ruleProps.text
	if (text) {
		/**
		 * Conjugate `text` if `parentGramProps` or `insertedPersonNumber` is defined and `subnode.ruleProps.text` is a conjugative text object or an array containing a conjugative text object.
		 *
		 * Do not extend this conditional to ignore when `text` is a string, instead of passing to `conjugateText()` which returns it unchanged, because `text` is rarely a string when `parentGramProps` is defined.
		 */
		if (parentGramProps || insertedPersonNumber) {
			return conjugateText(text, parentGramProps, subnode.ruleProps.tense, insertedPersonNumber)
		}

		/**
		 * `parentGramProps` can exist and not conjugate `text` if `text` is a string and `parentGramProps` is intended for another term within the same sequence.
		 *
		 * `text` can be a conjugative object or array and `parentGramProps` be undefined if `text` requires a `gramProps` of an ancestor rule higher in its tree or a `personNumber` property in a preceding nominative rule in its tree.
		 */
		return text
	}

	printSubnodeErr(subnode, subnode.node.subs, 'Term sequence subnode lacks `text`')
	throw new Error('Ill-formed term sequence')
}

/**
 * Conjugates `text`, if conjugative.
 *
 * If `text` is an array, conjugates text objects within the array and concatenates resulting strings with separating spaces.
 *
 * @private
 * @static
 * @param {Object|string|(Object|string)[]} text The display text invariable string, conjugative text object, or array of invariable strings and conjugative objects to conjugate.
 * @param {Object} [parentGramProps] The `ruleProps.gramProps` of the parent subnode that produces the subnode that owns `text`.
 * @param {string} [inputTense] The term sequence's input tense, defined by a descendant verb terminal symbol's `tense` property, with which to conjugate `text` if matches `parentGramProps.acceptedTense`.
 * @param {string} [insertedPersonNumber] The `ruleProps.personNumber` of the parent subnode if the subnode is an insertion where `ruleProps.insertedSymIdx` is 0.
 * @returns {string} Returns the conjugated display text.
 */
function conjugateText(text, parentGramProps, inputTense, insertedPersonNumber) {
	var textConstructor = text.constructor

	// Conjugate `text` to its correct inflection. 87% of cases.
	if (textConstructor === Object) {
		return conjugateTextObject(text, parentGramProps, inputTense, insertedPersonNumber)
	}

	// No conjugation. Occurs when the parent node has a `gramProps` intended to conjugate the text object in the binary node's other branch, or for invariable strings in conjugative text arrays.
	// Check after `Object` check because of its infrequency.
	if (textConstructor === String) {
		return text
	}

	// Conjugate text objects within a text array, and concatenate resulting strings with invariable strings in the array. Never contains nested arrays.
	var conjugatedText = ''
	for (var t = 0, textArrayLen = text.length; t < textArrayLen; ++t) {
		if (t > 0) {
			// Concatenate text items with spaces. Avoid adding leading space.
			conjugatedText += ' '
		}
		conjugatedText += conjugateText(text[t], parentGramProps, inputTense, insertedPersonNumber)
	}
	return conjugatedText
}

/**
 * Conjugates `textObj` to the term's correct inflection according to the parent subnode's `parentGramProps` or `insertedPersonNumber`.
 *
 * @private
 * @static
 * @param {Object} textObj The child subnode's display text object to conjugate.
 * @param {Object} [parentGramProps] The `ruleProps.gramProps` of the parent subnode that produces the subnode that owns `textObj`.
 * @param {string} [inputTense] The term sequence's input tense, defined by a descendant verb terminal symbol's `tense` property, with which to conjugate `textObj` if matches `parentGramProps.acceptedTense`.
 * @param {string} [insertedPersonNumber] The `ruleProps.personNumber` of the parent subnode if the subnode is an insertion where `ruleProps.insertedSymIdx` is 0.
 * @returns {string} Returns the display text `subnode` produces.
 */
function conjugateTextObject(textObj, parentGramProps, inputTense, insertedPersonNumber) {
	if (parentGramProps) {
		/**
		 * Conjugate a child subnode within a term sequence if terminal symbol input tense matches optionally accepted tense.
		 *
		 * For example, consider a term sequence that contains `[give-to]`, which itself produces a rule with `gramProps.acceptedTense` and conjugative `[verb-give]`:
		 *   `[give-to]` -> gramProps.acceptedTense: "past"
		 *               -> `[verb-give]` -> "gave", text: `{give-verb-forms}`, tense: "past"
		 *               -> `[to]`        -> "to",   text: "to"
		 *               => "gave to" - because `[verb-give]` was input in past tense.
		 *
		 * Perform `parentGramProps.acceptedTense` conjugation before `parentGramProps.form` to support subject verb rules that have both properties. For example: "people who like/liked ...".
		 */
		if (inputTense && parentGramProps.acceptedTense === inputTense && textObj[inputTense]) {
			return textObj[inputTense]
		}

		/**
		 * Conjugate a child subnode within a term sequence that defines a grammatical form.
		 *
		 * For example, consider a term sequence that contains `[mentioned-in]`, which itself produces a rule with `gramProps.form` and conjugative `[verb-mention]`:
		 *   `[mentioned-in]` -> gramProps.form: "past"
		 *                    -> `[verb-mention]` -> "mention", text: `{mention-verb-forms}`
		 *                    -> `[in]`           -> "in",      text: "in"
		 *                    => "mentioned in"
		 */
		var grammaticalForm = parentGramProps.form
		if (grammaticalForm && textObj[grammaticalForm]) {
			return textObj[grammaticalForm]
		}
	}

	/**
	 * Conjugate a child subnode within a term sequence if the parent subnode is an insertion with `personNumber` and `insertedSymIdx` of 0. In this case, the inserted (leading) `text`, to which this text will be appended, was generated from a nominative subject.
	 *
	 * For example, consider an insertion node with leading insertion text "I" and `personNumber` of "oneSg", paired with non-insertion verb sequence `[have]`:
	 *   rhs: [ `[have]` ] -> "have", text: `{have-verb-forms}`
	 *   insertedSymIdx: 0,
	 *   personNumber: "oneSg",
	 *   text: "I",
	 *   => "I have"
	 */
	if (insertedPersonNumber && textObj[insertedPersonNumber]) {
		return textObj[insertedPersonNumber]
	}

	/*
	 * Throw an exception a parent node's `gramProps` fails to conjugate a conjugative text object produced by a descendant node.
	 *
	 * This text object could be left not conjugated for a grammatical property higher within the parse tree, though we have yet to see such a case.
	 */
	util.logError('Failed to conjugate:')
	util.log('  Text object:', textObj)
	util.log('  Parent rule `gramProps`:', parentGramProps)
	util.log()
	throw new Error('Failed term sequence conjugation')
}

/**
 * Prints an error to the console for `subnode` and `childSubs` with `errMsg`.
 *
 * @private
 * @static
 * @param {Object} subnode The parser subnode.
 * @param {Object[]} childSubs The problematic child sub node set of `subnode` to print.
 * @param {string} errMsg The error message to print.
 */
function printSubnodeErr(subnode, childSubs, errMsg) {
	// Append ":" to `errMsg` if lacks.
	if (errMsg[errMsg.length - 1] !== ':') {
		errMsg += ':'
	}

	util.logError(errMsg, stringifySubnode(subnode))
	util.logObjectAtDepth(childSubs, 3)
}

/**
 * Creates a string representation of `subnode` for printing to the console.
 *
 * Formats the node as follows: '[rhs-a]' '[rhs-b]'.
 *
 * @private
 * @static
 * @param {Object} subnode The subnode (unary or binary) to stringify.
 * @returns {string} Returns the subnode string representation.
 */
function stringifySubnode(subnode) {
	var leftSymName = util.stylize(subnode.node.sym.name)

	// Check if `subnode` is binary.
	var subnodeNext = subnode.next
	if (subnodeNext) {
		return leftSymName + ' ' + util.stylize(subnodeNext.node.sym.name)
	}

	// `subnode` is unary.
	return leftSymName
}