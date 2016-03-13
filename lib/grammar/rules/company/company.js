var g = require('../../grammar')
var preps = require('../prepositions')
var count = require('../count')
var date = require('../date')
var user = require('../user/user')
var preps = require('../prepositions')


var company = g.newCategory({
	sg: 'company',
	pl: 'companies',
	entities: [
		'Apple',
		'Stripe',
		'Slack',
	],
})

company.head.addWord({
	insertionCost: 3,
	accepted: [ company.namePl ],
})


// NUM FUNDING:
var funding = g.newSymbol('funding').addRule({
	rhs: [
		preps.medium,
		g.newSymbol('funding', 'term').addWord({ insertionCost: 1.5, accepted: [ 'funding' ] }),
	],
})

var numFunding = count.create(funding)

var raised = g.newSymbol('raised').addWord({
	insertionCost: 2.5,
	accepted: [ 'raised' ],
})

// (companies that) raised `<int>` in funding
company.subjFilter.addRule({
	rhs: [ raised, numFunding ],
	semantic: company.semantic,
})

// (companies with) `<int>` in funding
company.inner.addRule({
	rhs: [ preps.possessed, numFunding ],
	semantic: company.semantic,
})


// NUM EMPLOYEES:
var employees = g.newSymbol('employees').addWord({
	insertionCost: 2.75,
	accepted: [ 'employees' ],
	substitutions: [ 'employee', 'workers', 'worker' ],
})

// (companies) with <int> employyes
company.inner.addRule({
	rhs: [ preps.possessed, count.create(employees) ],
	semantic: company.semantic,
})


// DATE FOUNDED:
var founded = g.newSymbol('founded').addWord({
	insertionCost: 2.25,
	accepted: [ 'founded' ],
	substitutions: [ 'started', 'created' ],
})

var companiesStartedSemantic = g.newSemantic({
	name: g.hyphenate(company.namePl, 'started'),
	cost: 0.5,
	minParams: 1,
	maxParams: 2,
})

// (companies) founded in `[year]`
company.inner.addRule({
	rhs: [ founded, date.general ],
	semantic: companiesStartedSemantic,
})


// FOUNDED:
var companiesFoundedSemantic = g.newSemantic({
	name: g.hyphenate(company.namePl, founded.name),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
})

// FIXME: The following two rules slow all queries (for all categories) by increasing the number of reductions. Unsure how use of `user` yields more reductions for other categories because they are certain to fail.
// (companies) founded by `[obj-users+]`
company.passive.addRule({ rhs: [ founded, user.byObjUsersPlus ], semantic: companiesFoundedSemantic })
// (companies) `[nom-users+]` founded
company.objFilter.addRule({ rhs: [ user.nomUsersPlus, founded ], semantic: companiesFoundedSemantic })

var companyFoundersSemantic = g.newSemantic({
	name: g.hyphenate(company.nameSg, 'founders'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	// (people who follow) founders of `{company}` and their followers
	isPeople: true,
})
// (people who) founded `[companies+]`
user.subjFilter.addRule({
	rhs: [ founded, company.plPlus ],
	semantic: companyFoundersSemantic,
})

// founders of `[companies+]`
// `{company}` founders
user.addAgentNoun({
	agentNounTerm: g.newSymbol('founders').addWord({
		insertionCost: 2.5,
		accepted: [ 'founders' ],
		substitutions: [ 'starters', 'creators' ],
	}),
	prepTerm: preps.participant,
	category: company,
	actionSemantic: companyFoundersSemantic,
})


// BOARD MEMBERS:
var boardMembers = g.newSymbol('board', 'members').addWord({
	insertionCost: 3.5,
	accepted: [ 'board members', 'advisors' ],
})

var companyBoardMembersSemantic = g.newSemantic({
	name: g.hyphenate(company.nameSg, boardMembers.name),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
	// (people who follow) board members of `{company}` and their followers
	isPeople: true,
})

// board members of `[companies+]`
// FIXME: Temporary, duplicate binary rule identical to a rule that `user.addAgentNoun()` creates above.
var ofCompanyPlusTemp = g.newSymbol(preps.participant.name, company.plPlus.name, 'temp').addRule({
	rhs: [ preps.participant, company.plPlus ],
})
user.head.addRule({
	rhs: [ boardMembers, ofCompanyPlusTemp ],
	noInsertionIndexes: [ 0 ],
	transpositionCost: 1,
	semantic: companyBoardMembersSemantic,
})
// `{company}` board members
user.head.addRule({ rhs: [ company.sg, boardMembers ], semantic: companyBoardMembersSemantic })