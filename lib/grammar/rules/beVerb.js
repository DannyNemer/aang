// Manually implement "be" as a term sequence, then implement the associated nonterminal rules, and at last return to extending `verbTermSet` to support it with the necessary parameterization and abstraction.
var g = require('../grammar')


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
	// Unsure. `defaultText` is only used for term sequence substitution display text when `[be-no-tense]` is in the first `acceptedTerms` of that term sequence.
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