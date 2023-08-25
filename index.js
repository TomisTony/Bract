"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return _typeof(key) === "symbol" ? key : String(key); }
function _toPrimitive(input, hint) { if (_typeof(input) !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (_typeof(res) !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
// 这个 createElement 并不是 document.createElement, 而是创建一个虚拟 dom。
// 实际上 Babel 会通过这个函数自动帮我们转换 JSX 成我们代码中使用的虚拟 DOM
function createElement(type, props) {
  for (var _len = arguments.length, children = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
    children[_key - 2] = arguments[_key];
  }
  return {
    type: type,
    props: _objectSpread(_objectSpread({}, props), {}, {
      children: children.map(function (child) {
        return _typeof(child) === "object" ? child : createTextElement(child);
      })
    })
  };
}
function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: []
    }
  };
}
function createDom(fiber) {
  var dom = fiber.type === "TEXT_ELEMENT" ? document.createTextNode("") // nodeValue 会在下方和其他 props 统一注入
  : document.createElement(fiber.type);
  updateDom(dom, {}, fiber.props);
  return dom;
}
var isEvent = function isEvent(key) {
  return key.startsWith("on");
};
var isProperty = function isProperty(key) {
  return key !== "children" && !isEvent(key);
};
var isNew = function isNew(prev, next) {
  return function (key) {
    return prev[key] !== next[key];
  };
};
var isGone = function isGone(prev, next) {
  return function (key) {
    return !(key in next);
  };
};
// 这里是更新真实的 Dom
function updateDom(dom, prevProps, nextProps) {
  // remove old or changed event listeners
  Object.keys(prevProps).filter(isEvent).filter(function (key) {
    return !(key in nextProps) || isNew(prevProps, nextProps)(key);
  }).forEach(function (name) {
    var eventType = name.toLowerCase().substring(2); // onClick -> click
    dom.removeEventListener(eventType, prevProps[name]);
  });

  // remove old properties
  Object.keys(prevProps).filter(isProperty).filter(isGone(prevProps, nextProps)).forEach(function (name) {
    dom[name] = "";
  });

  // set new or changed properties
  Object.keys(nextProps).filter(isProperty).filter(isNew(prevProps, nextProps)).forEach(function (name) {
    dom[name] = nextProps[name];
  });

  // add event listeners
  Object.keys(nextProps).filter(isEvent).filter(isNew(prevProps, nextProps)).forEach(function (name) {
    var eventType = name.toLowerCase().substring(2); // onClick -> click
    dom.addEventListener(eventType, nextProps[name]);
  });
}

// 使用当前的 fiber 树构建 dom 树
function commitRoot() {
  deletions.forEach(commitWork);
  commitWork(wipRoot.child);
  currentRoot = wipRoot;
  wipRoot = null;
}

// 把虚拟 dom 应用到真实 dom
function commitWork(fiber) {
  if (!fiber) {
    return;
  }
  // 找到最近的有 dom 的父节点, 因为函数组件没有 dom
  var domParentFiber = fiber.parent;
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent;
  }
  var domParent = domParentFiber.dom;
  if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
    domParent.appendChild(fiber.dom);
  } else if (fiber.effectTag === "DELETION") {
    commitDeletion(fiber, domParent);
  } else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props);
  }
  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

// 删除节点
function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom);
  } else {
    commitDeletion(fiber.child, domParent);
  }
}
function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element]
    },
    alternate: currentRoot // 用于比较
  };

  deletions = [];
  nextUnitOfWork = wipRoot; // 下一个工作单元
}

var nextUnitOfWork = null;
var currentRoot = null; // current root fiber
var wipRoot = null; // work in progress root
var deletions = null;
var wipFiber = null; // work in progress fiber
var hookIndex = null; // hook index

function workLoop(deadline) {
  var shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }
  if (!nextUnitOfWork && wipRoot) {
    commitRoot();
  }
  requestIdleCallback(workLoop); // 空闲时间执行任务
}

requestIdleCallback(workLoop);

// 用于根据当前的 unitOfWork 构建 fiber 树, 并返回下一个 unitOfWork
function performUnitOfWork(fiber) {
  var isFunctionComponent = fiber.type instanceof Function;
  if (isFunctionComponent) {
    updateFunctionComponent(fiber);
  } else {
    updateHostComponent(fiber);
  }
  // return next unit of work
  if (fiber.child) {
    return fiber.child;
  }
  var nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    nextFiber = nextFiber.parent;
  }
}
function updateFunctionComponent(fiber) {
  // 通过执行函数，获得 children
  wipFiber = fiber;
  hookIndex = 0;
  wipFiber.hooks = [];
  var children = [fiber.type(fiber.props)];
  reconcileChildren(fiber, children);
}
function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }
  reconcileChildren(fiber, fiber.props.children);
}

// 比较 elements 和上个版本的 fiber 节点 (通过 wipFiber.alternate.child 来获得上个版本的 fiber 节点), 根据比较结果来构建 wipFiber.child
function reconcileChildren(wipFiber, elements) {
  var _wipFiber$alternate;
  var index = 0;
  var oldFiber = (_wipFiber$alternate = wipFiber.alternate) === null || _wipFiber$alternate === void 0 ? void 0 : _wipFiber$alternate.child;
  var prevSibling = null;
  while (index < elements.length || oldFiber != null) {
    var _element = elements[index];
    var newFiber = null;
    var sameType = oldFiber && _element && _element.type === oldFiber.type;
    // 即使节点本身的 type 没有改变，也会走更新逻辑，因为可能 props 变了
    if (sameType) {
      // update the node
      newFiber = {
        type: oldFiber.type,
        props: _element.props,
        dom: oldFiber.dom,
        // 复用 dom
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE"
      };
    }
    if (_element && !sameType) {
      // add this node
      newFiber = {
        type: _element.type,
        props: _element.props,
        dom: null,
        // 新增 dom
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT"
      };
    }
    if (oldFiber && !sameType) {
      // delete the oldFiber's node
      oldFiber.effectTag = "DELETION";
      deletions.push(oldFiber);
    }
    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }
    if (index === 0) {
      wipFiber.child = newFiber;
    } else if (_element) {
      prevSibling.sibling = newFiber;
    }
    prevSibling = newFiber;
    index++;
  }
}

// useState 在每次 render 的时候都会执行，所以我们要做两手准备
// 如果之前没有执行过 useState，那么我们会进行初始化
// 如果之前执行过 useState，那么我们根据旧的 state ，并结合用户传入的 action，来获得最新的 state
function useState(initial) {
  var oldHook = wipFiber.alternate && wipFiber.alternate.hooks && wipFiber.alternate.hooks[hookIndex];
  var hook = {
    state: oldHook ? oldHook.state : initial,
    queue: []
  };
  var actions = oldHook ? oldHook.queue : [];
  // 这里我们会执行旧版的 actions，来获得最新的 state。
  // 说是旧版的 actions，实际上这个旧版的 action 是在上一次 render 之后，通过用户的 setState 传入的 action
  // 等同于说，这里的 actions 就是我们本次渲染希望更改的 state
  actions.forEach(function (action) {
    hook.state = action(hook.state);
  });
  var setState = function setState(action) {
    hook.queue.push(action);
    // 跟 render 一样，启动重新渲染
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot
    };
    nextUnitOfWork = wipRoot;
    deletions = [];
  };
  wipFiber.hooks.push(hook);
  hookIndex++;
  return [hook.state, setState];
}
var Bract = {
  createElement: createElement,
  render: render,
  useState: useState
};

// 以下注释可以使得 babel 在编译代码的时候，使用我们自定义的 createElement 方法
/** @jsx Bract.createElement */

var a = function a() {
  var element = Bract.createElement("div", {
    onclick: function onclick() {
      return a();
    }
  }, "111 444");
  var container = document.getElementById("root");
  Bract.render(element, container);
};
var element = Bract.createElement("div", {
  onclick: function onclick() {
    return a();
  }
}, "111 222 333");
var container = document.getElementById("root");
Bract.render(element, container);
