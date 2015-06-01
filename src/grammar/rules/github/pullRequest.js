var g = require('../../grammar')
var Category = require('../Category')
var github = require('./github')
var poss = require('../poss')
var user = require('../user')
var preps = require('../prepositions')
var count = require('../count')


var pullRequest = new Category({ sg: 'pull-request', pl: 'pull-requests' })

var pullRequestsTerm = new g.Symbol(pullRequest.namePl, 'term')
pullRequestsTerm.addWord({
	insertionCost: 3.5,
	accepted: [ 'pull requests' ]
})

// |Github pull requests (I created)
pullRequest.headMayPoss.addRule({ RHS: [ github.termOpt, pullRequestsTerm ] })


var pullRequestsCreatedSemantic = g.newSemantic({ name: g.hyphenate(pullRequest.namePl, 'created'), cost: 0.5, minParams: 1, maxParams: 1, preventDups: true })
var pullRequestCreatorsSemantic = g.newSemantic({ name: g.hyphenate(pullRequest.nameSg, 'creators'), cost: 0.5, minParams: 1, maxParams: 1 })

// my pull requests
var pullRequestPossDeterminer = new g.Symbol(pullRequest.nameSg, 'poss', 'determiner')
pullRequestPossDeterminer.addRule({ RHS: [ poss.determiner ], semantic: pullRequestsCreatedSemantic })
pullRequest.noRelativePossessive.addRule({ RHS: [ pullRequestPossDeterminer, pullRequest.possessible ] })
// pull requests of mine
pullRequest.head.addRule({ RHS: [ pullRequest.headMayPoss, poss.ofPossUsers ], semantic: pullRequestsCreatedSemantic })


// CREATED:
// (pull requests) created by me
pullRequest.passive.addRule({ RHS: [ github.created, user.byObjUsers ], semantic: pullRequestsCreatedSemantic })
// (pull requests) I <stop> created
pullRequest.objFilter.addRule({ RHS: [ user.nomUsersPreVerbStopWords, github.created ], semantic: pullRequestsCreatedSemantic })
// (pull requests) I <stop> have created
pullRequest.objFilter.addRule({ RHS: [ user.nomUsersPreVerbStopWords, github.haveCreated ], semantic: pullRequestsCreatedSemantic })
// (people who) created pull requests ...
user.subjFilter.addRule({ RHS: [ github.created, pullRequest.catPl ], semantic: pullRequestCreatorsSemantic })
// (people who) have created pull requests ... - not [pull-requests+] because 'by'
user.subjFilter.addRule({ RHS: [ github.haveCreated, pullRequest.catPl ], semantic: pullRequestCreatorsSemantic, personNumber: 'pl' })
// creators of [pull-requests]
user.head.addRule({ RHS: [ github.creatorsOf, pullRequest.catPl ], semantic: pullRequestCreatorsSemantic })


// MENTION:
var pullRequestsMentionedSemantic = g.newSemantic({ name: g.hyphenate(pullRequest.namePl, 'mentioned'), cost: 0.5, minParams: 1, maxParams: 1 })
// (pull requests that) mention me
pullRequest.subjFilter.addRule({ RHS: [ github.mention, user.objUsersPlus ], semantic: pullRequestsMentionedSemantic })
// (pull requests) I-am/{user}-is/[users]-are mentioned in
pullRequest.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWords, github.beGeneralMentionedIn ], semantic: pullRequestsMentionedSemantic })
// (people mentioned in) [issues]/[pull-requests] (and/or) [issues]/[pull-requests]
github.mentioners.addRule({ RHS: [ pullRequest.catPl ] })


// ASSIGNED-TO:
var pullRequestsAssignedSemantic = g.newSemantic({ name: g.hyphenate(pullRequest.namePl, 'assigned'), cost: 0.5, minParams: 1, maxParams: 1 })
// (issues) assigned to me
pullRequest.inner.addRule({ RHS: [ github.assignedTo, user.objUsersPlus ], semantic: pullRequestsAssignedSemantic })
// (issues) I-am/{user}-is/[users]-are assigned to
pullRequest.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWords, github.beGeneralAssignedTo ], semantic: pullRequestsAssignedSemantic })
// (people assigned to) [issues]/[pull-requests] (and/or) [issues]/[pull-requests]
github.assigners.addRule({ RHS: [ pullRequest.catPl ] })


// OPEN/CLOSED:
// open/closed (pull requests); (pull requests that are) open/closed
pullRequest.adjective.addRule({
	RHS: [ github.state ],
	semantic: g.newSemantic({ name: g.hyphenate(pullRequest.namePl, 'state'), cost: 0.5, minParams: 1, maxParams: 1, preventDups: true })
})


// WITH N COMMENTS:
// (pull-requests) with <int> comment
pullRequest.inner.addRule({ RHS: [ preps.possessed, github.commentCount ], semantic: pullRequest.semantic })