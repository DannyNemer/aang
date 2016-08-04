// Manually implement "be" as a term sequence, then implement the associated nonterminal rules, and at last return to extending `verbTermSet` to support it with the necessary parameterization and abstraction.
var g = require('../grammar')
var termSequenceUtil = require('../termSequence/termSequenceUtil')


// (people who) are (employed by `[companies+]`)
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

// (people who) were (employed by `[companies+]`)
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

// (issues I) am/was (mentioned in)
exports.noTense = g.newSymbol('be', 'no', 'tense').addRule({
	// Not a substitution rule: no `text`.
	rhs: [ exports.present ],
}).addRule({
	rhs: [ exports.past ],
})._toTermSequence({
	// Specify contains every verb form (of both tenses).
	type: g.termTypes.VERB,
	// When nesting this term sequence within the first `acceptedTerms` of another term sequence, use `[be-present]` as the display text of that term sequence's substitutions. This is not currently in use as such.
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

	// Use a conjugative text object for both present and past tense.
	var beDisplayText = {
		oneSg: verbFormsTermSet.oneSg,
		threeSg: verbFormsTermSet.threeSg,
		pl: verbFormsTermSet.pl,
	}

	Object.keys(verbFormsTermSet).forEach(function (formName, i) {
		var verbForm = verbFormsTermSet[formName]

		// Ignore identical definitions for `oneSg` and `threeSg`: `[be-past]` -> "was"
		if (formName === 'threeSg' && verbForm === verbFormsTermSet.oneSg) {
			return
		}
		// Ignore identical definitions for `pl` and `subjunctive`: `[be-past]` -> "were"
		if (formName === 'subjunctive' && verbForm === verbFormsTermSet.pl) {
			return
		}

		// Unsure if should define `tense` as 'past' for past tense set.
		var newVerbTerminalRule = {
			isTerminal: true,
			rhs: verbForm,
			text: beDisplayText,
		}

		if (options.insertionCost !== undefined && i === 0) {
			newVerbTerminalRule.insertionCost = options.insertionCost
		}

		beVerbSym.addRule(newVerbTerminalRule)
	})

	// Extend `beVerbSym` with term sequence properties.
	return beVerbSym._toTermSequence({
		isTermSet: true,
		type: options.type,
		defaultText: beDisplayText,
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
	 * Assign 'past' to all terminal rules `[be-past]` produces only when `[be-past]` (or a parent) is a substitution within another verb term sequence that has the parent grammatical property `acceptedTense` as 'past'. Currently, there is no such usage.
	 *
	 * None of the `beVerb` sets in this module have `past` defined on their conjugative display text object, and therefore none can be used with a parent `acceptedTense`.
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