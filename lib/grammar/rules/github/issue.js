var g = require('../../grammar')
var github = require('./github')
var poss = require('../user/poss')
var user = require('../user/user')
var auxVerbs = require('../auxVerbs')
var stopWords = require('../stopWords')
var preps = require('../prepositions')
var date = require('../date')


var issue = g.newCategory({ sg: 'issue', pl: 'issues' })

issue.term.addWord({
	insertionCost: 3.5,
	accepted: [ issue.namePl ],
})

// |Github issues (I opened)
issue.headMayPoss.addRule({ rhs: [ github.termOpt, issue.term ] })


var issuesOpenedSemantic = g.newSemantic({
	name: g.hyphenate(issue.namePl, 'opened'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	forbidsMultiple: true,
})

// my issues; my closed issues
var issuePossDeterminer = g.newSymbol(issue.nameSg, poss.determiner.name).addRule({
	rhs: [ poss.determiner ],
	semantic: issuesOpenedSemantic,
})
issue.noRelativePossessive.addRule({ rhs: [ issuePossDeterminer, issue.possessable ] })
// issues of mine
issue.head.addRule({ rhs: [ issue.headMayPoss, poss.ofPossUsers ], semantic: issuesOpenedSemantic })


// OPEN:
issue.addVerbRuleSet({
	verbTerm: g.newVerb({
		symbolName: 'open',
		insertionCost: 1,
		acceptedVerbTermSets: [ {
			oneSg: 'open',
			threeSg: 'opens',
			pl: 'open',
			past: 'opened',
			presentParticiple: 'opening',
		}, {
			oneSg: 'create',
			threeSg: 'creates',
			pl: 'create',
			past: 'created',
			presentParticiple: 'creating',
		} ],
	}),
	// Prevent present tense descriptions of issue opening, an action-relationship only represented as a past event:
	//   Stop: (repos) `[nom-users+]` fork(s)
	//   Stop: (repos) `[nom-users+]` do/does not fork
	//   Stop: (people who) fork `[repositories+]`
	//   Stop: (people who) do not fork `[repositories+]`
	onlyPastTense: true,
	// Prevent present-perfect-negative rules, which otherwise incorrectly suggest different users can open existing issues in the future:
	//   Stop: (issues) `[nom-users]` have/has not opened
	//   Stop: (people who) have not opened `[issues+]`
	noPresentPerfectNegative: true,
	// Verb rules for `issues-opened()`:
	//   (issues) opened by `[obj-users]`
	//   (issues) `[nom-users]` opened
	//   (issues) `[nom-users]` have/has opened
	//   (issues) `[nom-users]` did not open
	catVerbSemantic: issuesOpenedSemantic,
	// Verb rules for `issue-openers()`:
	//   (people who) opened `[issues+]`
	//   (people who) have opened `[issues+]`
	//   (people who) did not open `[issues+]`
	userVerbSemantic: g.newSemantic({
		name: g.hyphenate(issue.nameSg, 'openers'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
		// (people who follow) people who opened `[issues+]` (and their followers)
		isPeople: true,
	}),
	// Agent noun rule for `issue-openers()`:
	//   openers of `[issues+]`
	agentNoun: {
		agentNounTerm: g.newSymbol('openers').addWord({
			insertionCost: 3,
			accepted: [ 'openers', 'creators' ],
		}),
		prepTerm: preps.participant,
	},
})


// MENTION:
var issuesMentionedSemantic = g.newSemantic({
	name: g.hyphenate(issue.namePl, 'mentioned'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
})
var notIssuesMentionedSemantic = g.reduceSemantic(auxVerbs.notSemantic, issuesMentionedSemantic)
// (issues that) mention me
issue.subjFilter.addRule({ rhs: [ github.mention, user.objUsersPlus ], semantic: issuesMentionedSemantic })
// (issues that) do not mention me
issue.subjFilter.addRule({ rhs: [ github.doPresentNegationMention, user.objUsersPlus ], semantic: notIssuesMentionedSemantic })
// (issues) I-am/`{user}`-is/`[users]`-are mentioned in
// Temporarily removed `[pre-verb-stop-word]` from before `github.beMentionedIn`.
issue.objFilter.addRule({ rhs: [ user.nomUsersPlus, github.beMentionedIn ], semantic: issuesMentionedSemantic })
// (issues) I-am/`{user}`-is/`[users]`-are not mentioned in
// Temporarily removed `[pre-verb-stop-word]` from before `github.beNegationMentionedIn`.
issue.objFilter.addRule({ rhs: [ user.nomUsersPlus, github.beNegationMentionedIn ], semantic: notIssuesMentionedSemantic })
// (people mentioned in) `[issues]`/`[pull-requests]` (and/or) `[issues]`/`[pull-requests]`
github.mentioners.addRule({ rhs: [ issue.pl ] })


// ASSIGNED-TO:
var issuesAssignedSemantic = g.newSemantic({
	name: g.hyphenate(issue.namePl, 'assigned'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
})
var notIssuesAssignedSemantic = g.reduceSemantic(auxVerbs.notSemantic, issuesAssignedSemantic)
// (issues) assigned to me
issue.inner.addRule({ rhs: [ github.assignedTo, user.objUsersPlus ], semantic: issuesAssignedSemantic })
// (issues) I-am/`{user}`-is/`[users]`-are assigned to
// Temporarily removed `[pre-verb-stop-word]` from before `github.beAssignedTo`.
issue.objFilter.addRule({ rhs: [ user.nomUsersPlus, github.beAssignedTo ], semantic: issuesAssignedSemantic })
// (issues) I-am/`{user}`-is/`[users]`-are not assigned to
// Temporarily removed `[pre-verb-stop-word]` from before `github.beNegationAssignedTo`.
issue.objFilter.addRule({ rhs: [ user.nomUsersPlus, github.beNegationAssignedTo ], semantic: notIssuesAssignedSemantic })
// (people assigned to) `[issues]`/`[pull-requests]` (and/or) `[issues]`/`[pull-requests]`
github.assigners.addRule({ rhs: [ issue.pl ] })


// OPEN/CLOSED:
// open/closed (issues); (issues that are) open/closed
issue.adjective.addRule({
	rhs: [ github.state ],
	semantic: g.newSemantic({
		name: g.hyphenate(issue.namePl, 'state'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
		forbidsMultiple: true,
	}),
})

// NUM COMMENTS:
issue.addCountRuleSet({
	itemTerm: github.comments,
	// Count rules for `issues-comment-count()`:
	//   (issues) with `<int>` comments
	//   (issues that) have `<int>` comments
	//   (issues that) do not have `<int>` comments
	catCountSemantic: g.newSemantic({
		name: g.hyphenate(issue.namePl, 'comment', 'count'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
	}),
})

// DATE:
var updated = g.newSymbol('updated').addWord({
	insertionCost: 2,
	accepted: [ 'updated' ],
})

// (issues) updated `[date]`
issue.inner.addRule({ rhs: [ updated, date ], semantic: issue.semantic })