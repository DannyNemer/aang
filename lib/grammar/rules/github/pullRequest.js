var g = require('../../grammar')
var github = require('./github')
var user = require('../user/user')
var auxVerbs = require('../auxVerbs')
var preps = require('../prepositions')
var nouns = require('../nouns')
var verbs = require('../verbs')


var pullRequestsCreatedSemantic = g.newSemantic({
	name: g.hyphenate('pull', 'requests', 'created'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	forbidsMultipleIntersection: true,
})

var pullRequest = g.newCategory({
	nameSg: 'pull-request',
	namePl: 'pull-requests',
	// `[poss-determiner]` pull requests
	// pull requests of `[poss-users]` [or `[poss-users+-disjunction]`]
	possSemantic: pullRequestsCreatedSemantic,
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


// CREATE:
pullRequest.addVerbRuleSet({
	verbTerm: verbs.createSet,
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

pullRequest.addIndirectObjectVerbRuleSet({
	verbTerm: verbs.mention,
	prepTerm: preps.in,
	// Verb rules for `pull-requests-mentioned()`:
	//   (pull requests) `[nom-users+]` `[be]` mentioned in
	//   (pull requests) `[nom-users+]` `[be]` not mentioned in
	catVerbSemantic: pullRequestsMentionedSemantic,
	// Verb rules for `mentioners()`:
	//   (people mentioned in) `[issues]`/`[pull-requests]` (and/or `[issues]`/`[pull-requests]`)
	//   (people not mentioned in) `[issues]`/`[pull-requests]` (and/or `[issues]`/`[pull-requests]`)
	agentSetSym: github.mentioners,
})


// ASSIGNED-TO:
var pullRequestsAssignedSemantic = g.newSemantic({
	name: g.hyphenate(pullRequest.namePl, 'assigned'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
})
// (pull requests) assigned to me
pullRequest.inner.addRule({
	rhs: [ verbs.assignedTo, user.objUsersPlus ],
	semantic: pullRequestsAssignedSemantic,
})

pullRequest.addIndirectObjectVerbRuleSet({
	verbTerm: verbs.assign,
	prepTerm: preps.to,
	// Verb rules for `pull-requests-assigned()`:
	//   (pull requests) `[nom-users+]` `[be]` assigned to
	//   (pull requests) `[nom-users+]` `[be]` not assigned to
	catVerbSemantic: pullRequestsAssignedSemantic,
	// Verb rules for `assigners()`:
	//   (people assigned to) `[issues]`/`[pull-requests]` (and/or `[issues]`/`[pull-requests]`)
	//   (people not assigned to) `[issues]`/`[pull-requests]` (and/or `[issues]`/`[pull-requests]`)
	agentSetSym: github.assigners,
})


// OPEN/CLOSED:
// open/closed (pull requests); (pull requests that are) open/closed
pullRequest.adjective.addRule({
	rhs: [ github.state ],
	semantic: g.newSemantic({
		name: g.hyphenate(pullRequest.namePl, 'state'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
		forbidsMultipleIntersection: true,
	}),
})

// NUM COMMENTS:
pullRequest.addCountRuleSet({
	itemNoun: nouns.comments,
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