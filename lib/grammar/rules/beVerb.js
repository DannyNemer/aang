/**
 * The manual implementation of "be" as term sequences.
 *
 * Upon finalizing the rule structure design, will extend `verbTermSet` with the necessary abstractions to support verbs with this design.
 */

var util = require('../../util/util')
var g = require('../grammar')
var termSequenceUtil = require('../termSequence/termSequenceUtil')


/**
 * (people who) are (employed by `[companies+]`)
 *
 * Matches only the present tense "be" forms in input.
 * • For use by rule sets where tense is semantically meaningful, and therefore must not substitute to the past tense, which must have a different semantic.
 */
exports.present = createBeConjugativeVerbTerminalRuleSet({
	symbolName: g.hyphenate('be', 'present'),
	type: g.termTypes.VERB_PRESENT,
	insertionCost: 1,
	verbFormsTermSet: {
		oneSg: 'am',
		threeSg: 'is',
		pl: 'are',
		subjunctive: 'be',
		participle: 'being',
	},
})

/**
 * (people who) were (employed by `[companies+]`)
 *
 * Matches only the past tense "be" forms in input.
 * • For use by rule sets where tense is semantically meaningful, and therefore must not substitute to the present tense, which must have a different semantic.
 *
 * Every terminal rule has `tense` defined as 'past', though only used to maintain input tense when `[be-past]` is a substitution within another term sequence that is defined on a rule with matching `acceptedTense`. `[be-past]` itself does not work with `acceptedTense` because its conjugative `text` object has no `past` value.
 */
exports.past = createBeConjugativeVerbTerminalRuleSet({
	symbolName: g.hyphenate('be', 'past'),
	type: g.termTypes.VERB_PAST,
	verbFormsTermSet: {
		oneSg: 'was',
		threeSg: 'was',
		pl: 'were',
		subjunctive: 'were',
		participle: 'been',
	},
})

/**
 * (issues I) am/was (mentioned in)
 *
 * Matches every "be" form in input and conjugates to the correct form in the matched tense.
 * • For use by verb rule sets where the actions can be represented in present or past tense, though tense is not semantically meaningful.
 */
exports.noTense = g.newSymbol('be', 'no', 'tense').addRule({
	// Not a substitution rule: no `text`.
	rhs: [ exports.present ],
}).addRule({
	// Could define `tense` on this rule, though nonterminal rules do not currently support the property and `flattenTermSequence` only looks at child parser nodes for the `tense` value.
	rhs: [ exports.past ],
})._toTermSequence({
	// Specify produces terminal rules for every verb form of both tenses.
	type: g.termTypes.VERB,
	// When nesting this term sequence within the first `acceptedTerms` of another term sequence, use `[be-present]` as the display text of that term sequence's substitutions. Currently, there is no such usage.
	defaultText: exports.present.defaultText,
})

/**
 * (issues I have) been (mentioned in)
 * (repos that) are (created by me) -> (...) were (created by me)
 *
 * Matches every "be" form in input and conjugates to the correct past tense form.
 * • For use by verb rule sets that represent past actions that must use past tense display text, though it is not semantically meaningful.
 */
exports.pastWithSubstitutedPresentForms = g.newSymbol(exports.past.name, 'with', 'substituted', 'present', 'forms').addRule({
	rhs: [ exports.past ],
}).addRule({
	rhs: [ exports.present ],
	// Substitute the present tense terminal symbols with the `[be-past]` conjugative `text` object when matched in input.
	text: exports.past.defaultText,
})._toTermSequence({
	// Specify produces terminal rules for every verb form of both tenses.
	type: g.termTypes.VERB,
	defaultText: exports.past.defaultText,
})

/**
 * (people who) were (followed by me) -> (...) are (followed by me)
 *
 * Matches every "be" form in input and conjugates to the correct present tense form.
 * • For use by verb rule sets that represent present actions that must use present tense display text, though it is not semantically meaningful.
 */
exports.presentWithSubstitutedPastForms = g.newSymbol(exports.present.name, 'with', 'substituted', 'past', 'forms').addRule({
	rhs: [ exports.present ],
}).addRule({
	rhs: [ exports.past ],
	// Substitute the past tense terminal symbols with the `[be-present]` conjugative `text` object when matched in input.
	text: exports.present.defaultText,
})._toTermSequence({
	// Specify produces terminal rules for every verb form of both tenses.
	type: g.termTypes.VERB,
	defaultText: exports.present.defaultText,
})


/**
 * Creates a verb terminal rule set with a conjugative text object for "be".
 *
 * @private
 * @static
 * @param {Object} options The options object.
 * @returns {NSymbol} Returns the new `NSymbol` for the terminal rule set.
 */
function createBeConjugativeVerbTerminalRuleSet(options) {
	var beVerbSym = g.newSymbol(options.symbolName)
	var verbFormsTermSet = options.verbFormsTermSet
	var tense = options.type === g.termTypes.VERB_PAST ? 'past' : 'present'

	// The conjugative `text` object, for use by both present and past tense sets.
	var displayText = {
		oneSg: verbFormsTermSet.oneSg,
		threeSg: verbFormsTermSet.threeSg,
		pl: verbFormsTermSet.pl,
	}

	/**
	 * The terminal rule for the first-person-singular verb form, chosen by the nonterminal rule property `personNumber`: "am", "was".
	 *
	 * Assign `options.insertionCost`, if defined, to the first terminal rule in the set.
	 */
	beVerbSym.addRule(createVerbTerminalRule(verbFormsTermSet.oneSg, displayText, tense, options.insertionCost))

	/**
	 * The terminal rule for the third-person-singular verb form, chosen by the nonterminal rule property `personNumber`: "is", "was".
	 *
	 * Check if distinguishable from the first-person-singular verb form to avoid duplicity errors, because grammatically the two verb forms can be identical: "was".
	 */
	if (verbFormsTermSet.threeSg !== verbFormsTermSet.oneSg) {
		beVerbSym.addRule(createVerbTerminalRule(verbFormsTermSet.threeSg, displayText, tense))
	}

	// The terminal rule for the the plural verb form, chosen by the nonterminal rule property `personNumber` and the `grammaticalForm` value 'infinitive': "are", "were".
	beVerbSym.addRule(createVerbTerminalRule(verbFormsTermSet.pl, displayText, tense))

	/**
	 * The terminal rule for the subjunctive verb form, substituted when input with `displayText`: "be", "were".
	 *
	 * Check if distinguishable from the plural verb form to avoid duplicity errors, because grammatically the two verb forms can be identical: "were".
	 */
	if (verbFormsTermSet.subjunctive !== verbFormsTermSet.pl) {
		beVerbSym.addRule(createVerbTerminalRule(verbFormsTermSet.subjunctive, displayText, tense))
	}

	// The terminal rule for the the participle verb form, substituted when input with `displayText`: "being", "been".
	beVerbSym.addRule(createVerbTerminalRule(verbFormsTermSet.participle, displayText, tense))

	// Extend `beVerbSym` with term sequence properties. Enables nesting of `beVerbSym` in other term sequences with matching term sequence type, and prevents addition of further rules to `beVerbSym`.
	return beVerbSym._toTermSequence({
		isTermSet: true,
		type: options.type,
		defaultText: displayText,
		insertionCost: options.insertionCost,
	})
}

/**
 * Creates an `NSymbol.prototype.addRule()` options object for `terminalSymbol` with `displayText` as its `text` value, `tense`, and `insertionCost` if defined.
 *
 * @private
 * @static
 * @param {string} terminalSymbol The terminal symbol to match in input.
 * @param {Object} displayText The conjugative terminal rule `text` value.
 * @param {string} tense The grammatical tense of `terminalSymbol`. Either 'present' or 'past'.
 * @param {number} [insertionCost] The terminal rule insertion cost. Enables creation of insertion rules using the `NSymbol` to which the returned rule is added.
 * @returns {Object} Returns the new terminal rule `NSymbol.prototype.addRule()` options object.
 */
function createVerbTerminalRule(terminalSymbol, displayText, tense, insertionCost) {
	// Check `terminalSymbol` lacks whitespace and forbidden characters.
	if (termSequenceUtil.isIllFormedTerminalSymbol(terminalSymbol)) {
		throw new Error('Ill-formed verb terminal symbol')
	}

	if (tense !== 'present' && tense !== 'past') {
		util.logError('Unrecognized verb rule grammatical tense:', util.stylize(tense))
		throw new Error('Ill-formed verb terminal rule')
	}

	var newVerbTerminalRule = {
		isTerminal: true,
		rhs: terminalSymbol,
		text: displayText,
	}

	/**
	 * Assign 'past' to all terminal rules `[be-past]` produces only when `[be-past]`. Maintains input tense when `[be-past]` is a substitution within another term sequence that is defined on a rule with matching `acceptedTense`. Currently, there is no such usage.
	 *
	 * None of the `beVerb` sets in this module have `past` defined on their conjugative display text object, and therefore none can are compatible with a parent `acceptedTense`.
	 */
	if (tense === 'past') {
		newVerbTerminalRule.tense = tense
	}

	// Assign `insertionCost`, if provided.
	if (insertionCost !== undefined) {
		newVerbTerminalRule.insertionCost = insertionCost
	}

	return newVerbTerminalRule
}