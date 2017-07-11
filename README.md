# aang

Aang is an extensive, sophisticated natural language understanding (NLU) system built from scratch. Designed to enable developers to easily create custom, full-featured, fast, robust, and precise natural language interfaces (e.g., virtual assistants, chatbots, and natural language search engines) to integrate with their products.

See [`/doc/`](https://github.com/DannyNemer/aang/tree/master/doc) for work-in-progress documentation.

See over 100,000 words of extensive, excellent, existing documentation throughout the source files in [`/lib/`](https://github.com/DannyNemer/aang/tree/master/lib).

#### Summary of the system:

1. First, a developer parameterizes types of objects, entities, actions, attributes, relationships, etc., that they want their interface to understand, as well as names for semantic functions they can recognize from the parser's output.
2. The generator outputs a context-free grammar (CFG) that supports varying phrasing according to the parametrization, including support for grammatical conjugation, associated semantic functions, and ill-formed input. The generator also performs extensive checks for errors, ambiguity, illogical semantics, grammatical errors, and more.
3. The parser generates a state-transition table from the grammar. Upon receiving input, the parser matches terminal symbols/phrases and performs entity recognition. Then, the parser generates a dense parse forest and performs an A* search on the forest to output the *k*-best, semantically and textually unique parse trees that match the input. Each parse tree has an associated semantic tree (which maps to a lambda calculus semantic representation) and grammatically correct display-text (even if the input is ill-formed). This process requires ~20 ms on average.

Such a short explanation inadequately describes the breadth and sophistication of the system. But, the following are a few notable features:

- Supports (infinitely) recursive grammar/statements (nested clauses)
- Recognizes and corrects ill-formed input
- Grammatical conjugation/correction
- Anaphora resolution ("he", "him", "they", etc.)
- Boolean operators ("and", "or", "not")
- Outputs *k*-best parse trees, semantic trees, and display-text for the input
- Semantic/logical validation (no semantic contradictions, duplicates, etc.)
- Disambiguation (identifies parses that are semantically identical yet textually distinguishable, and textually identical parses that are semantically distinguishable)

#### Linguistic framework:
My system internally uses an extensive linguistic framework I designed that models fundamental linguistic components and structures at different levels of abstraction. With this framework, the system enables developers to simply parameterize the types of objects, entities, relationships, and attributes they want their natural language interface to understand. From that parametrization, the system generates a grammar that handles the variations of phrasing (and ill-formed input), which the system's parser uses to run the natural language interface. For example, internally there are fundamental word objects, from which verbs types are defined, from which auxiliary verbs are defined, with which verb phrases are defined, with which sets of verb phrases are created for a simple parameterization. Please note this description is sparse and omits accounts of the system's automated processes, thorough checks (e.g., tests to avoid ambiguity, semantically contradictory statements, grammatical conjugation errors), semantic pairings, grammatical attributes, and more.

I modeled this framework as integrable building blocks to easily support new phrasings that benefit from the aforementioned tests, support new forms of grammatical conjugation and semantic structures, and eventually support extensions to different languages. Again, this is a simplified explanation that insufficiently conveys the system's scope. The system's goal, of course, is to produce natural language interfaces that accurately and quickly map any and all potential phrasings (including ill-formed) to their semantic representations. (Note: This model and approach is not ideal. I believe deep learning will soon exceed this and similar methods in robustness, scalability, and accuracy/precision, which is primarily why I paused development of Aang.)