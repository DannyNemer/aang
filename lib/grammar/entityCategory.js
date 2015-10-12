var util = require('../util/util')
var g = require('./grammar')
var stringUtil = require('./stringUtil')


exports.entities = {}
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
var entityCategoryOptionsSchema = {
	// Unique name for entity category.
	name: String,
	// The entities to look for in input.
	entities: { type: Array, arrayType: String },
}

exports.new = function (options) {
	if (util.illFormedOpts(entityCategoryOptionsSchema, options)) {
		throw new Error('Ill-formed entity category')
	}

	var categoryName = '{' + stringUtil.formatName(options.name) + '}'

	if (exports.creationLines.hasOwnProperty(categoryName)) {
		util.logErrorAndPath('Duplicate entity category name:', categoryName)
		throw new Error('Duplicate entity category name')
	}

	// Save instantiation file path and line number for error reporting.
	exports.creationLines[categoryName] = util.getModuleCallerPathAndLineNumber()

	var newEntities = options.entities
	for (var i = 0, newEntitiesLen = newEntities.length; i < newEntitiesLen; ++i) {
		var entity = newEntities[i]
		var entityKey = entity.toLowerCase()

		// Check for duplicate entities within this category.
		for (var j = i + 1; j < newEntitiesLen; ++j) {
			var otherEntity = newEntities[j]
			if (entityKey === otherEntity) {
				util.logErrorAndPath('Duplicate entity:', categoryName, '->', i + ': ' + entity + ',', j + ': ' + otherEntity)
				throw new Error('Duplicate entity')
			}
		}

		var entityInstances = (exports.entities[entityKey] || (exports.entities[entityKey] = []))
		entityInstances.push({
			// Add text to each instance of the entity in a different category in case capitalization differs.
			text: entity,
			category: categoryName,
			// Save id as String for semantic arguments ordering.
			id: String(entityCount++),
		})
	}

	// Used as a terminal symbol placeholder.
	return categoryName
}