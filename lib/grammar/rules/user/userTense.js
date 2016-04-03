var g = require('../../grammar')
var user = require('./user')


// Returns actions that occurred in the past (excluding the present).
var pastSemantic = g.newSemantic({
	name: 'past',
	cost: 0,
	minParams: 1,
	maxParams: 1,
})

// Returns actions that occurred in the past or occur in the present.
var everPastSemantic = g.newSemantic({
	name: g.hyphenate('ever', 'past'),
	cost: 0.3,
	minParams: 1,
	maxParams: 1,
})

// Returns actions that occurred in the past, occur in the present, or set to occur in the future.
// NOTE: Might exclude this semantic.
var everSemantic = g.newSemantic({
	name: 'ever',
	cost: 0.3,
	minParams: 1,
	maxParams: 1,
})

var previously = g.newSymbol('previously').addWord({
	accepted: [ 'previously', 'formerly' ],
})

var ever = g.newSymbol('ever').addWord({
	accepted: [ 'ever' ],
})


// Represents past actions for verbs for which the tense (i.e., time) is meaningful.
user.subjFilterPast = g.newSymbol(user.subjFilter.name, 'past')

// (people who) worked at `[companies+]`
user.subjFilter.addRule({
	rhs: [ user.subjFilterPast ],
	semantic: everPastSemantic,
})

// (people who) previously worked at `[companies+]`
user.subjFilter.addRule({
	rhs: [ previously, user.subjFilterPast ],
	// Enable transposition:
	//   "(people who) worked at `[companies+]` previously" -> "(people who) previously worked at `[companies+]`"
	transpositionCost: 1,
	// Prevent `[previously]` insertion. Though semantically distinct from `[user-subj-filter]` -> `[user-subj-filter-past]`, the difference is not obvious.
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
// (people who) worked at `[companies+]` in the past
user.subjFilter.addRule({
	rhs: [ user.subjFilterPast, inThePast ],
	semantic: pastSemantic,
})

// (people who) ever worked at `[companies+]`
user.subjFilter.addRule({
	rhs: [ ever, user.subjFilterPast ],
	semantic: everSemantic,
})