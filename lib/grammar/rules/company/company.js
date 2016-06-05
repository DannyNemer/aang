var g = require('../../grammar')
var location = require('../location')
var preps = require('../prepositions')
var verbs = require('../verbs')
var terms = require('../terms')
var nouns = require('../nouns')


var company = g.newCategory({
	sg: 'company',
	pl: 'companies',
	headTerm: g.newTermSequence({
		symbolName: g.hyphenate('companies', 'term'),
		insertionCost: 3,
		acceptedTerms: [ 'companies' ],
		substitutedTerms: [
			'company',
			'startups', 'startup',
			'employers', 'employer',
		],
	}),
	entities: [
		'Apple',
		'Stripe',
		'Slack',
	],
})

company.head.addRule({ rhs: [ company.term ] })

// NUM FUNDING:
company.addCountRuleSet({
	// (`<int>) in|of funding
	itemTerm: g.newTermSequence({
		symbolName: 'funding',
		acceptedTerms: [
			[ preps.medium, terms.funding ],
		],
	}),
	verbTerm: verbs.raise,
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
	verbTerm: g.newTermSequence({
		symbolName: g.hyphenate(company.nameSg, 'found'),
		isVerb: true,
		acceptedTerms: [
			// Note: The insertion cost for `[verb-found]` is not used because the substitution `[verb-create]` has a cheaper insertion cost. Though, the display text for `[verb-found]` is still used for insertions because it is the first item in `acceptedTerms`.
			verbs.found,
		],
		substitutedTerms: [
			verbs.start,
			verbs.create,
			// Temporarily include past tense verb form "found", though ambiguous with `[verb-found]`. Will later extend `g.newTermSequence()` to detect the ambiguity and exclude the terminal symbol automatically when flattening unary rules. For now, avoid using a present tense verb (created by `g.newVerb()`) in a non-present term sequence, to enable proper checks.
			verbs.find,
		],
	}),
	// Prevent present tense descriptions of company founding, an action-relationship only represented as a past event:
	//   Stop: (companies) `[nom-users+]` found(s)
	//   Stop: (companies) `[nom-users+]` do/does not found
	//   Stop: (people who) found `[companies+]`
	//   Stop: (people who) do not found `[companies+]`
	onlyPastTense: true,
	// Prevent present perfect negative rules, which otherwise incorrectly suggest different people can found existing companies in the future:
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
		agentNounTerm: nouns.founders,
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

// INVEST-IN:
company.addVerbRuleSet({
	verbTerm: g.newTermSequence({
		symbolName: g.hyphenate('invest', 'in'),
		isVerb: true,
		acceptedTerms: [
			[ verbs.invest, preps.in ],
			verbs.fund,
		],
		substitutedTerms: [
			verbs.finance,
		],
	}),
	// Prevent present tense descriptions of company investing, an action-relationship only represented as a past event:
	//   Stop: (companies) `[nom-users+]` invest(s) in
	//   Stop: (companies) `[nom-users+]` do/does not invest in
	//   Stop: (people who) invest in `[companies+]`
	//   Stop: (people who) do not invest in `[companies+]`
	onlyPastTense: true,
	// Verb rules for `companies-invested()`:
	//   (companies) invested in by `[obj-users+]`
	//   (companies) `[nom-users+]` invested in
	//   (companies) `[nom-users+]` have/has invested in
	//   (companies) `[nom-users+]` did not invest in
	//   (companies) `[nom-users+]` have/has not invested in
	catVerbSemantic: g.newSemantic({
		name: g.hyphenate(company.namePl, 'invested'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
	}),
	// Verb rules for `company-investors()`:
	//   (people who) invested in `[companies+]`
	//   (people who) have invested in `[companies+]`
	//   (people who) did not invest in `[companies+]`
	//   (people who) have not invested in `[repositories+]`
	userVerbSemantic: g.newSemantic({
		name: g.hyphenate(company.nameSg, 'investors'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
		// (people who follow) people who invested to `[companies+]` (and their followers)
		isPeople: true,
	}),
	// Agent noun rules for `company-investors()`:
	//   investors in `[companies+]`
	//   `{company}` investors
	agentNoun: {
		agentNounTerm: nouns.investors,
		prepTerm: preps.investor,
	},
})

// BOARD MEMBERS:
company.addAgentNoun({
	agentNounTerm: nouns.boardMembers,
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
	/**
	 * Separate verb sets by tense to restrict matches to the input tense. Otherwise, `pfsearch` conjugates the matched verb to both present and past tense, which are semantically distinguishable. For example, "worked" yields the following scarcely distinguishable display text (though different semantics):
	 *   "companies I worked at", `ever-past()`
	 *   Stop: "companies I worked->work at" , `present()`
	 */
	verbPresentTerm: g.newTermSequence({
		symbolName: g.hyphenate(company.nameSg, 'work', 'at', 'present'),
		isVerb: true,
		verbTense: 'present',
		acceptedTerms: [
			[
				// Even though this term sequence is nested entirely within the `acceptedTerms` set of another term sequence, `calcHeuristicCosts` will properly substitute the display text of `[verb-consult-present]`->`[verb-work-present]` when traversing its parse node.
				g.newTermSequence({
					symbolName: g.hyphenate(company.nameSg, 'work', 'present'),
					isVerb: true,
					verbTense: 'present',
					acceptedTerms: [
						verbs.workPresent,
					],
					substitutedTerms: [
						verbs.consultPresent,
					],
				}),
				/**
				 * Position `[prep-benefactive]` outside the term sequence `[company-work-present]` to separate the substitution text values. For example, this enables the following substitution:
				 *   "companies I consult for" -> "... work for"
				 * Otherwise, when substituting `[verb-consult-present]`, the grammar would use the `defaultText` value of `[prep-benefactive]`. For example, this would undesirably enable the following substitution:
				 *   Stop: "companies I consult for" -> "... work at"
				 */
				preps.benefactive,
			],
		],
	}),
	verbPastTerm: g.newTermSequence({
		symbolName: g.hyphenate(company.nameSg, 'work', 'at', 'past'),
		isVerb: true,
		verbTense: 'past',
		acceptedTerms: [
			[
				g.newTermSequence({
					symbolName: g.hyphenate(company.nameSg, 'work', 'past'),
					isVerb: true,
					verbTense: 'past',
					acceptedTerms: [
						/**
						 * No insertion cost for `[verb-work-past]` to prevent multiple similar suggestions, with display text scarcely distinguished by tense (though different semantics). For example:
						 *   "companies"
						 *   Stop: -> "companies I work at", `present()`
						 *   Stop: -> "companies I worked at", `ever-past()`
						 */
						verbs.workPast,
					],
					substitutedTerms: [
						verbs.consultPast,
					],
				}),
				preps.benefactive,
			],
		],
	}),
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

// (companies) in `{city}`|`{region}`|`{country}`
company.inner.addRule({
	rhs: [ preps.container, location ],
	semantic: g.newSemantic({
		name: g.hyphenate(company.namePl, 'in'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
		// Companies can only exist in one location, hence an intersection yields an empty set.
		// forbidsMultiple: true,
	})
})