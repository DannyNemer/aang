# aang

<img alt="Aang" width="170" align="right" src="https://raw.githubusercontent.com/DannyNemer/aang/master/doc/img/logo.jpg"/>

Aang is an extensive, sophisticated natural language understanding (NLU) system built from scratch. Designed to enable developers to easily create custom, full-featured, fast, robust, and precise natural language interfaces (e.g., virtual assistants, chatbots, and natural language search engines) to integrate with their products.

*"Developing the first 90% of an AI system is easier than the final 10%."* ~ An enervated developer.

### System summary:
1. **Natural language API**
	- First, a developer parameterizes types of objects, entities, actions, attributes, relationships, etc., that they want their interface to understand, as well as names for semantic functions they can recognize from the parser's output.
	- The system uses a [natural language API](https://github.com/DannyNemer/aang/blob/master/lib/grammar/rules/Category.js) that allows developers to easily design custom natural language interfaces (NLIs) with these simple parameterizations.
	- Internally, uses a [linguistic framework](https://github.com/DannyNemer/aang/blob/master/lib/grammar/NSymbol.js) that models [fundamental linguistic components](https://github.com/DannyNemer/aang/blob/master/lib/grammar/termSequence/termSequence.js) and structures at different levels of abstraction, with which the NLIs are constructed. Modeled as integrable building blocks to easily support new [grammatical structures and components](https://github.com/DannyNemer/aang/blob/master/lib/grammar/termSequence/verbTermSet.js), new phrasings, new forms of grammatical conjugation, and new semantic structures.
	- Integrates a [semantic framework](https://github.com/DannyNemer/aang/blob/master/lib/grammar/semantic.js) that serves as a lambda calculus representation of meaning within the grammar.
2. **Grammar generator**
	- A context-free grammar (CFG) [generator](https://github.com/DannyNemer/aang/blob/master/lib/grammar/grammar.js) integrates the linguistic framework with the natural language API.
	- Outputs a CFG that automatically supports various phrasing according to the parametrization, including support for grammatical conjugation, associated semantic functions, lexical and morphological analysis, and [ill-formed input](https://github.com/DannyNemer/aang/blob/master/lib/grammar/createInsertionRules.js) (i.e., insertions, deletion, substitutions, and transpositions).
	- The generator also performs extensive checks for errors, [ambiguity](https://github.com/DannyNemer/aang/blob/master/lib/ambig/ambiguityCheck.js), [illogical semantics](https://github.com/DannyNemer/aang/blob/master/lib/grammar/semanticChecks.js), grammatical errors, and more.
3. **Parser**
	-	Using the CFGs designed with the API, the parser outputs the *k*-best parse trees, semantic trees, and grammatically conjugated display-text for the given textual input.
	- First, compiles a [state-transition table](https://github.com/DannyNemer/aang/blob/master/lib/parse/StateTable.js) from the CFG that the parser uses as a precompiled LR(*k*) parsing table.
	- Upon receiving input, the parser [matches terminal symbols/phrases](https://github.com/DannyNemer/aang/blob/master/lib/parse/matchTerminalRules.js) and performs lexical analysis, morphological analysis, and entity recognition.
	- From the matched terminal symbols, the [shift-reduce parser](https://github.com/DannyNemer/aang/blob/master/lib/parse/Parser.js) generates a dense parse forest of multiple potential parse trees.
	- An A* graph-search algorithm efficiently [traverses the dense parse forests and calculates cost heuristics](https://github.com/DannyNemer/aang/blob/master/lib/parse/calcHeuristicCosts.js).
	- A [parse forest search algorithm](https://github.com/DannyNemer/aang/blob/master/lib/parse/pfsearch.js) efficiently finds the *k*-best unique and semantically valid parse trees.
	- Each parse tree has an associated semantic tree (which maps to a lambda calculus semantic representation) and [grammatically correct display-text](https://github.com/DannyNemer/aang/blob/master/lib/parse/conjugateText.js) (even if the input is ill-formed).
	- The entire parsing process, from tokenizing input to outputting the *k*-best parse and semantic trees and display-text, requires **~20 ms on average**. This speed enables auto-complete for its interfaces (i.e., outputting the *k*-best results immediately after the user types each character).
		- Assuming the fastest user types one character per ~150 ms: ~20 ms for parsing, ~100 ms for RTT, and ~30 ms to spare (e.g., display buffer).
4. **Miscellaneous**
	- Includes eight command line interfaces (CLIs) for developing, [debugging](https://github.com/DannyNemer/aang/blob/master/lib/cli/cli.js), [testing](https://github.com/DannyNemer/aang/blob/master/lib/test/test.js), and [benchmarking](https://github.com/DannyNemer/aang/blob/master/lib/benchmark/benchmark.js) the system, its NLU interfaces, grammars, and parsers.
	- Includes a suite of tests that check for ambiguity (grammatical, semantic, and textual), [grammatical conjugation errors, ill-formed semantic structures](https://github.com/DannyNemer/aang/blob/master/lib/parse/checkParseTree.js), [inefficiently designed grammatical structures](https://github.com/DannyNemer/aang/blob/master/lib/grammar/checkGrammar.js), and more to ensure optimal performance of the NLIs.
	- 6,500+ git commits, [2,000+ test cases](https://github.com/DannyNemer/aang/tree/master/lib/test), 250+ unique error messages, 100,000+ words of technical documentation, and the highest code quality. (4,000+ hours of work.)

Such a short explanation inadequately describes the breadth and sophistication of the system. But, the following are a few notable advancements over existing NLIs (e.g., Siri, Alexa):

- Faster parsing
- More precise understanding (i.e., more complex semantic representations)
- Supports (infinitely) recursive grammar/statements (nested clauses)
- Recognizes and corrects ill-formed input
- Grammatical conjugation/correction
- Anaphora resolution ("he", "him", "they", etc.)
- Boolean operators ("and", "or", "not")
- Outputs *k*-best parse trees, semantic trees, and display-text for the input
- Semantic/logical validation (no semantic contradictions, duplicates, etc.)
- Disambiguation (identifies parses that are semantically identical yet textually distinguishable, and textually identical parses that are semantically distinguishable)

### Testimonial:
While the above architecture appears straightforward, its design and development was anything but. Implementing this system was a seemingly Sisyphean task: multiple times, hundreds of hours of work had to be discarded to discover the superior, scalable, and successful approaches. No component, design, data structure, or algorithm was obvious, and each is the product of testing numerous models. The system's substantial, meticulous documentation demonstrates the rigorous design process that was necessary to solve its technical hurdles.

The system was diligently designed as modular to reliably support any and all future extensions and expansions. This is not a prototype, but rather the foundation for a scaled system that implements various custom NLIs, each serving tens of thousands of requests per second, and handles the obscurest of edge cases. Modularity governs the design, from the natural language API to the internal linguistic framework to the succession of steps that comprise the parsing process to the detailed, redundant tests. *Even my test suite has a test suite.*

### Examples:

### Documentation:
See [`/doc/`](https://github.com/DannyNemer/aang/tree/master/doc) for documentation that is temporary and  incomplete while I evaluate the best method to present the material.

See over 100,000 words of extensive, excellent, existing documentation throughout the source files in [`/lib/`](https://github.com/DannyNemer/aang/tree/master/lib).

See this early [**paper for the system**](https://github.com/DannyNemer/aang/blob/master/doc/original%20paper/paper.pdf), though note it is out-of-date and should not be referenced. The system has advanced far beyond and diverged from the contents of this original paper. Nowadays, however, a fancy LaTeX "white paper" impresses many regardless of the work's merit, so I offer it here as tribute.
- Separately, LaTeX fans may enjoy seeing this paper's intricate, text-based figures constructed entirely in LaTeX: the parse tree, CFG, state table, etc.
- As is, given the sophistication and originality of the algorithms and data structures I designed throughout the system, there are several discrete components that each warrant their own (academic) paper:
	- [Ambiguity detection for CFGs](https://github.com/DannyNemer/aang/tree/master/lib/ambig)
	- [Calculating graph-search heuristics for a cyclic graph generated from recursive CFGs](https://github.com/DannyNemer/aang/blob/master/lib/parse/calcHeuristicCosts.js#L222)
	- [An MDP state-transition parse table generated from CFGs](https://github.com/DannyNemer/aang/blob/master/lib/parse/StateTable.js)
	- [A shift-reduce parser that uses a single dense graph (i.e., parse forest) with memory-efficient packed nodes](https://github.com/DannyNemer/aang/blob/master/lib/parse/Parser.js)
	- [Efficient A* search for parse forests with simultaneous semantic validation, text conjugation, and terminal sequence merging](https://github.com/DannyNemer/aang/blob/master/lib/parse/pfsearch.js)
	- [Flattening parse forests (prior search) by merging terminal symbol sequences](https://github.com/DannyNemer/aang/blob/master/lib/parse/flattenTermSequence.js) ([and disambiguating as necessary](https://github.com/DannyNemer/aang/blob/master/lib/parse/flattenTermSequence.js#L789))

### Linguistic framework:
My system internally uses an extensive linguistic framework I designed that models fundamental linguistic components and structures at different levels of abstraction. With this framework, the system enables developers to simply parameterize the types of objects, entities, relationships, and attributes they want their natural language interface to understand. From that parametrization, the system generates a grammar that handles the variations of phrasing (and ill-formed input), which the system's parser uses to run the natural language interface. For example, internally there are fundamental word objects, from which verbs types are defined, from which auxiliary verbs are defined, with which verb phrases are defined, with which sets of verb phrases are created for a simple parameterization. Please note this description is sparse and omits accounts of the system's automated processes, thorough checks (e.g., tests to avoid ambiguity, semantically contradictory statements, grammatical conjugation errors), semantic pairings, grammatical attributes, and more.

I modeled this framework as integrable building blocks to easily support new phrasings that benefit from the aforementioned tests, support new forms of grammatical conjugation and semantic structures, and eventually support extensions to different languages. Again, this is a simplified explanation that insufficiently conveys the system's scope. The system's goal, of course, is to produce natural language interfaces that accurately and quickly map any and all potential phrasings (including ill-formed) to their semantic representations. (Note: This model and approach is not ideal. I believe deep learning will soon exceed this and similar methods in robustness, scalability, and accuracy/precision, which is primarily why I paused development of Aang.)

### Deep learning and NLU:
As described above, I view natural language understanding (NLU) as the process of taking arbitrary input, of arbitrary size with or without context, and **outputting a cross-linguistically consistent semantic representation** (e.g., a lambda calculus representation). One of the primary reasons I paused this project's development is because I believe the core of my system will soon be possible, and eventually superior, with deep learning, obsoleting most of my work.

Below, I describe how deep learning can achieve the components that comprise this NLU process. I refer to Google's [SyntaxNet](https://github.com/tensorflow/models/tree/master/syntaxnet) in most of the descriptions because SyntaxNet is the most complete, accurate, well-documented, and open-source implementation of these deep learning approaches; other papers have documented similar findings.

1. **Text segmentation (word boundary identification)**

	Google's SyntaxNet uses pre-trained neural networks to [identify word boundaries](https://research.googleblog.com/2016/08/meet-parseys-cousins-syntax-for-40.html) in 40+ languages (with very high accuracy), including Chinese (which does not separate words with spaces).

2. **Entity recognition**

	Identifying entities (e.g., a name of a city, restaurant, person) can be incredibly computationally intensive if forced to search every input *n*-gram in every possible index of entities (e.g., indices of cities, restaurants, people). Ergo, it is best to use pre-trained [language models](https://en.wikipedia.org/wiki/Language_model) to determine the probabilistic likelihood of the *n*th term belonging to a particular entity category based on the previous *n* terms in input. For example, a trained language model can identify that the next term in "people who live in ..." has a high likelihood of appearing in location-related indices (e.g., cities, countries), and will avoid searching low-probability entity categories (of which there could be dozens; e.g., people, book/film names). Applying ML to entity recognition is not new and was a planned component of my system that I never reached.

3. **Morphological analysis**

	Similar to text segmentation, Google's SyntaxNet can [infer inflection](https://research.googleblog.com/2016/08/meet-parseys-cousins-syntax-for-40.html), which is pertinent mainly to dependency parsing but also applies to WSD and grammatical conjugation. "In Russian, a heavily inflected language, morphology can indicate number, gender, whether the word is the subject or object of a sentence, possessives, prepositional phrases, and more."

4. **Word vectors**

	After input text segmentation and terminal symbol identification and analysis, the next component of a deep learning NLU system would map the text input to [word/phrase embeddings](https://en.wikipedia.org/wiki/Word_embedding). These vectors would be pre-trained with unsupervised learning (e.g., [skip-gram](https://arxiv.org/abs/1607.04606)) on large corpora (e.g., [Wikipedia corpus](https://github.com/facebookresearch/fastText/blob/master/pretrained-vectors.md)). These vector representations are essential for the parse tree generation in the next step, but also capture the fuzzy nature of language, such as identifying semantically similar phrases. Also, given language's fuzziness, there can be varying degrees of precision in mapping to semantic representations. For example, in some use cases, two terms qualify as synonymous (e.g., "alarm" and "clock") while other times the same terms should not. **Vector computations enable the probabilistic semantic analysis to modulate the degree of precision (or semantic fidelity) appropriate for the current task or interface.**

5. **Parse trees**

	Parse trees are the paramount component that differentiates NLU from NLP. Primarily, it determines the relationships between terms within a text sequence to infer the text's meaning. These relationships are modeled with a parse tree and an associated semantic tree (which would map to a linguistically-independent semantic representation). Google's SyntaxNet demonstrates a [simple feed-forward neural network can construct these parse trees](https://research.googleblog.com/2016/05/announcing-syntaxnet-worlds-most.html): "Given a sentence as input, it tags each word with a part-of-speech (POS) tag that describes the word's syntactic function, and it determines the syntactic relationships between words in the sentence, represented in the dependency parse tree."

	Indeed, SyntaxNet is merely part-of-speech tagging for grammatical structure, not [semantic role labeling](https://en.wikipedia.org/wiki/Semantic_role_labeling). But, once this approach identifies the syntactic relationship (e.g., subject + verb/action + object), the word vectors can infer the semantic representation of that relationship. Also, these structures account for the same dependency parsing needed for NLU tasks. While constructing a parse tree, SyntaxNet employs [beam search](https://en.wikipedia.org/wiki/Beam_search) to disambiguate its parses: "An input sentence is processed from left to right, with dependencies between words being incrementally added as each word in the sentence is considered. At each point in processing many decisions may be possible—due to ambiguity—and a neural network gives scores for competing decisions based on their plausibility." Again, these POS trees are not NLU's goal, but now that neural networks can accurately construct the syntactic structure of input, handle disambiguation, and vector spaces can model the word and phrase semantic representations, it is nearly possible to integrate these components to output rich semantic trees.

	Google trains its models on treebanks provided by the [Universal Dependency project](http://universaldependencies.org/). Google also notes this deep learning approach is not yet perfect, but it is continuously improving: "While the accuracy is not perfect, it’s certainly high enough to be useful in many applications. The major source of errors at this point are examples such as the prepositional phrase attachment ambiguity described above, which require real world knowledge (e.g. that a street is not likely to be located in a car) and deep contextual reasoning."

	Note: One such possible deep learning approach is to use neural networks to output dense parse forests, and then use existing implementations to search the parse forests for the *k*-best semantically valid, disambiguated parse trees with their associated semantic trees and grammatically correct display-text. I wrote [a scant account of this approach here](https://medium.com/@dannynemer/dl-nlu-8fdae1c40eb7).

6. **Unseen words**

	Neural networks can generate [character-based input representations](https://github.com/tensorflow/models/blob/master/syntaxnet/g3doc/conll2017/paper.pdf), instead of word-based embeddings, to determine the semantic structure on [unseen terms](https://research.googleblog.com/2017/03/an-upgrade-to-syntaxnet-new-models-and.html) by identifying "systematic patterns in morphology and syntax [to] allow us to guess the grammatical function of words even when they are completely novel. [...] By doing so, the models can learn that words can be related to each other because they share common parts (e.g. ‘cats’ is the plural of ‘cat’ and shares the same stem; ‘wildcat’ is a type of ‘cat’). [...] These models [...] are thus much better at predicting the meaning of new words based both on their spelling and how they are used in context."

7. **Language independence**

	As SyntaxNet demonstrates, the implementations that use word embeddings and neural networks are independent of language, and Google has trained neural networks for 40+ languages. Again, Google trains its models on treebanks provided by the [Universal Dependency project](http://universaldependencies.org/).

8. **Grammatical conjugation**

	Grammatical conjugation is not unique to NLU, but essential for any natural language interface, including tasks that must map a given semantic representation to its corresponding display-text (i.e., the reverse of the above process). Using the same models that the morphological analysis (part 3) employs, coupled with the syntactical structure that the parse trees reveal (part 5), these systems can correctly conjugate terms according to their language's grammar.