var g = require('../../grammar')
var github = require('./github')
var user = require('../user/user')
var auxVerbs = require('../auxVerbs')
var verbs = require('../verbs')
var preps = require('../prepositions')
var nouns = require('../nouns')


var issuesOpenedSemantic = g.newSemantic({
	name: g.hyphenate('issues', 'opened'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	forbidsMultipleIntersection: true,
})

var issue = g.newCategory({
	nameSg: 'issue',
	namePl: 'issues',
	headNoun: g.newCountNoun({
		insertionCost: 3.5,
		nounFormsSet: { sg: 'issue', pl: 'issues' },
	}),
	// `[poss-determiner]` issues
	// issues of `[poss-users]` [or `[poss-users+-disjunction]`]
	possSemantic: issuesOpenedSemantic,
})

// |Github issues (I opened)
issue.headMayPoss.addRule({ rhs: [ issue.headNoun ] })
issue.headMayPoss.addRule({ rhs: [ github.term, issue.headNoun ] })


// OPEN:
issue.addVerbRuleSet({
	verbTerm: g.newTermSequence({
		symbolName: g.hyphenate(issue.nameSg, 'open'),
		type: g.termTypes.VERB,
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
	//   Stop: (issues) `[nom-users+-disjunction]` open(s)
	//   Stop: (issues) `[nom-users+-disjunction]` do/does not open
	//   Stop: (people who) open `[issues+]`
	//   Stop: (people who) do not open `[issues+]`
	onlyPastTense: true,
	// Prevent present perfect negative rules, which otherwise incorrectly suggest different users can open existing issues in the future:
	//   Stop: (issues) `[nom-users+-disjunction]` have/has not opened
	//   Stop: (people who) have not opened `[issues+]`
	noPresentPerfectNegative: true,
	// Verb rules for `issues-opened()`:
	//   (issues) opened by `[obj-users+-disjunction]`
	//   (issues) `[nom-users+-disjunction]` opened
	//   (issues) `[nom-users+-disjunction]` have/has opened
	//   (issues) `[nom-users+-disjunction]` did not open
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
	// Verb rules for `issues-mentioned()`:
	//   (issues that) mention/mentioned `[obj-users+]`
	//   (issues that) have mentioned `[obj-users+]`
	//   (issues that) do not mention `[obj-users+]`
	//   (issues that) have not mentioned `[obj-users+]`
	objectSym: user.objUsersPlus,
	catVerbSemantic: issuesMentionedSemantic,
})

issue.addIndirectObjectVerbRuleSet({
	verbTerm: verbs.mention,
	prepTerm: preps.in,
	// Verb rules for `issues-mentioned()`:
	//   (issues) `[nom-users+]` `[be]` mentioned in
	//   (issues) `[nom-users+]` `[be]` not mentioned in
	catVerbSemantic: issuesMentionedSemantic,
	// Verb rules for `mentioners()`:
	//   (people mentioned in) `[issues]`/`[pull-requests]` (and/or `[issues]`/`[pull-requests]`)
	//   (people not mentioned in) `[issues]`/`[pull-requests]` (and/or `[issues]`/`[pull-requests]`)
	agentSetSym: github.mentioners,
})


// ASSIGNED-TO:
var issuesAssignedSemantic = g.newSemantic({
	name: g.hyphenate(issue.namePl, 'assigned'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
})
// (issues) assigned to me
issue.inner.addRule({
	rhs: [ verbs.assignedTo, user.objUsersPlus ],
	semantic: issuesAssignedSemantic,
})

issue.addIndirectObjectVerbRuleSet({
	verbTerm: verbs.assign,
	prepTerm: preps.to,
	// Verb rules for `issues-assigned()`:
	//   (issues) `[nom-users+]` `[be]` assigned to
	//   (issues) `[nom-users+]` `[be]` not assigned to
	catVerbSemantic: issuesAssignedSemantic,
	// Verb rules for `assigners()`:
	//   (people assigned to) `[issues]`/`[pull-requests]` (and/or `[issues]`/`[pull-requests]`)
	//   (people not assigned to) `[issues]`/`[pull-requests]` (and/or `[issues]`/`[pull-requests]`)
	agentSetSym: github.assigners,
})


// OPEN/CLOSED:
// open/closed (issues); (issues that are) open/closed
issue.adjective.addRule({
	rhs: [ github.state ],
	semantic: g.newSemantic({
		name: g.hyphenate(issue.namePl, 'state'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
		forbidsMultipleIntersection: true,
	}),
})

// NUM COMMENTS:
issue.addCountRuleSet({
	itemNoun: nouns.comments,
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