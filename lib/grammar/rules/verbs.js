var g = require('../grammar')


var verbSymNamePrefix = 'verb'

// (followers `[nom-users-plural-subj]`) share
exports.share = g.newVerb({
	symbolName: g.hyphenate(verbSymNamePrefix, 'share'),
	insertionCost: 2,
	verbFormsTermSet: {
		oneSg: 'share',
		threeSg: 'shares',
		pl: 'share',
		past: 'shared',
		presentParticiple: 'sharing',
	},
})

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

// (repos/pull-requests `[nom-users]`) made -> `[verb-create]`
exports.make = g.newVerb({
	symbolName: g.hyphenate(verbSymNamePrefix, 'make'),
	verbFormsTermSet: {
		oneSg: 'make',
		threeSg: 'makes',
		pl: 'make',
		past: 'made',
		presentParticiple: 'making',
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

// (issues) updated (`[date]`)
exports.update = g.newVerb({
	symbolName: g.hyphenate(verbSymNamePrefix, 'update'),
	insertionCost: 2,
	verbFormsTermSet: {
		oneSg: 'update',
		threeSg: 'updates',
		pl: 'update',
		past: 'updated',
		presentParticiple: 'updating',
	},
})

// (pull-requests/issues that) mention (`[obj-users+]`)
exports.mention = g.newVerb({
	symbolName: g.hyphenate(verbSymNamePrefix, 'mention'),
	insertionCost: 1,
	verbFormsTermSet: {
		oneSg: 'mention',
		threeSg: 'mentions',
		pl: 'mention',
		past: 'mentioned',
		presentParticiple: 'mentioning',
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
// Temporarily include past tense verb form "found", though ambiguous with `[verb-found]`. Will later extend `g.newTermSequence()` to detect ambiguity and exclude the terminal symbol automatically when flattening unary rules. For now, avoid using a present tense verb (created by `g.newVerb()`) in a non-present term sequence to enable proper checks.
exports.find = g.newVerb({
	symbolName: g.hyphenate(verbSymNamePrefix, 'find'),
	verbFormsTermSet: {
		oneSg: 'find',
		threeSg: 'finds',
		pl: 'find',
		past: 'found',
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

// (companies `[nom-users+]`) work(s) (at)
exports.workPresent = g.newVerb({
	symbolName: g.hyphenate(exports.work.name, 'present'),
	// Note: Temporarily restrict insertion cost to match `[verb-work]` until deprecating `splitRegexTerminalSymbols` which requires insertion costs to match for identical terminal symbols.
	insertionCost: 1.5,
	// Exclude past tense verb forms to restrict matches to present tense rules. Otherwise, "worked" yields the following scarcely distinguishable display text (though different semantics):
	//  "companies I worked at", `ever-past()`
	//  Stop: "companies I worked->work at" , `present()`
	tense: 'present',
	verbFormsTermSet: {
		oneSg: 'work',
		threeSg: 'works',
		pl: 'work',
		presentParticiple: 'working',
	},
})

// (companies) worked (at by `[obj-users+]`)
exports.workPast = g.newVerb({
	symbolName: g.hyphenate(exports.work.name, 'past'),
	tense: 'past',
	verbFormsTermSet: {
		past: 'worked',
	},
})

// (companies `[nom-users+]`) consult(s) (at) -> `[verb-work-present]` (at)
exports.consultPresent = g.newVerb({
	symbolName: g.hyphenate(verbSymNamePrefix, 'consult', 'present'),
	tense: 'present',
	verbFormsTermSet: {
		oneSg: 'consult',
		threeSg: 'consults',
		pl: 'consult',
		presentParticiple: 'consulting',
	},
})

// (companies) consulted (at by `[obj-users+]`) -> `[verb-work-past] (at by `[obj-users+]`)
exports.consultPast = g.newVerb({
	symbolName: g.hyphenate(verbSymNamePrefix, 'consult', 'past'),
	tense: 'past',
	verbFormsTermSet: {
		past: 'consulted',
	},
})