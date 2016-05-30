var g = require('../../grammar')
var user = require('../user/user')
var conjunction = require('../conjunction')
var auxVerbs = require('../auxVerbs')
var verbs = require('../verbs')
var preps = require('../prepositions')


// (my) |GitHub (repos)
exports.term = g.newTermSequence({
	symbolName: g.hyphenate('term', 'github'),
	acceptedTerms: [ 'GitHub' ],
})

// GitHub (users I follow); (my) GitHub (followers)
user.service.addRule({ rhs: [ exports.term ] })


// (repos/pull-requests) created (by me)
exports.create = g.newTermSequence({
	symbolName: g.hyphenate(exports.term.name, 'create'),
	isVerb: true,
	acceptedTerms: [
		verbs.create,
	],
	substitutedTerms: [
		verbs.make,
	],
})


// MENTION:
var mentionedIn = g.newBinaryRule({
	rhs: [ verbs.mention, preps.in ],
	grammaticalForm: 'past',
})

// (pull-requests/issues) I-am/`{user}`-is/`[users]`-are mentioned in
exports.beMentionedIn = g.newBinaryRule({ rhs: [ auxVerbs.be, mentionedIn ] })
// (pull-requests/issues) I-am/`{user}`-is/`[users]`-are not mentioned in
exports.beNegationMentionedIn = g.newBinaryRule({ rhs: [ auxVerbs.beNegation, mentionedIn ] })

// (people mentioned in) `[issues]`/`[pull-requests]`
exports.mentioners = g.newSymbol('mentioners')
// (people mentioned in) `[issues]`/`[pull-requests]` and/or `[issues]`/`[pull-requests]`
var mentionersPlus = conjunction.create(exports.mentioners)
// (people) mentioned in `[mentioners+]`; (people who are) mentioned in `[mentioners+]`
user.inner.addRule({
	rhs: [ mentionedIn, mentionersPlus ],
	semantic: g.newSemantic({
		name: g.hyphenate(user.namePl, 'mentioned'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
	})
})


// ASSIGNED-TO:
exports.assignedTo = g.newTermSequenceBinarySymbol({
	termPair: [
		g.newTermSequence({
			symbolName: 'assigned',
			insertionCost: 0.7,
			acceptedTerms: [ 'assigned' ],
		}),
		preps.to,
	],
})

// (issues/pull-requests) I-am/`{user}`-is/`[users]`-are assigned to
exports.beAssignedTo = g.newBinaryRule({ rhs: [ auxVerbs.be, exports.assignedTo ] })
// (issues/pull-requests) I-am/`{user}`-is/`[users]`-are not assigned to
exports.beNegationAssignedTo = g.newBinaryRule({ rhs: [ auxVerbs.beNegation, exports.assignedTo ] })

// (people assigned to) `[issues]`/`[pull-requests]`
exports.assigners = g.newSymbol('assigners')
// (people assigned to) `[issues]`/`[pull-requests]` and/or `[issues]`/`[pull-requests]`
var assignersPlus = conjunction.create(exports.assigners)
// (people) assigned to `[assigners+]; (people who are) mentioned in `[assigners+]`
user.inner.addRule({
	rhs: [ exports.assignedTo, assignersPlus ],
	semantic: g.newSemantic({
		name: g.hyphenate(user.namePl, 'assigned'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
	})
})


// OPEN/CLOSED:
// open/closed (issues/pull-requests); (issues/pull-requests that are) open/closed
exports.state = g.newSymbol('state').addRule({
	isTerminal: true,
	rhs: 'open',
	text: 'open',
	semantic: g.newSemantic({ isArg: true, name: 'open', cost: 0 }),
}).addRule({
	isTerminal: true,
	rhs: 'closed',
	text: 'closed',
	semantic: g.newSemantic({ isArg: true, name: 'closed', cost: 0 }),
})


// Load GitHub-specific rules.
require('./repository')
require('./pullRequest')
require('./issue')