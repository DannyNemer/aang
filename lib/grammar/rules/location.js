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
			}, {
				display: 'Detroit, Michigan',
				// The token "Detroit" creates two instances of the same entity because `Parser` much check the different entity token sets to ensure correct multi-token matches.
				names: [ 'Detroit Michigan', 'Detroit MI' ],
			}, {
				display: 'San Fransisco, California',
				names: [ 'San Fransisco California', 'San Fransisco CA' ],
			}, {
				display: 'Cupertino, California',
				names: [ 'Cupertino California', 'Cupertino CA' ],
			},
		],
	}),
})

var region = g.newSymbol('region').addRule({
	isTerminal: true,
	isPlaceholder: true,
	rhs: g.newEntityCategory({
		name: 'region',
		entities: [
			{
				display: 'California',
				names: [ 'California', 'CA' ],
			}, {
				display: 'Missouri',
				names: [ 'Missouri', 'MO' ],
			}
		],
	}),
})

// (companies in) `{city}`|`{region}`
var location = g.newSymbol('location').addRule({
	rhs: [ city ],
}).addRule({
	rhs: [ region ],
})

module.exports = location