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