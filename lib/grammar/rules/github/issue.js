var g = require('../../grammar')
var Category = require('../category')
var github = require('./github')
var poss = require('../poss')
var user = require('../user')
var auxVerbs = require('../auxVerbs')
var stopWords = require('../stopWords')
var preps = require('../prepositions')
var count = require('../count')
var date = require('../date')


var issue = new Category({ sg: 'issue', pl: 'issues' })

issue.term.addWord({
	insertionCost: 3.5,
	accepted: [ issue.namePl ],
})

// |Github issues (I opened)
issue.headMayPoss.addRule({ RHS: [ github.termOpt, issue.term ] })


var issuesOpenedSemantic = g.newSemantic({ name: g.hyphenate(issue.namePl, 'opened'), cost: 0.5, minParams: 1, maxParams: 1, forbidMultiple: true })

// my issues; my closed issues
var issuePossDeterminer = g.newSymbol(issue.nameSg, 'poss', 'determiner')
issuePossDeterminer.addRule({ RHS: [ poss.determiner ], semantic: issuesOpenedSemantic })
issue.noRelativePossessive.addRule({ RHS: [ issuePossDeterminer, issue.possessible ] })
// issues of mine
issue.head.addRule({ RHS: [ issue.headMayPoss, poss.ofPossUsers ], semantic: issuesOpenedSemantic })


// OPEN:
var openPresent = g.newSymbol('open', 'present')
openPresent.addWord({
	insertionCost: 1,
	accepted: [ 'open' ],
	substitutions: [ 'opened' ],
})
// Add in a separate call to `openPresent.addWord()` so "created" corrects to "create", not "open".
openPresent.addWord({
	accepted: [ 'create' ],
	substitutions: [ 'created' ],
})

var doPastNegationOpenPresent = g.newBinaryRule({ RHS: [ auxVerbs.doPastNegation, openPresent ] })

var openPast = g.newSymbol('open', 'past')
openPast.addWord({
	insertionCost: 1,
	accepted: [ 'opened' ],
	substitutions: [ 'open' ],
})
// Add in a separate call to `openPast.addWord()` so "create" corrects to "created", not "opened".
openPast.addWord({
	accepted: [ 'created' ],
	substitutions: [ 'create' ],
})

var haveNoInsertOpenPast = g.newBinaryRule({ RHS: [ auxVerbs.have, openPast ], noInsertionIndexes: [ 0 ] })

// (issues) opened by me
issue.passive.addRule({ RHS: [ openPast, user.byObjUsers ], semantic: issuesOpenedSemantic })
// (issues) I <stop> opened
issue.objFilter.addRule({ RHS: [ user.nomUsersPreVerbStopWord, openPast ], semantic: issuesOpenedSemantic })
// (issues) I <stop> have opened
issue.objFilter.addRule({ RHS: [ user.nomUsersPreVerbStopWord, haveNoInsertOpenPast ], semantic: issuesOpenedSemantic })
// (issues) I did not open
issue.objFilter.addRule({ RHS: [ user.nomUsers, doPastNegationOpenPresent ], semantic: g.reduceSemantic(auxVerbs.notSemantic, issuesOpenedSemantic) })

var issuesOpenersSemantic = g.newSemantic({ name: g.hyphenate(issue.nameSg, 'openers'), cost: 0.5, minParams: 1, maxParams: 1 })
// (people who) opened [issues]
user.subjFilter.addRule({ RHS: [ openPast, issue.catPl ], semantic: issuesOpenersSemantic })
// (people who) have opened [issues] - not [issues+] because 'by'
user.subjFilter.addRule({ RHS: [ haveNoInsertOpenPast, issue.catPl ], semantic: issuesOpenersSemantic })
// (people who) did not open [issues]
user.subjFilter.addRule({ RHS: [ doPastNegationOpenPresent, issue.catPl ], semantic: g.reduceSemantic(auxVerbs.notSemantic, issuesOpenersSemantic) })

var openersOf = g.newSymbol('openers', 'of')
openersOf.addWord({
	accepted: [ 'openers of', 'creators of' ] // should I use regexp? be seperate syms
})
// openers of [issues]
user.head.addRule({ RHS: [ openersOf, issue.catPl ], semantic: issuesOpenersSemantic })


// MENTION:
var issuesMentionedSemantic = g.newSemantic({ name: g.hyphenate(issue.namePl, 'mentioned'), cost: 0.5, minParams: 1, maxParams: 1 })
var notIssuesMentionedSemantic = g.reduceSemantic(auxVerbs.notSemantic, issuesMentionedSemantic)
// (issues that) mention me
issue.subjFilter.addRule({ RHS: [ github.mention, user.objUsersPlus ], semantic: issuesMentionedSemantic })
// (issues that) do not mention me
issue.subjFilter.addRule({ RHS: [ github.doPresentNegationMention, user.objUsersPlus ], semantic: notIssuesMentionedSemantic })
// (issues) I-am/{user}-is/[users]-are mentioned in
issue.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWord, github.beGeneralMentionedIn ], semantic: issuesMentionedSemantic })
// (issues) I-am/{user}-is/[users]-are not mentioned in
issue.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWord, github.beGeneralNegationMentionedIn ], semantic: notIssuesMentionedSemantic })
// (people mentioned in) [issues]/[pull-requests] (and/or) [issues]/[pull-requests]
github.mentioners.addRule({ RHS: [ issue.catPl ] })


// ASSIGNED-TO:
var issuesAssignedSemantic = g.newSemantic({ name: g.hyphenate(issue.namePl, 'assigned'), cost: 0.5, minParams: 1, maxParams: 1 })
// (issues) assigned to me
issue.inner.addRule({ RHS: [ github.assignedTo, user.objUsersPlus ], semantic: issuesAssignedSemantic })
// (issues) I-am/{user}-is/[users]-are assigned to
issue.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWord, github.beGeneralAssignedTo ], semantic: issuesAssignedSemantic })
// (issues) I-am/{user}-is/[users]-are not assigned to
issue.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWord, github.beGeneralNegationAssignedTo ], semantic: g.reduceSemantic(auxVerbs.notSemantic, issuesAssignedSemantic) })
// (people assigned to) [issues]/[pull-requests] (and/or) [issues]/[pull-requests]
github.assigners.addRule({ RHS: [ issue.catPl ] })


// OPEN/CLOSED:
// open/closed (issues); (issues that are) open/closed
issue.adjective.addRule({
	RHS: [ github.state ],
	semantic: g.newSemantic({ name: g.hyphenate(issue.namePl, 'state'), cost: 0.5, minParams: 1, maxParams: 1, forbidMultiple: true }),
})


// WITH N COMMENTS:
// (issues) with <int> comment
issue.inner.addRule({ RHS: [ preps.possessed, github.commentCount ], semantic: issue.semantic })


// DATE:
var updated = g.newSymbol('updated')
updated.addWord({
	insertionCost: 2,
	accepted: [ 'updated' ],
})

// (issues) updated in [year]
issue.inner.addRule({ RHS: [ updated, date.general ], semantic: issue.semantic })