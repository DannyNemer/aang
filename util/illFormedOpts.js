/**
 * @license
 * ill-formed-opts
 * Copyright 2015-2016 Danny Nemer <http://dannynemer.com>
 * Available under MIT license <http://opensource.org/licenses/MIT>
 */

var util = require('./util')

/**
 * Checks if `options` does not adhere to `schema`, thereby simulating static function arguments (i.e., type checking and arity). If ill-formed, prints descriptive, helpful errors (including the file-path + line-number of the offending function call).
 *
 * @name illFormedOpts
 * @static
 * @param {Object} schema The definition of required and optional properties for `options`.
 * @param {Object} [options] The options object to check for conformity to `schema`.
 * @param {Object} [ignoreUndefined] Specify ignoring non-`required` `options` properties defined as `undefined`. Otherwise, reports them as errors, which is useful for catching broken references.
 * @returns {boolean} Returns `true` if `options` is ill-formed, else `false`.
 * @example
 *
 * var illFormedOpts = require('ill-formed-opts')
 *
 * var mySchema = {
 *   // Optionally accept an `boolean` for 'silent'.
 *   silent: Boolean,
 *   // Optionally accept an `Array` of `string`s for 'args'.
 *   args: { type: Array, arrayType: String },
 *   // Require `string` 'modulePath'.
 *   modulePath: { type: String, required: true },
 *   // Optionally accept one of predefined values for 'stdio'.
 *   stdio: { values: [ 'pipe', 'ignore', 0, 1, 2 ] },
 *   // Optionally accept an `Object` that adheres to the nested `schema` object.
 *   options: { type: Object, schema: {
 *     cwd: String,
 *     uid: Number,
 *   } },
 * }
 *
 * function myFork(options) {
 *   if (illFormedOpts(mySchema, options)) {
 *     // => Prints descriptive, helpful error message
 *
 *     throw new Error('Ill-formed options')
 *   }
 *
 *   // ...stuff...
 * }
 * ```
 * The contents of `foo.js`:
 * ```js
 * myFork({ modulePath: './myModule.js', stdio: 'out' })
 * ```
 * Output:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/ill-formed-opts/master/doc/illFormedOpts-example.jpg" alt="illFormedOpts() example output"/>
 *
 * **Property names and types:** `mySchema` is an object where each property name defines an accepted `options` property. Each `mySchema` property value defines the accepted data type(s) for that property using function constructors (e.g., `Array`, `Object`, `Number`, `MyClassName`):
 *
 * ```js
 * var mySchema = {
 *   list: Array,
 *   // => Optionally accepts the `list` property in `options`, which must be an `Array`.
 * }
 * ```
 *
 * When specifying primitive data types (e.g., `string`, `number`, and `boolean`), use their corresponding function constructors even if the passed `options` value is instantiated using literals instead of the constructor (and consequently are complex data types):
 *
 * ```js
 * var mySchema = {
 *   name: String,
 *   // => Accepts primitive type values, `{ name: 'dantil' }`, as well as complex type
 *   //    references of the same type, `{ name: String('dantil') }`.
 * }
 * ```
 *
 * **Required properties:** To require an `options` property, set the `mySchema` property to an object defining `type` and `required`:
 *
 * ```js
 * var mySchema = {
 *   port: { type: Number, required: true },
 *   // => Requires `options` with the property `port`.
 * }
 * ```
 *
 * **Variadic types:** To accept varying types for an `options` property, set the `mySchema` property to an object defining `type` as an array of function constructors:
 *
 * ```js
 * var mySchema = {
 *    count: { type: [ Number, String ] },
 *    // => Accepts values for `count` of type `Number` or `String`.
 *    name: { type: [ String ] },
 *    // => Accepts values for `count` of only type `String`.
 *    alias: String,
 *    // => Accepts values for `count` of only type `String` (identical to `name`).
 * }
 * ```
 *
 * **Array element types:** To accept an `Array` containing values of specific type(s), set the `mySchema` property to an object defining `type` as `Array` and `arrayType` as the function constructor(s):
 *
 * ```js
 * var mySchema = {
 *   names: { type: Array, arrayType: String },
 *   // => Accepts an `Array` containing elements of type `String` for `names`; e.g.,
 *   //    `{ names: [ 'dantil' ] }`.
 *   paths: { type: Array, arrayType: [ String ] },
 *   // => Behavior identical to `names` property.
 *   values: { type: Array, arrayType: [ Number, String ] },
 *   // => Accepts an `Array` containing elements of type `String` or `Number` for
 *   //    `values`.
 *   elements: { type: Array, arrayType: Object, allowEmpty: true },
 *   // => Accepts an `Array` containing elements of type `Object`, and does not report
 *   //    an error if the array is empty.
 * }
 * ```
 *
 * **Predefined values:** To only accept values from a predefined set, set the `mySchema` property to an object defining `values` as an array of the values:
 *
 * ```js
 * var mySchema = {
 *   fruit: { values: [ 'apple', 'orange', 'pear' ] },
 *   // => Only accepts 'apple', 'orange', or 'pear' as a value for `fruit`; e.g.,
 *   //    `{ fruit: 'apple' }`.
 * }
 * ```
 *
 * **Nested object schemas:** To recursively check if a passed `Object` value adhere to a separate, nested schema, set the `mySchema` property to an object defining `type` as `Object` and `schema` as an object following the `options` parameterization:
 *
 * ```js
 * var mySchema = {
 *   childOptions: { type: Object, schema: {
 *     cwd: String,
 *     uid: Number,
 *   } },
 *   // => Recursively checks value for `childOptions` adheres to `schema`.
 * }
 */
module.exports = function (schema, options, ignoreUndefined) {
	// Check if `options` has any property `schema` does not define.
	if (hasUnrecognizedProps(schema, options)) {
		return true
	}

	// Check if `options` is missing any property `schema` requires.
	if (isMissingRequiredProps(schema, options)) {
		return true
	}

	// Check if `options` values conform to `schema`.
	for (var prop in options) {
		var optsVal = options[prop]
		var propSchema = schema[prop]

		// Check if property defined as `undefined` (likely accidentally).
		if (optsVal === undefined) {
			// If `ignoreUndefined`, ignore non-`required` properties defined as `undefined`.
			if (!propSchema.required && ignoreUndefined) {
				continue
			}

			util.logError(`\`${prop}\` defined as \`undefined\`:`)
			util.logPathAndObject(options)
			return true
		} else if (propSchema.constructor === Object && propSchema.values) {
			// Check if passed value is not a predefined, acceptable value.
			// - Check `propSchema` is an `Object` literal to distinguish from the `Object` constructor (denoting a parameter of type `Object`) which has the function `Object.values()`.
			if (isUnrecognizedVal(options, prop, propSchema.values)) {
				return true
			}
		} else {
			// Check if passed value is not of an acceptable type.
			if (isIncorrectType(options, prop, propSchema.type || propSchema)) {
				return true
			}

			// Check if passed array is empty (if `propSchema.allowEmpty` not truthy), contains `undefined`, or contains an element not of `propSchema.arrayType` (if defined).
			if (Array.isArray(optsVal) && isIllFormedArray(options, prop, propSchema)) {
				return true
			}

			if (optsVal.constructor === Object) {
				// Check if passed object is empty with no properties.
				if (isIllFormedObject(options, prop)) {
					return true
				}

				// Recursively check if passed object adheres to nested object schema, `propSchema.schema`, if defined.
				if (propSchema.schema && module.exports(propSchema.schema, optsVal, ignoreUndefined)) {
					return true
				}
			}
		}
	}

	// No errors.
	return false
}

/**
 * Checks if `options` has any property `schema` does not define. If so, prints an error message with `schema` to display the properties it accepts.
 *
 * @private
 * @static
 * @param {Object} schema The definition of required and optional properties for `options`.
 * @param {Object} [options] The options object to inspect.
 * @returns {boolean} Returns `true` if `options` has a property `schema` does not define, else `false`.
 */
function hasUnrecognizedProps(schema, options) {
	for (var prop in options) {
		if (!schema.hasOwnProperty(prop)) {
			util.logError('Unrecognized property:', util.stylize(prop))
			util.log('  Acceptable properties:', schema)
			util.logPathAndObject(options)
			return true
		}
	}

	return false
}

/**
 * Checks if `options` is missing any property `schema` requires. If so, prints an error message with `schema` to display the properties it requires.
 *
 * @private
 * @static
 * @param {Object} schema The definition of required and optional properties for `options`.
 * @param {Object} [options] The options object to inspect.
 * @returns {boolean} Returns `true` if `options` is missing `schema` requires, else `false`.
 */
function isMissingRequiredProps(schema, options) {
	for (var prop in schema) {
		var propSchema = schema[prop]
		if (propSchema.required && (!options || !options.hasOwnProperty(prop))) {
			util.logError('Missing required property:', util.stylize(prop))
			util.log('  Acceptable properties:', schema)
			util.logPathAndObject(options)
			return true
		}
	}

	return false
}

/**
 * Checks if `options[prop]` is not a predefined, acceptable value in `propAcceptableVals`. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} options The options object to inspect.
 * @param {string} prop The `options` property name that defines the value to inspect.
 * @param {*[]} propAcceptableVals The predefined, acceptable values for `options[prop]`.
 * @returns {boolean} Returns `true` if `options[prop]` is not in `propAcceptableVals`, else `false`.
 */
function isUnrecognizedVal(options, prop, propAcceptableVals) {
	var optsVal = options[prop]

	// Check if passed value is not a predefined, acceptable value.
	if (propAcceptableVals.indexOf(optsVal) === -1) {
		util.logError(`Unrecognized value for \`${prop}\`:`, util.stylize(optsVal))
		util.log(`  Acceptable values for \`${prop}\`:`, propAcceptableVals)
		util.logPathAndObject(options)
		return true
	}

	return false
}

/**
 * Checks if `options[prop]` is not of the acceptable type(s), `propType`. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} options The options object to inspect.
 * @param {string} prop The `options` property name that defines the value to inspect.
 * @param {Function|Function[]} propType The acceptable type(s) (constructor(s)) of `options[prop]`.
 * @returns {boolean} Returns `true` if `options[prop]` is not of type(s) `propType`, else `false`.
 */
function isIncorrectType(options, prop, propType) {
	var optsVal = options[prop]
	var propAcceptableTypes = Array.isArray(propType) ? propType : [ propType ]

	if (propAcceptableTypes.indexOf(optsVal.constructor) === -1) {
		util.logError(`Incorrect type for \`${prop}\`:`, util.stylize(optsVal))
		util.log(`  Acceptable types for \`${prop}\`:`, concatConstructorNames(propAcceptableTypes))
		util.logPathAndObject(options)
		return true
	}

	return false
}

/**
 * Checks if the array `options[prop]` is empty (if `propSchema.allowEmpty` is not truthy) or contains `undefined`, or contains an element not of `propSchema.arrayType` (if defined). If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} options The options object to inspect.
 * @param {string} prop The `options` property name that defines the array to inspect.
 * @param {Object} propSchema The schema for `prop`.
 * @returns {boolean} Returns `true` if `options[prop]` is ill-formed, else `false`.
 */
function isIllFormedArray(options, prop, propSchema) {
	var optsArray = options[prop]

	// Check if `optsArray` is empty, if prohibited.
	if (optsArray.length === 0 && !propSchema.allowEmpty) {
		util.logError(`Array \`${prop}\` is empty:`)
		util.logPathAndObject(options)
		return true
	}

	// Check if `optsArray` contains `undefined`.
	if (optsArray.indexOf(undefined) !== -1) {
		util.logError(`\`undefined\` found in array \`${prop}\`:`)
		util.log('  ', optsArray)
		util.logPathAndObject(options)
		return true
	}

	// Check if `optsArray` contains an element not of `arrayType`, if defined.
	if (propSchema.arrayType && isIncorrectTypedArray(options, prop, propSchema.arrayType)) {
		return true
	}

	return false
}

/**
 * Checks if the array `options[prop]` contains an element not of the acceptable type(s), `propArrayType`. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} options The options object to inspect.
 * @param {string} prop The `options` property name that defines the array to inspect.
 * @param {Function|Function[]} propArrayType The acceptable type(s) (constructor(s)) of elements in `options[prop]`.
 * @returns {boolean} Returns `true` if `options[prop]` contains an element not of type(s) `propArrayType`, else `false`.
 */
function isIncorrectTypedArray(options, prop, propArrayType) {
	var optsArray = options[prop]
	var propAcceptableTypes = Array.isArray(propArrayType) ? propArrayType : [ propArrayType ]

	// Check if `optsArray` contains elements not of an acceptable type.
	for (var i = 0, optsArrayLen = optsArray.length; i < optsArrayLen; ++i) {
		var el = optsArray[i]

		if (propAcceptableTypes.indexOf(el.constructor) === -1) {
			util.logError(`\`${prop}\` array contains element of incorrect type:`, util.stylize(el))
			util.log(`  Acceptable types for elements of \`${prop}\`:`, concatConstructorNames(propAcceptableTypes))
			util.logPathAndObject(options)
			return true
		}
	}

	return false
}

/**
 * Checks if the object `options[prop]` is empty with no properties. If so, prints an error.
 *
 * @private
 * @static
 * @param {Object} options The options object to inspect.
 * @param {string} prop The `options` property name that defines the object to inspect.
 * @returns {boolean} Returns `true` if `options[prop]` is ill-formed, else `false`.
 */
function isIllFormedObject(options, prop) {
	var optsObject = options[prop]

	// Check if `optsObject` is empty with no properties.
	if (Object.keys(optsObject).length === 0) {
		util.logError(`Object \`${prop}\` is empty with no properties:`)
		util.logPathAndObject(options)
		return true
	}

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