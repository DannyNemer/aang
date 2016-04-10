var g = require('../../grammar')
var user = require('./user')
var auxVerbs = require('../auxVerbs')


// Returns objects associated with a date in the past (excluding the present).
var pastSemantic = g.newSemantic({
	name: 'past',
	cost: 0,
	minParams: 1,
	maxParams: 1,
})

// Returns objects associated with a date in the past or present.
var everPastSemantic = g.newSemantic({
	name: g.hyphenate('ever', 'past'),
	cost: 0.3,
	minParams: 1,
	maxParams: 1,
})

// Returns objects associated with a date in the past, present, or future.
// NOTE: Might remove this semantic.
var everSemantic = g.newSemantic({
	name: 'ever',
	cost: 0.3,
	minParams: 1,
	maxParams: 1,
})

var notEverSemantic = g.reduceSemantic(auxVerbs.notSemantic, everSemantic)

// Returns objects associated with a date in the present.
var presentSemantic = g.newSemantic({
	name: 'present',
	cost: 0,
	minParams: 1,
	maxParams: 1,
})

// Returns objects associated with a future date.
var futureSemantic = g.newSemantic({
	name: 'future',
	cost: 0.3,
	minParams: 1,
	maxParams: 1,
})


var previously = g.newTerm({
	symbolName: 'previously',
	acceptedTerms: [ 'previously', 'formerly' ],
})

var currently = g.newTerm({
	symbolName: 'currently',
	acceptedTerms: [ 'currently', 'presently', 'now' ],
})

var usedTo = g.newTerm({
	symbolName: g.hyphenate('used', 'to'),
	acceptedTerms: [ 'used to' ],
})

var ever = g.newTerm({
	symbolName: 'ever',
	acceptedTerms: [ 'ever' ],
})

var never = g.newTerm({
	symbolName: 'never',
	acceptedTerms: [ 'never' ],
	substitutedTerms: [ 'not ever' ],
})

var will = g.newTerm({
	symbolName: 'will',
	acceptedTerms: [ 'will' ],
})

var haveEverOpt = g.newSymbol(auxVerbs.have.name, ever.name, 'opt').addRule({
	rhs: [ auxVerbs.have, ever ],
}).addRule({
	rhs: [ auxVerbs.have ],
})


// Represent actions for verbs for which the tense (i.e., time) is meaningful.
user.subjFilterPast = g.newSymbol(user.subjFilter.name, 'past')
user.subjFilterPresent = g.newSymbol(user.subjFilter.name, 'present')


// (people who) worked at `[companies+]`, `ever-past()`
user.subjFilter.addRule({
	rhs: [ user.subjFilterPast ],
	semantic: everPastSemantic,
})

// (people who) previously worked at `[companies+]`, `past()`
user.subjFilter.addRule({
	rhs: [ previously, user.subjFilterPast ],
	// Enable transposition:
	//   "(people who) worked at `[companies+]` previously" -> "(people who) previously worked at `[companies+]`"
	transpositionCost: 1,
	// Prevent `[previously]` insertion. Though semantically distinct from `[user-subj-filter]` -> `[user-subj-filter-past]`, the difference scarcely distinguishable.
	noInsertionIndexes: [ 0 ],
	semantic: pastSemantic,
})

/**
 * NOTE: Currently, all suggestions after the first result exclude "in the past" because "in the past" is also a stop-word (`[sentence-adverbial]`). This is because no insertions are possible for when "in the past" is not matched to the stop-word. Fixing this requires insertions for "and `[filter+]`" (and similar rules), which can not be implemented until preventing cases where `pfsearch` finds no legal parse trees due to semantic restrictions (otherwise, it can search infinitely).
 *
 * NOTE: Perhaps do not include this rule because it is confusing what "in the past" applies to. For example
 *   "(people who) worked at companies that raised 20 in funding in the past"
 */
// FIXME: Improve and finalize multi-token terminal symbol implementation.
var inThePast = g.newSymbol('in', 'the', 'past').addRule({ isTerminal: true, rhs: 'in the past'})
// (people who) worked at `[companies+]` in the past, `past()`
user.subjFilter.addRule({
	rhs: [ user.subjFilterPast, inThePast ],
	// Prevent `[in-the-past]` insertion. Though semantically distinct from `[user-subj-filter]` -> `[user-subj-filter-past]`, the difference scarcely distinguishable.
	noInsertionIndexes: [ 1 ],
	semantic: pastSemantic,
})

// (people who) ever worked at `[companies+]`, `ever()`
user.subjFilter.addRule({
	rhs: [ ever, user.subjFilterPast ],
	// Prevent `[ever]` insertion.
	noInsertionIndexes: [ 0 ],
	semantic: everSemantic,
})

// (people who) have |ever worked at `[companies+]`, `ever()`
user.subjFilter.addRule({
	// NOTE: Unsure whether to use `[have-ever-opt]`, or flatten and create one more `[user-subj-filter]` rule.
	rhs: [ haveEverOpt, user.subjFilterPast ],
	// Prevent `[have]` insertion. Though semantically distinct from `[user-subj-filter]` -> `[user-subj-filter-past]`, the difference scarcely distinguishable.
	noInsertionIndexes: [ 0 ],
	semantic: everSemantic,
})

// (people who) have not worked at `[companies+]`, `not(ever())`
user.subjFilter.addRule({
	rhs: [ auxVerbs.haveNoInsertNegation, user.subjFilterPast ],
	// Prevent `[have-no-insert-negation]` insertion.
	noInsertionIndexes: [ 0 ],
	semantic: notEverSemantic,
})

// (people who) never worked at `[companies+]`, `not(ever())`
user.subjFilter.addRule({
	rhs: [ never, user.subjFilterPast ],
	// Prevent `[never]` insertion.
	noInsertionIndexes: [ 0 ],
	semantic: notEverSemantic,
})

// (people who) have never worked at `[companies+]`, `not(ever())`
user.subjFilter.addRule({
	rhs: [ [ auxVerbs.have, never ], user.subjFilterPast ],
	// Prevent `[have-never]` insertion.
	noInsertionIndexes: [ 0 ],
	semantic: notEverSemantic,
})

// (people who) did not work at `[companies+]`, `not(ever())`
// Allow `[do-past-negation]` insertion for the following:
//   "people who not ..." -> "people who did not ..."
user.subjFilter.addRule({
	rhs: [ auxVerbs.doPastNegation, user.subjFilterPresent ],
	semantic: notEverSemantic,
})


// (people who) work at `[companies+]`, `present()`
user.subjFilter.addRule({
	rhs: [ user.subjFilterPresent ],
	semantic: presentSemantic,
})

// (people who) currently work at `[companies+]`, `present()`
user.subjFilter.addRule({
	rhs: [ currently, user.subjFilterPresent ],
	// Enable transposition:
	//   "(people who) work at `[companies+]` currently" -> "(people who) currently work at `[companies+]`"
	transpositionCost: 1,
	// Prevent `[currently]` insertion. Though semantically distinct from `[user-subj-filter]` -> `[user-subj-filter-present]`, the difference scarcely distinguishable.
	noInsertionIndexes: [ 0 ],
	semantic: presentSemantic,
})

// (people who) used to work at `[companies+]`, `past()`
user.subjFilter.addRule({
	rhs: [ usedTo, user.subjFilterPresent ],
	// Prevent `[used-to]` insertion.
	noInsertionIndexes: [ 0 ],
	semantic: pastSemantic,
})

// (people who) will work at `[companies+]`, `future()`
user.subjFilter.addRule({
	rhs: [ will, user.subjFilterPresent ],
	// Prevent `[will]` insertion.
	noInsertionIndexes: [ 0 ],
	semantic: futureSemantic,
})

user.passiveTense = g.newSymbol(user.passive.name, 'tense')

// (people) employed by `[companies]`, `ever()`
// (people not) employed by `[companies]`, `not(ever())`
user.reduced.addRule({
	rhs: [ user.passiveTense ],
	semantic: everSemantic,
})

// (people who) have been employed by `[companies+]`, `ever()`
user.subjFilter.addRule({
	rhs: [ auxVerbs.haveBeen, user.passiveTense ],
	// Prevent `[have-been]` insertion.
	noInsertionIndexes: [ 0 ],
	semantic: everSemantic,
})

// (people who)           are employed by `[companies+]`, `ever()`
// (people who used to)   be  employed by `[companies+]`, `past()`
// (people who will)      be  employed by `[companies+]`, `future()`
// (people who currently) are employed by `[companies+]`, `present()`
user.subjFilterPresent.addRule({
	rhs: [ auxVerbs.bePresent, user.passiveTense ],
})

// (people who)            were employed by `[companies+]`,             `ever-past()`
// (people who previously) were employed by `[companies+]`,             `past()`
// (people who)            were employed by `[companies+]` in the past, `past()`
// (people who ever)       were employed by `[companies+]`,             `ever()`
// (people who have |ever) been employed by `[companies+]`,             `ever()`
// (people who have not)   been employed by `[companies+]`,             `not(ever())`
// (people who never)      were employed by `[companies+]`,             `not(ever())`
// (people who have never) been employed by `[companies+]`,             `not(ever())`
user.subjFilterPast.addRule({
	rhs: [ auxVerbs.bePast, user.passiveTense ],
})

// (people) currently employed by `[companies+]`, `present()`
// (people who are not) currently employed by `[companies+]`, `not(present())`
user.passive.addRule({
	rhs: [ currently, user.passiveTense ],
	// Enable transposition:
	//   "(people) employed by `[companies+]` currently" -> "(people) currently employed by `[companies+]`"
	transpositionCost: 1,
	// Prevent `[currently]` insertion.
	noInsertionIndexes: [ 0 ],
	semantic: presentSemantic,
})

// (people) previously employed by `[companies+]`, `past()`
user.passive.addRule({
	rhs: [ previously, user.passiveTense ],
	// Enable transposition:
	//   "(people) employed by `[companies+]` previously" -> "(people) previously employed by `[companies+]`"
	transpositionCost: 1,
	// Prevent `[previously]` insertion.
	noInsertionIndexes: [ 0 ],
	semantic: pastSemantic,
})

// (people) ever employed by `[companies+]`, `ever()`
user.passive.addRule({
	rhs: [ ever, user.passiveTense ],
	// Prevent `[ever]` insertion.
	noInsertionIndexes: [ 0 ],
	semantic: everSemantic,
})