var g = require('../../grammar')
var user = require('../user')
var auxVerbs = require('../auxVerbs')
var stopWords = require('../stopWords')
var user = require('../user')
var conjunctions = require('../conjunctions')
var count = require('../count')


var github = g.newSymbol('github')
github.addWord({
	accepted: [ 'GitHub' ]
})

// (my) |GitHub (repos)
exports.termOpt = github.createNonterminalOpt()

// GitHub (users I follow); (my) GitHub (followers)
user.company.addRule({ RHS: [ github ] })


exports.created = g.newSymbol('created')
exports.created.addWord({
	insertionCost: 0.5,
	accepted: [ 'created' ]
})

// (repos/pull-requests I) have created
// (people who) have created ([repos]/[pull-requests])
exports.haveNoInsertCreated = g.newBinaryRule({ RHS: [ auxVerbs.have, exports.created ], noInsertionsForIndexes: [ 0 ] })

// creators of ([repositories]/[pull-requests])
exports.creatorsOf = g.newSymbol('creators', 'of')
exports.creatorsOf.addWord({
	accepted: [ 'creators of' ]
})


// MENTION:
// (pull-requests/issues that) mention ([obj-users+])
exports.mention = g.newSymbol('mention')
exports.mention.addWord({
	accepted: [ 'mention' ]
})

var mentionedIn = g.newSymbol('mentioned', 'in')
mentionedIn.addWord({
	insertionCost: 2,
	accepted: [ 'mentioned in' ]
})

// (pull-requests/issues) I-am/{user}-is/[users]-are mentioned in
exports.beGeneralMentionedIn = g.newBinaryRule({ RHS: [ auxVerbs.beGeneral, mentionedIn ] })

// (people mentioned in) [issues]/[pull-requests]
exports.mentioners = g.newSymbol('mentioners')
// (people mentioned in) [issues]/[pull-requests] and/or [issues]/[pull-requests]
var mentionersPlus = conjunctions.addForSymbol(exports.mentioners)
// (people) mentioned in [mentioners+]; (people who are) mentioned in [mentioners+]
user.inner.addRule({
	RHS: [ mentionedIn, mentionersPlus ],
	semantic: g.newSemantic({ name: g.hyphenate(user.namePl, 'mentioned'), cost: 0.5, minParams: 1, maxParams: 1 })
})


// ASSIGNED-TO:
exports.assignedTo = g.newSymbol('assigned', 'to')
exports.assignedTo.addWord({
  insertionCost: 2,
  accepted: [ 'assigned to' ]
})

// (issues/pull-requests) I-am/{user}-is/[users]-are assigned to
exports.beGeneralAssignedTo = g.newBinaryRule({ RHS: [ auxVerbs.beGeneral, exports.assignedTo ] })

// (people assigned to) [issues]/[pull-requests]
exports.assigners = g.newSymbol('assigners')
// (people assigned to) [issues]/[pull-requests] and/or [issues]/[pull-requests]
var assignersPlus = conjunctions.addForSymbol(exports.assigners)
// (people) assigned to [assigners+]; (people who are) mentioned in [assigners+]
user.inner.addRule({
	RHS: [ exports.assignedTo, assignersPlus ],
	semantic: g.newSemantic({ name: g.hyphenate(user.namePl, 'assigned'), cost: 0.5, minParams: 1, maxParams: 1 })
})


// OPEN/CLOSED
// open/closed (issues/pull-requests); (issues/pull-requests that are) open/closed
exports.state = g.newSymbol('state')
exports.state.addRule({
	terminal: true, RHS: 'open',
	semantic: g.newSemantic({ isArg: true, name: 'open', cost: 0 })
})
exports.state.addRule({
	terminal: true, RHS: 'closed',
	semantic: g.newSemantic({ isArg: true, name: 'closed', cost: 0 })
})


// WITH N COMMENTS:
var comments = g.newSymbol('comments')
comments.addWord({
  insertionCost: 3,
  accepted: [ 'comments' ]
})
// (issues/pull-requests) with <int> comment
exports.commentCount = count.createForItems(comments)


// Load GitHub-specific rules:
require('./repository')
require('./pullRequest')
require('./issue')