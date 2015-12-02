var g = require('../../grammar')
var Category = require('../Category')
var github = require('./github')
var poss = require('../poss')
var user = require('../user')
var auxVerbs = require('../auxVerbs')
var preps = require('../prepositions')
var count = require('../count')


var pullRequest = new Category({ sg: 'pull-request', pl: 'pull-requests' })

pullRequest.term.addWord({
	insertionCost: 3.5,
	accepted: [ 'pull requests' ],
	substitutions: [ 'PRs' ],
})

// |Github pull requests (I created)
pullRequest.headMayPoss.addRule({ RHS: [ github.termOpt, pullRequest.term ] })


var pullRequestsCreatedSemantic = g.newSemantic({ name: g.hyphenate(pullRequest.namePl, 'created'), cost: 0.5, minParams: 1, maxParams: 1, forbidsMultiple: true })

// my pull requests
var pullRequestPossDeterminer = g.newSymbol(pullRequest.nameSg, poss.determiner.name).addRule({
	RHS: [ poss.determiner ],
	semantic: pullRequestsCreatedSemantic,
})
pullRequest.noRelativePossessive.addRule({ RHS: [ pullRequestPossDeterminer, pullRequest.possessable ] })
// pull requests of mine
pullRequest.head.addRule({ RHS: [ pullRequest.headMayPoss, poss.ofPossUsers ], semantic: pullRequestsCreatedSemantic })


// CREATE:
// (pull requests) created by me
pullRequest.passive.addRule({ RHS: [ github.create, user.byObjUsers ], semantic: pullRequestsCreatedSemantic, tense: 'past' })
// (pull requests) I <stop> [have-opt] created
pullRequest.objFilter.addRule({ RHS: [ user.nomUsersPreVerbStopWordHaveOpt, github.create ], semantic: pullRequestsCreatedSemantic, tense: 'past' })
// (pull requests) I did not create
pullRequest.objFilter.addRule({ RHS: [ user.nomUsers, github.doPastNegationCreatePresent ], semantic: g.reduceSemantic(auxVerbs.notSemantic, pullRequestsCreatedSemantic) })

var pullRequestCreatorsSemantic = g.newSemantic({ name: g.hyphenate(pullRequest.nameSg, 'creators'), cost: 0.5, minParams: 1, maxParams: 1 })
// Use `[pull-requests]` instead of `[pull-requests+]` because the latter will never be used because this category lacks entities.
// (people who) [have-opt] created [pull-requests]
user.subjFilter.addRule({ RHS: [ github.haveOptCreatePast, pullRequest.catPl ], semantic: pullRequestCreatorsSemantic })
// (people who) did not create [pull-requests]
user.subjFilter.addRule({ RHS: [ github.doPastNegationCreatePresent, pullRequest.catPl ], semantic: g.reduceSemantic(auxVerbs.notSemantic, pullRequestCreatorsSemantic) })

// creators of [pull-requests]
user.head.addRule({
	RHS: [ github.creators, [ preps.participant, pullRequest.catPl ] ],
	noInsertionIndexes: [ 0 ],
	transpositionCost: 1,
	semantic: pullRequestCreatorsSemantic,
})


// MENTION:
var pullRequestsMentionedSemantic = g.newSemantic({ name: g.hyphenate(pullRequest.namePl, 'mentioned'), cost: 0.5, minParams: 1, maxParams: 1 })
var notPullRequestsMentionedSemantic = g.reduceSemantic(auxVerbs.notSemantic, pullRequestsMentionedSemantic)
// (pull requests that) mention me
pullRequest.subjFilter.addRule({ RHS: [ github.mention, user.objUsersPlus ], semantic: pullRequestsMentionedSemantic })
// (pull requests that) do not mention me
pullRequest.subjFilter.addRule({ RHS: [ github.doPresentNegationMention, user.objUsersPlus ], semantic: notPullRequestsMentionedSemantic })
// (pull requests) I-am/{user}-is/[users]-are mentioned in
pullRequest.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWord, github.beGeneralMentionedIn ], semantic: pullRequestsMentionedSemantic })
// (pull requests) I-am/{user}-is/[users]-are not mentioned in
pullRequest.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWord, github.beGeneralNegationMentionedIn ], semantic: notPullRequestsMentionedSemantic })
// (people mentioned in) [issues]/[pull-requests] (and/or) [issues]/[pull-requests]
github.mentioners.addRule({ RHS: [ pullRequest.catPl ] })


// ASSIGNED-TO:
var pullRequestsAssignedSemantic = g.newSemantic({ name: g.hyphenate(pullRequest.namePl, 'assigned'), cost: 0.5, minParams: 1, maxParams: 1 })
// (pull requests) assigned to me
pullRequest.inner.addRule({ RHS: [ github.assignedTo, user.objUsersPlus ], semantic: pullRequestsAssignedSemantic })
// (pull requests) I-am/{user}-is/[users]-are assigned to
pullRequest.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWord, github.beGeneralAssignedTo ], semantic: pullRequestsAssignedSemantic })
// (pull requests) I-am/{user}-is/[users]-are not assigned to
pullRequest.objFilter.addRule({ RHS: [ user.nomUsersPlusPreVerbStopWord, github.beGeneralNegationAssignedTo ], semantic: g.reduceSemantic(auxVerbs.notSemantic, pullRequestsAssignedSemantic) })
// (people assigned to) [issues]/[pull-requests] (and/or) [issues]/[pull-requests]
github.assigners.addRule({ RHS: [ pullRequest.catPl ] })


// OPEN/CLOSED:
// open/closed (pull requests); (pull requests that are) open/closed
pullRequest.adjective.addRule({
	RHS: [ github.state ],
	semantic: g.newSemantic({ name: g.hyphenate(pullRequest.namePl, 'state'), cost: 0.5, minParams: 1, maxParams: 1, forbidsMultiple: true }),
})


// WITH N COMMENTS:
// (pull-requests) with <int> comment
pullRequest.inner.addRule({ RHS: [ preps.possessed, github.commentCount ], semantic: pullRequest.semantic })