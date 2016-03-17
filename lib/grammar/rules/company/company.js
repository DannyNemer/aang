var g = require('../../grammar')
var preps = require('../prepositions')
var count = require('../count')
var user = require('../user/user')


var company = g.newCategory({
	sg: 'company',
	pl: 'companies',
	entities: [
		'Apple',
		'Stripe',
		'Slack',
	],
})

company.head.addWord({
	insertionCost: 3,
	accepted: [ company.namePl ],
	substitutions: [
		company.nameSg,
		'startups', 'startup',
	],
})

// NUM FUNDING:
// (companies) with `<int>` in funding
// (companies that) raised `<int>` in funding
// (companies that) have raised `<int>` in funding
// (companies that) did not raise `<int>` in funding
// (companies that) have not raised `<int>` in funding
company.addCountRuleSet({
	// (`<int>) in/of funding
	itemTerm: g.newSymbol('funding').addRule({
		rhs: [
			preps.medium,
			g.newSymbol('funding', 'term').addWord({ insertionCost: 1.5, accepted: [ 'funding' ] }),
		],
	}),
	verbTerm: g.newSymbol('raise').addVerb({
		insertionCost: 2.5,
		oneSg: 'raise',
		threeSg: 'raises',
		pl: 'raise',
		past: 'raised',
		presentParticiple: 'raising',
	}),
	catCountSemantic: g.newSemantic({
		name: g.hyphenate(company.namePl, 'funding', 'count'),
		cost: 0.5,
		minParams: 1,
		maxParams: 2,
	}),
})

// NUM EMPLOYEES:
// (companies) with `<int>` employees
// (companies) that have `<int>` employees
// (companies) do not have `<int>` employees
company.addCountRuleSet({
	itemTerm: g.newSymbol('employees').addWord({
		insertionCost: 2.75,
		accepted: [ 'employees' ],
		substitutions: [ 'employee', 'workers', 'worker' ],
	}),
	catCountSemantic: g.newSemantic({
		name: g.hyphenate(company.namePl, 'employees', 'count'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
	}),
})

// FOUNDED:
company.addVerbRuleSet({
	verbTerm: g.newSymbol('found').addVerb({
		insertionCost: 2.25,
		oneSg: 'found',
		threeSg: 'founds',
		pl: 'found',
		past: 'founded',
		presentParticiple: 'founding',
		substitutions: [
			'start', 'starts', 'started', 'starting',
			'create', 'creates', 'created', 'creating',
		],
	}),
	onlyPastTense: true,
	// Verb rules for `companies-founded()`:
	//   (companies) founded by me/`{user}`/people-who...
	//   (companies) I/`{user}`/people-who... founded
	//   (companies) I/`{user}`/people-who... have/has founded
	//   (companies) I/`{user}`/people-who... did not found
	//   (companies) I/`{user}`/people-who... have/has not founded - NOTE: Perhaps prevent this query.
	catVerbSemantic: g.newSemantic({
		name: g.hyphenate(company.namePl, 'founded'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
	}),
	// Verb rules for `company-founders()`:
	//   (people who) founded `[companies+]`
	//   (people who) have founded `[companies+]` - NOTE: Perhaps prevent this query.
	//   (people who) did not found `[companies+]`
	//   (people who) have not founded `[companies+]` - NOTE: Perhaps prevent this query.
	userVerbSemantic: g.newSemantic({
		name: g.hyphenate(company.nameSg, 'founders'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
		// (people who follow) people who founded `[companies+]` (and their followers)
		isPeople: true,
	}),
	// Agent noun rules for `company-founders()`:
	//   founders of `[companies+]`
	//   `{company}` founders
	agentNoun: {
		agentNounTerm: g.newSymbol('founders').addWord({
			insertionCost: 2.5,
			accepted: [ 'founders' ],
			substitutions: [ 'starters', 'creators' ],
		}),
		prepTerm: preps.participant,
	},
	// Date rules for `companies-started()`
	//   (companies) founded `[date]`
	catDateSemantic: g.newSemantic({
		name: g.hyphenate(company.namePl, 'founded', 'date'),
		cost: 0.5,
		minParams: 1,
		maxParams: 2,
	}),
})

// BOARD MEMBERS:
// board members of `[companies+]`
// `{company}` board members
company.addAgentNoun({
	agentNounTerm: g.newSymbol('board', 'members').addWord({
		insertionCost: 3.5,
		accepted: [ 'board members', 'advisors' ],
	}),
	prepTerm: preps.participant,
	userVerbSemantic: g.newSemantic({
		name: g.hyphenate(company.nameSg, 'board', 'members'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
		// (people who follow) board members of `{company}` (and their followers)
		isPeople: true,
	}),
})