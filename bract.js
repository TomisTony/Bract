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
  const domParent = fiber.parent.dom;
  if(fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
    domParent.appendChild(fiber.dom);
  } else if(fiber.effectTag === "DELETION") {
    domParent.removeChild(fiber.dom);
  } else if(fiber.effectTag === "UPDATE" && fiber.dom != null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props);
  }
  commitWork(fiber.child);
  commitWork(fiber.sibling);
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
  // add dom node
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }
  // create new fibers
  const elements = fiber.props.children;
  reconcileChildren(fiber, elements);
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

// 比较 elements 和上个版本的 fiber 节点 (通过 wipFiber.alternate.child 来获得上个版本的 fiber 节点), 根据比较结果来构建 wipFiber.child
function reconcileChildren(wipFiber, elements) {
  let index = 0;
  let oldFiber = wipFiber.alternate?.child;
  let prevSibling = null;
  while(index < elements.length || oldFiber != null) {
    const element = elements[index];
    let newFiber = null;
    const sameType = oldFiber && element && element.type === oldFiber.type;
    // 即使节点本身的 type ，也会走更新逻辑，因为可能 props 变了
    if(sameType) {
      // update the node
      console.log(oldFiber)
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom, // 复用 dom
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      }
    }
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

const Bract = {
  createElement,
  render,
};

// 以下注释可以使得 babel 在编译代码的时候，使用我们自定义的 createElement 方法
/** @jsx Bract.createElement */

const updateValue = e => {
  rerender(e.target.value)
}

const rerender = value => {
  const element = (
      <div id="foo">
          <a href="http://www.example.com">bar</a>
          <br />
          <fakeElement>111</fakeElement>
          <img src="aha.com/fake.jpg" alt="img"></img>
          <input onInput={updateValue} value={value} />
          <h2>Hello {value}</h2>
      </div>
  );
  Bract.render(element, document.getElementById("root"));
}

rerender("World");