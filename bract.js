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

  const isProperty = (key) => key !== "children";
  Object.keys(fiber.props)
    .filter(isProperty)
    .forEach((name) => {
      dom[name] = fiber.props[name];
    });

  return dom;
}

const isEvent = (key) => key.startsWith("on");
const isProperty = (key) => key !== "children" && !isEvent(key);
const isNew = (prev, next) => (key) => prev[key] !== next[key];
const isGone = (prev, next) => (key) => !(key in next);
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

function commitRoot() {
  deletions.forEach(commitWork);
  commitWork(wipRoot.child);
  currentRoot = wipRoot;
  wipRoot = null;
}

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
let currentRoot = null;
let wipRoot = null;
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

function reconcileChildren(wipFiber, elements) {
  let index = 0;
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child; // 用于比较
  let prevSibling = null;
  while(index < elements.length || oldFiber != null) {
    const element = elements[index];
    let newFiber = null;
    const sameType = oldFiber && element && element.type === oldFiber.type;
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