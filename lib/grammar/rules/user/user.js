var util = require('../../../../util/util')
var g = require('../../grammar')


var user = g.newCategory({
	nameSg: 'user',
	namePl: 'users',
	isPerson: true,
	headNoun: g.newTermSequence({
		symbolName: g.hyphenate('user', 'head', 'noun'),
		type: g.termTypes.NOUN,
		acceptedTerms: [
			g.newCountNoun({
				insertionCost: 2.5,
				nounFormsSet: { sg: 'person', pl: 'people' },
			}),
			g.newCountNoun({
				nounFormsSet: { sg: 'user', pl: 'users' },
			}),
		],
	}),
	entities: [
		'Danny',
		'Aang',
		'John',
		// Test ambiguity with entities. E.g., "people who follow John".
		'John von Neumann',
		// Test scoring multi-token entity matches. E.g., "John Neumann" matches "John von Neumann" with a higher score (i.e., cheaper cost) than "John" and "Neumann".
		'Neumann',
		// Test deletables in entity names.
		'John not Neumann',
		// Test ambiguity with overlapping entity matches. E.g., "people who follow George Bush" -> "people who follow George <Bush and Jeb> Bush".
		'George Bush',
		'Jeb Bush',
		// Test duplicate entity tokens within the same entity.
		'Marc Marc',
		// Test rejection of incorrect count of token matches. E.g., "Max Max" is accepted and "Max Max Max" is rejected though the same number of tokens.
		'Max Planck Max',
		'Richard Feynman',
		'Elizabeth Cady Stanton',
		// Test ambiguity where multi-token names for the same entity contain an identical token. A match to only that token matches both names, which both map to the same entity (id and display text). E.g., "people who follow Alan".
		{ display: 'Alan Kay', names: [ 'Alan Kay', 'Alan Curtis' ] },
		// Test ambiguity where a multi-token name contains a token that is also a single-token name for the same entity. A match to only that token matches both names, which both map to the same entity (id and display text). E.g., "people who follow Iroh".
		{ display: 'Iroh', names: [ 'Iroh', 'General Iroh', 'Uncle Iroh' ] },
		'Marvin Minsky',
		'John McCarthy',
	],
})


// GitHub users (I follow)
user.service = g.newSymbol(user.namePl, 'service')
user.head.addRule({ rhs: [ user.service, user.headNoun ] })


// `{user:'s}` (repositories); (followers of) `{user:'s}`
// This is a temporary solution.
user.sgPossessive = g.newSymbol(user.nameSg + ':\'s').addRule({
	isTerminal: true,
	rhs: g.newEntityCategory({
		name: user.nameSg + ':\'s',
		entities: [ 'Danny\'s', 'Aang\'s', 'John von Neumann\'s', 'John\'s' ],
		isPerson: true,
	}),
	isPlaceholder: true,
})


// Export `user` `Category`, which includes the above rules saved to the category.
module.exports = user

// Extend `user` with `nominative`, `objective`, `possessive` symbols.
Object.assign(user, require('./nominative'))
Object.assign(user, require('./objective'))
Object.assign(user, require('./possessive'))

// Load `user`-specific rules.
require('./userTense')
require('./followers')
require('./gender')