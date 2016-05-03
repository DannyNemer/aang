var g = require('../../grammar')
var preps = require('../prepositions')


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
		'employers', 'employer',
	],
})

// NUM FUNDING:
company.addCountRuleSet({
	// (`<int>) in/of funding
	itemTerm: g.newSymbol('funding').addRule({
		rhs: [
			preps.medium,
			g.newSymbol('funding', 'term').addWord({ insertionCost: 1.5, accepted: [ 'funding' ] }),
		],
	}),
	verbTerm: g.newVerb({
		symbolName: 'raise',
		insertionCost: 2.5,
		verbFormsTermSet: {
			oneSg: 'raise',
			threeSg: 'raises',
			pl: 'raise',
			past: 'raised',
			presentParticiple: 'raising',
		},
	}),
	// Count rules for `companies-funding-count()`:
	//   (companies) with `<int>` in funding
	//   (companies that) raised `<int>` in funding
	//   (companies that) have raised `<int>` in funding
	//   (companies that) did not raise `<int>` in funding
	//   (companies that) have not raised `<int>` in funding
	catCountSemantic: g.newSemantic({
		name: g.hyphenate(company.namePl, 'funding', 'count'),
		cost: 0.5,
		minParams: 1,
		maxParams: 2,
	}),
})

// NUM EMPLOYEES:
company.addCountRuleSet({
	itemTerm: g.newNoun({
		symbolName: 'employees',
		insertionCost: 2.75,
		acceptedNounTermSets: [ {
			sg: 'employee',
			pl: 'employees',
		} ],
		substitutedNounTermSets: [ {
			sg: 'worker',
			pl: 'workers',
		} ],
	}),
	// Count rules for `companies-employee-count()`:
	//   (companies) with `<int>` employees
	//   (companies that) have `<int>` employees
	//   (companies that) do not have `<int>` employees
	catCountSemantic: g.newSemantic({
		name: g.hyphenate(company.namePl, 'employee', 'count'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
	}),
})

// FOUND:
company.addVerbRuleSet({
	verbTerm: g.newVerbSet({
		symbolName: 'found',
		insertionCost: 0.5,
		acceptedVerbTermSets: [ {
			oneSg: 'found',
			threeSg: 'founds',
			pl: 'found',
			past: 'founded',
			presentParticiple: 'founding',
		} ],
		substitutedVerbTermSets: [ {
			oneSg: 'start',
			threeSg: 'starts',
			pl: 'start',
			past: 'started',
			presentParticiple: 'starting',
		}, {
			oneSg: 'create',
			threeSg: 'creates',
			pl: 'create',
			past: 'created',
			presentParticiple: 'creating',
		}, {
			oneSg: 'find',
			threeSg: 'finds',
			pl: 'find',
			// Exclude past-tense inflection "found".
			presentParticiple: 'finding',
		} ],
	}),
	// Prevent present tense descriptions of company founding, an action-relationship only represented as a past event:
	//   Stop: (companies) `[nom-users+]` fork
	//   Stop: (companies) `[nom-users+]` do/does not fork
	//   Stop: (people who) fork `[repositories+]`
	//   Stop: (people who) do not fork `[repositories+]`
	onlyPastTense: true,
	// Prevent present-perfect-negative rules, which otherwise incorrectly suggest different people can found existing companies in the future:
	//   Stop: (companies) `[nom-users+]` have/has not founded
	//   Stop: (people who) have not founded `[companies+]`
	noPresentPerfectNegative: true,
	// Verb rules for `companies-founded()`:
	//   (companies) founded by `[obj-users+]`
	//   (companies) `[nom-users+]` founded
	//   (companies) `[nom-users+]` have/has founded
	//   (companies) `[nom-users+]` did not found
	catVerbSemantic: g.newSemantic({
		name: g.hyphenate(company.namePl, 'founded'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
	}),
	// Verb rules for `company-founders()`:
	//   (people who) founded `[companies+]`
	//   (people who) have founded `[companies+]`
	//   (people who) did not found `[companies+]`
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
	// Date rules for `companies-founded-date()`:
	//   (companies) founded `[date]`
	//   (companies not) founded `[date]`
	catDateSemantic: g.newSemantic({
		name: g.hyphenate(company.namePl, 'founded', 'date'),
		cost: 0.5,
		minParams: 1,
		maxParams: 2,
	}),
})

// BOARD MEMBERS:
company.addAgentNoun({
	agentNounTerm: g.newNoun({
		symbolName: g.hyphenate('board', 'members'),
		insertionCost: 3.5,
		acceptedNounTermSets: [
			{ pl: 'board members' },
			{ pl: 'advisors' },
		],
	}),
	prepTerm: preps.participant,
	// Agent noun rules for `company-board-members()`:
	//   board members of `[companies+]`
	//   `{company}` board members
	agentNounSemantic: g.newSemantic({
		name: g.hyphenate(company.nameSg, 'board', 'members'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
		// (people who follow) board members of `{company}` (and their followers)
		isPeople: true,
	}),
})

// WORK-AT:
company.addTenseVerbRuleSet({
	verbPresentTerm: g.newVerbSet({
		symbolName: g.hyphenate('work', 'present'),
		insertionCost: 1.5,
		acceptedVerbTermSets: [ {
			oneSg: 'work',
			threeSg: 'works',
			pl: 'work',
			presentParticiple: 'working',
		} ],
		substitutedVerbTermSets: [ {
			oneSg: 'consult',
			threeSg: 'consults',
			pl: 'consult',
			presentParticiple: 'consulting',
		} ],
	}),
	verbPastTerm: g.newInvariableTerm({
		symbolName: g.hyphenate('work', 'past'),
		// No insertion cost to prevent multiple similar suggestions, scarcely distinguished by tense (though different semantics). For example:
		//   "companies"
		//   -> "companies I work at", `present()`
		//   -> "companies I worked at", `ever-past()`
		acceptedTerms: [ 'worked' ],
	}),
	prepTerm: preps.benefactive,
	// Verb rules for `companies-worked-at()`:
	//   (companies) worked at by `[obj-users+]`, `ever()`
	//   (companies) `[nom-users+]` work(s) at, `present()`
	catVerbSemantic: g.newSemantic({
		name: g.hyphenate(company.namePl, 'worked', 'at'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
	}),
})