// Manually implement "be" as a term sequence, then implement the associated nonterminal rules, and at last return to extending `verbTermSet` to support it with the necessary parameterization and abstraction.
var g = require('../grammar')


exports.present = g.newSymbol('be', 'present')

var bePresentInsertionCost = 1

var bePresentVerbFormsTermSet = {
	oneSg: 'am',
	threeSg: 'is',
	pl: 'are',
	subjunctive: 'be',
	participle: 'being',
}

var bePresentDisplayText = {
	oneSg: bePresentVerbFormsTermSet.oneSg,
	threeSg: bePresentVerbFormsTermSet.threeSg,
	pl: bePresentVerbFormsTermSet.pl,
}

Object.keys(bePresentVerbFormsTermSet).forEach(function (beVerbForm, i) {
	var newVerbTerminalRule = {
		isTerminal: true,
		rhs: beVerbForm,
		text: bePresentDisplayText,
	}

	if (i === 0) {
		newVerbTerminalRule.insertionCost = bePresentInsertionCost
	}

	exports.present.addRule(newVerbTerminalRule)
})

exports.present._toTermSequence({
	isTermSet: true,
	type: g.termTypes.VERB_PRESENT,
	defaultText: bePresentDisplayText,
	insertionCost: bePresentInsertionCost,
})


exports.past = g.newSymbol('be', 'past')

var bePastVerbFormsTermSet = {
	oneSg: 'was',
	threeSg: 'was',
	pl: 'were',
	subjunctive: 'were',
	participle: 'been',
}

var bePastDisplayText = {
	oneSg: bePastVerbFormsTermSet.oneSg,
	threeSg: bePastVerbFormsTermSet.threeSg,
	pl: bePastVerbFormsTermSet.pl,
}

Object.keys(bePastVerbFormsTermSet).forEach(function (beVerbForm) {
	// Unsure if need to define `tense` as 'past'.
	exports.past.addRule({
		isTerminal: true,
		rhs: beVerbForm,
		// Use a conjugative text object for past tense.
		text: bePastDisplayText,
	})
})

exports.past._toTermSequence({
	isTermSet: true,
	type: g.termTypes.VERB_PAST,
	defaultText: bePastDisplayText,
})