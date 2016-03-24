var g = require('../../grammar')
var github = require('./github')
var poss = require('../user/poss')
var user = require('../user/user')
var auxVerbs = require('../auxVerbs')
var preps = require('../prepositions')


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
// (pull requests) I created
pullRequest.objFilter.addRule({ rhs: [ user.nomUsers, github.create ], semantic: pullRequestsCreatedSemantic, grammaticalForm: 'past' })
// (pull requests) I have created
pullRequest.objFilter.addRule({ rhs: [ user.nomUsersHaveNoInsert, github.create ], semantic: pullRequestsCreatedSemantic, grammaticalForm: 'past' })
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
// (people who) created `[pull-requests+]`
user.subjFilter.addRule({ rhs: [ github.create, pullRequest.plPlus ], semantic: pullRequestCreatorsSemantic, grammaticalForm: 'past' })
// (people who) have created `[pull-requests+]`
user.subjFilter.addRule({ rhs: [ github.haveNoInsertCreatePast, pullRequest.plPlus ], semantic: pullRequestCreatorsSemantic })
// (people who) did not create `[pull-requests+]`
user.subjFilter.addRule({ rhs: [ github.doPastNegationCreatePresent, pullRequest.plPlus ], semantic: g.reduceSemantic(auxVerbs.notSemantic, pullRequestCreatorsSemantic) })
// creators of `[pull-requests+]`
pullRequest.addAgentNoun({
	agentNounTerm: github.creators,
	prepTerm: preps.participant,
	userVerbSemantic: pullRequestCreatorsSemantic,
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
// Temporarily removed `[pre-verb-stop-word]` from before `github.beMentionedIn`.
pullRequest.objFilter.addRule({ rhs: [ user.nomUsersPlus, github.beMentionedIn ], semantic: pullRequestsMentionedSemantic })
// (pull requests) I-am/`{user}`-is/`[users]`-are not mentioned in
// Temporarily removed `[pre-verb-stop-word]` from before `github.beNegationMentionedIn`.
pullRequest.objFilter.addRule({ rhs: [ user.nomUsersPlus, github.beNegationMentionedIn ], semantic: notPullRequestsMentionedSemantic })
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
// Temporarily removed `[pre-verb-stop-word]` from before `github.beAssignedTo`.
pullRequest.objFilter.addRule({ rhs: [ user.nomUsersPlus, github.beAssignedTo ], semantic: pullRequestsAssignedSemantic })
// (pull requests) I-am/`{user}`-is/`[users]`-are not assigned to
// Temporarily removed `[pre-verb-stop-word]` from before `github.beNegationAssignedTo`.
pullRequest.objFilter.addRule({ rhs: [ user.nomUsersPlus, github.beNegationAssignedTo ], semantic: g.reduceSemantic(auxVerbs.notSemantic, pullRequestsAssignedSemantic) })
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

// NUM COMMENTS:
pullRequest.addCountRuleSet({
	itemTerm: github.comments,
	// Count rules for `pull-requests-comment-count()`:
	//   (pull requests) with `<int>` comments
	//   (pull requests that) have `<int>` comments
	//   (pull requests that) do not have `<int>` comments
	catCountSemantic: g.newSemantic({
		name: g.hyphenate(pullRequest.namePl, 'comment', 'count'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
	}),
})