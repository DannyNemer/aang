var g = require('../../grammar')
var github = require('./github')
var poss = require('../user/poss')
var user = require('../user/user')
var auxVerbs = require('../auxVerbs')
var verbs = require('../verbs')
var preps = require('../prepositions')
var terms = require('../terms')
var nouns = require('../nouns')


var issue = g.newCategory({
	sg: 'issue',
	pl: 'issues',
	headTerm: g.newTermSequence({
		symbolName: g.hyphenate('issues', 'term'),
		insertionCost: 3.5,
		type: 'invariable',
		acceptedTerms: [ 'issues' ],
	}),
})

// |Github issues (I opened)
issue.headMayPoss.addRule({ rhs: [ issue.term ] })
issue.headMayPoss.addRule({ rhs: [ github.term, issue.term ] })


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
	verbTerm: g.newTermSequence({
		symbolName: g.hyphenate(issue.nameSg, 'open'),
		type: 'verb',
		acceptedTerms: [
			// Use identical `insertionCost` for `[verb-open]` as `[verb-create]` to ensure insertion rules for `[issue-open]` insert `[verb-open]` instead of its accepted synonym, `[verb-create]`.
			verbs.open,
			verbs.create,
		],
		substitutedTerms: [
			verbs.make,
		],
	}),
	// Prevent present tense descriptions of issue opening, an action-relationship only represented as a past event:
	//   Stop: (repos) `[nom-users+]` fork(s)
	//   Stop: (repos) `[nom-users+]` do/does not fork
	//   Stop: (people who) fork `[repositories+]`
	//   Stop: (people who) do not fork `[repositories+]`
	onlyPastTense: true,
	// Prevent present perfect negative rules, which otherwise incorrectly suggest different users can open existing issues in the future:
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
		agentNounTerm: nouns.openers,
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

issue.addSubjectVerbRuleSet({
	verbTerm: verbs.mention,
	// Accept past tense form of `[verb-mention]` if input is past tense, while still defaulting to present tense when input is not past tense and for insertions. Applicable to `[verb-mention]`, which can be expressed in present or past tense without semantic differences. Enables the following rule to be present or past tense:
	//   (issues that) mentioned `[obj-users+]`
	acceptPastTenseIfInput: true,
	// Verb rules for `repository-contributors()`:
	//   (issues that) mention/mentioned `[obj-users+]`
	//   (issues that) have mentioned `[obj-users+]`
	//   (issues that) do not mention `[obj-users+]`
	//   (issues that) have not mentioned `[obj-users+]`
	objectSym: user.objUsersPlus,
	catVerbSemantic: issuesMentionedSemantic,
})

// (issues) I-am/`{user}`-is/`[users]`-are mentioned in
issue.objFilter.addRule({ rhs: [ user.nomUsersPlus, github.beMentionedIn ], semantic: issuesMentionedSemantic })
// (issues) I-am/`{user}`-is/`[users]`-are not mentioned in
issue.objFilter.addRule({ rhs: [ user.nomUsersPlus, github.beNegationMentionedIn ], semantic: g.reduceSemantic(auxVerbs.notSemantic, issuesMentionedSemantic) })
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
issue.objFilter.addRule({ rhs: [ user.nomUsersPlus, github.beAssignedTo ], semantic: issuesAssignedSemantic })
// (issues) I-am/`{user}`-is/`[users]`-are not assigned to
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
	itemTerm: terms.comments,
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

// DATE UPDATED:
issue.addDateRuleSet({
	verbTerm: verbs.update,
	// Date rules for `issues-updated-date()`:
	//   (issues) updated `[date]`
	//   (issues not) updated `[date]`
	catDateSemantic: g.newSemantic({
		name: g.hyphenate(issue.namePl, 'updated', 'date'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
	}),
})