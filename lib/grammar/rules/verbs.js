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