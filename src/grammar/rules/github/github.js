var g = require('../../grammar')
var user = require('../user')
var auxVerbs = require('../auxVerbs')
var stopWords = require('../stopWords')
var user = require('../user')
var conjunctions = require('../conjunctions.js')


var github = new g.Symbol('github')
github.addWord({
	accepted: [ 'GitHub' ]
})

// (my) |GitHub (repos)
exports.termOpt = github.createNonterminalOpt()

// GitHub (users I follow); (my) GitHub (followers)
user.company.addRule({ RHS: [ github ] })


exports.created = new g.Symbol('created')
exports.created.addWord({
	insertionCost: 0.5,
	accepted: [ 'created' ]
})

// (repos/pull-requests I) have created
// (people who) have created ([repos]/[pull-requests])
exports.haveCreated = new g.Symbol('have', 'created')
exports.haveCreated.addRule({ RHS: [ auxVerbs.have, exports.created ] })

// creators of ([repositories]/[pull-requests])
exports.creatorsOf = new g.Symbol('creators', 'of')
exports.creatorsOf.addWord({
	accepted: [ 'creators of' ]
})


// MENTION:
// (pull-requests/issues that) mention ([obj-users+])
exports.mention = new g.Symbol('mention')
exports.mention.addWord({
	accepted: [ 'mention' ]
})

var mentionedIn = new g.Symbol('mentioned', 'in')
mentionedIn.addWord({
	insertionCost: 2,
	accepted: [ 'mentioned in' ]
})

// (pull-requests/issues) I-am/{user}-is/[users]-are mentioned in
exports.beGeneralMentionedIn = new g.Symbol('be', 'general', 'mentioned', 'in')
exports.beGeneralMentionedIn.addRule({ RHS: [ auxVerbs.beGeneral, mentionedIn ] })

// (people mentioned in) [issues]/[pull-requests]
exports.mentioners = new g.Symbol('mentioners')
// (people mentioned in) [issues]/[pull-requests] and/or [issues]/[pull-requests]
var mentionersPlus = conjunctions.addForSymbol(exports.mentioners)
// (people) mentioned in [mentioners+]; (people who are) mentioned in [mentioners+]
user.inner.addRule({
	RHS: [ mentionedIn, mentionersPlus ],
	semantic: g.newSemantic({ name: g.hyphenate(user.namePl, 'mentioned'), cost: 0.5, minParams: 1, maxParams: 1 })
})


// ASSIGNED-TO:
exports.assignedTo = new g.Symbol('assigned', 'to')
exports.assignedTo.addWord({
  insertionCost: 2,
  accepted: [ 'assigned to' ]
})

// (issues/pull-requests) I-am/{user}-is/[users]-are assigned to
exports.beGeneralAssignedTo = new g.Symbol('be', 'general', 'assigned', 'to')
exports.beGeneralAssignedTo.addRule({ RHS: [ auxVerbs.beGeneral, exports.assignedTo ] })

// (people assigned to) [issues]/[pull-requests]
exports.assigners = new g.Symbol('assigners')
// (people assigned to) [issues]/[pull-requests] and/or [issues]/[pull-requests]
var assignersPlus = conjunctions.addForSymbol(exports.assigners)
// (people) assigned to [assigners+]; (people who are) mentioned in [assigners+]
user.inner.addRule({
	RHS: [ exports.assignedTo, assignersPlus ],
	semantic: g.newSemantic({ name: g.hyphenate(user.namePl, 'assigned'), cost: 0.5, minParams: 1, maxParams: 1 })
})


// OPEN/CLOSED
// open/closed (issues/pull-requests); (issues/pull-requests that are) open/closed
exports.state = new g.Symbol('state')
exports.state.addRule({
	terminal: true, RHS: 'open', text: 'open',
	semantic: g.newSemantic({ name: 'open', isArg: true, cost: 0 })
})
exports.state.addRule({
	terminal: true, RHS: 'closed', text: 'closed',
	semantic: g.newSemantic({ name: 'closed', isArg: true, cost: 0 })
})


// Load GitHub-specific rules:
require('./repository')
require('./pullRequest')
require('./issue')