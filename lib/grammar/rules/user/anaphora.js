var g = require('../../grammar')


/**
 * The anaphoric terms which refer to an antecedent semantic of the same grammatical person-number.
 * Use in conjugation with the nonterminal rule property, `personNumber`, which instructs `pfsearch` to copy the matching antecedent's semantic.
 */

// (repos `{user}` likes that) he|she (contributed to)
// (`{user:'s}` followers followed by) him|her
exports.threeSg = g.newSymbol('3', 'sg').addPronoun({
	nom: 'he',
	obj: 'him',
}).addPronoun({
	nom: 'she',
	obj: 'her',
})

// (people who follow `{user}` and like) his|her (repos)
exports.threeSgPossDet = g.newTermSequence({
	symbolName: g.hyphenate(exports.threeSg.name, 'poss', 'det'),
	acceptedTerms: [ 'his', 'her' ],
})

// (people who follow `{user}` and followers of) his|hers
exports.threeSgPossPronoun = g.newTermSequence({
	symbolName: g.hyphenate(exports.threeSg.name, 'poss', 'pronoun'),
	acceptedTerms: [ 'his', 'hers' ],
})


// (repos my followers like that) they (contributed to)
// (my followers' followers who follow) them; (my followers' repos liked by) them
exports.threePl = g.newPronoun({
	symbolName: g.hyphenate(3, 'pl'),
	pronounFormsTermSet: {
		nom: 'they',
		obj: 'them',
	},
})

// (people who follow my followers and like) their (repos)
exports.threePlPossDet = g.newTermSequence({
	symbolName: g.hyphenate(exports.threePl.name, 'poss', 'det'),
	acceptedTerms: [ 'their' ],
})

// (people who follow my followers and followers of) theirs
exports.threePlPossPronoun = g.newTermSequence({
	symbolName: g.hyphenate(exports.threePl.name, 'poss', 'pronoun'),
	acceptedTerms: [ 'theirs' ],
})