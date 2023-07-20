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

function render(element, container) {
  const dom =
    element.type === "TEXT_ELEMENT"
      ? document.createTextNode("") // nodeValue 会在下方和其他 props 统一注入
      : document.createElement(element.type);

  const isProperty = (key) => key !== "children";
  Object.keys(element.props)
    .filter(isProperty)
    .forEach((name) => {
      dom[name] = element.props[name];
    });

  element.props.children.forEach((child) => {
    render(child, dom);
  });

  container.appendChild(dom);
}

const Bract = {
  createElement,
  render,
};

// 以下注释可以使得 babel 在编译代码的时候，使用我们自定义的 createElement 方法
/** @jsx Bract.createElement */
const element = (
    <div id="foo">
        <a href="http://www.example.com">bar</a>
        <br />
        <fakeElement>111</fakeElement>
        <img src="aha.com/fake.jpg" alt="img"></img>
    </div>
);

const container = document.getElementById("root");
Bract.render(element, container);