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

// (repos `[nom-users+]`) work(s)/work (on) -> `[verb-contribute]` (to)
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

// (companies `[nom-users+]`) founded
exports.found = g.newVerb({
	symbolName: g.hyphenate(verbSymNamePrefix, 'found'),
	insertionCost: 2.25,
	verbFormsTermSet: {
		oneSg: 'found',
		threeSg: 'founds',
		pl: 'found',
		past: 'founded',
		presentParticiple: 'founding',
	},
})

// (companies `[nom-users+]`) started -> `[verb-found]`
exports.start = g.newVerb({
	symbolName: g.hyphenate(verbSymNamePrefix, 'start'),
	verbFormsTermSet: {
		oneSg: 'start',
		threeSg: 'starts',
		pl: 'start',
		past: 'started',
		presentParticiple: 'starting',
	},
})

// (companies `[nom-users+]`) finds -> `[verb-found]`
exports.findPresent = g.newVerb({
	symbolName: g.hyphenate(verbSymNamePrefix, 'find', 'present'),
	// Exclude past tense verb form "found" to avoid ambiguity with `[verb-found]` as a substitution in the term sequence `[company-found]`.
	noPastRules: true,
	verbFormsTermSet: {
		oneSg: 'find',
		threeSg: 'finds',
		pl: 'find',
		presentParticiple: 'finding',
	},
})

// (companies that) raised (`<int>` in funding)
exports.raise = g.newVerb({
	symbolName: g.hyphenate(verbSymNamePrefix, 'raise'),
	insertionCost: 2.5,
	verbFormsTermSet: {
		oneSg: 'raise',
		threeSg: 'raises',
		pl: 'raise',
		past: 'raised',
		presentParticiple: 'raising',
	},
})