var g = require('../../grammar')
var preps = require('../prepositions')
var count = require('../count')
var date = require('../date')
var user = require('../user/user')


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

// (companies that) raised <int> in funding
company.subjFilter.addRule({
	rhs: [ raised, numFunding ],
	semantic: company.semantic,
})

// (companies with) <int> in funding
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

var companiesFoundedSemantic = g.newSemantic({
	name: g.hyphenate(company.namePl, founded.name),
	cost: 0.5,
	minParams: 1,
	maxParams: 2,
})

// (companies) founded in [year]
company.inner.addRule({
	rhs: [ founded, date.general ],
	semantic: companiesFoundedSemantic,
})


// FOUNDED:
var companiesCreatedSemantic = g.newSemantic({
	name: g.hyphenate(company.namePl, 'created'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
})

// (companies) founded by `[obj-users+]`
company.passive.addRule({ rhs: [ founded, user.byObjUsersPlus ], semantic: companiesCreatedSemantic })
// (companies) `[nom-users+]` founded
company.objFilter.addRule({ rhs: [ user.nomUsersPlus, founded ], semantic: companiesCreatedSemantic })