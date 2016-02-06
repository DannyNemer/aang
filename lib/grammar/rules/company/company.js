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

var raised = g.newSymbol('raised').addWord({
	insertionCost: 2.5,
	accepted: [ 'raised' ],
})

// (companies that) raised <int> in funding
company.subjFilter.addRule({
	rhs: [ raised, count.create(funding) ],
	semantic: company.semantic,
})