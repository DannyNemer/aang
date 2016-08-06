var g = require('../../grammar')
var user = require('../user/user')
var conjunction = require('../conjunction')
var auxVerbs = require('../auxVerbs')
var verbs = require('../verbs')
var preps = require('../prepositions')


// (my) |GitHub (repos)
exports.term = g.newTermSequence({
	symbolName: g.hyphenate('term', 'github'),
	type: g.termTypes.INVARIABLE,
	acceptedTerms: [ 'GitHub' ],
})

// GitHub (users I follow); (my) GitHub (followers)
user.service.addRule({ rhs: [ exports.term ] })


// MENTION:
// (people mentioned in) `[issues]`/`[pull-requests]`
exports.mentioners = g.newSymbol('mentioners')
// (people) mentioned in `[mentioners+]`; (people who are) mentioned in `[mentioners+]`
user.inner.addRule({
	rhs: [ [ {
				symbol: verbs.mention,
				grammaticalForm: 'past',
			},
			preps.in,
		],
		// (people mentioned in) `[issues]`/`[pull-requests]` and/or `[issues]`/`[pull-requests]`
		conjunction.create(exports.mentioners),
	],
	semantic: g.newSemantic({
		name: g.hyphenate(user.namePl, 'mentioned'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
	})
})


// ASSIGNED-TO:
// (people assigned to) `[issues]`/`[pull-requests]`
exports.assigners = g.newSymbol('assigners')
// (people) assigned to `[assigners+]; (people who are) mentioned in `[assigners+]`
user.inner.addRule({
	rhs: [
		verbs.assignedTo,
		// (people assigned to) `[issues]`/`[pull-requests]` and/or `[issues]`/`[pull-requests]`
		conjunction.create(exports.assigners),
	],
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