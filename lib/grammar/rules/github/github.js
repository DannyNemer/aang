var g = require('../../grammar')
var user = require('../user/user')
var auxVerbs = require('../auxVerbs')
var stopWords = require('../stopWords')
var conjunctions = require('../conjunctions')
var count = require('../count')


var github = g.newSymbol('github')
github.addWord({
	accepted: [ 'GitHub' ],
})

// (my) |GitHub (repos)
exports.termOpt = github.createNonterminalOpt()

// GitHub (users I follow); (my) GitHub (followers)
user.company.addRule({ RHS: [ github ] })


exports.create = g.newSymbol('create').addVerb({
	insertionCost: 0.5,
	oneSg: 'create',
	threeSg: 'creates',
	pl: 'create',
	past: 'created',
	substitutions: [ 'make', 'makes', 'made' ],
})

// (repos/pull-requests I) did not create
exports.doPastNegationCreatePresent = g.newBinaryRule({ RHS: [ auxVerbs.doPastNegation, exports.create ], personNumber: 'pl' })

// (repos/pull-requests I) [have-opt] created
// (people who) [have-opt] created ([repos]/[pull-requests])
exports.haveOptCreatePast = g.newBinaryRule({ RHS: [ auxVerbs.haveOpt, exports.create ], tense: 'past' })

// creators (of [repositories]/[pull-requests])
// ({repository}) (creators)
exports.creators = g.newSymbol('creators').addWord({
	insertionCost: 2.75,
	accepted: [ 'creators' ],
	substitutions: [ 'authors' ],
})


// MENTION:
// (pull-requests/issues that) mention ([obj-users+])
exports.mention = g.newSymbol('mention').addWord({
	accepted: [ 'mention' ],
	substitutions: [ 'mentioning' ],
})

// (pull-requests/issues that) do not mention ([obj-users+])
exports.doPresentNegationMention = g.newBinaryRule({ RHS: [ auxVerbs.doPresentNegation, exports.mention ] })

var mentionedIn = g.newSymbol('mentioned', 'in').addWord({
	insertionCost: 1.1,
	accepted: [ 'mentioned in' ],
})

// (pull-requests/issues) I-am/{user}-is/[users]-are mentioned in
exports.beGeneralMentionedIn = g.newBinaryRule({ RHS: [ auxVerbs.beGeneral, mentionedIn ] })
// (pull-requests/issues) I-am/{user}-is/[users]-are not mentioned in
exports.beGeneralNegationMentionedIn = g.newBinaryRule({ RHS: [ auxVerbs.beGeneralNegation, mentionedIn ] })

// (people mentioned in) [issues]/[pull-requests]
exports.mentioners = g.newSymbol('mentioners')
// (people mentioned in) [issues]/[pull-requests] and/or [issues]/[pull-requests]
var mentionersPlus = conjunctions.create(exports.mentioners)
// (people) mentioned in [mentioners+]; (people who are) mentioned in [mentioners+]
user.inner.addRule({
	RHS: [ mentionedIn, mentionersPlus ],
	semantic: g.newSemantic({ name: g.hyphenate(user.namePl, 'mentioned'), cost: 0.5, minParams: 1, maxParams: 1 })
})


// ASSIGNED-TO:
exports.assignedTo = g.newSymbol('assigned', 'to').addWord({
	insertionCost: 1.2,
	accepted: [ 'assigned to' ],
})

// (issues/pull-requests) I-am/{user}-is/[users]-are assigned to
exports.beGeneralAssignedTo = g.newBinaryRule({ RHS: [ auxVerbs.beGeneral, exports.assignedTo ] })
// (issues/pull-requests) I-am/{user}-is/[users]-are not assigned to
exports.beGeneralNegationAssignedTo = g.newBinaryRule({ RHS: [ auxVerbs.beGeneralNegation, exports.assignedTo ] })

// (people assigned to) [issues]/[pull-requests]
exports.assigners = g.newSymbol('assigners')
// (people assigned to) [issues]/[pull-requests] and/or [issues]/[pull-requests]
var assignersPlus = conjunctions.create(exports.assigners)
// (people) assigned to [assigners+]; (people who are) mentioned in [assigners+]
user.inner.addRule({
	RHS: [ exports.assignedTo, assignersPlus ],
	semantic: g.newSemantic({ name: g.hyphenate(user.namePl, 'assigned'), cost: 0.5, minParams: 1, maxParams: 1 })
})


// OPEN/CLOSED:
// open/closed (issues/pull-requests); (issues/pull-requests that are) open/closed
exports.state = g.newSymbol('state').addRule({
	isTerminal: true, RHS: 'open',
	semantic: g.newSemantic({ isArg: true, name: 'open', cost: 0 }),
}).addRule({
	isTerminal: true, RHS: 'closed',
	semantic: g.newSemantic({ isArg: true, name: 'closed', cost: 0 }),
})


// WITH N COMMENTS:
var comments = g.newSymbol('comments').addWord({
	insertionCost: 3,
	accepted: [ 'comments' ],
	substitutions: [ 'comment' ],
})
// (issues/pull-requests) with <int> comment
exports.commentCount = count.createForItems(comments)


// Load GitHub-specific rules.
require('./repository')
require('./pullRequest')
require('./issue')