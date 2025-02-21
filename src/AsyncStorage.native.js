/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @flow
 * @jsdoc
 */

'use strict';

import RCTAsyncStorage from './RCTAsyncStorage';

if (!RCTAsyncStorage) {
  throw new Error(`[@RNC/AsyncStorage]: NativeModule: AsyncStorage is null.

To fix this issue try these steps:

  • Run \`react-native link @react-native-async-storage/async-storage\` in the project root.

  • Rebuild and restart the app.

  • Run the packager with \`--reset-cache\` flag.

  • If you are using CocoaPods on iOS, run \`pod install\` in the \`ios\` directory and then rebuild and re-run the app.

  • If this happens while testing with Jest, check out docs how to integrate AsyncStorage with it: https://react-native-async-storage.github.io/async-storage/docs/advanced/jest

If none of these fix the issue, please open an issue on the Github repository: https://github.com/react-native-async-storage/react-native-async-storage/issues
`);
}

type ReadOnlyArrayString = $ReadOnlyArray<string>;

type MultiGetCallbackFunction = (
  errors: ?$ReadOnlyArray<Error>,
  result: ?$ReadOnlyArray<ReadOnlyArrayString>,
) => void;

type MultiRequest = {|
  keys: $ReadOnlyArray<string>,
  callback: ?MultiGetCallbackFunction,
  keyIndex: number,
  resolve: ?(result?: Promise<?$ReadOnlyArray<ReadOnlyArrayString>>) => void,
  reject: ?(error?: any) => void,
|};

function checkValidInput(usedKey: string, value: any) {
  const isValuePassed = arguments.length > 1;

  if (typeof usedKey !== 'string') {
    console.warn(
      `[AsyncStorage] Using ${typeof usedKey} type for key is not supported. This can lead to unexpected behavior/errors. Use string instead.\nKey passed: ${usedKey}\n`,
    );
  }

  if (isValuePassed && typeof value !== 'string') {
    if (value == null) {
      throw new Error(
        `[AsyncStorage] Passing null/undefined as value is not supported. If you want to remove value, Use .removeItem method instead.\nPassed value: ${value}\nPassed key: ${usedKey}\n`,
      );
    } else {
      console.warn(
        `[AsyncStorage] The value for key "${usedKey}" is not a string. This can lead to unexpected behavior/errors. Consider stringifying it.\nPassed value: ${value}\nPassed key: ${usedKey}\n`,
      );
    }
  }
}

function checkValidArgs(keyValuePairs, callback) {
  if (
    !Array.isArray(keyValuePairs) ||
    keyValuePairs.length === 0 ||
    !Array.isArray(keyValuePairs[0])
  ) {
    throw new Error(
      '[AsyncStorage] Expected array of key-value pairs as first argument to multiSet',
    );
  }

  if (callback && typeof callback !== 'function') {
    if (Array.isArray(callback)) {
      throw new Error(
        '[AsyncStorage] Expected function as second argument to multiSet. Did you forget to wrap key-value pairs in an array for the first argument?',
      );
    }

    throw new Error(
      '[AsyncStorage] Expected function as second argument to multiSet',
    );
  }
}

/**
 * `AsyncStorage` is a simple, unencrypted, asynchronous, persistent, key-value
 * storage system that is global to the app.  It should be used instead of
 * LocalStorage.
 *
 * See http://reactnative.dev/docs/asyncstorage.html
 */
const AsyncStorage = {
  _getRequests: ([]: Array<MultiRequest>),
  _getKeys: ([]: Array<string>),
  _immediate: (null: ?number),

  /**
   * Fetches an item for a `key` and invokes a callback upon completion.
   *
   * See http://reactnative.dev/docs/asyncstorage.html#getitem
   */
  getItem: function (
    key: string,
    callback?: ?(error: ?Error, result: string | null) => void,
  ): Promise<string | null> {
    return new Promise((resolve, reject) => {
      checkValidInput(key);
      RCTAsyncStorage.multiGet([key], function (errors, result) {
        // Unpack result to get value from [[key,value]]
        const value = result && result[0] && result[0][1] ? result[0][1] : null;
        const errs = convertErrors(errors);
        callback && callback(errs && errs[0], value);
        if (errs) {
          reject(errs[0]);
        } else {
          resolve(value);
        }
      });
    });
  },

  /**
   * Sets the value for a `key` and invokes a callback upon completion.
   *
   * See http://reactnative.dev/docs/asyncstorage.html#setitem
   */
  setItem: function (
    key: string,
    value: string,
    callback?: ?(error: ?Error) => void,
  ): Promise<null> {
    return new Promise((resolve, reject) => {
      checkValidInput(key, value);
      RCTAsyncStorage.multiSet([[key, value]], function (errors) {
        const errs = convertErrors(errors);
        callback && callback(errs && errs[0]);
        if (errs) {
          reject(errs[0]);
        } else {
          resolve(null);
        }
      });
    });
  },

  /**
   * Removes an item for a `key` and invokes a callback upon completion.
   *
   * See http://reactnative.dev/docs/asyncstorage.html#removeitem
   */
  removeItem: function (
    key: string,
    callback?: ?(error: ?Error) => void,
  ): Promise<null> {
    return new Promise((resolve, reject) => {
      checkValidInput(key);
      RCTAsyncStorage.multiRemove([key], function (errors) {
        const errs = convertErrors(errors);
        callback && callback(errs && errs[0]);
        if (errs) {
          reject(errs[0]);
        } else {
          resolve(null);
        }
      });
    });
  },

  /**
   * Merges an existing `key` value with an input value, assuming both values
   * are stringified JSON.
   *
   * **NOTE:** This is not supported by all native implementations.
   *
   * See http://reactnative.dev/docs/asyncstorage.html#mergeitem
   */
  mergeItem: function (
    key: string,
    value: string,
    callback?: ?(error: ?Error) => void,
  ): Promise<null> {
    return new Promise((resolve, reject) => {
      checkValidInput(key, value);
      RCTAsyncStorage.multiMerge([[key, value]], function (errors) {
        const errs = convertErrors(errors);
        callback && callback(errs && errs[0]);
        if (errs) {
          reject(errs[0]);
        } else {
          resolve(null);
        }
      });
    });
  },

  /**
   * Erases *all* `AsyncStorage` for all clients, libraries, etc. You probably
   * don't want to call this; use `removeItem` or `multiRemove` to clear only
   * your app's keys.
   *
   * See http://reactnative.dev/docs/asyncstorage.html#clear
   */
  clear: function (callback?: ?(error: ?Error) => void): Promise<null> {
    return new Promise((resolve, reject) => {
      RCTAsyncStorage.clear(function (error) {
        const err = convertError(error);
        callback && callback(err);
        if (err) {
          reject(err);
        } else {
          resolve(null);
        }
      });
    });
  },

  /**
   * Gets *all* keys known to your app; for all callers, libraries, etc.
   *
   * See http://reactnative.dev/docs/asyncstorage.html#getallkeys
   */
  getAllKeys: function (
    callback?: ?(error: ?Error, keys: ?ReadOnlyArrayString) => void,
  ): Promise<ReadOnlyArrayString> {
    return new Promise((resolve, reject) => {
      RCTAsyncStorage.getAllKeys(function (error, keys) {
        const err = convertError(error);
        callback && callback(err, keys);
        if (err) {
          reject(err);
        } else {
          resolve(keys);
        }
      });
    });
  },

  /**
   * The following batched functions are useful for executing a lot of
   * operations at once, allowing for native optimizations and provide the
   * convenience of a single callback after all operations are complete.
   *
   * These functions return arrays of errors, potentially one for every key.
   * For key-specific errors, the Error object will have a key property to
   * indicate which key caused the error.
   */

  /**
   * Flushes any pending requests using a single batch call to get the data.
   *
   * See http://reactnative.dev/docs/asyncstorage.html#flushgetrequests
   * */
  flushGetRequests: function (): void {
    const getRequests = this._getRequests;
    const getKeys = this._getKeys;

    this._getRequests = [];
    this._getKeys = [];

    RCTAsyncStorage.multiGet(getKeys, function (errors, result) {
      // Even though the runtime complexity of this is theoretically worse vs if we used a map,
      // it's much, much faster in practice for the data sets we deal with (we avoid
      // allocating result pair arrays). This was heavily benchmarked.
      //
      // Is there a way to avoid using the map but fix the bug in this breaking test?
      // https://github.com/facebook/react-native/commit/8dd8ad76579d7feef34c014d387bf02065692264
      const map = {};
      result &&
        result.forEach(([key, value]) => {
          map[key] = value;
          return value;
        });
      const reqLength = getRequests.length;

      /**
       * As mentioned few lines above, this method could be called with the array of potential error,
       * in case of anything goes wrong. The problem is, if any of the batched calls fails
       * the rest of them would fail too, but the error would be consumed by just one. The rest
       * would simply return `undefined` as their result, rendering false negatives.
       *
       * In order to avoid this situation, in case of any call failing,
       * the rest of them will be rejected as well (with the same error).
       */
      const errorList = convertErrors(errors);
      const error = errorList && errorList.length ? errorList[0] : null;

      for (let i = 0; i < reqLength; i++) {
        const request = getRequests[i];
        if (error) {
          request.callback && request.callback(error);
          request.reject && request.reject(error);
          continue;
        }
        const requestResult = request.keys.map((key) => [key, map[key]]);
        request.callback && request.callback(null, requestResult);
        request.resolve && request.resolve(requestResult);
      }
    });
  },

  /**
   * This allows you to batch the fetching of items given an array of `key`
   * inputs. Your callback will be invoked with an array of corresponding
   * key-value pairs found.
   *
   * See http://reactnative.dev/docs/asyncstorage.html#multiget
   */
  multiGet: function (
    keys: Array<string>,
    callback?: ?MultiGetCallbackFunction,
  ): Promise<?$ReadOnlyArray<ReadOnlyArrayString>> {
    if (!this._immediate) {
      this._immediate = setImmediate(() => {
        this._immediate = null;
        this.flushGetRequests();
      });
    }

    const getRequest: MultiRequest = {
      keys: keys,
      callback: callback,
      // do we need this?
      keyIndex: this._getKeys.length,
      resolve: null,
      reject: null,
    };

    const promiseResult = new Promise((resolve, reject) => {
      getRequest.resolve = resolve;
      getRequest.reject = reject;
    });

    this._getRequests.push(getRequest);
    // avoid fetching duplicates
    keys.forEach((key) => {
      if (this._getKeys.indexOf(key) === -1) {
        this._getKeys.push(key);
      }
    });

    return promiseResult;
  },

  /**
   * Use this as a batch operation for storing multiple key-value pairs. When
   * the operation completes you'll get a single callback with any errors.
   *
   * See http://reactnative.dev/docs/asyncstorage.html#multiset
   */
  multiSet: function (
    keyValuePairs: Array<Array<string>>,
    callback?: ?(errors: ?$ReadOnlyArray<?Error>) => void,
  ): Promise<null> {
    checkValidArgs(keyValuePairs, callback);
    return new Promise((resolve, reject) => {
      keyValuePairs.forEach(([key, value]) => {
        checkValidInput(key, value);
      });

      RCTAsyncStorage.multiSet(keyValuePairs, function (errors) {
        const error = convertErrors(errors);
        callback && callback(error);
        if (error) {
          reject(error);
        } else {
          resolve(null);
        }
      });
    });
  },

  /**
   * Call this to batch the deletion of all keys in the `keys` array.
   *
   * See http://reactnative.dev/docs/asyncstorage.html#multiremove
   */
  multiRemove: function (
    keys: Array<string>,
    callback?: ?(errors: ?$ReadOnlyArray<?Error>) => void,
  ): Promise<null> {
    return new Promise((resolve, reject) => {
      keys.forEach((key) => checkValidInput(key));

      RCTAsyncStorage.multiRemove(keys, function (errors) {
        const error = convertErrors(errors);
        callback && callback(error);
        if (error) {
          reject(error);
        } else {
          resolve(null);
        }
      });
    });
  },

  /**
   * Batch operation to merge in existing and new values for a given set of
   * keys. This assumes that the values are stringified JSON.
   *
   * **NOTE**: This is not supported by all native implementations.
   *
   * See http://reactnative.dev/docs/asyncstorage.html#multimerge
   */
  multiMerge: function (
    keyValuePairs: Array<Array<string>>,
    callback?: ?(errors: ?$ReadOnlyArray<?Error>) => void,
  ): Promise<null> {
    return new Promise((resolve, reject) => {
      RCTAsyncStorage.multiMerge(keyValuePairs, function (errors) {
        const error = convertErrors(errors);
        callback && callback(error);
        if (error) {
          reject(error);
        } else {
          resolve(null);
        }
      });
    });
  },
};

// Not all native implementations support merge.
if (!RCTAsyncStorage.multiMerge) {
  // $FlowFixMe
  delete AsyncStorage.mergeItem;
  // $FlowFixMe
  delete AsyncStorage.multiMerge;
}

function convertErrors(errs): ?$ReadOnlyArray<?Error> {
  if (!errs || (Array.isArray(errs) && errs.length === 0)) {
    return null;
  }
  return (Array.isArray(errs) ? errs : [errs]).map((e) => convertError(e));
}

function convertError(error): ?Error {
  if (!error) {
    return null;
  }
  const out = new Error(error.message);
  // $FlowFixMe: adding custom properties to error.
  out.key = error.key;
  return out;
}

export default AsyncStorage;
