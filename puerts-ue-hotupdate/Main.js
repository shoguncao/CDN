// Main.js —— 热更下发的业务脚本（由 puerts-ue-hotupdate 仓库产出后传到 CDN）
//
// 执行时机：客户端下载完本版本后，由 Puerts 调用（入口在 manifest 的 entry 字段）。

console.log('[JS] Main.js 开始执行');

// C++ 在 JsEnv->Start 时把 World 传了进来
let world = puerts.argv.getByName('World');

if (world) {
    // 在屏幕上显示一行绿色文字，停留 20 秒 —— 证明 JS 真的被执行了
    let color = new UE.LinearColor(0.2, 1.0, 0.3, 1.0);
    UE.KismetSystemLibrary.PrintString(
        world,
        'Hello from JS (hot update)',
        true,   // 显示在屏幕上
        true,   // 同时写日志
        color,
        20.0
    );
    console.log('[JS] 已调用 PrintString');
} else {
    console.log('[JS] 警告：没拿到 World（C++ 未传或类型不对）');
}
