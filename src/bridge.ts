export type AppBridgeInvokeContext = 'exists' | 'get' | 'set' | 'invoke';

export type AppBridgeEmit = (name: string, data?: unknown) => void;

export type AppBridgeReplyStatus = 'ok' | 'error';

export type AppBridgeReply = (status: AppBridgeReplyStatus, reason: unknown) => void;

export type AppBridgeResponse = {id: number | string, status: AppBridgeReplyStatus, result: unknown};

export type AppBridgeInvoke = (reply: AppBridgeReply, path: string, context: AppBridgeInvokeContext, args: unknown[]) => void;

export type AppBridgeEventHandler = (data?: unknown) => void;

export interface AppBridgeProperty {
    path: string,
    type: 'function' | 'property',
    value?: unknown,
    get?: () => unknown,
    set?: (value: unknown) => unknown
};

export interface AppBridgeDetails {
    appBridge: AppBridge;
    emit: AppBridgeEmit;
    invoke: AppBridgeInvoke
};

export interface AppBridge {

    /** Adds an event listener
     * @param {string} name - Event name to listen for
     * @param {AppBridgeEventHandler} handler - Handler to call when the event is emitted
     * @param {boolean} [once=false] - If true the handler will be removed the next time the event is emitted
     * @returns
     */
    on: (name: string, handler: AppBridgeEventHandler, once?: boolean) => void;

    /** Adds an event listener that is removed after the next time the event is emitted
     * @param name - Event name to listen for
     * @param handler  - Handler to call when the event is emitted
     * @returns
     */
    once: (name: string, handler: AppBridgeEventHandler) => void;

    /** Removes an event listener
     * @param {string} name - Event name to remove the handler from
     * @param {AppBridgeEventHandler} handler - Handler that was used when the event listener was registered
     * @param {boolean} [once=false] - once value used when the handler was registered
     * @returns
     */
    off: (name: string, handler: AppBridgeEventHandler, once?: boolean) => void;

    /** Removes all event listeners from the instance
     * @param {string} [name] - If specified, all event emitters for the specified event name are removed
     * @returns
     */
    offAll: (name?: string) => void;

    /** Registers a property/function that can be accessed by the other context's process
     *
     * @param {AppBridgeProperty} definition
     * @returns
     */
    register: (definition: AppBridgeProperty) => void;

    /** Checks if a property/function has been registered on the other context's process
     *
     * @param {string} path - Path of the property/function to check
     * @returns {Promise<boolean>}
     */
    exists: (path: string) => Promise<boolean>;

    /** Gets a property's value that has been registered on the other context's process
     * @param {string} path - Path of the registered property
     * @returns {Promise<any>}
     */
    get: <T>(path: string) => Promise<T>;

    /** Sets a property's value that has been registered on the other context's process
     * @param {string} path - Path of the registered property
     * @param {any} value - The value to set the property to
     * @returns {Promise<any>} - The new value for the property
     */
    set: <T>(path: string, value: T) => Promise<T>;

    /** Invokes a function that has been registered on the other context's process
     * @param {string} path - Path of the registered function
     * @param {any[]} args - Args to pass as parameters to the function
     * @returns {Promise<any>}
     */
    invoke: <T>(path: string, ...args: unknown[]) => Promise<T>;

    /** Emits an event on the the other context's process
     * @param {string} name - The event to emit
     * @param {unknown} [data] - Data to be emitted with the event
     * @returns {any}
     */
    emit: (name: string, data?: unknown) => void;

    /** Registers emit and invoke functions for the instance
     * @param {AppBridgeEmit} emit - Function to handle emitting events
     * @param {AppBridgeInvoke} invoke - Function to handle invocations
     * @returns {AppBridgeDetails}
     */
    hook: (emit: AppBridgeEmit, invoke: AppBridgeInvoke) => AppBridgeDetails;

    /** Unregisters the currently registered emit and invoke function
     * @returns
     */
    unhook: () => void;
};

const hasOwnProperty = Object.prototype.hasOwnProperty;
const has = (subject: unknown, property: string) => subject != null && hasOwnProperty.call(subject, property);

const toStr = (subject: unknown, name?: string) : string => {
    if (typeof subject !== 'string' && !(subject instanceof String)) {
        throw new Error(`'${name || 'value'}' argument must be a string`);
    }
    return '' + subject;
};

export default function() : AppBridgeDetails {
    let hooked = false;
    let hookedEmit : undefined | AppBridgeEmit;
    let hookedInvoke : undefined | AppBridgeInvoke;

    let eventListeners: Record<string, { handler: AppBridgeEventHandler, once: boolean }[]> = {};

    const properties: Record<string, { type: 'property' | 'function', get: () => unknown, set?: (value: unknown) => unknown }> = {};

    let pendingInvokes : (() => void)[] = [];

    const addEventListener = (name: string, handler: AppBridgeEventHandler, once = false) : void => {
        name = toStr(name, 'name');
        if (typeof handler !== 'function') {
            throw new Error("'handler' must be a function");
        }
        if (once != null && typeof once != 'boolean' && !(<unknown>once instanceof Boolean)) {
            throw new Error("'once' must be boolean when specified");
        }
        once = once == true;
        if (!has(eventListeners, name) || eventListeners[name] == null || eventListeners[name].length === 0) {
            eventListeners[name] = [{handler, once}];
        } else {
            eventListeners[name].unshift({handler, once});
        }
    };
    const selfEmit : AppBridgeEmit = (name: string, data?: unknown) : void => {
        name = toStr(name, 'name');

        if (!has(eventListeners, name) || eventListeners[name] == null) {
            return;
        }
        const listeners = eventListeners[name];

        if (listeners.length === 0) {
            delete eventListeners[name];
            return;
        }

        let idx = listeners.length;
        while (idx) {
            idx -= 1;
            const { handler, once } = listeners[idx];

            if (once) {
                listeners.splice(idx, 1);
            }
            setTimeout(() => handler(data), 0);
        }
        if (listeners.length === 0) {
            delete eventListeners[name];
        }
    };
    const selfInvoke : AppBridgeInvoke = (reply: AppBridgeReply, path: string, context: AppBridgeInvokeContext, args: unknown[]) : void => {
        if (typeof path !== 'string' && !(<unknown>path instanceof String)) {
            return reply('error', "'path' argument must be a string");
        }
        if (context !== 'exists' && context !== 'get' && context !== 'set' && context !== 'invoke') {
            return reply('error', "'context' argument must be 'exists' or 'get' or 'set' or 'invoke");
        }
        if (args != null && !Array.isArray(args)) {
            return reply('error', "'args' argument must be an array when specified");
        }
        const exists = has(properties, path) && properties[path] != null;
        if (context === 'exists') {
            return reply('ok', exists);
        }
        if (!exists) {
            return reply('error', `'${path}' is not defined`);
        }

        const entry = properties[path];

        let res : unknown;
        if (entry.type === 'function') {
            if (context !== 'invoke') {
                return reply('error', `'${path}' is a function`);
            }
            res = (<(...args: unknown[]) => unknown>entry.get())(...args);

        } else if (context === 'invoke') {
            return reply('error', `'${path}' is a non-invocable property`);
        } else if (context === 'get') {
            res = entry.get();
        } else if (has(entry, 'set') && typeof entry.set === 'function') {
            res = entry.set(args[0]);
        } else {
            return reply('error', `'${path}' is not settable`);
        }

        if (res instanceof Error) {
            return reply('error', res.message);
        }
        if (!(res instanceof Promise)) {
            return reply('ok', res);
        }

        res
            .then(
                result => reply('ok', result),
                reason => reply('error', reason instanceof Error ? reason.message : reason)
            )
            .catch(error => reply('error', error instanceof Error ? error.message : error));
    };

    const sendInvoke = <T>(path: string, context: AppBridgeInvokeContext, args: unknown[]) : Promise<T> => {
        if (!hooked || hookedInvoke == null) {
            hooked = false;
            hookedEmit = undefined;
            hookedInvoke = undefined;
            return Promise.reject(new Error('appBridge isn\'t hooked'));
        }
        let invokeFnc : null | AppBridgeInvoke = hookedInvoke;
        return new Promise<T>((resolve, reject) => {
            if (invokeFnc == null || invokeFnc !== hookedInvoke ) {
                invokeFnc = null;
                reject('appbridge was unhooked');
                return;
            }
            let pending = true;
            const doEnd = () => {
                pending = false;
                invokeFnc = null;
                reject('appbridge was unhooked');
            };
            pendingInvokes.push(doEnd);

            const reply = (status: AppBridgeReplyStatus, result: unknown) : void => {
                const idx = pendingInvokes.findIndex((ender : () => void ) => ender === doEnd);
                if (idx > -1) {
                    pendingInvokes.splice(idx, 1);
                }
                if (!pending) {
                    pending = false;
                    invokeFnc = null;
                } else if (status === 'ok') {
                    resolve(<T>result);
                } else {
                    reject(result instanceof Error ? result.message : <T>result);
                }
            };

            invokeFnc(reply, path, context, args);
        });
    };

    const propBase = { writable: false, configurable: false, enumerable: true };
    const appBridge : AppBridge = Object.freeze(Object.create(null, {
        on: {
            ...propBase,
            value: addEventListener
        },
        once: {
            ...propBase,
            value: (name: string, handler: AppBridgeEventHandler) : void => {
                addEventListener(name, handler, true);
            }
        },
        off: {
            ...propBase,
            value: (name: string, handler: AppBridgeEventHandler, once = false) : void => {
                name = toStr(name, 'name');
                if (typeof handler !== 'function') {
                    throw new Error("'handler' must be a function");
                }
                if (once != null && typeof once != 'boolean' && !(<unknown>once instanceof Boolean)) {
                    throw new Error("'once' must be boolean when specified");
                }
                once = once == true;

                if (!has(eventListeners, name) || eventListeners[name] == null) {
                    return;
                }
                const listeners = eventListeners[name];
                if (listeners.length === 0) {
                    delete eventListeners[name];
                    return;
                }

                for (let idx = 0, len = listeners.length; idx < len; idx += 1) {
                    const { handler: lHandler, once: lOnce} = listeners[idx];
                    if (handler === lHandler && once === lOnce) {
                        if (listeners.length === 1) {
                            delete eventListeners[name];
                        } else {
                            listeners.splice(idx, 1);
                        }
                        break;
                    }
                }
            }
        },
        offAll: {
            ...propBase,
            value: (name?: string) : void => {
                if (name == null) {
                    eventListeners = {};
                    return;
                }
                name = toStr(name, 'name');
                if (!has(eventListeners, name)) {
                    return;
                }
                delete eventListeners[name];
            }
        },
        emit: {
            ...propBase,
            value: (name: string, data?: unknown) : void => {
                if (hooked == false || hookedEmit == null) {
                    hooked = false;
                    hookedEmit = undefined;
                    hookedInvoke = undefined;
                    throw new Error('appbridge isn\'t hooked');
                }
                name = toStr(name, 'name');
                hookedEmit(name, data);
            }
        },
        exists: {
            ...propBase,
            value: <T>(path: string) : Promise<T> => sendInvoke(path, 'exists', [])
        },
        get: {
            ...propBase,
            value: <T>(path: string) : Promise<T> => sendInvoke(path, 'get', [])
        },
        set: {
            ...propBase,
            value: <T>(path: string, value?: unknown) : Promise<T> => sendInvoke(path, 'set', [value])
        },
        invoke: {
            ...propBase,
            value: <T>(path: string, ...args: unknown[]) : Promise<T> => sendInvoke(path, 'invoke', args)
        },
        register: {
            ...propBase,
            value: (definition: AppBridgeProperty) : void => {
                if (definition == null) {
                    throw new Error('invalid definition');
                }
                const path = toStr(definition.path, 'path'),
                    { type, value, get, set } = definition,
                    strType = toStr(type, 'type');

                if (has(properties, path) && properties[path] != null) {
                    throw new Error(`'${path}' already registered`);

                } else if (strType === 'function') {
                    if (typeof value !== 'function') {
                        throw new Error("'value' must be a function when type is 'function'");
                    }
                    properties[path] = {
                        type: 'function',
                        get: () => value
                    };

                } else if (strType !== 'property') {
                    throw new Error(`'${strType}' must either be 'property' or 'function'`);

                } else if (set != null) {
                    if (typeof set !== 'function') {
                        throw new Error("'set' must be a function when specified");
                    }
                    if (get == null) {
                        throw new Error("'get' must be specified with 'set' is specified");
                    }
                    if (typeof get !== 'function') {
                        throw new Error("'get' must be a function when specified");
                    }
                    if (value !== undefined) {
                        throw new Error("cannot specify 'value' and 'get'");
                    }
                    properties[path] = {
                        type: 'property',
                        get,
                        set
                    };
                } else if (get != null) {
                    if (typeof get !== 'function') {
                        throw new Error("'get' must be a function when specified");
                    }
                    if (value !== undefined) {
                        throw new Error("cannot specify 'value' and 'get'");
                    }
                    properties[path] = {
                        type: 'property',
                        get
                    };
                } else if (value !== undefined) {
                    properties[path] = {
                        type: 'property',
                        get: () => value
                    };
                } else {
                    throw new Error('invalid definition');
                }
            }
        },
        hook: {
            ...propBase,
            value: (emit: AppBridgeEmit, invoke: AppBridgeInvoke) => {
                if (hooked) {
                    throw new Error('appbridge is currently hooked');
                }
                hooked = true;
                hookedEmit = emit;
                hookedInvoke = invoke;

                return { appBridge, emit: selfEmit, invoke: selfInvoke };
            }
        },
        unhook: {
            ...propBase,
            value: () : void => {
                pendingInvokes.forEach(value => value());
                pendingInvokes = [];
                hookedEmit = undefined;
                hookedInvoke = undefined;
                hooked = false;
            }
        }
    }));

    return { appBridge, emit: selfEmit, invoke: selfInvoke };
};