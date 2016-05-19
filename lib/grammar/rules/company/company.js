var g = require('../../grammar')
var preps = require('../prepositions')
var verbs = require('../verbs')
var terms = require('../terms')


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
	//   Stop: (companies) `[nom-users+]` fork
	//   Stop: (companies) `[nom-users+]` do/does not fork
	//   Stop: (people who) fork `[repositories+]`
	//   Stop: (people who) do not fork `[repositories+]`
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
		agentNounTerm: g.newTermSequence({
			symbolName: 'founders',
			insertionCost: 2.5,
			acceptedTerms: [ 'founders' ],
			substitutedTerms: [ 'starters', 'creators' ]
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
				// Even though this term sequence is nested entirely within the `acceptedTerms` set of another term sequence, `calcHeuristicCosts` will properly substitute the display text of `[verb-consult-present]`->`[verb-work-present]` when traversing its parser node.
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