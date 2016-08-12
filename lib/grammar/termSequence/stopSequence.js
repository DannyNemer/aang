/**
 * Methods, which `grammar` inherits, that create `NSymbol` instances that produce stop sequences, which delete terminal symbols matched in input.
 */

var util = require('../../util/util')
var g = require('../grammar')
var termSequence = require('./termSequence')
var termSequenceUtil = require('./termSequenceUtil')


// Instruct `util.getModuleCallerLocation()` to skip the `stopSequence` module when searching the call stack for instantiation file paths of `NSymbol` instances that `stopSequence` methods create. For use in error messages.
util.skipFileInLocationRetrieval()