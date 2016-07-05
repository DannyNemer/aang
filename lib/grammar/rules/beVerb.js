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