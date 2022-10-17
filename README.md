# aang

_DEPRECATED as of June 2017_

<img alt="Aang" width="170" align="right" src="https://raw.githubusercontent.com/DannyNemer/aang/master/doc/img/logo.jpg"/>

Aang is an extensive, scalable, sophisticated natural language understanding (NLU) system built from scratch. Designed to enable developers to easily create custom, full-featured, fast, robust, and precise natural language interfaces (e.g., virtual assistants, chatbots, and natural language search engines) to integrate with their products.

The design and architecture are formidable, the code quality is supreme, and the documentation is fit for publication.

*"Developing the first 90% of an AI system is easier than the final 10%."* ~ An enervated developer.

**Usage** ([see more](#cli)):

```shell
yarn cli
```

## System Overview

1. **Natural language API**
   1. First, a developer parameterizes types of objects, entities, actions, attributes, relationships, etc., that they want their interface to understand, as well as names for semantic functions they can recognize from the parser's output.
   2. The system uses a [natural language API](lib/grammar/rules/Category.js) that allows developers to easily design custom natural language interfaces (NLIs) with these simple parameterizations.
   3. Internally, uses a [linguistic framework](lib/grammar/NSymbol.js) that models [fundamental linguistic components](lib/grammar/termSequence/termSequence.js) and structures at different levels of abstraction, with which the NLIs are constructed. Modeled as integrable building blocks to easily support new [grammatical structures and components](lib/grammar/termSequence/verbTermSet.js), new phrasings, new forms of grammatical conjugation, and new semantic structures.
   4. Integrates a [semantic framework](lib/grammar/semantic.js) that uses lambda calculus to represent meaning within the grammar and parse graphs.
2. **Grammar generator**
   1. A context-free grammar (CFG) [generator](lib/grammar/grammar.js) integrates the linguistic framework with the natural language API.
   2. Outputs a CFG that automatically supports various phrasing according to the parametrization, including support for grammatical conjugation, associated semantic functions, lexical and morphological analysis, and [ill-formed input](lib/grammar/createInsertionRules.js) (i.e., insertions, deletion, substitutions, and transpositions).
   3. The generator also performs extensive checks for errors, [ambiguity](lib/ambig/ambiguityCheck.js), [illogical semantics](lib/grammar/semanticChecks.js), grammatical errors, and more.
3. **Parser**
   1. Using the CFGs designed with the API, the parser outputs the _k_-best parse trees, semantic trees, and grammatically conjugated display-text for the given textual input.
   2. First, uses the CFG to generate a (Markov) [state-transition table](lib/parse/StateTable.js), which the parser employs as a precompiled LR(_k_) parsing table.
   3. Upon receiving input, the parser [matches terminal symbols/phrases](lib/parse/matchTerminalRules.js) and performs lexical analysis, morphological analysis, and entity recognition.
   4. From the matched terminal symbols, the [shift-reduce parser](lib/parse/Parser.js) uses the state table as a [Markov decision process (MDP)](https://en.wikipedia.org/wiki/Markov_decision_process) to generate a parsing stack, which references parsing states in the table. The parser then generalizes the stack into a graph as output. This output graph is a dense parse forest, which is a compact graph representation of all possible parse trees for the given input.
   5. An A\* graph-search algorithm efficiently [traverses the dense parse forests and calculates cost heuristics](lib/parse/calcHeuristicCosts.js).
   6. A [parse forest search algorithm](lib/parse/pfsearch.js) efficiently finds the _k_-best unique and semantically valid parse trees.
   7. Each parse tree has an associated semantic tree (which maps to a lambda calculus semantic representation) and [grammatically correct display-text](lib/parse/conjugateText.js) (even if the input is ill-formed).
   8. The entire parsing process, from tokenizing input to outputting the _k_-best parse and semantic trees and display-text, requires **~20 ms on average**. This speed enables auto-complete for its interfaces (i.e., outputting the _k_-best results immediately after the user types each character).
      - Assuming the fastest user types one character per ~150 ms: ~20 ms for parsing, ~100 ms for RTT, and ~30 ms to spare (e.g., display buffer).
4. **Miscellaneous**
   1. Includes eight command line interfaces (CLIs) for developing, [debugging](cli/cli.js), [testing](test/test.js), and [benchmarking](benchmark/benchmark.js) the system, its NLU interfaces, grammars, and parsers.
   2. Includes a suite of tests that check for ambiguity (grammatical, semantic, and textual), [grammatical conjugation errors, ill-formed semantic structures](lib/parse/checkParseTree.js), [inefficiently designed grammatical structures](lib/grammar/checkGrammar.js), and more to ensure optimal performance of the NLIs.
   3. 6,500+ git commits, [2,000+ unit tests](test/), 250+ unique error messages, **50,000+ lines of technical documentation**, and the highest code quality. (4,000+ hours of work.)

Such a short explanation inadequately describes the breadth and sophistication of the system. But, the following are a few notable advancements over existing NLIs (e.g., Siri, Alexa):

1. Faster parsing
2. More precise understanding (i.e., more complex semantic representations)
3. Supports (infinitely) recursive grammar/statements (nested clauses)
4. Recognizes and corrects ill-formed input
5. Grammatical conjugation/correction
6. Anaphora resolution ("he", "him", "they", etc.)
7. Boolean operators ("and", "or", "not")
8. Outputs _k_-best parse trees, semantic trees, and display-text for the input
9. Semantic/logical validation (no semantic contradictions, duplicates, etc.)
10. Disambiguation (identifies parses that are semantically identical yet textually distinguishable, and textually identical parses that are semantically distinguishable)

## Testimonial

While the above architecture appears straightforward, its design and development was anything but. Implementing this system was a seemingly Sisyphean task: multiple times, hundreds of hours of work had to be discarded to discover the superior, scalable, and successful approaches. No component, design, data structure, or algorithm was obvious, and each is the product of testing numerous models. The system's substantial, meticulous documentation demonstrates the rigorous design process that was necessary to solve its technical hurdles.

The system was diligently designed as modular to reliably support any and all future extensions and expansions. This is not a prototype, but rather the foundation for a scaled system that implements various custom NLIs, each serving tens of thousands of requests per second, and handles the obscurest of edge cases. Modularity governs the design, from the natural language API to the internal linguistic framework to the succession of steps that comprise the parsing process to the detailed, redundant tests. _Even my test suite has a test suite._

## Documentation

See over 50,000+ lines of extensive, meticulous, existing documentation throughout the source files in [`lib/`](lib/).

See this early [**paper for the system**](doc/original%20paper/paper.pdf) and [its proposal](doc/original%20paper/proposal.pdf), though note it is out-of-date and should not be referenced. The system has advanced far beyond and diverged from the contents of this original paper. Nowadays, however, a fancy LaTeX "white paper" impresses many regardless of the work's merit, so I offer it here as tribute.

- Separately, LaTeX fans may enjoy seeing this paper's intricate, text-based figures constructed entirely in LaTeX: the parse tree, CFG, state table, etc.

As is, given the sophistication and originality of the algorithms and data structures I designed throughout the system, there are several discrete components that each warrant their own (academic) paper:

1. [Ambiguity detection for CFGs](lib/ambig/)
2. [Calculating graph-search heuristics for a cyclic graph generated from recursive CFGs](lib/parse/calcHeuristicCosts.js#L222)
3. [An MDP state-transition parse table generated from CFGs](lib/parse/StateTable.js)
4. [A shift-reduce parser that uses a single dense graph (i.e., parse forest) with memory-efficient packed nodes](lib/parse/Parser.js)
5. [Efficient A\* search for parse forests with simultaneous semantic validation, text conjugation, and terminal sequence merging](lib/parse/pfsearch.js)
6. [Flattening parse forests (prior search) by merging terminal symbol sequences](lib/parse/flattenTermSequence.js) ([and disambiguating as necessary](lib/parse/flattenTermSequence.js#L789))
7. [Anaphora resolution, which remains a problem throughout linguistics](lib/parse/resolveAnaphora.js)
8. [Semantic reduction](lib/parse/semanticReduction.js)
9. [Parsing union operations in semantic trees](lib/grammar/semantic.js#L1216-L1554)

## Linguistic Framework

My system internally uses an extensive linguistic framework I designed that models fundamental linguistic components and structures at different levels of abstraction. With this framework, the system enables developers to simply parameterize the types of objects, entities, relationships, and attributes they want their natural language interface to understand. From that parametrization, the system generates a grammar that handles the variations of phrasing (and ill-formed input), which the system's parser uses to run the natural language interface. For example, internally there are fundamental word objects, from which verbs types are defined, from which auxiliary verbs are defined, with which verb phrases are defined, with which sets of verb phrases are created for a simple parameterization. Please note this description is sparse and omits accounts of the system's automated processes, thorough checks (e.g., tests to avoid ambiguity, semantically contradictory statements, grammatical conjugation errors), semantic pairings, grammatical attributes, and more.

I modeled this framework as integrable building blocks to easily support new phrasings that benefit from the aforementioned tests, support new forms of grammatical conjugation and semantic structures, and eventually support extensions to different languages. Again, this is a simplified explanation that insufficiently conveys the system's scope. The system's goal, of course, is to produce natural language interfaces that accurately and quickly map any and all potential phrasings (including ill-formed) to their semantic representations. (Note: This model and approach is not ideal. I believe deep learning will soon exceed this and similar methods in robustness, scalability, and accuracy/precision, which is primarily why I paused development of Aang.)

## CLI

The command line interface for Aang:

```shell
yarn cli
```

If you do not have `yarn` installed:

```shell
node cli/cli.js
```

Then just type queries! Try `my open PRs assigned to me`. See [examples](#examples) below for me.

### Programs

The CLI contains the following built-in programs:

- `[query]` - Parses the provided query and outputs the k-best parse trees.

- `.test` - Parses the suite of test queries and checks output conforms to
  the test's specifications.

- `.benchmark` - Benchmarks the duration of parsing the queries in the test
  suite.

- `.buildGrammar` - Generates and outputs the grammar containing the grammar
  rules, semantics, entities, and deletables, for use with the parser.

- `.ambiguityCheck` - Finds and prints instances of ambiguity in the grammar.

- `.stateTable` - Prints the state table generated from the grammar.

- `.archive*` - Saves output of program \*. Includes: `.archiveTest`,
  `.archiveTestSmall`, `.archiveTestQuiet`, `.archiveGrammar`,
  `.archiveAmbigCheck`, `.archiveStateTable`, `.archiveAll`.

- `.restoreGrammar` - Copies the last output of `.archiveGrammar` to the
  `.buildGrammar` output path.

- `.diff*` - Compares last archived output of program \* to current output of
  the same program. Includes: `.diffTest`, `.diffTestSmall`, `.diffTestQuiet`,
  `.diffGrammar`, `.diffAmbigCheck`, `.diffStateTable`.

Enables configuration of CLI environment variables which are passed as options
when executing the above programs.

Each program is spawn as a child process. This automatically enables any
changes to modules outside the CLI, allows the user to kill any process (with
`^C`) without exiting the CLI, and improves benchmark result consistency by
mitigating the impact of process caches.

## Examples

The following are examples of natural language queries/interfaces that can you can design with this system. Each example is the [CLI](cli/cli.js) output with the input text and the corresponding output text (with any corrections) and associated semantic.

The examples below cover the domain of natural language search queries to best show the complexity this system (i.e., Aang) can understand. Queries for virtual assistants are structured nearly identically to search queries (just with a prepended command phrase: `"create a [calendar event at ...]"`, `"what are [restaurants in ...]"`, `"show me [people who ...]"`). Queries in a conversational UI are even simpler.

For these examples, I created an NLI for searching the structured data of Git repositories and GitHub: forks, pull requests, repositories, users, etc.

1. An example of outputting the _k_-best matches (display-text and semantic) for the input text:
   ![alt text](doc/img/example1.jpg)

1. An example of the parse tree generated for the input query. This example uses a simple query and only outputs the first result (i.e., exact match) because otherwise the parse tree would be too large to display here:
   ![alt text](doc/img/example2.jpg)

1. An example of a complex parse with boolean operators and the resultant semantic: "and" (intersection), "or" (union), "not" (negation). Note the entity resolution of "John von Neumann" (`{user}` category) and "Node.js" (`{repository}`) to their corresponding entity ids.
   ![alt text](doc/img/example3.jpg)

1. A succession of simple queries demonstrating grammatical conjugation correction. (In the output below, the second of the two display-texts is the actual system output. The CLI re-prints the input query for to diff against the actual output to highlight the corrections the system made.) (In these examples, the system is only outputting the first parse tree (_k=1_) for brevity.)
   ![alt text](doc/img/example4.jpg)

1. Several examples demonstrating anaphora resolution.
   ![alt text](doc/img/example5.jpg)

## Deep learning and NLU

As described above, I view natural language understanding (NLU) as the process of taking arbitrary textual input (including voice-to-text transcriptions), of arbitrary size with or without context, and **outputting a cross-linguistically consistent semantic representation** (e.g., a [lambda calculus representation](https://en.wikipedia.org/wiki/Lambda_calculus)). One of the primary reasons I paused this project's development is because I believe the core of my system will soon be possible, and eventually superior, with deep learning, obsoleting most of my work.

Below, I describe how deep learning can achieve the components that comprise this NLU process. I refer to Google's [SyntaxNet](https://github.com/tensorflow/models/tree/master/syntaxnet) in most of the descriptions because SyntaxNet is the most complete, accurate, well-documented, and open-source implementation of these deep learning approaches; other papers have documented similar findings.

1. **Text segmentation (word boundary identification)**

   Google's SyntaxNet uses pre-trained neural networks to [identify word boundaries](https://research.googleblog.com/2016/08/meet-parseys-cousins-syntax-for-40.html) in 40+ languages (with very high accuracy), including Chinese (which does not separate words with spaces).

2. **Entity recognition**

   Identifying entities (e.g., a name of a city, restaurant, person) can be incredibly computationally intensive if forced to search every input _n_-gram in every possible index of entities (e.g., indices of cities, restaurants, people). Ergo, it is best to use pre-trained [language models](https://en.wikipedia.org/wiki/Language_model) to determine the probabilistic likelihood of the _n_th term belonging to a particular entity category based on the previous \_n_ terms in input. For example, a trained language model can identify that the next term in "people who live in ..." has a high likelihood of appearing in location-related indices (e.g., cities, countries), and will avoid searching low-probability entity categories (of which there could be dozens; e.g., people, book/film names). Applying ML to entity recognition is not new and was a planned component of my system that I never reached.

3. **Morphological analysis**

   Similar to text segmentation, Google's SyntaxNet can [infer inflection](https://research.googleblog.com/2016/08/meet-parseys-cousins-syntax-for-40.html), which is pertinent mainly to dependency parsing but also applies to WSD and grammatical conjugation. "In Russian, a heavily inflected language, morphology can indicate number, gender, whether the word is the subject or object of a sentence, possessives, prepositional phrases, and more."

4. **Word vectors**

   After input text segmentation and terminal symbol identification and analysis, the next component of a deep learning NLU system would map the text input to [word/phrase embeddings](https://en.wikipedia.org/wiki/Word_embedding). These vectors would be pre-trained with unsupervised learning (e.g., [skip-gram](https://arxiv.org/abs/1607.04606)) on large corpora (e.g., [Wikipedia corpus](https://github.com/facebookresearch/fastText/blob/master/pretrained-vectors.md)). These vector representations are essential for the parse tree generation in the next step, but also capture the fuzzy nature of language, such as identifying semantically similar phrases. Also, given language's fuzziness, there can be varying degrees of precision in mapping to semantic representations. For example, in some use cases, two terms qualify as synonymous (e.g., "alarm" and "clock") while other times the same terms should not. **Vector computations enable the probabilistic semantic analysis to modulate the degree of precision (or semantic fidelity) appropriate for the current task or interface.**

5. **Parse trees**

   Parse trees are the paramount component that differentiates NLU from NLP. Primarily, it determines the relationships between terms within a text sequence to infer the text's meaning. These relationships are modeled with a parse tree and an associated semantic tree (which would map to a linguistically-independent semantic representation). Google's SyntaxNet demonstrates a [simple feed-forward neural network can construct these parse trees](https://research.googleblog.com/2016/05/announcing-syntaxnet-worlds-most.html): "Given a sentence as input, it tags each word with a part-of-speech (POS) tag that describes the word's syntactic function, and it determines the syntactic relationships between words in the sentence, represented in the dependency parse tree."

   Indeed, SyntaxNet is merely part-of-speech tagging for grammatical structure, not [semantic role labeling](https://en.wikipedia.org/wiki/Semantic_role_labeling). But, once this approach identifies the syntactic relationship (e.g., subject + verb/action + object), the word vectors can infer the semantic representation of that relationship. Also, these structures account for the same dependency parsing needed for NLU tasks. While constructing a parse tree, SyntaxNet employs [beam search](https://en.wikipedia.org/wiki/Beam_search) to disambiguate its parses: "An input sentence is processed from left to right, with dependencies between words being incrementally added as each word in the sentence is considered. At each point in processing many decisions may be possible—due to ambiguity—and a neural network gives scores for competing decisions based on their plausibility." Again, these POS trees are not NLU's goal, but now that neural networks can accurately construct the syntactic structure of input, handle disambiguation, and vector spaces can model the word and phrase semantic representations, it is nearly possible to integrate these components to output rich semantic trees.

   Google trains its models on treebanks provided by the [Universal Dependency project](http://universaldependencies.org/). Google also notes this deep learning approach is not yet perfect, but it is continuously improving: "While the accuracy is not perfect, it’s certainly high enough to be useful in many applications. The major source of errors at this point are examples such as the prepositional phrase attachment ambiguity described above, which require real world knowledge (e.g. that a street is not likely to be located in a car) and deep contextual reasoning."

   Note: One such possible deep learning approach is to use neural networks to output dense parse forests, and then use existing implementations to search the parse forests for the _k_-best semantically valid, disambiguated parse trees with their associated semantic trees and grammatically correct display-text. I wrote [a scant account of this approach here](https://medium.com/@dannynemer/dl-nlu-8fdae1c40eb7).

6. **Unseen words**

   Neural networks can generate [character-based input representations](https://github.com/tensorflow/models/blob/master/syntaxnet/g3doc/conll2017/paper.pdf), instead of word-based embeddings, to determine the semantic structure on [unseen terms](https://research.googleblog.com/2017/03/an-upgrade-to-syntaxnet-new-models-and.html) by identifying "systematic patterns in morphology and syntax to allow us to guess the grammatical function of words even when they are completely novel. [...] By doing so, the models can learn that words can be related to each other because they share common parts (e.g. ‘cats’ is the plural of ‘cat’ and shares the same stem; ‘wildcat’ is a type of ‘cat’). [...] These models [...] are thus much better at predicting the meaning of new words based both on their spelling and how they are used in context."

7. **Language independence**

   As SyntaxNet demonstrates, the implementations that use word embeddings and neural networks are independent of language, and Google has trained neural networks for 40+ languages. Again, Google trains its models on treebanks provided by the [Universal Dependency project](http://universaldependencies.org/).

8. **Grammatical conjugation**

   Grammatical conjugation is not unique to NLU, but essential for any natural language interface, including tasks that must map a given semantic representation to its corresponding display-text (i.e., the reverse of the above process). Using the same models that the morphological analysis (part 3) employs, coupled with the syntactical structure that the parse trees reveal (part 5), these systems can correctly conjugate terms according to their language's grammar.
