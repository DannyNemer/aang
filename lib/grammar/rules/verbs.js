var g = require('../grammar')


var verbSymNamePrefix = 'verb'

// (repos/pull-requests) `[nom-users]` created
exports.create = g.newVerb({
	symbolName: g.hyphenate(verbSymNamePrefix, 'create'),
	insertionCost: 0.5,
	verbFormsTermSet: {
		oneSg: 'create',
		threeSg: 'creates',
		pl: 'create',
		past: 'created',
		presentParticiple: 'creating',
	},
})

// (repos `[nom-users+]`) contribute(s)/contributed (to)
exports.contribute = g.newVerb({
	symbolName: g.hyphenate(verbSymNamePrefix, 'contribute'),
	insertionCost: 0.7,
	verbFormsTermSet: {
		oneSg: 'contribute',
		threeSg: 'contributes',
		pl: 'contribute',
		past: 'contributed',
		presentParticiple: 'contributing',
	},
})