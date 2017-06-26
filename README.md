# aang

Aang is a natural language understanding system.

The documentation below is 1% complete. See over 100,000 words of extensive, excellent, existing documentation throughout the source files in `/lib/`.

# `cli`

#### Usage
`node cli [options]`

#### Description
The command line interface for aang.

Contains the following built-in programs:
- `[query]` - Parses the provided query and outputs the k-best parse trees.

- `.test` - Parses the suite of test queries and checks output conforms to the test's specifications.

- `.benchmark` - Benchmarks the duration of parsing the queries in the test suite.

- `.buildGrammar` - Generates and outputs the grammar containing the grammar rules, semantics, entities, and deletables, for use with the parser.

- `.ambiguityCheck` - Finds and prints instances of ambiguity in the grammar.

- `.stateTable` - Prints the state table generated from the grammar.

- `.archive*` - Saves output of program *. Includes: `.archiveTest`, `.archiveTestSmall`, `.archiveTestQuiet`, `.archiveGrammar`, `.archiveAmbigCheck`, `.archiveStateTable`, `.archiveAll`.

- `.restoreGrammar` - Copies the last output of `.archiveGrammar` to the `.buildGrammar` output path.

- `.diff*` - Compares last archived output of program * to current output of the same program. Includes: `.diffTest`, `.diffTestSmall, `.diffTestQuiet`, `.diffGrammar`, `.diffAmbigCheck`, `.diffStateTable`.

Enables configuration of CLI environment variables which are passed as options when executing the above programs.

Each program is spawn as a child process. This automatically enables any changes to modules outside the CLI, allows the user to kill any process (with `^C`) without exiting the CLI, and improves benchmark result consistency by mitigating the impact of process caches.

#### Options
	-h, --help  Display this screen.                                     [boolean]

# `parse`

## `parse`
	Usage
	  node parse <query> [options]

	Description
	  Parses <query> and outputs the k-best parse trees.

	Options
	  -k                        The maximum number of parse trees to find.                  [default: 7]
	  -q, --quiet               Suppress parse results from output.                            [boolean]
	  -b, --benchmark           Benchmark each test's parse duration.                          [boolean]
	  -c, --costs               Print the parse costs.                                         [boolean]
	  -a, --ambiguity           Print instances of semantic ambiguity.                         [boolean]
	  -t, --trees               Print the parse trees.                                         [boolean]
	  -n, --tree-node-costs     Include in parse trees each node's path cost.                  [boolean]
	  -r, --tree-token-ranges   Include in parse trees each node's token range.                [boolean]
	  -s, --semantics           Print the semantic representation of each parse tree.
	                                                                           [boolean] [default: true]
	  -o, --object-semantics    Print object representations of the semantics.                 [boolean]
	  -p, --parse-stack         Print the parse stack.                                         [boolean]
	  -f, --parse-forest        Print an equational representation of the parse forest.        [boolean]
	  -g, --parse-forest-graph  Print a graph representation of the parse forest.              [boolean]
	  -h, --help                Display this screen.                                           [boolean]

	Examples
	  node parse "people who follow me" -k=5 -t   Finds the 5-best parse trees for the query, and
	                                              includes the parse trees in the parse results.
	  node parse "people I follow" -sfq           Finds the 7-best parse trees for the query, prints the
	                                              parse forest and parse stack, but does not print the
	                                              parse results.
	  node parse "males my followers follow" -bc  Finds the 7-best parse trees for the query, prints the
	                                              duration of the parse, and includes the parse tree
	                                              costs in the parse results.

# `termSequence`

## `verbTermSet`
Methods, which `grammar` inherits, that create `NSymbol` instances that produce terminal rule sets for verbs.

These methods create an `NSymbol` for complete verb form term sets, instead of adding rules to an existing `NSymbol`, and forbid adding rules to the returned `NSymbol` afterward to prevent external changes to the rule sets.

### `VerbFormsTermSet`
The inflections of a verb, from which `verbTermSet.newVerb()` creates a verb terminal rule set (of term sequence type 'verb') and `verbTermSet.newTenseVerb()` creates separate present and past tense verb terminal rule sets (of term sequence types 'verb-present' and 'verb-past', respectively).

Each rule created from the terms in this set has an object as its `text` with the properties `oneSg`, `threeSg`, `pl`, and `past`. When constructing parse trees, `pfsearch` conjugates this `text` object to the correct verb form (i.e., display text) according to grammatical properties in the same tree:
- The person-number forms, `oneSg`, `threeSg`, and `pl`, are conjugated by the grammatical `personNumber` property in preceding nominative rules. The `pl` person-number form is also conjugated by the `grammaticalForm` value 'infinitive' in the (immediate) parent nonterminal rule.
- The tense form, `past`, is conjugated by the `grammaticalForm` property in the (immediate) parent nonterminal rule. Also, if the parent rule has `acceptedTense` defined as 'past', it accepts the `past` form when input, but does not conjugate to it otherwise (unlike `grammaticalForm`).

The grammar generator and `pfsearch` use neither `presentSubjunctive`, `presentParticiple`, nor `pastParticiple` for conjugation. Rather, their parameterization serves only to enforce complete definitions of verbs for complete substitution sets. They are replaced when input by one of the first four forms in the set.

Note: It is better to have a single terminal rule set with dynamic grammatical conjugation than to define separate rule sets with identical terminal symbols but different display text for the different non-nominative grammatical forms. The non-nominative forms (e.g., 'past', 'nom', 'obj') conjugate via the parent rule and therefore can determine inflection at compile time, unlike nominative conjugation which depends on the parse tree. The overhead `Parser` would endure for the additional reductions for the additional terminal rule matches is far greater than the `pfsearch` overhead for the conjugation.

Note: Each verb form becomes a terminal symbol and can not contain whitespace.

#### Properties
- `oneSg` *(string)*: The first-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "am", "was", "like".
- `threeSg` *(string)*: The third-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "is", "was", "likes".
- `pl` *(string)*: The plural verb form, chosen by the nonterminal rule properties `personNumber` and `grammaticalForm`. E.g., "are", "were" "like".
- `past` *(string)*: The simple past tense verb form (or, preterite), chosen by the parent rule property `grammaticalForm` and accepted when input by matching the parent rule property `acceptedTense`. E.g., "was", "liked", "did", "had".
- `[presentSubjunctive]` *(string)*: The present-subjunctive verb form, substituted when input with one of the first four forms. E.g., "be".
- `[presentParticiple]` *(string)*: The present-participle verb form, substituted when input with one of the first four forms. E.g., "being", "liking".
- `[pastParticiple]` *(string)*: The past-participle verb form, substituted when input with one of the first four forms (and substituted with `past` if the parent rule has matching `acceptedTense`). E.g., "been", "done".

### `PresentVerbFormsTermSet`
The present tense inflections of a verb, which `verbTermSet.newTenseVerb()` constructs internally when creating the present tense verb terminal rule set (of term sequence type 'verb-present').

Each rule created from the terms in this set has an object as its `text` with the properties `oneSg`, `threeSg`, and `pl`. When constructing parse trees, `pfsearch` conjugates this `text` object to the correct verb form (i.e., display text) according to the grammatical `personNumber` property in preceding nominative rules in the same tree. The `pl` person-number form is also conjugated by the `grammaticalForm` value 'infinitive' in the (immediate) parent nonterminal rule.

The grammar generator and `pfsearch` use neither `presentSubjunctive` nor `presentParticiple` for conjugation. Rather, their parameterization serves only to enforce complete definitions of verbs for complete substitution sets. They are replaced when input by one of first three forms in the set.

Inherits the present tense properties of `VerbFormsTermSet`.

#### Properties
- `oneSg` *(string)*: The first-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "am", "was", "like".
- `threeSg` *(string)*: The third-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "is", "was", "likes".
- `pl` *(string)*: The plural verb form, chosen by the nonterminal rule properties `personNumber` and `grammaticalForm`. E.g., "are", "were" "like".
- `[presentSubjunctive]` *(string)*: The present-subjunctive verb form, substituted when input with one of the first three forms. E.g., "be".
- `[presentParticiple]` *(string)*: The present-participle verb form, substituted when input with one of the first three forms. E.g., "being", "liking".

### `PastVerbFormsTermSet`
The past tense inflections of a verb, which `verbTermSet.newTenseVerb()` constructs internally when creating the past tense verb terminal rule set (of term sequence type 'verb-past').

Each rule created from the terms in this set is an invariable term with the `past` form as its `text`. `pfsearch` can not conjugate these rules.

The grammar generator and `pfsearch` do not use `pastParticiple` for conjugation. Rather, its parameterization serves only to enforce complete definitions of verbs for complete substitution sets. It is replaced when input by `past`.

Inherits the past tense properties of `VerbFormsTermSet`.

#### Properties
- `past` *(string)*: The simple past tense verb form (or, preterite), accepted when input. E.g., "was", "liked", "did", "had".
- `[pastParticiple]` *(string)*: The past-participle verb form, substituted when input with `past`. E.g., "been", "done".

### `grammar.newVerb(options)`
Creates an `NSymbol` that produces a terminal rule set for a verb with the necessary text forms for conjugation.

Each rule in the set, created from the terms in `options.verbFormsTermSet`, has an object as its `text` with the properties `oneSg`, `threeSg`, `pl`, and `past` for the different verb forms. When constructing parse trees, `pfsearch` conjugates this `text` object to the correct verb form (i.e., display text) according to grammatical properties in the same tree:
- The person-number forms, `oneSg`, `threeSg`, and `pl`, are conjugated by the grammatical `personNumber` property in preceding nominative rules. The `pl` person-number form is also conjugated by the `grammaticalForm` value 'infinitive' in the (immediate) parent nonterminal rule.
- The tense form, `past`, is conjugated by the `grammaticalForm` property in the (immediate) parent nonterminal rule. Also, if the parent rule has `acceptedTense` defined as 'past', it accepts the `past` form when input, but does not conjugate to it otherwise (unlike `grammaticalForm`).

Note: Each verb form in `options.verbFormsTermSet` becomes a terminal symbol and can not contain whitespace.

The returned `NSymbol` has the following properties:
- `name`: `options.symbolName` if defined, else the concatenation of the prefix 'verb-' with the infinitive verb form, `options.verbFormsTermSet.pl`.
- `isTermSequence`: `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
- `isTermSet`: `true`. Specifies every rule is a single-token terminal rule with the same `text` value.
- `termSequenceType`: 'verb'.
defaultText - The conjugative `text` object for the verb forms, used as display text for every (terminal) rule this `NSymbol` produces.
- `insertionCost`: `options.insertionCost`, if defined.

#### Arguments
- `options` *(Object)*: The options object.
- `[options.symbolName]` *(string)*: The name for the new `NSymbol`. If `undefined`, concatenates the prefix 'verb-' with the infinitive verb form, `options.verbFormsTermSet.pl`.
- `[options.insertionCost]` *(number)*: The insertion cost for the terminal rule set, assigned to the first rule in the set (i.e., `verbFormsTermSet.oneSg`). Enables the creation of insertion rules using the new nonterminal symbol that produces this set.
- `[options.noPastDisplayText]` *(boolean)*: Specify excluding the past tense verb form, `options.verbFormsTermSet.past`, from the display `text` object. Instead, substitute the `past` form when input with the verb's correct present tense form. Unlike the present tense set that `verbSet.newTenseVerb()` creates, this option creates terminal rules for the past tense verb forms as substitutions.
- `options.verbFormsTermSet` *(VerbFormsTermSet)*: The verb terminal symbol set with each verb form.

#### Returns
*(NSymbol)*: Returns the new `NSymbol` for the verb terminal rule set.

### `TenseVerbSet`
The object `verbTermSet.newTenseVerb()` returns, with two terminal rule sets from the verb forms in `options.verbFormsTermSet`, split by present and past grammatical tense, and a third nonterminal substitution term sequence that produces both without tense restrictions.

The `verbTermSet.newTenseVerb()` method description delineates the properties of each these `NSymbol` instances.

#### Properties
- `noTense` *(NSymbol)*: The nonterminal term sequence of type 'verb' that produces `present` and `past`, with a substitution conjugative `text` object containing all verb forms in `options.verbFormsTermSet`
- `present` *(NSymbol)*: The terminal rule set of type 'verb-present' that produces the present tense verb forms: `oneSg`, `threeSg`, `pl`, `presentSubjunctive`, and `presentParticiple`.
- `past` *(NSymbol)*: The terminal rule set of type 'verb-past' that produces the past tense verb forms: `past`, `pastParticiple`.

### `grammar.newTenseVerb(options)`
Creates two terminal rule sets from the verb forms in `options.verbFormsTermSet`, split by present and past grammatical tense, and a third nonterminal substitution term sequence that produces both without tense restrictions. Returns the three `NSymbol` instances in an object of the form `TenseVerbSet`.

Each of the two terminal rule sets produces only terminal symbols and display text for the specified tense.
1. `TenseVerbSet.present`: Each rule in the set has a conjugative `text` object with the person-number forms. The person-number forms, `oneSg`, `threeSg`, and `pl`, are conjugated by the grammatical `personNumber` property in preceding nominative rules. The `pl` person-number form is also conjugated by the `grammaticalForm` value 'infinitive' in the (immediate) parent nonterminal rule.
2. `TenseVerbSet.past`: Each rule in the set has an invariable `text` string with the simple past form, `options.verbFormsTermSet.past`. `pfsearch` can not conjugate these rules.

`TenseVerbSet.noTense`: The term sequence that produces the two tense term sets, with a substitution conjugative `text` object on each nonterminal rule with all verb forms in `options.verbFormsTermSet`. Behaves identically to verb terminal rule sets that `verbTermSet.newVerb()` creates.

The terminal rule sets for each grammatical tense are for use with `Category.prototype.addTenseVerbRuleSet()`, where tense is semantically meaningful and input in one tense should never be substituted by forms of the other tense. The term sequence parent set is for use in all other verb sets where tense does not influence semantics.

Note: Each verb form in `options.verbFormsTermSet` becomes a terminal symbol and can not contain whitespace.

Note: Using this separate method to create a terminal rule set for only a verb's forms of a specific tense is superior to extending `verbTermSet.newVerb()` with an `options.tense` definition (for either 'present' or 'past') because the former enforces complete definitions of verbs. If only one tense terminal rule set is needed, the grammar generator deletes the unused set just as it deletes all unused grammar components.

The returned `NSymbol` instances have the following properties:
1. `TenseVerbSet.noTense`
	- `name`: `options.symbolName` if defined, else the concatenation of the prefix 'verb-' with the infinitive verb form, `options.verbFormsTermSet.pl`.
	- `isTermSequence`: `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
	- `termSequenceType`: 'verb'.
	- `defaultText`: The conjugative `text` object for the verb forms for both tenses, identical to that which `verbTermSet.newVerb()` uses.
2. `TenseVerbSet.present`
	- `name`: The concatenation of `TenseVerbSet.noTense.name` with the suffix '-present'.
	- `isTermSequence`: `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
	- `isTermSet`: `true`. Specifies every rule is a single-token terminal rule with the same `text` value.
	- `termSequenceType`: 'verb-present'.
	- `defaultText`: The conjugative `text` object for the present tense verb forms.
	- `insertionCost`: `options.insertionCost`, if defined.
3. `TenseVerbSet.past`
	- `name`: The concatenation of `TenseVerbSet.noTense.name` with the suffix '-past'.
	- `isTermSequence`: `true`. Enables nesting within term sequences and flattening in `flattenTermSequence`.
	- `isTermSet`: `true`. Specifies every rule is a single-token terminal rule with the same `text` value.
	- `termSequenceType`: 'verb-past'.
	- `defaultText`: The invariable `text` string for the past tense verb for

#### Arguments
- `options` *(Object)*: The options object.
- `[options.symbolName]` *(string)*: The name for the new `NSymbol`. If `undefined`, concatenates the prefix 'verb-' with the infinitive verb form, `options.verbFormsTermSet.pl`.
- `[options.insertionCost]` *(number)*: The insertion cost for the pair of terminal rule sets, assigned to the first rule in the present tense set (i.e., `verbFormsTermSet.oneSg`). Enables the creation of insertion rules using the new `NSymbol` that produces the present set (i.e., the LHS symbol).
- `options.verbFormsTermSet` *(VerbFormsTermSet)*: The verb terminal symbol set with each verb form.

#### Returns
*(TenseVerbSet)*: Returns the object containing the separate present and past terminal rule sets and the parent substitution term sequence that combines the two.