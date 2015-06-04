var g = require('../../grammar')
var Category = require('../Category')
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
	accepted: [ issue.namePl ]
})

// |Github issues (I opened)
issue.headMayPoss.addRule({ RHS: [ github.termOpt, issue.term ] })


var issuesOpenedSemantic = g.newSemantic({ name: g.hyphenate(issue.namePl, 'opened'), cost: 0.5, minParams: 1, maxParams: 1, preventDups: true })
var issuesOpenersSemantic = g.newSemantic({ name: g.hyphenate(issue.nameSg, 'openers'), cost: 0.5, minParams: 1, maxParams: 1 })

// my issues; my closed issues
var issuePossDeterminer = g.newSymbol(issue.nameSg, 'poss', 'determiner')
issuePossDeterminer.addRule({ RHS: [ poss.determiner ], semantic: issuesOpenedSemantic })
issue.noRelativePossessive.addRule({ RHS: [ issuePossDeterminer, issue.possessible ] })
// issues of mine
issue.head.addRule({ RHS: [ issue.headMayPoss, poss.ofPossUsers ], semantic: issuesOpenedSemantic })


// OPENED:
var opened = g.newSymbol('opened')
opened.addWord({
	insertionCost: 1,
	accepted: [ 'opened', 'created' ]
})

// (issues) opened by me
issue.passive.addRule({ RHS: [ opened, user.byObjUsers ], semantic: issuesOpenedSemantic })
// (issues) I <stop> opened
issue.objFilter.addRule({ RHS: [ user.nomUsersPreVerbStopWords, opened ], semantic: issuesOpenedSemantic })
// (issues) I <stop> have opened
var haveOpened = g.newSymbol('have', 'opened')
haveOpened.addRule({ RHS: [ auxVerbs.have, opened ] })
issue.objFilter.addRule({ RHS: [ user.nomUsersPreVerbStopWords, haveOpened ], semantic: issuesOpenedSemantic })
// (people who) opened issues ...
user.subjFilter.addRule({ RHS: [ opened, issue.catPl ], semantic: issuesOpenersSemantic })
// (people who) have opened issues ... - not [issues+] because 'by'
user.subjFilter.addRule({ RHS: [ haveOpened, issue.catPl ], semantic: issuesOpenersSemantic, personNumber: 'pl' })

var openersOf = g.newSymbol('openers', 'of')
openersOf.addWord({
	accepted: [ 'openers of', 'creators of' ] // should I use regexp? be seperate syms
})
// openers of [issues]
user.head.addRule({ RHS: [ openersOf, issue.catPl ], semantic: issuesOpenersSemantic })


// MENTION:
var issuesRequestsMentionedSemantic = g.newSemantic({ name: g.hyphenate(issue.namePl, 'mentioned'), cost: 0.5, minParams: 1, maxParams: 1 })
// (issues that) mention me
issue.subjFilter.addRule({ RHS: [ github.mention, user.objUsersPlus ], semantic: issuesRequestsMentionedSemantic })
// (issues) I-am/{user}-is/[users]-are mentioned in
issue.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWords, github.beGeneralMentionedIn ], semantic: issuesRequestsMentionedSemantic })
// (people mentioned in) [issues]/[pull-requests] (and/or) [issues]/[pull-requests]
github.mentioners.addRule({ RHS: [ issue.catPl ] })


// ASSIGNED-TO:
var issuesAssignedSemantic = g.newSemantic({ name: g.hyphenate(issue.namePl, 'assigned'), cost: 0.5, minParams: 1, maxParams: 1 })
// (issues) assigned to me
issue.inner.addRule({ RHS: [ github.assignedTo, user.objUsersPlus ], semantic: issuesAssignedSemantic })
// (issues) I-am/{user}-is/[users]-are assigned to
issue.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWords, github.beGeneralAssignedTo ], semantic: issuesAssignedSemantic })
// (people assigned to) [issues]/[pull-requests] (and/or) [issues]/[pull-requests]
github.assigners.addRule({ RHS: [ issue.catPl ] })


// OPEN/CLOSED:
// open/closed (issues); (issues that are) open/closed
issue.adjective.addRule({
	RHS: [ github.state ],
	semantic: g.newSemantic({ name: g.hyphenate(issue.namePl, 'state'), cost: 0.5, minParams: 1, maxParams: 1, preventDups: true })
})


// WITH N COMMENTS:
// (issues) with <int> comment
issue.inner.addRule({ RHS: [ preps.possessed, github.commentCount ], semantic: issue.semantic })


// DATE:
var updated = g.newSymbol('updated')
updated.addWord({
	insertionCost: 3,
	accepted: [ 'updated' ]
})

// (issues) updated in [year]
issue.inner.addRule({ RHS: [ updated, date.general ], semantic: issue.semantic })