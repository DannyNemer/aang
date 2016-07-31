/**
 * Methods, which `grammar` inherits, that create `NSymbol` instances that produce terminal rule sets for nouns.
 *
 * These methods create an `NSymbol` for complete noun form term sets, as opposed to adding rules to an existing `NSymbol`, and forbid adding rules to the returned `NSymbol` afterward to prevent external changes to the rule sets.
 */

var util = require('../../util/util')
var g = require('../grammar')


// Instruct `util.getModuleCallerLocation()` to skip the `nounTermSet` module when searching the call stack for instantiation file paths of `NSymbol` instances that `nounTermSet` methods create. For use in error messages.
util.skipFileInLocationRetrieval()