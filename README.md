# aang

Aang is an extensive, sophisticated natural language understanding (NLU) system built from scratch. Designed to enable developers to easily create custom, full-featured, fast, robust, and precise natural language interfaces (e.g., virtual assistants, chatbots, and natural language search engines) to integrate with their products.

See [`/doc/`](https://github.com/DannyNemer/aang/tree/master/doc) for work-in-progress documentation.

See over 100,000 words of extensive, excellent, existing documentation throughout the source files in [`/lib/`](https://github.com/DannyNemer/aang/tree/master/lib).

#### Summary of the system:

1. First, a developer parameterizes types of objects, entities, actions, attributes, relationships, etc., that they want their interface to understand, as well as names for semantic functions they can recognize from the parser's output.
2. The generator outputs a grammar that supports varying phrasing according to the parametrization, including support for grammatical conjugation, associated semantic functions, and ill-formed input. The generator also performs extensive checks for errors, ambiguity, illogical semantics, grammatical errors, and more.
3. The parser generates a state-transition table from the grammar. Upon receiving input, the parser matches terminal symbols/phrases and performs entity recognition. Then, the parser generates a dense, parse forest and performs an A* search on the forest to output the k-best, semantically and textually unique parse trees that match the input. Each parse tree has an associated semantic tree (which maps to a lambda calculus semantic representation) and grammatically correct display-text (even if the input is ill-formed). This process requires ~20 ms on average.

Such a short explanation inadequately describes the breadth and sophistication of the system. But, the following are a few notable:

- Supports (infinitely) recursive grammar/statements (nested clauses)
- Recognizes and corrects ill-formed input
- Grammatical conjugation/correction
- Anaphora resolution ("he", "him", "they", etc.)
- Boolean operators ("and", "or", "not")
- Outputs k-best parse trees, semantic trees, and display-text for the input
- Semantic/logical validation (no semantic contradictions, duplicates, etc.)
- Disambiguation (identifies parses that are semantically identical yet textually distinguishable, and textually identical parses that are semantically distinguishable)