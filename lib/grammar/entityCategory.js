var util = require('../util/util')
var g = require('./grammar')
var stringUtil = require('./stringUtil')


// The map of entity tokens to entities.
exports.entitySets = {}
// A map of entity category names to creation lines; used for error reporting.
exports.creationLines = {}
// Counter for entity ids.
var entityCount = 0

var entityObjSchema = {
	// The entity's display text.
	display: { type: String, required: true },
	// The synonyms for the entity, all of which are substituted by `display`.
	names: { type: Array, arrayType: [ String ], required: true }
}

/**
 * Creates a new entity category containing the passed entities.
 *
 * @static
 * @param {Object} entityCategory The entity category object.
 * @param {string} entityCategory.name The unique name for entity category.
 * @param {(string|Object)[]} entityCategory.entities The entities to look for in input, defined as either strings or objects with properties `display` (string) and `names` (`string[]`) for entities with multiple names (e.g., "Javascript", "JS").
 * @param {boolean} [entityCategory.isPerson=false] Specify an instance of this entity category represents a person and can serve as the antecedent for an anaphoric expression (of matching grammatical person-number).
 * @returns {string} Returns the terminal symbol for the category.
 */
var entityCategorySchema = {
	// The unique name for entity category.
	name: { type: String, required: true },
	// The entities to look for in input, defined as either strings or objects with properties `display` (string) and `names` (`string[]`) for entities with multiple names (e.g., "JavaScript", "JS").
	entities: { type: Array, arrayType: [ String, Object ], required: true },
	// Specify an instance of this entity category represents a person and can serve as the antecedent for an anaphoric expression (of matching grammatical person-number).
	isPerson: Boolean,
}

exports.new = function (entityCategory) {
	if (util.illFormedOpts(entityCategorySchema, entityCategory)) {
		throw new Error('Ill-formed entity category')
	}

	var categoryName = '{' + stringUtil.formatStringForName(entityCategory.name) + '}'

	if (exports.creationLines.hasOwnProperty(categoryName)) {
		util.logErrorAndPath('Duplicate entity category name:', categoryName)
		throw new Error('Duplicate entity category name')
	}

	// Check for duplicate and ill-formed entities within this category.
	checkEntityCategory(entityCategory, categoryName)

	// Add entities.
	var newEntities = entityCategory.entities
	for (var e = 0, newEntitiesLen = newEntities.length; e < newEntitiesLen; ++e) {
		var newEntity = newEntities[e]
		var entityId = String(entityCount++)

		if (newEntity.constructor === Object) {
			// Add multiple instances of the same entity (with the same display text) for each of its names.
			var entityNames = newEntity.names
			for (var n = 0, entityNamesLen = entityNames.length; n < entityNamesLen; ++n) {
				addEntity(newEntity.display, entityNames[n], entityId, categoryName, entityCategory.isPerson, hasAmbiguousMultiTokenAlias(entityNames, n))
			}
		} else {
			addEntity(newEntity, newEntity, entityId, categoryName, entityCategory.isPerson)
		}
	}

	// Save instantiation file path and line number for error reporting.
	exports.creationLines[categoryName] = util.getModuleCallerPathAndLineNumber()

	// Used as a terminal symbol placeholder.
	return categoryName
}

/**
 * Adds an entity with the provided properties.
 *
 * @private
 * @static
 * @param {string} displayText The entity's display text (with correct capitalization).
 * @param {string} name The entity's name to match in input and replace with `displayText` (though may be identical).
 * @param {string} id The entity id.
 * @param {string} categoryName The entity category.
 * @param {boolean} isPerson Specify this entity represents a person and can serve as the antecedent for an anaphoric expression (of matching grammatical person-number).
 * @param {boolean} [hasAmbiguousMultiTokenAlias] Specify `name` is multi-token and shares a token with another multi-token name for the same `id`. This instructs `matchTerminalRules` to check for multiple matches to the same entity id via different aliases over the same token span, and thereby avoid ambiguity.
 */
function addEntity(displayText, name, id, categoryName, isPerson, hasAmbiguousMultiTokenAlias) {
	// Tokenize entity name to enable partial entity matches, deletables within entities, and out of order token matches. Sort tokens alphabetically to prevent multiple input matches to the same token index.
	var nameTokens = tokenizeEntityName(name)
	var nameTokensLen = nameTokens.length

	var entity = {
		// The display text (with correct capitalization).
		text: displayText,
		// The name tokens (can be different than `text`) sorted alphabetically.
		tokens: nameTokens,
		// The number of tokens.
		size: nameTokensLen,
		// The entity category.
		category: categoryName,
		// The unique identifier. Saved as a string for semantic arguments sorting.
		id: id,
		// Specify `name` is multi-token and shares a token with another multi-token name for the same `id`. This instructs `matchTerminalRules` to check for multiple matches to the same entity id via different aliases over the same token span, and thereby avoid ambiguity.
		hasAmbiguousMultiTokenAlias: hasAmbiguousMultiTokenAlias,
	}

	if (isPerson) {
		// The grammatical person-number property to assign to the semantic argument created from this entity (when matched in input), with which to resolve anaphora in `pfsearch`.
		entity.anaphoraPersonNumber = 'threeSg'
	}

	// Map each token to `entity`.
	for (var t = 0; t < nameTokensLen; ++t) {
		var token = nameTokens[t]
		var entityInstances = exports.entitySets[token] || (exports.entitySets[token] = [])

		// Avoid duplicates when an entity has multiple instances of the same token. The same token can map to multiple instances of the same entity (id + display text) when those instances have different names/aliases that contain the same token, in which case `matchTerminalRules` keeps the cheapest match.
		if (entityInstances.indexOf(entity) === -1) {
			entityInstances.push(entity)
		}
	}
}

/**
 * Tokenizes `entityName` to enable partial entity matches, deletables within entities, and out of order token matches. Sorts tokens alphabetically to prevent multiple input matches to the same token index.
 *
 * @private
 * @static
 * @param {string} entityName The entity name to tokenize.
 * @returns {string[]} Returns the array of tokens for `name`.
 */
function tokenizeEntityName(entityName) {
	return entityName.toLowerCase().split(/\s+/).sort()
}

/**
 * Checks if the entity name at index `entityIdx` in `entityNames` is multi-token and shares a token with another multi-token name within `entityNames`. This instructs `Parser.prototype.addMultiTokenEntityNodes()` in `matchTerminalRules` to avoid adding multiple nodes for entity matches to different entity names/aliases for the same entity (id) over the same token span.
 *
 * E.g., a match to "Alan" can be for either the alias "Alan Kay" or "Alan Curtis", both of which map to "Alan Kay".
 *
 * This only checks multi-token names because only multi-token names are added in `Parser.prototype.addMultiTokenEntityNodes()`, which does not have access to the uni-token entity matches to check for ambiguity.
 *
 * @private
 * @static
 * @param {string[]} entityNames The entity names to check for potentially ambiguous multi-token aliases.
 * @param {number} entityIdx The index of the name within `entityNames`
 * @returns {boolean|undefined} Returns `true` if the name at index `entityIdx` within `entityNames` shares a token with another multi-token name within `entityNames` and can lead to ambiguous, multiple matches to the same entity via aliases, else `undefined`.
 */
function hasAmbiguousMultiTokenAlias(entityNames, entityIdx) {
	var nameTokens = tokenizeEntityName(entityNames[entityIdx])
	var nameTokensLen = nameTokens.length

	// Only check multi-token names because only multi-token names are added in `Parser.prototype.addMultiTokenEntityNodes()` and do not have access to the uni-token entity matches to check for ambiguity.
	if (nameTokensLen > 1) {
		for (var o = 0, entityNamesLen = entityNames.length; o < entityNamesLen; ++o) {
			if (entityIdx === o) continue

			var otherNameTokens = tokenizeEntityName(entityNames[o])
			if (otherNameTokens.length > 1) {
				for (var t = 0; t < nameTokensLen; ++t) {
					if (otherNameTokens.indexOf(nameTokens[t]) !== -1) {
						return true
					}
				}
			}
		}
	}
}

/**
 * Checks for duplicate and ill-formed entities within `entityCategory`. Throws an exception if found.
 *
 * @private
 * @static
 * @param {Object} entityCategory The entity category object.
 * @param {string} categoryName The entity category name (stylized for the grammar, unlike `entityCategory.name`).
 */
function checkEntityCategory(entityCategory, categoryName) {
	var newEntities = entityCategory.entities
	for (var i = 0, newEntitiesLen = newEntities.length; i < newEntitiesLen; ++i) {
		var newEntity = newEntities[i]
		var newEntityDisplay

		if (newEntity.constructor === Object) {
			if (util.illFormedOpts(entityObjSchema, newEntity)) {
				throw new Error('Ill-formed entity')
			}

			newEntityDisplay = newEntity.display

			// Check for duplicate names (i.e., synonyms) for the same entity.
			var entityNames = newEntity.names
			for (var n = 0, entityNamesLen = entityNames.length; n < entityNamesLen; ++n) {
				var entityName = entityNames[n]
				var entityNameLowercase = entityName.toLowerCase()

				for (var j = n + 1; j < entityNamesLen; ++j) {
					if (entityNames[j].toLowerCase() === entityNameLowercase) {
						util.logError('Duplicate entity name:', categoryName, '->', newEntityDisplay, '->', util.stylize(entityName))
						util.logPathAndObject(newEntity)
						throw new Error('Duplicate entity name')
					}
				}
			}
		} else {
			newEntityDisplay = newEntity
		}

		// Ensure all display texts are unique. There can be multiple entities with the same name if they have different display text (via substitution).
		var newEntityDisplayLowercase = newEntityDisplay.toLowerCase()
		for (var j = i + 1; j < newEntitiesLen; ++j) {
			var otherEntity = newEntities[j]
			var otherEntityDisplay = otherEntity.constructor === Object ? otherEntity.display : otherEntity

			if (otherEntityDisplay.toLowerCase() === newEntityDisplayLowercase) {
				util.logErrorAndPath('Duplicate entity:', categoryName, '->', i + ': ' + newEntityDisplay + ',', j + ': ' + otherEntityDisplay)
				throw new Error('Duplicate entity')
			}
		}
	}
}

/**
 * Sorts entity tokens (the keys in the map `entitySets`) alphabetically and the entities for each token alphabetically.
 *
 * Sorts entities for each token alphabetically by display text so that parse trees with entity matches to the same input token and with the same match cost are sorted alphabetically when output.
 *
 * `grammar.sortGrammar()` invokes this method at the end of grammar generation.
 *
 * @static
 */
exports.sortEntities = function () {
	Object.keys(exports.entitySets).sort().forEach(function (entityToken) {
		// Sort entities with `entityToken` alphabetically by display text and then by name tokens (which can differ).
		// Sort by display text first so that parse trees with entity matches to the same input token and with the same match cost are sorted alphabetically when output.
		var entities = exports.entitySets[entityToken].sort(function (entityA, entityB) {
			// Sort `entityA` before `entityB`.
			if (entityA.text < entityB.text) return -1

			// Sort `entityA` after `entityB`.
			if (entityA.text > entityB.text) return 1

			// Sort `entityA` before `entityB`.
			if (entityA.tokens < entityB.tokens) return -1

			// Sort `entityA` after `entityB`.
			if (entityA.tokens > entityB.tokens) return 1

			throw new Error('Duplicate entities')
		})

		// Sort entity tokens alphabetically.
		delete exports.entitySets[entityToken]
		exports.entitySets[entityToken] = entities
	})
}