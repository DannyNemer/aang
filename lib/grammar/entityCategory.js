var util = require('../util/util')
var g = require('./grammar')
var grammarUtil = require('./grammarUtil')


/**
 * The map of entity tokens to arrays of entities that contain those tokens.
 *
 * @type {Object.<string, Object[]>}
 */
exports._entitySets = {}

/**
 * The array of entity categories in the grammar. For use by `removeUnusedComponents` to check for unused categories.
 *
 * @type {string[]}
 */
exports.categoryNames = []

/**
 * The map of entity category names names to definition lines (file-path + line-number). For use in error messages.
 *
 * @type {Object.<string, string>}
 */
exports._defLines = {}

// Counter for entity ids.
var entityCount = 0

var entityObjSchema = {
	// The entity's display text.
	display: { type: String, required: true },
	// The synonyms for the entity, all of which are substituted with `display`.
	names: { type: Array, arrayType: [ String ], required: true },
}

/**
 * Creates a new entity category containing the passed entities.
 *
 * @static
 * @param {Object} entityCategory The entity category object.
 * @param {string} entityCategory.name The unique name for entity category.
 * @param {(string|Object)[]} entityCategory.entities The entities to look for in input, defined as either strings or objects with properties `display` (string) and `names` (`string[]`) for entities with multiple names (e.g., "Javascript", "JS").
 * @param {boolean} [entityCategory.isPerson] Specify an instance of this entity category represents a person and can serve as the antecedent for an anaphoric expression (of matching grammatical person-number).
 * @returns {string} Returns the terminal symbol for the category.
 */
var entityCategorySchema = {
	name: { type: String, required: true },
	entities: { type: Array, arrayType: [ String, Object ], required: true },
	isPerson: Boolean,
}

exports.new = function (entityCategory) {
	if (util.illFormedOpts(entityCategorySchema, entityCategory)) {
		throw new Error('Ill-formed entity category')
	}

	var categoryName = '{' + grammarUtil.formatStringForName(entityCategory.name) + '}'

	if (grammarUtil.isDuplicateName(categoryName, exports._defLines, 'entity category')) {
		throw new Error('Duplicate entity category name')
	}

	// Check for duplicate and ill-formed entities within this category. Throw an exception if found.
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
				addEntity({
					displayText: newEntity.display,
					name: entityNames[n],
					id: entityId,
					categoryName: categoryName,
					isPerson: entityCategory.isPerson,
					ambigUniTokenAliases: getAmbigUniTokenAliases(entityNames, n),
					hasAmbigMultiTokenAlias: hasAmbigMultiTokenAlias(entityNames, n),
				})
			}
		} else {
			addEntity({
				displayText: newEntity,
				name: newEntity,
				id: entityId,
				categoryName: categoryName,
				isPerson: entityCategory.isPerson,
			})
		}
	}

	// Save instantiation file path and line number for error reporting.
	exports._defLines[categoryName] = util.getModuleCallerLocation()

	// Save category name for checking for unused entity categories in `removeUnusedComponents`.
	exports.categoryNames.push(categoryName)

	// Used as a terminal symbol placeholder.
	return categoryName
}

/**
 * Adds an entity with the provided properties.
 *
 * @private
 * @static
 * @param {Object} options The options object.
 * @param {string} options.displayText The entity's display text (with correct capitalization).
 * @param {string} options.name The entity's name to match in input and replace with `displayText` (though may be identical).
 * @param {string} options.id The unique entity id.
 * @param {string} options.categoryName The entity category.
 * @param {boolean} [options.isPerson] Specify this entity represents a person and can serve as the antecedent for an anaphoric expression (of matching grammatical person-number).
 * @param [string[]] [options.ambigUniTokenAliases] The uni-token aliases of the same `id` (with a different `name`) that this multi-token `name` contains.
 * @param {boolean} [options.hasAmbigMultiTokenAlias] Specify `name` is multi-token and shares a token with another multi-token name for the same `id`.
 */

var entitySchema = {
	// The entity's display text (with correct capitalization).
	displayText: { type: String, required: true },
	// The entity's name to match in input and replace with `displayText` (though may be identical).
	name: { type: String, required: true },
	// The unique entity id.
	id: { type: String, required: true },
	// The entity category.
	categoryName: { type: String, required: true },
	// Specify this entity represents a person and can serve as the antecedent for an anaphoric expression (of matching grammatical person-number).
	isPerson: Boolean,
	// The uni-token aliases of the same `id` (with a different `name`) that this multi-token `name` contains. This instructs `matchTerminalRules` to not add parse nodes for single-token matches to these tokens for this entity object because there must also be a match to the uni-token alias of the same token for the same entity (which has already been added). This does not prevent matches across the full `name`.
	ambigUniTokenAliases: { type: Array, arrayType: String },
	// Specify `name` is multi-token and shares a token with another multi-token name for the same `id`. This instructs `matchTerminalRules` to check for multiple matches to the same entity id via different aliases over the same token span, and thereby avoid ambiguity.
	hasAmbigMultiTokenAlias: Boolean,
}

function addEntity(options) {
	if (util.illFormedOpts(entitySchema, options, true)) {
		throw new Error('Ill-formed entity')
	}

	// Tokenize entity name to enable partial entity matches, deletables within entities, and out of order token matches. Sort tokens alphabetically to prevent multiple input matches to the same token index.
	var nameTokens = tokenizeEntityName(options.name)
	var nameTokensLen = nameTokens.length

	var entity = {
		// The display text (with correct capitalization).
		text: options.displayText,
		// The name tokens (can be different than `text`) sorted alphabetically.
		tokens: nameTokens,
		// The number of tokens.
		size: nameTokensLen,
		// The entity category.
		category: options.categoryName,
		// The unique identifier. Saved as a string for semantic arguments sorting.
		id: options.id,
		// Note: It is likely both of the following two properties introduce overhead that should be avoided given the obscurity of the edge cases they prevent, and that it would be better to have `Parser` and `pfsearch` absorb additional load, and allowing `pfsearch` to catch the ambiguity at the end.
		// Note: Both of the following to properties can be improved by making entity objects unique for each token that maps to it, thereby specifying whether each entity match has the token that will be ambiguous, instead of checking every instance of the entity. This requires removing the operation in `initEntities` that replaces multiple instances of the same object with pointers to the same object, and instead accomplishing the same with the `tokens` array. This additional complexity is excessive for such a rare edge case.
		// Specify `name` is multi-token and shares a token with another multi-token name for the same `id`. This instructs `matchTerminalRules` to check for multiple matches to the same entity id via different aliases over the same token span, and thereby avoid ambiguity.
		hasAmbigMultiTokenAlias: options.hasAmbigMultiTokenAlias,
		// The uni-token aliases of the same `id` (with a different `name`) that this multi-token `name` contains. This instructs `matchTerminalRules` to not add parse nodes for single-token matches to these tokens for this entity object because there must also be a match to the uni-token alias of the same token for the same entity (which has already been added).
		// `undefined` if none exist to avoid invoking `indexOf()` for every multi-token entity match (on empty arrays), given this is such a rare case.
		ambigUniTokenAliases: options.ambigUniTokenAliases,
	}

	if (options.isPerson) {
		// The grammatical person-number property to assign to the semantic argument created from this entity (when matched in input), with which to resolve anaphora in `pfsearch`.
		entity.anaphoraPersonNumber = 'threeSg'
	}

	// Map each token to `entity`.
	for (var t = 0; t < nameTokensLen; ++t) {
		var token = nameTokens[t]
		var entityInstances = exports._entitySets[token] || (exports._entitySets[token] = [])

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
 * Gets the uni-token names in `entityNames` that the multi-token name at `entityIdx` contains, if any.
 *
 * These tokens instruct `Parser.prototype.addMultiTokenEntityNodes()` in `matchTerminalRules` to avoid adding a parse node for a single-token entity match via a token for which a uni-token alias for the same entity exists and a parse node was already added. I.e., avoids multiple matches for the same entity (id and display) via different names/aliases over the same one-token span.
 *
 * A single-token match to a multi-token entity name for a token returned by this function will not be added to the parse forest, but only kept for merging with adjacent matches to the same entity name (to form a multi-token match), because the ambiguous uni-token alias will be cheapest.
 *
 * E.g., a match to "Iroh" can be for either the alias "Iroh" or "General Iroh", both of which map to "Iroh". The single-token match to "Iroh" for the name "General Iroh" must be kept to check for an adjacent match to "General", but no node will added for the match to only "Iroh" for this name's entity object.
 *
 * This property supplements `hasAmbigMultiTokenAlias`, which only checks for possible ambiguous matches with other multi-token names because `Parser.prototype.addMultiTokenEntityNodes()` does not have access to the uni-token entity matches to check for ambiguity.
 *
 * Note: It is likely the overhead from this additional check for this rare edge case is more detrimental to performance than having `Parser` and `pfsearch` absorb additional load, and allowing `pfsearch` to catch the ambiguity at the end.
 *
 * @private
 * @static
 * @param {string[]} entityNames The entity names to check for potentially ambiguous uni-token aliases.
 * @param {number} entityIdx The index of the name within `entityNames` to compare.
 * @returns {string[]|undefined} Returns an array the uni-token entity names in `entityNames` that the multi-token name at `entityIdx` contains, else `undefined`.
 */
function getAmbigUniTokenAliases(entityNames, entityIdx) {
	var nameTokens = tokenizeEntityName(entityNames[entityIdx])
	var ambigUniTokenAliases = []

	// Check if the specified entity name is multi-token and contains a token used by a uti-token name within `entityNames`.
	if (nameTokens.length > 1) {
		for (var o = 0, entityNamesLen = entityNames.length; o < entityNamesLen; ++o) {
			if (entityIdx === o) continue

			var otherNameTokens = tokenizeEntityName(entityNames[o])
			if (otherNameTokens.length === 1) {
				var uniTokenAlias = otherNameTokens[0]
				if (nameTokens.indexOf(uniTokenAlias) !== -1) {
					ambigUniTokenAliases.push(uniTokenAlias)
				}
			}
		}
	}

	// Return `undefined` if there are no ambiguous uni-token aliases to avoid invoking `indexOf()` for every multi-token entity match (on empty arrays), given this is such a rare case.
	if (ambigUniTokenAliases.length > 0) {
		return ambigUniTokenAliases
	}
}

/**
 * Checks if the entity name at index `entityIdx` in `entityNames` is multi-token and shares a token with another multi-token name within `entityNames`.
 *
 * This value `Parser.prototype.addMultiTokenEntityNodes()` in `matchTerminalRules` to avoid adding multiple parse nodes for entity matches to different entity names/aliases for the same entity (id) over the same token span.
 *
 * E.g., a match to "Alan" can be for either the alias "Alan Kay" or "Alan Curtis", both of which map to "Alan Kay".
 *
 * This only checks multi-token names because only multi-token names are added in `Parser.prototype.addMultiTokenEntityNodes()`, which does not have access to the uni-token entity matches to check for ambiguity.
 *
 * Note: It is likely the overhead from this additional check for this rare edge case is more detrimental to performance than having `Parser` and `pfsearch` absorb additional load, and allowing `pfsearch` to catch the ambiguity at the end.
 *
 * @private
 * @static
 * @param {string[]} entityNames The entity names to check for potentially ambiguous multi-token aliases.
 * @param {number} entityIdx The index of the name within `entityNames` to compare.
 * @returns {boolean|undefined} Returns `true` if the name at index `entityIdx` within `entityNames` shares a token with another multi-token name within `entityNames` and can lead to ambiguous, multiple matches for the same entity via aliases, else `undefined`.
 */
function hasAmbigMultiTokenAlias(entityNames, entityIdx) {
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
 * Sorts entity tokens (the keys in the map `_entitySets`) alphabetically and the entities for each token alphabetically.
 *
 * Sorts entities for each token alphabetically by display text so that parse trees with entity matches to the same input token and with the same match cost are sorted alphabetically when output.
 *
 * `grammar.sortGrammar()` invokes this method at the end of grammar generation.
 *
 * @static
 */
exports.sortEntities = function () {
	Object.keys(exports._entitySets).sort().forEach(function (entityToken) {
		// Sort entities with `entityToken` alphabetically by display text and then by name tokens (which can differ).
		// Sort by display text first so that parse trees with entity matches to the same input token and with the same match cost are sorted alphabetically when output.
		var entities = exports._entitySets[entityToken].sort(function (entityA, entityB) {
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
		delete exports._entitySets[entityToken]
		exports._entitySets[entityToken] = entities
	})
}