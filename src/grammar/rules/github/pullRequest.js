var g = require('../../grammar')
var category = require('../category')
var github = require('./github')
var poss = require('../poss')
var user = require('../user')
var auxVerbs = require('../auxVerbs')
var preps = require('../prepositions')
var count = require('../count')


var pullRequest = category.new({ sg: 'pull-request', pl: 'pull-requests' })

pullRequest.term.addWord({
	insertionCost: 3.5,
	accepted: [ 'pull requests' ],
	substitutions: [ 'PRs' ],
})

// |Github pull requests (I created)
pullRequest.headMayPoss.addRule({ RHS: [ github.termOpt, pullRequest.term ] })


var pullRequestsCreatedSemantic = g.newSemantic({ name: g.hyphenate(pullRequest.namePl, 'created'), cost: 0.5, minParams: 1, maxParams: 1, forbidMultiple: true })

// my pull requests
var pullRequestPossDeterminer = g.newSymbol(pullRequest.nameSg, 'poss', 'determiner')
pullRequestPossDeterminer.addRule({ RHS: [ poss.determiner ], semantic: pullRequestsCreatedSemantic })
pullRequest.noRelativePossessive.addRule({ RHS: [ pullRequestPossDeterminer, pullRequest.possessible ] })
// pull requests of mine
pullRequest.head.addRule({ RHS: [ pullRequest.headMayPoss, poss.ofPossUsers ], semantic: pullRequestsCreatedSemantic })


// CREATE:
// (pull requests) created by me
pullRequest.passive.addRule({ RHS: [ github.createPast, user.byObjUsers ], semantic: pullRequestsCreatedSemantic })
// (pull requests) I <stop> created
pullRequest.objFilter.addRule({ RHS: [ user.nomUsersPreVerbStopWords, github.createPast ], semantic: pullRequestsCreatedSemantic })
// (pull requests) I <stop> have created
pullRequest.objFilter.addRule({ RHS: [ user.nomUsersPreVerbStopWords, github.haveNoInsertCreatePast ], semantic: pullRequestsCreatedSemantic })
// (pull requests) I did not create
pullRequest.objFilter.addRule({ RHS: [ user.nomUsers, github.doPastNegationCreatePresent ], semantic: g.reduceSemantic(auxVerbs.notSemantic, pullRequestsCreatedSemantic) })

var pullRequestCreatorsSemantic = g.newSemantic({ name: g.hyphenate(pullRequest.nameSg, 'creators'), cost: 0.5, minParams: 1, maxParams: 1 })
// (people who) created [pull-requests]
user.subjFilter.addRule({ RHS: [ github.createPast, pullRequest.catPl ], semantic: pullRequestCreatorsSemantic })
// (people who) have created [pull-requests] - not [pull-requests+] because 'by'
user.subjFilter.addRule({ RHS: [ github.haveNoInsertCreatePast, pullRequest.catPl ], semantic: pullRequestCreatorsSemantic, personNumber: 'pl' })
// (people who) did not create [pull-requests]
// Use [pull-requests+]?
user.subjFilter.addRule({ RHS: [ github.doPastNegationCreatePresent, pullRequest.catPl ], semantic: g.reduceSemantic(auxVerbs.notSemantic, pullRequestCreatorsSemantic) })
// creators of [pull-requests]
user.head.addRule({ RHS: [ github.creatorsOf, pullRequest.catPl ], semantic: pullRequestCreatorsSemantic })


// MENTION:
var pullRequestsMentionedSemantic = g.newSemantic({ name: g.hyphenate(pullRequest.namePl, 'mentioned'), cost: 0.5, minParams: 1, maxParams: 1 })
var notPullRequestsMentionedSemantic = g.reduceSemantic(auxVerbs.notSemantic, pullRequestsMentionedSemantic)
// (pull requests that) mention me
pullRequest.subjFilter.addRule({ RHS: [ github.mention, user.objUsersPlus ], semantic: pullRequestsMentionedSemantic })
// (pull requests that) do not mention me
pullRequest.subjFilter.addRule({ RHS: [ github.doPresentNegationMention, user.objUsersPlus ], semantic: notPullRequestsMentionedSemantic, personNumber: 'pl' })
// (pull requests) I-am/{user}-is/[users]-are mentioned in
pullRequest.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWords, github.beGeneralMentionedIn ], semantic: pullRequestsMentionedSemantic })
// (people mentioned in) [issues]/[pull-requests] (and/or) [issues]/[pull-requests]
github.mentioners.addRule({ RHS: [ pullRequest.catPl ] })


// ASSIGNED-TO:
var pullRequestsAssignedSemantic = g.newSemantic({ name: g.hyphenate(pullRequest.namePl, 'assigned'), cost: 0.5, minParams: 1, maxParams: 1 })
// (pull requests) assigned to me
pullRequest.inner.addRule({ RHS: [ github.assignedTo, user.objUsersPlus ], semantic: pullRequestsAssignedSemantic })
// (pull requests) I-am/{user}-is/[users]-are assigned to
pullRequest.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWords, github.beGeneralAssignedTo ], semantic: pullRequestsAssignedSemantic })
// (people assigned to) [issues]/[pull-requests] (and/or) [issues]/[pull-requests]
github.assigners.addRule({ RHS: [ pullRequest.catPl ] })


// OPEN/CLOSED:
// open/closed (pull requests); (pull requests that are) open/closed
pullRequest.adjective.addRule({
	RHS: [ github.state ],
	semantic: g.newSemantic({ name: g.hyphenate(pullRequest.namePl, 'state'), cost: 0.5, minParams: 1, maxParams: 1, forbidMultiple: true }),
})


// WITH N COMMENTS:
// (pull-requests) with <int> comment
pullRequest.inner.addRule({ RHS: [ preps.possessed, github.commentCount ], semantic: pullRequest.semantic })