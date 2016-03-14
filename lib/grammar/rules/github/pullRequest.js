var g = require('../../grammar')
var github = require('./github')
var poss = require('../user/poss')
var user = require('../user/user')
var auxVerbs = require('../auxVerbs')
var preps = require('../prepositions')
var count = require('../count')


var pullRequest = g.newCategory({ sg: 'pull-request', pl: 'pull-requests' })

pullRequest.term.addWord({
	insertionCost: 3.5,
	accepted: [ 'pull requests' ],
	substitutions: [ 'PRs' ],
})

// |Github pull requests (I created)
pullRequest.headMayPoss.addRule({ rhs: [ github.termOpt, pullRequest.term ] })


var pullRequestsCreatedSemantic = g.newSemantic({
	name: g.hyphenate(pullRequest.namePl, 'created'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	forbidsMultiple: true,
})

// my pull requests
var pullRequestPossDeterminer = g.newSymbol(pullRequest.nameSg, poss.determiner.name).addRule({
	rhs: [ poss.determiner ],
	semantic: pullRequestsCreatedSemantic,
})
pullRequest.noRelativePossessive.addRule({ rhs: [ pullRequestPossDeterminer, pullRequest.possessable ] })
// pull requests of mine
pullRequest.head.addRule({ rhs: [ pullRequest.headMayPoss, poss.ofPossUsers ], semantic: pullRequestsCreatedSemantic })


// CREATE:
// (pull requests) created by me
pullRequest.passive.addRule({ rhs: [ github.create, user.byObjUsers ], semantic: pullRequestsCreatedSemantic, grammaticalForm: 'past' })
// (pull requests) I <stop> `[have-opt]` created
pullRequest.objFilter.addRule({ rhs: [ user.nomUsersPreVerbStopWordHaveOpt, github.create ], semantic: pullRequestsCreatedSemantic, grammaticalForm: 'past' })
// (pull requests) I did not create
pullRequest.objFilter.addRule({ rhs: [ user.nomUsers, github.doPastNegationCreatePresent ], semantic: g.reduceSemantic(auxVerbs.notSemantic, pullRequestsCreatedSemantic) })

var pullRequestCreatorsSemantic = g.newSemantic({
	name: g.hyphenate(pullRequest.nameSg, 'creators'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	// (repos liked by) people who created pull requests assigned to me and liked by their followers
	isPeople: true,
})
// (people who) `[have-opt]` created `[pull-requests+]`
user.subjFilter.addRule({ rhs: [ github.haveOptCreatePast, pullRequest.plPlus ], semantic: pullRequestCreatorsSemantic })
// (people who) did not create `[pull-requests+]`
user.subjFilter.addRule({ rhs: [ github.doPastNegationCreatePresent, pullRequest.plPlus ], semantic: g.reduceSemantic(auxVerbs.notSemantic, pullRequestCreatorsSemantic) })
// creators of `[pull-requests+]`
pullRequest.addAgentNoun({
	agentNounTerm: github.creators,
	prepTerm: preps.participant,
	actionSemantic: pullRequestCreatorsSemantic,
})


// MENTION:
var pullRequestsMentionedSemantic = g.newSemantic({
	name: g.hyphenate(pullRequest.namePl, 'mentioned'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
})
var notPullRequestsMentionedSemantic = g.reduceSemantic(auxVerbs.notSemantic, pullRequestsMentionedSemantic)
// (pull requests that) mention me
pullRequest.subjFilter.addRule({ rhs: [ github.mention, user.objUsersPlus ], semantic: pullRequestsMentionedSemantic })
// (pull requests that) do not mention me
pullRequest.subjFilter.addRule({ rhs: [ github.doPresentNegationMention, user.objUsersPlus ], semantic: notPullRequestsMentionedSemantic })
// (pull requests) I-am/`{user}`-is/`[users]`-are mentioned in
pullRequest.objFilter.addRule({ rhs: [ user.nomUsersPlusPreVerbStopWord, github.beGeneralMentionedIn ], semantic: pullRequestsMentionedSemantic })
// (pull requests) I-am/`{user}`-is/`[users]`-are not mentioned in
pullRequest.objFilter.addRule({ rhs: [ user.nomUsersPlusPreVerbStopWord, github.beGeneralNegationMentionedIn ], semantic: notPullRequestsMentionedSemantic })
// (people mentioned in) `[issues]`/`[pull-requests] (and/or) `[issues]`/`[pull-requests]`
github.mentioners.addRule({ rhs: [ pullRequest.pl ] })


// ASSIGNED-TO:
var pullRequestsAssignedSemantic = g.newSemantic({
	name: g.hyphenate(pullRequest.namePl, 'assigned'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
})
// (pull requests) assigned to me
pullRequest.inner.addRule({ rhs: [ github.assignedTo, user.objUsersPlus ], semantic: pullRequestsAssignedSemantic })
// (pull requests) I-am/`{user}`-is/`[users]`-are assigned to
pullRequest.objFilter.addRule({ rhs: [ user.nomUsersPlusPreVerbStopWord, github.beGeneralAssignedTo ], semantic: pullRequestsAssignedSemantic })
// (pull requests) I-am/`{user}`-is/`[users]`-are not assigned to
pullRequest.objFilter.addRule({ rhs: [ user.nomUsersPlusPreVerbStopWord, github.beGeneralNegationAssignedTo ], semantic: g.reduceSemantic(auxVerbs.notSemantic, pullRequestsAssignedSemantic) })
// (people assigned to) `[issues]`/`[pull-requests] (and/or) `[issues]`/`[pull-requests]`
github.assigners.addRule({ rhs: [ pullRequest.pl ] })


// OPEN/CLOSED:
// open/closed (pull requests); (pull requests that are) open/closed
pullRequest.adjective.addRule({
	rhs: [ github.state ],
	semantic: g.newSemantic({
		name: g.hyphenate(pullRequest.namePl, 'state'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
		forbidsMultiple: true,
	}),
})


// WITH N COMMENTS:
// (pull-requests) with `<int>` comment
pullRequest.inner.addRule({ rhs: [ preps.possessed, github.commentCount ], semantic: pullRequest.semantic })