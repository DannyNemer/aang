var util = require('../util/util')
var g = require('./grammar')
var stringUtil = require('./stringUtil')


// The map of entity tokens to entities.
exports.entitySets = {}
// A map of entity category names to creation lines; used for error reporting.
exports.creationLines = {}
// Counter for entity ids.
var entityCount = 0

/**
 * Creates a new entity category containing the passed entities.
 *
 * @param {Object} options The options object containing the entities.
 * @returns {string} Returns the terminal symbol for the category.
 */
var entityCategorySchema = {
	// The unique name for entity category.
	name: { type: String, required: true },
	// The entities to look for in input.
	entities: { type: Array, arrayType: String, required: true },
	// Specify an instance of this entity category represents a person and can serve as the antecedent for an anaphoric expression.
	isPerson: Boolean,
}

exports.new = function (options) {
	if (util.illFormedOpts(entityCategorySchema, options)) {
		throw new Error('Ill-formed entity category')
	}

	var categoryName = '{' + stringUtil.formatStringForName(options.name) + '}'

	if (exports.creationLines.hasOwnProperty(categoryName)) {
		util.logErrorAndPath('Duplicate entity category name:', categoryName)
		throw new Error('Duplicate entity category name')
	}

	// Save instantiation file path and line number for error reporting.
	exports.creationLines[categoryName] = util.getModuleCallerPathAndLineNumber()

	var newEntities = options.entities
	for (var i = 0, newEntitiesLen = newEntities.length; i < newEntitiesLen; ++i) {
		var entityDisplayText = newEntities[i]
		var entityKey = entityDisplayText.toLowerCase()

		// Check for duplicate entities within this category.
		for (var j = i + 1; j < newEntitiesLen; ++j) {
			var otherEntity = newEntities[j]
			if (entityKey === otherEntity) {
				util.logErrorAndPath('Duplicate entity:', categoryName, '->', i + ': ' + entityDisplayText + ',', j + ': ' + otherEntity)
				throw new Error('Duplicate entity')
			}
		}

		// Tokenize entity text to enable partial entity matches, deletables within entities, and out of order token matches. Sort tokens alphabetically to prevent duplicate token index matches in input.
		var entityTokens = entityKey.toLowerCase().split(' ').sort()
		var entityTokensLen = entityTokens.length

		var entity = {
			// The display text.
			text: entityDisplayText,
			// The tokens of `text`, sorted alphabetically.
			tokens: entityTokens,
			// The number of tokens in `text`.
			size: entityTokensLen,
			// The entity category.
			category: categoryName,
			// The unique identifier. Saved as a string for semantic arguments sorting.
			id: String(entityCount++),
			// Specify this entity represents a person and can serve as the antecedent for an anaphoric expression.
			isPerson: options.isPerson,
		}

		// Map each token to `entity`.
		for (var t = 0; t < entityTokensLen; ++t) {
			var token = entityTokens[t]
			var entityInstances = exports.entitySets[token] || (exports.entitySets[token] = [])

			// Avoid duplicates when an entity has multiple instances of the same token.
			if (entityInstances.indexOf(entity) === -1) {
				entityInstances.push(entity)
			}
		}
	}

	// Used as a terminal symbol placeholder.
	return categoryName
}