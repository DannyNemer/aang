var g = require('../../grammar')
var preps = require('../prepositions')
var count = require('../count')


var company = g.newCategory({
	sg: 'company',
	pl: 'companies',
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

// (companies that) raised <int> in funding
var raised = g.newSymbol('raised').addWord({
	insertionCost: 2.5,
	accepted: [ 'raised' ],
})
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