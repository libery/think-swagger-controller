const assert = require('assert');
const helper = require('think-helper');

function invokeController(options, app) {
  var descMap = {};
  var descLoaded = false;

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
    let controllers = app.controllers;

    if (isMultiModule) {
      assert(ctx.module, 'ctx.module required in multi module');
    }
    assert(ctx.controller, 'ctx.controller required');
    assert(ctx.action, 'ctx.action required');
    // error avoiding
    if (controllers && isMultiModule) {
      controllers = controllers[ctx.module];
    }
    //controllers empty
    if (helper.isEmpty(controllers)) {
      return next();
    }
    var data = getDesc(ctx.method.toLowerCase(), ctx.path);
    if(!data || data.length===0){
      return next();
    }
    var controllerName = data[0].file;
    var actionName = data[0].handler;
    const controller = controllers[controllerName];
    // controller not exist
    if (helper.isEmpty(controller)) {
      return next();
    }
    const instance = new controller(ctx);
    let promise = Promise.resolve();
    if (instance.__before) {
      promise = Promise.resolve(instance.__before());
    }
    // if return false, it will be prevent next process
    return promise.then(data => {
      if (data === false) return false;
      let method = actionName;
      if (!instance[method]) {
        method = '__call';
      }
      if (instance[method]) {
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