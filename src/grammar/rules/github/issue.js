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

var issuesTerm = new g.Symbol(issue.namePl, 'term')
issuesTerm.addWord({
	insertionCost: 3.5,
	accepted: [ issue.namePl ]
})

// |Github issues (I opened)
issue.headMayPoss.addRule({ RHS: [ github.termOpt, issuesTerm ] })


var issuesOpenedSemantic = g.newSemantic({ name: issue.namePl + '-opened', cost: 0.5, minParams: 1, maxParams: 1, preventDups: true })
var issuesOpenersSemantic = g.newSemantic({ name: issue.nameSg + '-openers', cost: 0.5, minParams: 1, maxParams: 1 })

// my issues
issue.noRelativePossessive.addRule({ RHS: [ poss.determiner, issue.possessible ], semantic: issuesOpenedSemantic })
// issues of mine
issue.head.addRule({ RHS: [ issue.headMayPoss, poss.ofPossUsers ], semantic: issuesOpenedSemantic })


// OPENED:
var opened = new g.Symbol('opened')
opened.addWord({
	insertionCost: 1,
	accepted: [ 'opened', 'created' ]
})

// (issues) opened by me
issue.passive.addRule({ RHS: [ opened, user.byObjUsers ], semantic: issuesOpenedSemantic })
// (issues) I <stop> opened
issue.objFilter.addRule({ RHS: [ user.nomUsersPreVerbStopWords, opened ], semantic: issuesOpenedSemantic })
// (issues) I <stop> have opened
var haveOpened = new g.Symbol('have', 'opened')
haveOpened.addRule({ RHS: [ auxVerbs.have, opened ] })
issue.objFilter.addRule({ RHS: [ user.nomUsersPreVerbStopWords, haveOpened ], semantic: issuesOpenedSemantic })
// (people who) opened issues ...
user.subjFilter.addRule({ RHS: [ opened, issue.catPl ], semantic: issuesOpenersSemantic })
// (people who) have opened issues ... - not [issues+] because 'by'
user.subjFilter.addRule({ RHS: [ haveOpened, issue.catPl ], semantic: issuesOpenersSemantic, personNumber: 'pl' })

var openersOf = new g.Symbol('openers', 'of')
openersOf.addWord({
	accepted: [ 'openers of', 'creators of' ] // should I use regexp? be seperate syms
})
// openers of [issues]
user.head.addRule({ RHS: [ openersOf, issue.catPl ], semantic: issuesOpenersSemantic })


// MENTION:
var issuesRequestsMentionedSemantic = g.newSemantic({ name: issue.namePl + '-mentioned', cost: 0.5, minParams: 1, maxParams: 1 })
// (issues that) mention me
issue.subjFilter.addRule({ RHS: [ github.mention, user.objUsersPlus ], semantic: issuesRequestsMentionedSemantic })
// (issues) I-am/{user}-is/[users]-are mentioned in
issue.objFilter.addRule({ RHS: [ user.nomUsersPlus, github.preVerbStopWordsBeGeneralMentionedIn ], semantic: issuesRequestsMentionedSemantic })
// (people mentioned in) [issues]
github.mentioners.addRule({ RHS: [ issue.catPl ] })


// ASSIGNED-TO:
var assignedTo = new g.Symbol('assigned', 'to')
assignedTo.addWord({
  insertionCost: 2,
  accepted: [ 'assigned to' ]
})

var issuesAssignedSemantic = g.newSemantic({ name: issue.namePl + '-assigned', cost: 0.5, minParams: 1, maxParams: 1 })
var usersAssignedSemantic = g.newSemantic({ name: user.namePl + '-assigned', cost: 0.5, minParams: 1, maxParams: 1 })

// (issues) I-am/{user}-is/[users]-are assigned to
var beGeneralAssignedTo = new g.Symbol('be', 'general', 'assigned', 'to')
beGeneralAssignedTo.addRule({ RHS: [ auxVerbs.beGeneral, assignedTo ] })
issue.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWords, beGeneralAssignedTo ], semantic: issuesAssignedSemantic })
// (issues) assigned to me
issue.inner.addRule({ RHS: [ assignedTo, user.objUsersPlus ], semantic: issuesAssignedSemantic })
// (people) assigned to [issues+]; (people who are) mentioned in [issues+]
user.inner.addRule({ RHS: [ assignedTo, issue.catPlPlus ], semantic: usersAssignedSemantic })


// OPEN/CLOSED:
var issuesStateSemantic = g.newSemantic({ name: issue.namePl + '-state', cost: 0.5, minParams: 1, maxParams: 1, preventDups: true })
// open issues
var openStateSemanticArg = g.newSemantic({ name: 'open', isArg: true, cost: 0.5 })
issue.adjective.addRule({ terminal: true, RHS: 'open', text: 'open', semantic: g.insertSemantic(issuesStateSemantic, openStateSemanticArg) })
// closed issues
var closedStateSemanticArg = g.newSemantic({ name: 'closed', isArg: true, cost: 0.5 })
issue.adjective.addRule({ terminal: true, RHS: 'closed', text: 'closed', semantic: g.insertSemantic(issuesStateSemantic, closedStateSemanticArg) })


// WITH N COMMENTS:
var comments = new g.Symbol('comments')
comments.addWord({
  insertionCost: 3,
  accepted: [ 'comments' ]
})

// issues with <int> comment
issue.inner.addRule({ RHS: [ preps.possessed, count.createForCategoryItems(issue, comments) ] })


// DATE:
var updated = new g.Symbol('updated')
updated.addWord({
	insertionCost: 3,
	accepted: [ 'updated' ]
})

// Are we correct to use that semantic? because there is a date semantic which has a cost and the updated semantic only for the date
// (issues) updated in [year]
issue.inner.addRule({
	RHS: [ updated, date.general ],
	semantic: g.newSemantic({ name: g.hyphenate(issue.namePl, 'updated'), cost: 0.5, minParams: 1, maxParams: 2 })
})