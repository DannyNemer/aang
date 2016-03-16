var g = require('../../grammar')
var preps = require('../prepositions')
var count = require('../count')
var date = require('../date')
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
})


// NUM FUNDING:
var funding = g.newSymbol('funding').addRule({
	rhs: [
		preps.medium,
		g.newSymbol('funding', 'term').addWord({ insertionCost: 1.5, accepted: [ 'funding' ] }),
	],
})

var numFunding = count.create(funding)

var raised = g.newSymbol('raised').addWord({
	insertionCost: 2.5,
	accepted: [ 'raised' ],
})

// (companies that) raised `<int>` in funding
company.subjFilter.addRule({
	rhs: [ raised, numFunding ],
	semantic: company.semantic,
})

// (companies with) `<int>` in funding
company.inner.addRule({
	rhs: [ preps.possessed, numFunding ],
	semantic: company.semantic,
})


// NUM EMPLOYEES:
var employees = g.newSymbol('employees').addWord({
	insertionCost: 2.75,
	accepted: [ 'employees' ],
	substitutions: [ 'employee', 'workers', 'worker' ],
})

// (companies) with <int> employyes
company.inner.addRule({
	rhs: [ preps.possessed, count.create(employees) ],
	semantic: company.semantic,
})

// FOUNDED:
var found = g.newSymbol('found').addVerb({
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
})

company.addVerbRuleSet({
	verbTerm: found,
	onlyPastTense: true,
	// Verb rules for `companies-founded()`:
	//   (companies) founded by me/`{user}`/people-who...
	//   (companies) I/`{user}`/people-who... founded
	//   (companies) I/`{user}`/people-who... have/has founded
	//   (companies) I/`{user}`/people-who... did not found
	//   (companies) I/`{user}`/people-who... have/has not founded - NOTE: Perhaps prevent this query.
	verbSemantic: g.newSemantic({
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
	agentNounSemantic: g.newSemantic({
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
})

// DATE FOUNDED:
// (companies) founded in `[year]`
company.addDateVerb({
	verbTerm: found,
	dateVerbSemantic: g.newSemantic({
		name: g.hyphenate(company.namePl, 'started'),
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
	agentNounSemantic: g.newSemantic({
		name: g.hyphenate(company.nameSg, 'board', 'members'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
		// (people who follow) board members of `{company}` and their followers
		isPeople: true,
	}),
})