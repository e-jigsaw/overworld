!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Overworld=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
///<reference path='../typings/bundle.d.ts' />
exports.utils = require('./overworld/utils/utils');
exports.Emittable = require('./overworld/utils/emittable');
exports.Portal = require('./overworld/portal');
exports.Context = require('./overworld/context');
exports.LifeCycle = require('./overworld/lifecycle');
exports.subscriber = function (fn) { return fn; }; // override function type

},{"./overworld/context":3,"./overworld/lifecycle":4,"./overworld/portal":5,"./overworld/utils/emittable":6,"./overworld/utils/utils":7}],2:[function(require,module,exports){
// This class is real Aggregator instance
// but user was given IAggregator
var Aggregator = (function () {
    function Aggregator(aggregator) {
        if (!aggregator.aggregate && aggregator instanceof Function)
            this.aggregator = new aggregator();
        else
            this.aggregator = aggregator;
        if (!this.aggregator.aggregate)
            throw 'aggregate does not defined';
    }
    Aggregator.prototype.callInitState = function (props) {
        if (this.aggregator.initState instanceof Function)
            return this.aggregator.initState(props);
    };
    Aggregator.prototype.callAggregate = function (props, state) {
        return this.aggregator.aggregate(props, state);
    };
    Aggregator.prototype.buildTemplateProps = function (props, forceState) {
        var _this = this;
        return new Promise(function (done) {
            var state = forceState ? forceState : _this.callInitState(props);
            Promise.resolve(state).then(function (nextState) {
                var templateProps = _this.callAggregate(props, nextState);
                Promise.resolve(templateProps).then(function (nextTemplateProps) {
                    done({ props: props, state: nextState, templateProps: nextTemplateProps });
                });
            });
        });
    };
    return Aggregator;
})();
module.exports = Aggregator;

},{}],3:[function(require,module,exports){
var utils = require('./utils/utils');
var Aggregator = require('./aggregator');
var LifeCycle = require('./lifecycle');
var subscribe = function (world) {
    return function (eventName, fn) {
        world.emitter.on(eventName, fn(world, world.props, world.state));
    };
};
var Context = (function () {
    function Context() {
        this._emitter = utils.createEmitter();
        this._build();
    }
    Object.defineProperty(Context.prototype, "emitter", {
        get: function () {
            return this._emitter;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Context.prototype, "props", {
        get: function () {
            return this._props;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Context.prototype, "state", {
        get: function () {
            return this._state;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Context.prototype, "component", {
        get: function () {
            return this._component;
        },
        enumerable: true,
        configurable: true
    });
    Context.prototype.init = function (props, state) {
        this._state = state;
        this._props = props;
    };
    Context.prototype.update = function (updater) {
        var _this = this;
        var state;
        if (updater instanceof Function) {
            state = updater(this._state);
        }
        else if (!updater) {
            state = this._state;
        }
        else {
            state = updater;
        }
        this._state = state;
        var building = this._aggregator.buildTemplateProps(this.props, this.state);
        Promise.resolve(building).then(function (params) {
            _this.injectContextProperties(params.templateProps);
            requestAnimationFrame(function () {
                _this._component.setProps(params.templateProps);
                _this.emitter.emit(LifeCycle.UPDATED);
            });
        });
    };
    Object.defineProperty(Context.prototype, "aggregator", {
        get: function () {
            return this._aggregator;
        },
        enumerable: true,
        configurable: true
    });
    Context.prototype.pause = function () {
        this.emitter.emit(LifeCycle.PAUSED);
    };
    Context.prototype.resume = function () {
        this.emitter.emit(LifeCycle.RESUMED);
    };
    Context.prototype.dispose = function () {
        this.emitter.emit(LifeCycle.DISPOSED);
    };
    Context.prototype.injectContextProperties = function (templateProps) {
        var t = templateProps;
        t.emitter = this._emitter;
        return templateProps;
    };
    Context.prototype.renderTo = function (templateProps, el, component) {
        var _this = this;
        var React = utils.getReact();
        templateProps.emitter = this._emitter;
        this.injectContextProperties(templateProps);
        return new Promise(function (done) {
            if (component) {
                _this._component = component;
                _this._component.setProps(templateProps, function () {
                    done(component);
                });
            }
            else {
                var view = _this.render(templateProps);
                _this._component = React.render(view, el);
                _this.emitter.emit(LifeCycle.MOUNTED);
                done(_this._component);
            }
        });
    };
    Context.prototype.render = function (templateProps) {
        var React = utils.getReact();
        return this._rootElement(templateProps);
    };
    Context.prototype._build = function () {
        var React = utils.getReact();
        var self = this;
        //component
        this._rootElement = React.createFactory(self.constructor.component);
        //aggregator
        var aggregator = self.constructor.aggregator;
        if (aggregator)
            this._aggregator = new Aggregator(aggregator);
        //subscribe
        var subscriber = self.constructor.subscriber;
        if (subscriber) {
            this._subscriber = subscriber;
            this._subscriber(subscribe(this));
        }
    };
    return Context;
})();
module.exports = Context;

},{"./aggregator":2,"./lifecycle":4,"./utils/utils":7}],4:[function(require,module,exports){
var LifeCycle = {
    CREATED: 'lifecycle:created',
    UPDATED: 'lifecycle:updated',
    MOUNTED: 'lifecycle:mounted',
    UNMOUNTED: 'lifecycle:unmounted',
    PAUSED: 'lifecycle:paused',
    RESUMED: 'lifecycle:resumed',
    DISPOSED: 'lifecycle:disposed'
};
module.exports = LifeCycle;

},{}],5:[function(require,module,exports){
var utils = require('./utils/utils');
var LifeCycle = require('./lifecycle');
/*declare class EE {};
var EventEmitter: typeof EE = require('events').EventEmitter;*/
var Portal = (function () {
    function Portal() {
        /*EventEmitter.call(this);*/
        /*super();*/
        this._linkMap = {}; //TODO: valid struct
        this._caches = {};
        this._nodes = [];
        this._cursor = 0;
    }
    Object.defineProperty(Portal.prototype, "activeNode", {
        get: function () {
            return this._nodes[this._cursor];
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Portal.prototype, "activeComponent", {
        get: function () {
            return this._caches[this.activeNode.type].component;
        },
        enumerable: true,
        configurable: true
    });
    Portal.prototype.getActiveEmitter = function () {
        return this.activeNode.instance.emitter;
    };
    Portal.prototype.getActiveContext = function () {
        return this.activeNode.instance;
    };
    Portal.prototype.link = function (name, world) {
        if (this._linkMap[name])
            throw name + ' is already registered';
        this._linkMap[name] = world;
    };
    Portal.prototype.buildLinkNode = function (name, forceCreate) {
        if (forceCreate === void 0) { forceCreate = false; }
        var React = utils.getReact();
        var lastNode = this.activeNode;
        if (lastNode) {
            //TODO: remove all
            lastNode.target.style.display = 'none';
            lastNode.instance.pause();
        }
        // setup caches
        var cache = null;
        var component;
        var target;
        var uuid;
        if (this._caches[name] && !forceCreate) {
            cache = this._caches[name];
            component = this._caches[name].component;
            target = this._caches[name].target;
            uuid = this._caches[name].uuid;
        }
        else {
            component = null;
            target = utils.createContainer();
            uuid = utils.uuid();
            target.className = name + '-' + uuid;
            this.el.appendChild(target);
        }
        if (!this._linkMap[name]) {
            throw name + ' is not linked to any world';
        }
        var node = {
            type: name,
            uuid: utils.uuid(),
            instance: new this._linkMap[name](),
            target: target
        };
        //fooo
        node.instance.emitter.emit(LifeCycle.CREATED);
        return new Promise(function (done) {
            /*this.renderNode(node, props, component).then(()=> done({node:node, cache: cache}))*/
            done({ node: node, cache: cache });
        });
    };
    Portal.prototype.renderNode = function (node, props, component) {
        var _this = this;
        var world = node.instance;
        return new Promise(function (done) {
            world.aggregator.buildTemplateProps(props).then(function (result) {
                // backdoor initializer
                world.init(result.props, result.state);
                world.renderTo(result.templateProps, node.target, component).then(function (mountedComponent) {
                    _this._caches[node.type] = {
                        component: mountedComponent,
                        target: node.target,
                        uuid: node.uuid
                    };
                    node.target.style.display = 'block';
                    done();
                });
            });
        });
    };
    // skip init
    Portal.prototype.resumeNode = function (node) {
        var _this = this;
        var world = node.instance;
        return new Promise(function (done) {
            Promise.resolve(world.aggregator.buildTemplateProps(world.props, world.state)).then(function (templateProps) {
                var component = _this._caches[node.type].component;
                world.renderTo(templateProps, node.target, component).then(function (mountedComponent) {
                    node.target.style.display = 'block';
                    done();
                });
            });
        });
    };
    Portal.prototype.mount = function (el) {
        this.el = el;
    };
    // swap root
    Portal.prototype.transition = function (name, props) {
        var _this = this;
        var lastNode = this.activeNode;
        if (lastNode) {
            //TODO: remove all
            lastNode.target.style.display = 'none';
            lastNode.instance.pause();
        }
        //TODO: dispose correctly
        this._nodes.length = 0;
        return new Promise(function (done) {
            _this.buildLinkNode(name).then(function (nodeWithCache) {
                var node = nodeWithCache.node;
                var component = nodeWithCache.cache ? nodeWithCache.cache.component : null;
                _this._cursor = 0;
                _this._nodes.push(node);
                _this.renderNode(node, props, component).then(done);
            });
        });
    };
    Portal.prototype.pushScene = function (name, props) {
        var _this = this;
        var lastNode = this.activeNode;
        if (lastNode) {
            //TODO: remove all
            lastNode.target.style.display = 'none';
            lastNode.instance.pause();
        }
        return new Promise(function (done) {
            _this.buildLinkNode(name).then(function (nodeWithCache) {
                var node = nodeWithCache.node;
                var component = nodeWithCache.cache ? nodeWithCache.cache.component : null;
                //TODO: fix
                _this._cursor++;
                var focusNode = _this._nodes[_this._cursor];
                if (!focusNode) {
                    // create new node
                    _this._nodes.push(node);
                }
                else if (focusNode.type === name) {
                    // reuse if next instance is same type
                    node = focusNode;
                }
                else {
                    // remove after this and push new node
                    _this._nodes.length = _this._cursor;
                    _this._nodes.push(node);
                }
                _this.renderNode(node, props, component).then(done);
            });
        });
    };
    Portal.prototype.popScene = function (resumeParams) {
        var _this = this;
        if (resumeParams === void 0) { resumeParams = {}; }
        // TODO: cache next node and reuse instance
        var lastNode = this.activeNode;
        if (lastNode) {
            //TODO: remove all
            lastNode.target.style.display = 'none';
            lastNode.instance.pause();
        }
        this._cursor--;
        var node = this._nodes[this._cursor];
        return new Promise(function (done) {
            if (node) {
                _this.resumeNode(node).then(function () {
                    node.instance.resume();
                    done();
                });
            }
            else {
                done();
            }
        });
    };
    Portal.prototype.serialize = function () {
        return this._nodes.map(function (node) { return ({
            props: node.instance.props,
            state: node.instance.state,
            type: node.type
        }); });
    };
    return Portal;
})();
module.exports = Portal;

},{"./lifecycle":4,"./utils/utils":7}],6:[function(require,module,exports){
var Emittable = {
    emit: function (eventName) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var emitter = this.props.emitter;
        if (!emitter) {
            throw 'emitter is undefined';
        }
        emitter.emit.apply(emitter, [eventName].concat(args));
    }
};
module.exports = Emittable;

},{}],7:[function(require,module,exports){
var _react;
var _immutable;
var EventEmitter = require('eventemitter2');
if (EventEmitter.EventEmitter2)
    EventEmitter = EventEmitter.EventEmitter2;
function setReact(react) {
    _react = react;
}
exports.setReact = setReact;
function getReact() {
    if (_react) {
        return _react;
    }
    if (typeof React !== 'undefined') {
        return React;
    }
    else {
        throw 'Overworld cant reach React';
    }
}
exports.getReact = getReact;
function createContainer() {
    if (typeof window === 'object') {
        return window.document.createElement('div');
    }
    else {
        return {};
    }
}
exports.createContainer = createContainer;
function createEmitter() {
    return new EventEmitter();
}
exports.createEmitter = createEmitter;
function uuid() {
    return Date.now().toString() + '-' + (~~(Math.random() * 10000)).toString();
}
exports.uuid = uuid;

},{"eventemitter2":8}],8:[function(require,module,exports){
/*!
 * EventEmitter2
 * https://github.com/hij1nx/EventEmitter2
 *
 * Copyright (c) 2013 hij1nx
 * Licensed under the MIT license.
 */
;!function(undefined) {

  var isArray = Array.isArray ? Array.isArray : function _isArray(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  };
  var defaultMaxListeners = 10;

  function init() {
    this._events = {};
    if (this._conf) {
      configure.call(this, this._conf);
    }
  }

  function configure(conf) {
    if (conf) {

      this._conf = conf;

      conf.delimiter && (this.delimiter = conf.delimiter);
      conf.maxListeners && (this._events.maxListeners = conf.maxListeners);
      conf.wildcard && (this.wildcard = conf.wildcard);
      conf.newListener && (this.newListener = conf.newListener);

      if (this.wildcard) {
        this.listenerTree = {};
      }
    }
  }

  function EventEmitter(conf) {
    this._events = {};
    this.newListener = false;
    configure.call(this, conf);
  }

  //
  // Attention, function return type now is array, always !
  // It has zero elements if no any matches found and one or more
  // elements (leafs) if there are matches
  //
  function searchListenerTree(handlers, type, tree, i) {
    if (!tree) {
      return [];
    }
    var listeners=[], leaf, len, branch, xTree, xxTree, isolatedBranch, endReached,
        typeLength = type.length, currentType = type[i], nextType = type[i+1];
    if (i === typeLength && tree._listeners) {
      //
      // If at the end of the event(s) list and the tree has listeners
      // invoke those listeners.
      //
      if (typeof tree._listeners === 'function') {
        handlers && handlers.push(tree._listeners);
        return [tree];
      } else {
        for (leaf = 0, len = tree._listeners.length; leaf < len; leaf++) {
          handlers && handlers.push(tree._listeners[leaf]);
        }
        return [tree];
      }
    }

    if ((currentType === '*' || currentType === '**') || tree[currentType]) {
      //
      // If the event emitted is '*' at this part
      // or there is a concrete match at this patch
      //
      if (currentType === '*') {
        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+1));
          }
        }
        return listeners;
      } else if(currentType === '**') {
        endReached = (i+1 === typeLength || (i+2 === typeLength && nextType === '*'));
        if(endReached && tree._listeners) {
          // The next element has a _listeners, add it to the handlers.
          listeners = listeners.concat(searchListenerTree(handlers, type, tree, typeLength));
        }

        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            if(branch === '*' || branch === '**') {
              if(tree[branch]._listeners && !endReached) {
                listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], typeLength));
              }
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            } else if(branch === nextType) {
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+2));
            } else {
              // No match on this one, shift into the tree but not in the type array.
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            }
          }
        }
        return listeners;
      }

      listeners = listeners.concat(searchListenerTree(handlers, type, tree[currentType], i+1));
    }

    xTree = tree['*'];
    if (xTree) {
      //
      // If the listener tree will allow any match for this part,
      // then recursively explore all branches of the tree
      //
      searchListenerTree(handlers, type, xTree, i+1);
    }

    xxTree = tree['**'];
    if(xxTree) {
      if(i < typeLength) {
        if(xxTree._listeners) {
          // If we have a listener on a '**', it will catch all, so add its handler.
          searchListenerTree(handlers, type, xxTree, typeLength);
        }

        // Build arrays of matching next branches and others.
        for(branch in xxTree) {
          if(branch !== '_listeners' && xxTree.hasOwnProperty(branch)) {
            if(branch === nextType) {
              // We know the next element will match, so jump twice.
              searchListenerTree(handlers, type, xxTree[branch], i+2);
            } else if(branch === currentType) {
              // Current node matches, move into the tree.
              searchListenerTree(handlers, type, xxTree[branch], i+1);
            } else {
              isolatedBranch = {};
              isolatedBranch[branch] = xxTree[branch];
              searchListenerTree(handlers, type, { '**': isolatedBranch }, i+1);
            }
          }
        }
      } else if(xxTree._listeners) {
        // We have reached the end and still on a '**'
        searchListenerTree(handlers, type, xxTree, typeLength);
      } else if(xxTree['*'] && xxTree['*']._listeners) {
        searchListenerTree(handlers, type, xxTree['*'], typeLength);
      }
    }

    return listeners;
  }

  function growListenerTree(type, listener) {

    type = typeof type === 'string' ? type.split(this.delimiter) : type.slice();

    //
    // Looks for two consecutive '**', if so, don't add the event at all.
    //
    for(var i = 0, len = type.length; i+1 < len; i++) {
      if(type[i] === '**' && type[i+1] === '**') {
        return;
      }
    }

    var tree = this.listenerTree;
    var name = type.shift();

    while (name) {

      if (!tree[name]) {
        tree[name] = {};
      }

      tree = tree[name];

      if (type.length === 0) {

        if (!tree._listeners) {
          tree._listeners = listener;
        }
        else if(typeof tree._listeners === 'function') {
          tree._listeners = [tree._listeners, listener];
        }
        else if (isArray(tree._listeners)) {

          tree._listeners.push(listener);

          if (!tree._listeners.warned) {

            var m = defaultMaxListeners;

            if (typeof this._events.maxListeners !== 'undefined') {
              m = this._events.maxListeners;
            }

            if (m > 0 && tree._listeners.length > m) {

              tree._listeners.warned = true;
              console.error('(node) warning: possible EventEmitter memory ' +
                            'leak detected. %d listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit.',
                            tree._listeners.length);
              console.trace();
            }
          }
        }
        return true;
      }
      name = type.shift();
    }
    return true;
  }

  // By default EventEmitters will print a warning if more than
  // 10 listeners are added to it. This is a useful default which
  // helps finding memory leaks.
  //
  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.

  EventEmitter.prototype.delimiter = '.';

  EventEmitter.prototype.setMaxListeners = function(n) {
    this._events || init.call(this);
    this._events.maxListeners = n;
    if (!this._conf) this._conf = {};
    this._conf.maxListeners = n;
  };

  EventEmitter.prototype.event = '';

  EventEmitter.prototype.once = function(event, fn) {
    this.many(event, 1, fn);
    return this;
  };

  EventEmitter.prototype.many = function(event, ttl, fn) {
    var self = this;

    if (typeof fn !== 'function') {
      throw new Error('many only accepts instances of Function');
    }

    function listener() {
      if (--ttl === 0) {
        self.off(event, listener);
      }
      fn.apply(this, arguments);
    }

    listener._origin = fn;

    this.on(event, listener);

    return self;
  };

  EventEmitter.prototype.emit = function() {

    this._events || init.call(this);

    var type = arguments[0];

    if (type === 'newListener' && !this.newListener) {
      if (!this._events.newListener) { return false; }
    }

    // Loop through the *_all* functions and invoke them.
    if (this._all) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
      for (i = 0, l = this._all.length; i < l; i++) {
        this.event = type;
        this._all[i].apply(this, args);
      }
    }

    // If there is no 'error' event listener then throw.
    if (type === 'error') {

      if (!this._all &&
        !this._events.error &&
        !(this.wildcard && this.listenerTree.error)) {

        if (arguments[1] instanceof Error) {
          throw arguments[1]; // Unhandled 'error' event
        } else {
          throw new Error("Uncaught, unspecified 'error' event.");
        }
        return false;
      }
    }

    var handler;

    if(this.wildcard) {
      handler = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handler, ns, this.listenerTree, 0);
    }
    else {
      handler = this._events[type];
    }

    if (typeof handler === 'function') {
      this.event = type;
      if (arguments.length === 1) {
        handler.call(this);
      }
      else if (arguments.length > 1)
        switch (arguments.length) {
          case 2:
            handler.call(this, arguments[1]);
            break;
          case 3:
            handler.call(this, arguments[1], arguments[2]);
            break;
          // slower
          default:
            var l = arguments.length;
            var args = new Array(l - 1);
            for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
            handler.apply(this, args);
        }
      return true;
    }
    else if (handler) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];

      var listeners = handler.slice();
      for (var i = 0, l = listeners.length; i < l; i++) {
        this.event = type;
        listeners[i].apply(this, args);
      }
      return (listeners.length > 0) || !!this._all;
    }
    else {
      return !!this._all;
    }

  };

  EventEmitter.prototype.on = function(type, listener) {

    if (typeof type === 'function') {
      this.onAny(type);
      return this;
    }

    if (typeof listener !== 'function') {
      throw new Error('on only accepts instances of Function');
    }
    this._events || init.call(this);

    // To avoid recursion in the case that type == "newListeners"! Before
    // adding it to the listeners, first emit "newListeners".
    this.emit('newListener', type, listener);

    if(this.wildcard) {
      growListenerTree.call(this, type, listener);
      return this;
    }

    if (!this._events[type]) {
      // Optimize the case of one listener. Don't need the extra array object.
      this._events[type] = listener;
    }
    else if(typeof this._events[type] === 'function') {
      // Adding the second element, need to change to array.
      this._events[type] = [this._events[type], listener];
    }
    else if (isArray(this._events[type])) {
      // If we've already got an array, just append.
      this._events[type].push(listener);

      // Check for listener leak
      if (!this._events[type].warned) {

        var m = defaultMaxListeners;

        if (typeof this._events.maxListeners !== 'undefined') {
          m = this._events.maxListeners;
        }

        if (m > 0 && this._events[type].length > m) {

          this._events[type].warned = true;
          console.error('(node) warning: possible EventEmitter memory ' +
                        'leak detected. %d listeners added. ' +
                        'Use emitter.setMaxListeners() to increase limit.',
                        this._events[type].length);
          console.trace();
        }
      }
    }
    return this;
  };

  EventEmitter.prototype.onAny = function(fn) {

    if (typeof fn !== 'function') {
      throw new Error('onAny only accepts instances of Function');
    }

    if(!this._all) {
      this._all = [];
    }

    // Add the function to the event listener collection.
    this._all.push(fn);
    return this;
  };

  EventEmitter.prototype.addListener = EventEmitter.prototype.on;

  EventEmitter.prototype.off = function(type, listener) {
    if (typeof listener !== 'function') {
      throw new Error('removeListener only takes instances of Function');
    }

    var handlers,leafs=[];

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);
    }
    else {
      // does not use listeners(), so no side effect of creating _events[type]
      if (!this._events[type]) return this;
      handlers = this._events[type];
      leafs.push({_listeners:handlers});
    }

    for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
      var leaf = leafs[iLeaf];
      handlers = leaf._listeners;
      if (isArray(handlers)) {

        var position = -1;

        for (var i = 0, length = handlers.length; i < length; i++) {
          if (handlers[i] === listener ||
            (handlers[i].listener && handlers[i].listener === listener) ||
            (handlers[i]._origin && handlers[i]._origin === listener)) {
            position = i;
            break;
          }
        }

        if (position < 0) {
          continue;
        }

        if(this.wildcard) {
          leaf._listeners.splice(position, 1);
        }
        else {
          this._events[type].splice(position, 1);
        }

        if (handlers.length === 0) {
          if(this.wildcard) {
            delete leaf._listeners;
          }
          else {
            delete this._events[type];
          }
        }
        return this;
      }
      else if (handlers === listener ||
        (handlers.listener && handlers.listener === listener) ||
        (handlers._origin && handlers._origin === listener)) {
        if(this.wildcard) {
          delete leaf._listeners;
        }
        else {
          delete this._events[type];
        }
      }
    }

    return this;
  };

  EventEmitter.prototype.offAny = function(fn) {
    var i = 0, l = 0, fns;
    if (fn && this._all && this._all.length > 0) {
      fns = this._all;
      for(i = 0, l = fns.length; i < l; i++) {
        if(fn === fns[i]) {
          fns.splice(i, 1);
          return this;
        }
      }
    } else {
      this._all = [];
    }
    return this;
  };

  EventEmitter.prototype.removeListener = EventEmitter.prototype.off;

  EventEmitter.prototype.removeAllListeners = function(type) {
    if (arguments.length === 0) {
      !this._events || init.call(this);
      return this;
    }

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      var leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);

      for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
        var leaf = leafs[iLeaf];
        leaf._listeners = null;
      }
    }
    else {
      if (!this._events[type]) return this;
      this._events[type] = null;
    }
    return this;
  };

  EventEmitter.prototype.listeners = function(type) {
    if(this.wildcard) {
      var handlers = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handlers, ns, this.listenerTree, 0);
      return handlers;
    }

    this._events || init.call(this);

    if (!this._events[type]) this._events[type] = [];
    if (!isArray(this._events[type])) {
      this._events[type] = [this._events[type]];
    }
    return this._events[type];
  };

  EventEmitter.prototype.listenersAny = function() {

    if(this._all) {
      return this._all;
    }
    else {
      return [];
    }

  };

  if (typeof define === 'function' && define.amd) {
     // AMD. Register as an anonymous module.
    define(function() {
      return EventEmitter;
    });
  } else if (typeof exports === 'object') {
    // CommonJS
    exports.EventEmitter2 = EventEmitter;
  }
  else {
    // Browser global.
    window.EventEmitter2 = EventEmitter;
  }
}();

},{}]},{},[1])(1)
});