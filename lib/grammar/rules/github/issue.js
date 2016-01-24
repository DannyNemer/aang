const g = require('../../grammar')
const Category = require('../Category')
const github = require('./github')
const poss = require('../user/poss')
const user = require('../user/user')
const auxVerbs = require('../auxVerbs')
const stopWords = require('../stopWords')
const preps = require('../prepositions')
const count = require('../count')
const date = require('../date')


const issue = new Category({ sg: 'issue', pl: 'issues' })

issue.term.addWord({
	insertionCost: 3.5,
	accepted: [ issue.namePl ],
})

// |Github issues (I opened)
issue.headMayPoss.addRule({ rhs: [ github.termOpt, issue.term ] })


const issuesOpenedSemantic = g.newSemantic({
	name: g.hyphenate(issue.namePl, 'opened'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	forbidsMultiple: true,
})

// my issues; my closed issues
const issuePossDeterminer = g.newSymbol(issue.nameSg, poss.determiner.name).addRule({
	rhs: [ poss.determiner ],
	semantic: issuesOpenedSemantic,
})
issue.noRelativePossessive.addRule({ rhs: [ issuePossDeterminer, issue.possessable ] })
// issues of mine
issue.head.addRule({ rhs: [ issue.headMayPoss, poss.ofPossUsers ], semantic: issuesOpenedSemantic })


// OPEN:
const open = g.newSymbol('open').addVerb({
	insertionCost: 1,
	oneSg: 'open',
	threeSg: 'opens',
	pl: 'open',
	past: 'opened',
}).addVerb({
	// Add synonyms in a separate call so symbols correct to corresponding accepted form.
	oneSg: 'create',
	threeSg: 'creates',
	pl: 'create',
	past: 'created',
})

// (issues) opened by me
issue.passive.addRule({ rhs: [ open, user.byObjUsers ], semantic: issuesOpenedSemantic, tense: 'past' })
// (issues) I <stop> [have-opt] opened
issue.objFilter.addRule({ rhs: [ user.nomUsersPreVerbStopWordHaveOpt, open ], semantic: issuesOpenedSemantic, tense: 'past' })
// (issues) I did not open
const doPastNegationOpenPresent = g.newBinaryRule({ rhs: [ auxVerbs.doPastNegation, open ], personNumber: 'pl' })
issue.objFilter.addRule({ rhs: [ user.nomUsers, doPastNegationOpenPresent ], semantic: g.reduceSemantic(auxVerbs.notSemantic, issuesOpenedSemantic) })

const issuesOpenersSemantic = g.newSemantic({
	name: g.hyphenate(issue.nameSg, 'openers'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	// (repos liked by) people who opened issues that mention me and liked by their followers
	isPeople: true,
})
// (people who) [have-opt] opened [issues+]
user.subjFilter.addRule({
	rhs: [
		g.newBinaryRule({ rhs: [ auxVerbs.haveOpt, open ], tense: 'past' }),
		issue.catPlPlus,
	],
	semantic: issuesOpenersSemantic
})
// (people who) did not open [issues+]
user.subjFilter.addRule({ rhs: [ doPastNegationOpenPresent, issue.catPlPlus ], semantic: g.reduceSemantic(auxVerbs.notSemantic, issuesOpenersSemantic) })

const openers = g.newSymbol('openers').addWord({
	insertionCost: 3,
	accepted: [ 'openers', 'creators' ],
})
// openers of [issues+]
user.head.addRule({
	rhs: [ openers, [ preps.participant, issue.catPlPlus ] ],
	noInsertionIndexes: [ 0 ],
	transpositionCost: 1,
	semantic: issuesOpenersSemantic,
})


// MENTION:
const issuesMentionedSemantic = g.newSemantic({
	name: g.hyphenate(issue.namePl, 'mentioned'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
})
const notIssuesMentionedSemantic = g.reduceSemantic(auxVerbs.notSemantic, issuesMentionedSemantic)
// (issues that) mention me
issue.subjFilter.addRule({ rhs: [ github.mention, user.objUsersPlus ], semantic: issuesMentionedSemantic })
// (issues that) do not mention me
issue.subjFilter.addRule({ rhs: [ github.doPresentNegationMention, user.objUsersPlus ], semantic: notIssuesMentionedSemantic })
// (issues) I-am/{user}-is/[users]-are mentioned in
issue.objFilter.addRule({ rhs: [ user.nomUsersPlusPreVerbStopWord, github.beGeneralMentionedIn ], semantic: issuesMentionedSemantic })
// (issues) I-am/{user}-is/[users]-are not mentioned in
issue.objFilter.addRule({ rhs: [ user.nomUsersPlusPreVerbStopWord, github.beGeneralNegationMentionedIn ], semantic: notIssuesMentionedSemantic })
// (people mentioned in) [issues]/[pull-requests] (and/or) [issues]/[pull-requests]
github.mentioners.addRule({ rhs: [ issue.catPl ] })


// ASSIGNED-TO:
const issuesAssignedSemantic = g.newSemantic({
	name: g.hyphenate(issue.namePl, 'assigned'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
})
const notIssuesAssignedSemantic = g.reduceSemantic(auxVerbs.notSemantic, issuesAssignedSemantic)
// (issues) assigned to me
issue.inner.addRule({ rhs: [ github.assignedTo, user.objUsersPlus ], semantic: issuesAssignedSemantic })
// (issues) I-am/{user}-is/[users]-are assigned to
issue.objFilter.addRule({ rhs: [ user.nomUsersPlusPreVerbStopWord, github.beGeneralAssignedTo ], semantic: issuesAssignedSemantic })
// (issues) I-am/{user}-is/[users]-are not assigned to
issue.objFilter.addRule({ rhs: [ user.nomUsersPlusPreVerbStopWord, github.beGeneralNegationAssignedTo ], semantic: notIssuesAssignedSemantic })
// (people assigned to) [issues]/[pull-requests] (and/or) [issues]/[pull-requests]
github.assigners.addRule({ rhs: [ issue.catPl ] })


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


// WITH N COMMENTS:
// (issues) with <int> comment
issue.inner.addRule({ rhs: [ preps.possessed, github.commentCount ], semantic: issue.semantic })


// DATE:
const updated = g.newSymbol('updated').addWord({
	insertionCost: 2,
	accepted: [ 'updated' ],
})

// (issues) updated in [year]
issue.inner.addRule({ rhs: [ updated, date.general ], semantic: issue.semantic })