var g = require('../../grammar')


var company = g.newCategory({
	sg: 'company',
	pl: 'companies',
})

company.head.addWord({
	insertionCost: 3,
	accepted: [ company.namePl ],
})