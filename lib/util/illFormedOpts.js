/**
 * @license
 * ill-formed-opts 0.0.1 - An options object schema validator for Node.js.
 * Copyright 2015 Danny Nemer
 * Available under MIT license <http://opensource.org/licenses/MIT>
 */

var util = require('./util')

/**
 * Checks if `options` adheres to `schema`, thereby simulating static function arguments (i.e., type checking and parameter count). Prints descriptive, helpful errors messages when `options` is ill-formed, including the line number of the offending function call.
 *
 * @static
 * @param {Object} schema The definition of required and optional properties for `options`.
 * @param {Object} options The options object to check for conformity to `schema`.
 * @returns {boolean} Returns `true` if `options` is ill-formed, else `false`.
 * @example
 *
 * var illFormedOpts = require('ill-formed-opts')
 *
 * var schema = {
 *   // Optionally accept an `boolean` for 'silent'.
 *   silent: Boolean,
 *   // Optionally accept an `Array` of `string`s for 'args'.
 *   args: { type: Array, arrayType: String },
 *   // Require `string` 'modulePath'.
 *   modulePath: { type: String, required: true },
 *   // Optionally accept one of predefined values for 'stdio'.
 *   stdio: { values: [ 'pipe', 'ignore', 0, 1, 2 ] }
 * }
 *
 * function myFork(options) {
 *   if (illFormedOpts(schema, options)) {
 *     // => Prints descriptive, helpful error message
 *
 *     throw new Error('Ill-formed options')
 *   }
 *
 *   // ...stuff...
 * }
 * ```
 * ```js
 * myFork({ modulePath: './myModule.js', stdio: 'out' })
 * // => Prints: Error: Unrecognized value for 'stdio': 'out'
 * //                   Acceptable values for 'stdio': [ 'pipe', 'ignore', 0, 1, 2 ]
 * //
 * //            /Users/Danny/foo.js:22
 * //              { modulePath: './myModule.js', stdio: 'out' }
 * ```
 *
 * **Property names and types:** `schema` is an object where each property name defines an accepted `options` property. Each `schema` property value defines the accepted data type(s) for that property using function constructors (e.g., `Array`, `Object`, `Number`, `MyClassName`):
 *
 * ```js
 * var schema = {
 *   list: Array
 * }
 * // => Optionally accepts the `list` property in `options`, which must be an `Array`.
 * ```
 *
 * When specifying primitive data types (e.g., `string`, `number`, and `boolean`), use their corresponding function constructors even if the passed `options` value is instantiated using literals instead of the constructor (and consequently are complex data types):
 *
 * ```js
 * var schema = {
 *   name: String
 * }
 * // => Accepts primitive type values, `{ name: 'dantil' }`, as well as complex type
 * //    references of the same type, `{ name: String('dantil') }`.
 * ```
 *
 * **Required properties:** To require an `options` property, set the `schema` property to an object defining `type` and `required`:
 *
 * ```js
 * var schema = {
 *   port: { type: Number, required: true }
 *   // => Requires `options` with the property `port`.
 * }
 * ```
 *
 * **Variadic types:** To accept varying types for an `options` property, set the `schema` property to an object defining `type` as an array of function constructors:
 *
 * ```js
 * var schema = {
 *    count: { type: [ Number, String ] },
 *    // => Accepts values for `count` of type `Number` or `String`.
 *    name: { type: [ String ] }
 *    // => Accepts values for `count` of only type `String`.
 *    alias: String,
 *    // => Accepts values for `count` of only type `String` (identical to `name`).
 * }
 * ```
 *
 * **Array element types:** To accept an `Array` containing values of specific type(s), set the `schema` property to an object defining `type` as `Array` and `arrayType` to the function constructor(s):
 *
 * ```js
 * var schema = {
 *   names: { type: Array, arrayType: String },
 *   // => Accepts an `Array` containing elements of type `String` for `names`; e.g.,
 *   //    `{ names: [ 'dantil' ] }`.
 *   paths: { type: Array, arrayType: [ String ] },
 *   // => Behavior identical to `names` property.
 *   values: { type: Array, arrayType: [ Number, String ] }
 *   // => Accepts an `Array` containing elements of type `String` or `Number` for
 *   //    `values`.
 *   elements: { type: Array, arrayType: Object, allowEmpty: true }
 *   // => Accepts an `Array` containing elements of type `Object`, and does not report an
 *   //    an error if the array is empty.
 * }
 * ```
 *
 * **Predifined values:** To only accept values from a predefined set, set the `schema` property to an object defining `values` as an array of the values:
 *
 * ```js
 * var schema = {
 *   fruit: { values: [ 'apple', 'orange', 'pear' ] }
 * }
 * // => Only accepts 'apple', 'orange', or 'pear' as a value for `fruit`; e.g.,
 * //   `{ fruit: 'apple' }`.
 */
function illFormedOpts(schema, options) {
	// Check for unrecognized properties.
	for (var paramName in options) {
		if (!schema.hasOwnProperty(paramName)) {
			util.logError('Unrecognized property:', util.stylize(paramName))
			util.log('Acceptable properties:', schema)
			util.logPathAndObject(options)
			return true
		}
	}

	// Check if missing an options parameter required by schema.
	for (var paramName in schema) {
		var paramSchema = schema[paramName]

		if (paramSchema.required && (!options || !options.hasOwnProperty(paramName))) {
			util.logError('Missing \'' + paramName + '\' property:')
			util.logPathAndObject(options)
			return true
		}
	}

	// Check if passed parameters conform to schema.
	for (var paramName in options) {
		// Stylize parameter name for printed error messages.
		var paramNameQuoted = '\'' + paramName + '\''

		var optsVal = options[paramName]
		var paramSchema = schema[paramName]
		var paramSchemaType = paramSchema.type || paramSchema
		var paramSchemaVals = paramSchema.values

		// Check for properties defined as `undefined` (likely by accident).
		if (optsVal === undefined) {
			util.logError(paramNameQuoted + ' defined as \'undefined\':')
			util.logPathAndObject(options)
			return true
		}

		if (Array.isArray(optsVal)) {
			// Check for empty arrays.
			if (optsVal.length === 0 && !paramSchema.allowEmpty) {
				util.logError('Array ' + paramNameQuoted + ' is empty:')
				util.logPathAndObject(options)
				return true
			}

			// Check for `undefined` values in arrays.
			if (optsVal.indexOf(undefined) !== -1) {
				util.logError('\'undefined\' found in ' + paramNameQuoted + ':')
				util.logPathAndObject(options)
				return true
			}
		}

		if (paramSchemaVals) {
			// Check if passed value is not an acceptable value.
			if (paramSchemaVals.indexOf(optsVal) === -1) {
				util.logError('Unrecognized value for ' + paramNameQuoted + ':', util.stylize(optsVal))
				util.log('       Acceptable values for ' + paramNameQuoted + ':', paramSchemaVals)
				util.logPathAndObject(options)
				return true
			}
		} else if (Array.isArray(paramSchemaType)) {
			// Check if passed value is not of an acceptable type.
			if (paramSchemaType.indexOf(optsVal.constructor) === -1) {
				util.logError('Incorrect type for ' + paramNameQuoted + ':', util.stylize(optsVal))
				util.log('       Acceptable types for ' + paramNameQuoted + ':', concatConstructorNames(paramSchemaType))
				util.logPathAndObject(options)
				return true
			}
		} else {
			// Check if passed value is not of correct type.
			if (optsVal.constructor !== paramSchemaType) {
				util.logError(paramNameQuoted + ' not of type ' + util.colors.cyan(paramSchemaType.name) + ':', typeof optsVal === 'string' ? util.stylize(optsVal) : optsVal)
				util.logPathAndObject(options)
				return true
			}

			// Check if passed Array contains elements not of `arrayType` (if `arrayType` is defined).
			if (Array.isArray(optsVal) && paramSchema.arrayType) {
				var arrayType = paramSchema.arrayType

				if (Array.isArray(arrayType)) {
					for (var i = 0, optsValLen = optsVal.length; i < optsValLen; ++i) {
						var el = optsVal[i]

						if (arrayType.indexOf(el.constructor) === -1) {
							util.logError(paramNameQuoted + ' array contains element of incorrect type:', util.stylize(el))
							util.log('       Acceptable types for elements of ' + paramNameQuoted + ':', concatConstructorNames(arrayType))
							util.logPathAndObject(options)
							return true
						}
					}
				} else {
					for (var i = 0, optsValLen = optsVal.length; i < optsValLen; ++i) {
						var el = optsVal[i]

						if (el.constructor !== arrayType) {
							util.logError(paramNameQuoted + ' array contains element not of type ' + util.colors.cyan(arrayType.name) + ':', util.stylize(el))
							util.logPathAndObject(options)
							return true
						}
					}
				}
			}
		}
	}

	// No errors.
	return false
}

/**
 * Converts `constructors` to a concatenated, stylized string of the constructor names. This is used for error messages.
 *
 * @private
 * @static
 * @param {Function[]} constructors The array of function constructors to convert.
 * @returns {string} Returns the concatenated, stylized string.
 */
function concatConstructorNames(constructors) {
	return constructors.map(function (constructor) {
		return util.colors.cyan(constructor.name)
	}).join(', ')
}

// Export `illFormedOpts`.
module.exports = illFormedOpts