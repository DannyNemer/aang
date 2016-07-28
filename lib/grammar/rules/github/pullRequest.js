var g = require('../../grammar')
var github = require('./github')
var poss = require('../user/possessive')
var user = require('../user/user')
var auxVerbs = require('../auxVerbs')
var preps = require('../prepositions')
var terms = require('../terms')
var nouns = require('../nouns')
var verbs = require('../verbs')


var pullRequest = g.newCategory({
	sg: 'pull-request',
	pl: 'pull-requests',
	headTerm: g.newTermSequence({
		symbolName: g.hyphenate('pull-requests', 'term'),
		type: g.termTypes.INVARIABLE,
		acceptedTerms: [
			[
				g.newTermSequence({
					symbolName: g.hyphenate('term', 'pull'),
					type: g.termTypes.INVARIABLE,
					insertionCost: 1.75,
					acceptedTerms: [ 'pull' ],
				}),
				g.newTermSequence({
					symbolName: g.hyphenate('term', 'requests'),
					type: g.termTypes.INVARIABLE,
					insertionCost: 1.75,
					acceptedTerms: [ 'requests' ],
				}),
			],
		],
		substitutedTerms: [ 'PRs' ],
	}),
})

// |Github pull requests (I created)
pullRequest.headMayPoss.addRule({ rhs: [ pullRequest.term ] })
pullRequest.headMayPoss.addRule({ rhs: [ github.term, pullRequest.term ] })


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
pullRequest.addVerbRuleSet({
	verbTerm: github.create,
	// Prevent present tense descriptions of pull request creation, an action-relationship only represented as a past event:
	//   Stop: (pull requests) `[nom-users+-disjunction]` create(s)
	//   Stop: (pull requests) `[nom-users+-disjunction]` do/does not create
	//   Stop: (people who) create `[pull-requests+]`
	//   Stop: (people who) do not create `[pull-requests+]`
	onlyPastTense: true,
	// Prevent present perfect negative rules, which otherwise incorrectly suggest different users can create existing pull requests in the future:
	//   Stop: (pull requests) `[nom-users+-disjunction]` have/has not created
	//   Stop: (people who) have not created `[pull-requests+]`
	noPresentPerfectNegative: true,
	// Verb rules for `pull-requests-created()`:
	//   (pull requests) created by `[obj-users+-disjunction]`
	//   (pull requests) `[nom-users+-disjunction]` created
	//   (pull requests) `[nom-users+-disjunction]` have/has created
	//   (pull requests) `[nom-users+-disjunction]` did not open
	catVerbSemantic: pullRequestsCreatedSemantic,
	// Verb rules for `pull-request-creators()`:
	//   (people who) created `[pull-requests+]`
	//   (people who) have created `[pull-requests+]`
	//   (people who) did not open `[pull-requests+]`
	userVerbSemantic: g.newSemantic({
		name: g.hyphenate(pullRequest.nameSg, 'creators'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
		// (people who follow) people who created `[pull-requests+]` (and their followers)
		isPeople: true,
	}),
	// Agent noun rules for `pull-request-creators()`:
	//   creators of `[pull-requests+]`
	//   `{pull-request}` creators
	agentNoun: {
		agentNounTerm: nouns.creators,
		prepTerm: preps.participant,
	},
})


// MENTION:
var pullRequestsMentionedSemantic = g.newSemantic({
	name: g.hyphenate(pullRequest.namePl, 'mentioned'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
})

pullRequest.addSubjectVerbRuleSet({
	verbTerm: verbs.mention,
	// Accept past tense form of `[verb-mention]` if input is past tense, while still defaulting to present tense when input is not past tense and for insertions. Applicable to `[verb-mention]`, which can be expressed in present or past tense without semantic differences. Enables the following rule to be present or past tense:
	//   (pull requests that) mentioned `[obj-users+]`
	acceptPastTenseIfInput: true,
	// Verb rules for `repository-contributors()`:
	//   (pull requests that) mention/mentioned `[obj-users+]`
	//   (pull requests that) have mentioned `[obj-users+]`
	//   (pull requests that) do not mention `[obj-users+]`
	//   (pull requests that) have not mentioned `[obj-users+]`
	objectSym: user.objUsersPlus,
	catVerbSemantic: pullRequestsMentionedSemantic,
})


// (pull requests) I-am/`{user}`-is/`[users]`-are mentioned in
pullRequest.objFilter.addRule({ rhs: [ user.nomUsersPlus, github.beMentionedIn ], semantic: pullRequestsMentionedSemantic })
// (pull requests) I-am/`{user}`-is/`[users]`-are not mentioned in
pullRequest.objFilter.addRule({ rhs: [ user.nomUsersPlus, github.beNegationMentionedIn ], semantic: g.reduceSemantic(auxVerbs.notSemantic, pullRequestsMentionedSemantic) })
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
	itemTerm: terms.comments,
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