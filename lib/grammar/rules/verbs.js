var g = require('../grammar')


var verbSymNamePrefix = 'verb'

// (repos/pull-requests `[nom-users]`) created
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

// (repos `[nom-users+]`) work(s)/work (on) -> contribute(s)/contributed (to)
exports.work = g.newVerb({
	symbolName: g.hyphenate(verbSymNamePrefix, 'work'),
	insertionCost: 1.5,
	verbFormsTermSet: {
		oneSg: 'work',
		threeSg: 'works',
		pl: 'work',
		past: 'worked',
		presentParticiple: 'working',
	},
})

// (repos `[nom-users+]`) forked
exports.fork = g.newVerb({
	symbolName: g.hyphenate(verbSymNamePrefix, 'fork'),
	insertionCost: 2,
	verbFormsTermSet: {
		oneSg: 'fork',
		threeSg: 'forks',
		pl: 'fork',
		past: 'forked',
		presentParticiple: 'forking',
	},
})

// (repos) pushed (`[date]`)
exports.push = g.newVerb({
	symbolName: g.hyphenate(verbSymNamePrefix, 'push'),
	verbFormsTermSet: {
		oneSg: 'push',
		threeSg: 'pushes',
		pl: 'push',
		past: 'pushed',
		presentParticiple: 'pushing',
	},
})