var g = require('../../grammar')
var preps = require('../prepositions')
var user = require('../user/user')
var company = require('./company')


var work = g.newVerb({
	symbolName: 'work',
	// NOTE: Temporarily increase `insertionCost` until can prevent its use with the `[contribute-to]` substitution set, "work on".
	insertionCost: 1.5,
	acceptedVerbTermSets: [ {
		oneSg: 'work',
		threeSg: 'works',
		pl: 'work',
		past: 'worked',
		presentParticiple: 'working',
	} ],
})

var employeesSemantic = g.newSemantic({
	name: 'employees',
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
})

var workSubjFilterPast = g.newSymbol('work', 'subj', 'filter', 'past')

// (people who) worked at `[companies+]`
workSubjFilterPast.addRule({
	rhs: [ work, [ preps.benefactive, company.plPlus ] ],
	// Dictates inflection of `work`:
	//   "(people who) `[work]` at `[companies+]`" -> "(people who) worked at `[companies+]`"
	grammaticalForm: 'past',
})

// Past-tense rules for `employees()`:
//   (people who) worked at `[companies+]`,             `ever-past()`
//   (people who) previously worked at `[companies+]`,  `past()`
//   (people who) worked at `[companies+]` in the past, `past()`
//   (people who) ever worked at `[companies+]`,        `ever()`
//   (people who) have |ever worked at `[companies+]` , `ever()`
//   (people who) have not worked at `[companies+]` ,   `not(ever())`
//   (people who) never worked at `[companies+]` ,      `not(ever())`
//   (people who) have never worked at `[companies+]` , `not(ever())`
user.subjFilterPast.addRule({
	rhs: [ workSubjFilterPast ],
	semantic: employeesSemantic,
})


var workSubjFilterPresent = g.newSymbol('work', 'subj', 'filter', 'present')

workSubjFilterPresent.addRule({
	// The grammatical person-number in the parent rule that produces `[user-subj-filter]`, defined as `pl`, dictates the inflection of `[work]`:
	//   "(people who) `[work]`" -> "(people who) work".
	rhs: [ work, [ preps.benefactive, company.plPlus ] ],
})

// Present-tense rule for `employees()`:
//   (people who) work at `[companies+]`, `present()`
// Past-tense rule for `employees()`:
//   (people who did not) work at `[companies+]`, `not(ever())`
user.subjFilterPresent.addRule({
	rhs: [ workSubjFilterPresent ],
	semantic: employeesSemantic,
})