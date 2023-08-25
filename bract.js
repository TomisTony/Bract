// 这个 createElement 并不是 document.createElement, 而是创建一个虚拟 dom。
// 实际上 Babel 会通过这个函数自动帮我们转换 JSX 成我们代码中使用的虚拟 DOM
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map((child) =>
        typeof child === "object" ? child : createTextElement(child)
      ),
    },
  };
}

function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  };
}

function createDom(fiber) {
  const dom =
    fiber.type === "TEXT_ELEMENT"
      ? document.createTextNode("") // nodeValue 会在下方和其他 props 统一注入
      : document.createElement(fiber.type);

  updateDom(dom, {}, fiber.props);
  return dom;
}

const isEvent = (key) => key.startsWith("on");
const isProperty = (key) => key !== "children" && !isEvent(key);
const isNew = (prev, next) => (key) => prev[key] !== next[key];
const isGone = (prev, next) => (key) => !(key in next);
// 这里是更新真实的 Dom
function updateDom(dom, prevProps, nextProps) {
  // remove old or changed event listeners
  Object.keys(prevProps)
    .filter(isEvent)
    .filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2); // onClick -> click
      dom.removeEventListener(eventType, prevProps[name]);
    });

  // remove old properties
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = "";
    });

  // set new or changed properties
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = nextProps[name];
    });

  // add event listeners
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2); // onClick -> click
      dom.addEventListener(eventType, nextProps[name]);
    }
  );
}

// 使用当前的 fiber 树构建 dom 树
function commitRoot() {
  // 这里需要对删除的节点做单独操作是因为新的 fiber 树中没有这些节点了
  deletions.forEach(commitWork);
  commitWork(wipRoot.child);
  currentRoot = wipRoot;
  wipRoot = null;
}

// 把虚拟 dom 应用到真实 dom
function commitWork(fiber) {
  if(!fiber) {
    return;
  }
  // 找到最近的有 dom 的父节点, 因为函数组件没有 dom
  let domParentFiber = fiber.parent;
  while(!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent;
  }
  const domParent = domParentFiber.dom;

  if(fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
    domParent.appendChild(fiber.dom);
  } else if(fiber.effectTag === "DELETION") {
    commitDeletion(fiber, domParent);
  } else if(fiber.effectTag === "UPDATE" && fiber.dom != null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props);
  }
  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

// 删除节点
function commitDeletion(fiber, domParent) {
  if(fiber.dom) {
    domParent.removeChild(fiber.dom);
  } else {
    commitDeletion(fiber.child, domParent);
  }
}

function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot, // 用于比较
  };
  deletions = [];
  nextUnitOfWork = wipRoot; // 下一个工作单元
}

let nextUnitOfWork = null;
let currentRoot = null; // current root fiber
let wipRoot = null; // work in progress root
let deletions = null;
let wipFiber = null; // work in progress fiber
let hookIndex = null; // hook index

function workLoop(deadline) {
  let shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }
  if(!nextUnitOfWork && wipRoot) {
    commitRoot();
  }
  requestIdleCallback(workLoop); // 空闲时间执行任务
}

requestIdleCallback(workLoop)

// 用于根据当前的 unitOfWork 构建 fiber 树, 并返回下一个 unitOfWork
function performUnitOfWork(fiber) {
  const isFunctionComponent = fiber.type instanceof Function;
  if(isFunctionComponent) {
    updateFunctionComponent(fiber);
  } else {
    updateHostComponent(fiber);
  }
  // return next unit of work
  if(fiber.child) {
    return fiber.child;
  }
  let nextFiber = fiber;
  while(nextFiber) {
    if(nextFiber.sibling) {
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
  const children = [fiber.type(fiber.props)];
  reconcileChildren(fiber, children);
}

function updateHostComponent(fiber) {
  if(!fiber.dom) {
    fiber.dom = createDom(fiber);
  }
  reconcileChildren(fiber, fiber.props.children);
}

// 比较 elements 和上个版本的 fiber 节点 (通过 wipFiber.alternate.child 来获得上个版本的 fiber 节点), 根据比较结果来构建 wipFiber.child
function reconcileChildren(wipFiber, elements) {
  let index = 0;
  let oldFiber = wipFiber.alternate?.child;
  let prevSibling = null;
  while(index < elements.length || oldFiber != null) {
    const element = elements[index];
    let newFiber = null;
    const sameType = oldFiber && element && element.type === oldFiber.type;
    // 即使节点本身的 type 没有改变，也会走更新逻辑，因为可能 props 变了
    if(sameType) {
      // update the node
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom, // 复用 dom
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      }
    }
    // 这里注意，如果几个子节点中间的一个节点被删了，那么每个节点对应的老节点都会被标记删除
    // 然后每一个后续的子节点都会走 PLACEMENT 逻辑。这就是没有 key 的后果
    if(element && !sameType) {
      // add this node
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null, // 新增 dom
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      }
    }
    if(oldFiber && !sameType) {
      // delete the oldFiber's node
      oldFiber.effectTag = "DELETION";
      deletions.push(oldFiber);
    }
    if(oldFiber) {
      oldFiber = oldFiber.sibling;
    }
    if(index === 0) {
      wipFiber.child = newFiber;
    } else if(element) {
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
  const oldHook = 
    wipFiber.alternate && 
    wipFiber.alternate.hooks && 
    wipFiber.alternate.hooks[hookIndex];
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  }
  const actions = oldHook ? oldHook.queue : [];
  // 这里我们会执行旧版的 actions，来获得最新的 state。
  // 说是旧版的 actions，实际上这个旧版的 action 是在上一次 render 之后，通过用户的 setState 传入的 action
  // 等同于说，这里的 actions 就是我们本次渲染希望更改的 state
  actions.forEach(action => {
    hook.state = action(hook.state);
  })
  const setState = action => {
    hook.queue.push(action);
    // 跟 render 一样，启动重新渲染
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    }
    nextUnitOfWork = wipRoot;
    deletions = [];
  }
  wipFiber.hooks.push(hook);
  hookIndex++;
  return [hook.state, setState];
}

const Bract = {
  createElement,
  render,
  useState,
};

// 以下注释可以使得 babel 在编译代码的时候，使用我们自定义的 createElement 方法
/** @jsx Bract.createElement */

const a = () => {
  const element = <div onclick={() => a()}>111 444</div>;
  const container = document.getElementById("root");
  Bract.render(element, container);
};

const element = <div onclick={() => a()}>111 222 333</div>;
const container = document.getElementById("root");
Bract.render(element, container);