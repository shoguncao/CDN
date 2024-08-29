// wasm_demo.js

// 定义add函数，接受一个整型参数
function add(value) {
    return value + 1;
}

// 导出add函数以供外部调用
window.add = add;
