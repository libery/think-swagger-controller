const assert = require('assert');
const helper = require('think-helper');

const defaultOptions = {
  emptyController: '',
  preSetStatus: 200
};
function invokeController(options, app) {
  var descMap = {};
  var descLoaded = false;
  options = Object.assign(defaultOptions, options);
  function initDescMap() {
    for (var i = 0; app.apiDescs && i < app.apiDescs.length; i++) {
      var desc = app.apiDescs[i];
      var apiPath = desc.apiPath;
      apiPath = apiPath.replace(/\//g, '_');
      apiPath = apiPath.replace(/\//g, '_');
      var key = desc.method + '_' + apiPath;
      var controllers = desc.controllers;
      descMap[key] = controllers;
    }
  }

  function getDesc(method, path) {
    var descs = app.apiDescs;
    if (!descLoaded && descs && descs.length > 0) {
      initDescMap();
      descLoaded = true;
    }
    if (descLoaded) {
      var apiPath = path;
      apiPath = apiPath.replace(/\//g, '_');
      apiPath = apiPath.replace(/\//g, '_');
      var key = method + '_' + apiPath;
      return descMap[key];
    } else {
      return null;
    }
  }
  return (ctx, next) => {

    const isMultiModule = app.modules.length;
    let controllers = app.controllers || {};

    if (isMultiModule) {
      assert(ctx.module, 'ctx.module required in multi module');
    }
    assert(ctx.controller, 'ctx.controller required');
    assert(ctx.action, 'ctx.action required');
    // error avoiding
    if (controllers && isMultiModule) {
      controllers = controllers[ctx.module] || {};
    }
    let Controller = controllers[ctx.controller];
    var data = getDesc(ctx.method.toLowerCase(), ctx.path);
    let swaggerAction = false;
    if(data && data.length >0){
      swaggerAction = true;
      var controllerName = data[0].file;
      var actionName = data[0].handler;
      Controller = controllers[controllerName];
    }
    // controller not exist
    if (helper.isEmpty(Controller)) {
      const emptyController = options.emptyController;
      if (emptyController && controllers[emptyController]) {
        Controller = controllers[emptyController];
      } else {
        return next();
      }
    
    }

    const instance = new Controller(ctx);
    let promise = Promise.resolve();
    if (instance.__before) {
      promise = Promise.resolve(instance.__before());
    }
    // if return false, it will be prevent next process
    return promise.then(data => {
      if (data === false) return false;
      let method = `${ctx.action}Action`;
      if (swaggerAction) {
        method = actionName;
      }
      if (!instance[method]) {
        method = '__call';
      }
      if (instance[method]) {
        // pre set request status
        if (ctx.body === undefined && options.preSetStatus) {
          ctx.status = options.preSetStatus;
        }
        return instance[method]();
      }
    }).then(data => {
      if (data === false) return false;
      if (instance.__after) {
        return instance.__after();
      }
    }).then(data => {
      if (data !== false) {
        return next();
      }
    });
  };
}

module.exports = invokeController;