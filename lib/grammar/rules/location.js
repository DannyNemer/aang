var g = require('../grammar')


var city = g.newSymbol('city').addRule({
	isTerminal: true,
	isPlaceholder: true,
	rhs: g.newEntityCategory({
		name: 'city',
		entities: [
			{
				display: 'Shanghai, China',
				names: [ 'Shanghai China' ],
			}, {
				display: 'Karachi, Pakistan',
				names: [ 'Karachi Pakistan' ],
			}, {
				display: 'Beijing, China',
				names: [ 'Beijing China' ],
			}, {
				display: 'Lagos, Nigeria',
				names: [ 'Lagos Nigeria' ],
			},
		],
	}),
})

// (companies in) `{city}`
var location = g.newSymbol('location').addRule({
	rhs: [ city ],
})

module.exports = location