const assert = require('assert');
const helper = require('think-helper');

function invokeController(options, app) {
  var descMap = {};
  var descLoaded = false;

  function initDescMap() {
    for (var i = 0; think.app.apiDescs && i < think.app.apiDescs.length; i++) {
      var desc = think.app.apiDescs[i];
      var apiPath = desc.apiPath;
      apiPath = apiPath.replace(/\//g, '_');
      apiPath = apiPath.replace(/\//g, '_');
      var key = desc.method + '_' + apiPath;
      var controllers = desc.controllers;
      descMap[key] = controllers;
    }
  }

  function getDesc(method, path) {
    var descs = think.app.apiDescs;
    if (!descLoaded && descs && descs.length > 0) {
      console.log('initDescMap start' + descs.length);
      initDescMap();
      console.log('initDescMap end');
      descLoaded = true;
    }
    if (descLoaded) {
      console.log('descLoaded keysize=' + think.app.apiDescs.length);
      var apiPath = path;
      apiPath = apiPath.replace(/\//g, '_');
      apiPath = apiPath.replace(/\//g, '_');
      var key = method + '_' + apiPath;
      console.log('getDesc key=' + key);
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
    console.log('ctx.method=' + ctx.method + ', ctx.path=' + ctx.path);
    var data = getDesc(ctx.method.toLowerCase(), ctx.path);
    console.log('data=' + data);
    var controllerName = data[0].file;
    var actionName = data[0].handler;
    console.log('controllerName=' + controllerName);
    const controller = controllers[controllerName];
    console.log('controller=' + controller);
    // console.log('helper.isEmpty(controller)=' + helper.isEmpty(controller));
    // controller not exist
    if (helper.isEmpty(controller)) {
      return next();
    }
    // console.log('ctx=' + JSON.stringify(ctx));
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