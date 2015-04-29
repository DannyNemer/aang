var g = require('../../grammar')
var Category = require('../Category')
var github = require('./github')
var poss = require('../poss')
var user = require('../user')
var auxVerbs = require('../auxVerbs')
var stopWords = require('../stopWords')
var preps = require('../prepositions')
var conjunctions = require('../conjunctions')

var issue = new Category({ sg: 'issue', pl: 'issues' })

var issuesTerm = g.addWord({
	symbol: new g.Symbol(issue.namePl, 'term'),
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
issue.head.addRule({ RHS: [ issue.headMayPoss, poss.ofPossUsersPlus ], semantic: issuesOpenedSemantic })


// OPENED:
var opened = g.addWord({
	symbol: new g.Symbol('opened'),
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

var openersOf = g.addWord({
	symbol: new g.Symbol('openers', 'of'),
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
var assignedTo = g.addWord({
  symbol: new g.Symbol('assigned', 'to'),
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
var issuesCommentsSemantic = g.newSemantic({ name: issue.namePl + '-comments', cost: 0.5, minParams: 1, maxParams: 2 })
var issuesCommentsOverSemantic = g.newSemantic({ name: issue.namePl + '-comments-over', cost: 0.5, minParams: 1, maxParams: 1 })
var issuesCommentsUnderSemantic = g.newSemantic({ name: issue.namePl + '-comments-under', cost: 0.5, minParams: 1, maxParams: 1 })

var number = new g.Symbol('number')
number.addRule({ terminal: true, RHS: '<int>' })

var comments = g.addWord({
  symbol: new g.Symbol('comments'),
  accepted: [ 'comments' ]
})

// (issues) with <int> comments
var commentsCount = new g.Symbol('comments', 'count')
issue.inner.addRule({ RHS: [ preps.possessed, commentsCount ] })

var numberComments = new g.Symbol('number', 'comments')
numberComments.addRule({ RHS: [ number, comments ] })
var numberCommentsOpt = new g.Symbol('number', 'comments', 'opt')
numberCommentsOpt.addRule({ RHS: [ number, g.addNonterminalOpt(comments) ] })

// (issues with) <int> comments
// issues-comments(n2)
commentsCount.addRule({ RHS: [ numberComments ], semantic: issuesCommentsSemantic })
// (issues with) under <int> comments
// issues-comments-under(n)
commentsCount.addRule({ RHS: [ preps.under, numberComments ], semantic: issuesCommentsUnderSemantic })
// (issues with) over <int> comments
// issues-comments-over(n)
commentsCount.addRule({ RHS: [ preps.over, numberComments ], semantic: issuesCommentsOverSemantic })
// (issues with) under <int> comments and over <int> comments
// issues-comments-over(n1), issues-comments-under(n2) - exclusive
var prepUnderNumberCommentsOpt = new g.Symbol('prep', 'under', 'number', 'comments', 'opt')
prepUnderNumberCommentsOpt.addRule({ RHS: [ preps.under, numberCommentsOpt ], semantic: issuesCommentsUnderSemantic })
var prepUnderNumberCommentsOptAnd = new g.Symbol('prep', 'under', 'number', 'comments', 'opt', 'and')
prepUnderNumberCommentsOptAnd.addRule({ RHS: [ prepUnderNumberCommentsOpt, conjunctions.and ] })
var prepOverNumberComments = new g.Symbol('prep', 'over', 'number', 'comments')
prepOverNumberComments.addRule({ RHS: [ preps.over, numberComments ], semantic: issuesCommentsOverSemantic })
commentsCount.addRule({ RHS: [ prepUnderNumberCommentsOptAnd, prepOverNumberComments ] })
// (issues with) over <int> comments and under <int> comments
// issues-comments-over(n1), issues-comments-under(n2) - exclusive
var prepOverNumberCommentsOpt = new g.Symbol('prep', 'over', 'number', 'comments', 'opt')
prepOverNumberCommentsOpt.addRule({ RHS: [ preps.over, numberCommentsOpt ], semantic: issuesCommentsOverSemantic })
var prepOverNumberCommentsOptAnd = new g.Symbol('prep', 'over', 'number', 'comments', 'opt', 'and')
prepOverNumberCommentsOptAnd.addRule({ RHS: [ prepOverNumberCommentsOpt, conjunctions.and ] })
var prepUnderNumberComments = new g.Symbol('prep', 'under', 'number', 'comments')
prepUnderNumberComments.addRule({ RHS: [ preps.under, numberComments ], semantic: issuesCommentsUnderSemantic })
commentsCount.addRule({ RHS: [ prepOverNumberCommentsOptAnd, prepUnderNumberComments ] })
// (issues with) <int> comments to <int> comments
// issues-comments(n1, n2) - inclusive
var numberCommentsOptPrepEnd = new g.Symbol('number', 'comments', 'opt', 'prep', 'end')
numberCommentsOptPrepEnd.addRule({ RHS: [ numberCommentsOpt, preps.end ] })
commentsCount.addRule({ RHS: [ numberCommentsOptPrepEnd, numberComments ], semantic: issuesCommentsSemantic })
// (issues with) between <int> comments and <int> comments
// issues-comments(n1, n2) - inclusive
var prepBetweenNumberCommmentsOpt = new g.Symbol('prep', 'between', 'number', 'comments', 'opt')
prepBetweenNumberCommmentsOpt.addRule({ RHS: [ preps.between, numberCommentsOpt ] })
var prepBetweenNumberCommmentsOptAnd = new g.Symbol('prep', 'between', 'number', 'comments', 'opt', 'and')
prepBetweenNumberCommmentsOptAnd.addRule({ RHS: [ prepBetweenNumberCommmentsOpt, conjunctions.and ] })
commentsCount.addRule({ RHS: [ prepBetweenNumberCommmentsOptAnd, numberComments ], semantic: issuesCommentsSemantic })