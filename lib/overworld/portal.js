var utils = require('./utils/utils');
var LifeCycle = require('./lifecycle');
function initAggregator(aggregator, props) {
    return new Promise(function (done) {
        Promise.resolve(aggregator.init(props)).then(function (state) {
            Promise.resolve(aggregator.aggregate(props, state)).then(function (templateProps) {
                done({ props: props, state: state, templateProps: templateProps });
            });
        });
    });
}
var Portal = (function () {
    function Portal() {
        this._linkMap = {}; //TODO: valid struct
        this._caches = {};
        this._nodes = [];
        this._activeNode = null;
        this._cursor = 0;
    }
    // for mixin
    Portal.prototype.getActiveEmitter = function () {
        return this._activeNode.instance.emitter;
    };
    Portal.prototype.link = function (name, world) {
        if (this._linkMap[name])
            throw name + ' is already registered';
        this._linkMap[name] = world;
    };
    Portal.prototype.buildLinkNode = function (name, forceCreate) {
        if (forceCreate === void 0) { forceCreate = false; }
        var React = utils.getReact();
        var lastNode = this._activeNode;
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
            initAggregator(world.aggregator, props).then(function (result) {
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
            Promise.resolve(world.aggregator.aggregate(world.props, world.state)).then(function (templateProps) {
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
        //TODO: dispose correctly
        this._nodes.length = 0;
        return new Promise(function (done) {
            _this.buildLinkNode(name).then(function (nodeWithCache) {
                var node = nodeWithCache.node;
                var component = nodeWithCache.cache ? nodeWithCache.cache.component : null;
                _this._cursor = 0;
                _this._activeNode = node;
                _this._nodes.push(node);
                _this.renderNode(node, props, component).then(done);
            });
        });
    };
    Portal.prototype.pushWorld = function (name, props) {
        var _this = this;
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
                _this._activeNode = node;
                _this.renderNode(node, props, component).then(done);
            });
        });
    };
    Portal.prototype.popWorld = function (resumeParams) {
        var _this = this;
        if (resumeParams === void 0) { resumeParams = {}; }
        // TODO: cache next node and reuse instance
        var lastNode = this._activeNode;
        if (lastNode) {
            //TODO: remove all
            lastNode.target.style.display = 'none';
            lastNode.instance.pause();
        }
        this._cursor--;
        var node = this._nodes[this._cursor];
        this._activeNode = node;
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