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

	// Use a conjugative text object for both present and past tense.
	var beDisplayText = {
		oneSg: options.verbFormsTermSet.oneSg,
		threeSg: options.verbFormsTermSet.threeSg,
		pl: options.verbFormsTermSet.pl,
	}

	Object.keys(options.verbFormsTermSet).forEach(function (beVerbForm, i) {
		// Unsure if should define `tense` as 'past' for past tense set.
		var newVerbTerminalRule = {
			isTerminal: true,
			rhs: beVerbForm,
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