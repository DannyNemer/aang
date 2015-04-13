var g = require('../../grammar')
var Category = require('../Category')
var github = require('./github')
var poss = require('../poss')
var user = require('../user')
var auxVerbs = require('../auxVerbs')
var stopWords = require('../stopWords')

var issue = new Category({ sg: 'issue', pl: 'issues' })

var issuesTerm = g.addWord({
	symbol: new g.Symbol(issue.namePl, 'term'),
	insertionCost: 3.5,
	accepted: [ issue.namePl ]
})

// |Github issues (I opened)
issue.headMayPoss.addRule({ RHS: [ github.termOpt, issuesTerm ] })


var issuesOpenedSemantic = new g.Semantic({ name: issue.namePl + '-opened', cost: 0.5, minParams: 1, maxParams: 1, preventDups: true })
var issuesOpenersSemantic = new g.Semantic({ name: issue.nameSg + '-openers', cost: 0.5, minParams: 1, maxParams: 1 })

// my issues
issue.noRelativePossessive.addRule({ RHS: [ poss.determiner, issue.possessible ], semantic: issuesOpenedSemantic })
// issues of mine
issue.head.addRule({ RHS: [ issue.headMayPoss, poss.ofPossUsersPlus ], semantic: issuesOpenedSemantic })


// OPENED:
var opened = g.addWord({
	symbol: new g.Symbol('opened'),
	insertionCost: 1,
	accepted: [ 'opened', 'created' ]
})

// (repos) opened by me
issue.passive.addRule({ RHS: [ opened, user.byObjUsers ], semantic: issuesOpenedSemantic })
// (repos) I opened
var preVerbStopWordsOpened = new g.Symbol('pre', 'verb', 'stop', 'words', 'opened')
preVerbStopWordsOpened.addRule({ RHS: [ stopWords.preVerb, opened ] })
issue.objFilter.addRule({ RHS: [ user.nomUsers, preVerbStopWordsOpened ], semantic: issuesOpenedSemantic })
// (repos) I have opened
var haveOpened = new g.Symbol('have', 'opened')
haveOpened.addRule({ RHS: [ auxVerbs.have, opened ] })
var preVerbStopWordsHaveOpened = new g.Symbol('pre', 'verb', 'stop', 'words', 'have', 'opened')
preVerbStopWordsHaveOpened.addRule({ RHS: [ stopWords.preVerb, haveOpened ] })
issue.objFilter.addRule({ RHS: [ user.nomUsers, preVerbStopWordsHaveOpened ], semantic: issuesOpenedSemantic })
// (people who) opened repos ...
user.subjFilter.addRule({ RHS: [ opened, issue.catPl ], semantic: issuesOpenersSemantic })
// (people who) have opened repos ...
var openedIssues = new g.Symbol('opened', issue.namePl)
openedIssues.addRule({ RHS: [ opened, issue.catPl ] }) // not [issues+] because 'by'
user.subjFilter.addRule({ RHS: [ auxVerbs.have, openedIssues ], semantic: issuesOpenersSemantic, personNumber: 'pl' })

var openersOf = g.addWord({
	symbol: new g.Symbol('openers', 'of'),
	accepted: [ 'openers-of', 'creators-of' ] // should I use regexp? be seperate syms
})
// openers of [issues]
user.head.addRule({ RHS: [ openersOf, issue.catPl ], semantic: issuesOpenersSemantic })


// MENTION:
var issuesRequestsMentionedSemantic = new g.Semantic({ name: issue.namePl + '-mentioned', cost: 0.5, minParams: 1, maxParams: 1 })
// (issues that) mention me
issue.subjFilter.addRule({ RHS: [ github.mention, user.objUsersPlus ], semantic: issuesRequestsMentionedSemantic })
// (issues) I-am/{user}-is/[users]-are mentioned in
issue.objFilter.addRule({ RHS: [ user.nomUsersPlus, github.preVerbStopWordsBeGeneralMentionedIn ], semantic: issuesRequestsMentionedSemantic })
// (people mentioned in) [issues]
github.mentioners.addRule({ RHS: [ issue.catPl ] })


// ASSIGNED-TO:
var assignedTo = g.addWord({
  symbol: new g.Symbol('assigned', 'to'),
  insertionCost: 2,
  accepted: [ 'assigned-to' ]
})

var issuesAssignedSemantic = new g.Semantic({ name: issue.namePl + '-assigned', cost: 0.5, minParams: 1, maxParams: 1 })
var usersAssignedSemantic = new g.Semantic({ name: user.namePl + '-assigned', cost: 0.5, minParams: 1, maxParams: 1 })

var beGeneralAssignedTo = new g.Symbol('be', 'general', 'assigned', 'to')
beGeneralAssignedTo.addRule({ RHS: [ auxVerbs.beGeneral, assignedTo ] })
var preVerbStopWordsBeGeneralAssignedTo = new g.Symbol('pre', 'verb', 'stop', 'words', 'be', 'general', 'assigned', 'to')
preVerbStopWordsBeGeneralAssignedTo.addRule({ RHS: [ stopWords.preVerb, beGeneralAssignedTo ] })
// (issues) I-am/{user}-is/[users]-are assigned to
issue.objFilter.addRule({ RHS: [ user.nomUsersPlus, preVerbStopWordsBeGeneralAssignedTo ], semantic: issuesAssignedSemantic })
// (issues) assigned to me
issue.inner.addRule({ RHS: [ assignedTo, user.objUsersPlus ], semantic: issuesAssignedSemantic })
// (people) assigned to [issues+]; (people who are) mentioned in [issues+]
user.inner.addRule({ RHS: [ assignedTo, issue.catPlPlus ], semantic: usersAssignedSemantic })


// OPEN/CLOSED:
var issuesStateSemantic = new g.Semantic({ name: issue.namePl + '-state', cost: 0.5, minParams: 1, maxParams: 1, preventDups: true })
// open issues
var openStateSemanticArg = new g.Semantic({ name: 'open', isArg: true, cost: 0.5 })
issue.adjective.addRule({ terminal: true, RHS: 'open', text: 'open', semantic: g.insertSemantic(issuesStateSemantic, openStateSemanticArg) })
// closed issues
var closedStateSemanticArg = new g.Semantic({ name: 'closed', isArg: true, cost: 0.5 })
issue.adjective.addRule({ terminal: true, RHS: 'closed', text: 'closed', semantic: g.insertSemantic(issuesStateSemantic, closedStateSemanticArg) })