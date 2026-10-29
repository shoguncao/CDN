// Main.js 2.1.0 —— 点击按钮：用 OC block 处理 id（收到 id / 用 id 调用 / 返回 id），结果直接显示在界面
const VERSION = '2.1.0';

let world = puerts.argv.getByName('World');

// PrintString 的绘制位置引擎写死在左上，只能靠空格把字往右推，避开 iPhone 刘海
const PAD = ' '.repeat(24);

function log(m) {
    UE.KismetSystemLibrary.PrintString(world, PAD + m, true, true, new UE.LinearColor(0.2, 0.8, 1, 1), 60);
}

log('版本 ' + VERSION);

// ---- 通用原生调用通道（cpp.NativeBridge）----
const B = require('cpp').NativeBridge;

function arg(v) {                                   // JS 值 → {t, v}
    if (v === null || v === undefined) return { t: 'n', v: 0 };
    if (typeof v === 'boolean')        return { t: 'b', v: v };
    if (typeof v === 'string')         return { t: 's', v: v };
    if (typeof v === 'number')         return { t: Number.isInteger(v) ? 'i' : 'd', v: v };
    return v;                                       // 已编码的 {t:'h', v:句柄}
}

function h(id) { return { t: 'h', v: id }; }        // 传对象句柄

// Puerts 默认定义了 PUERTS_FTEXT_AS_OBJECT（JsEnv.Build.cs:87），
// 即 FText 是"对象模式"：SetText 直接传 JS 字符串会被当指针解析而崩溃，必须先转换
function T(s) { return UE.KismetTextLibrary.Conv_StringToText(s); }

function invoke(target, method, args, sig) {
    const r = JSON.parse(B.Invoke(String(target), method, JSON.stringify((args || []).map(arg)), sig || ''));
    if (r.t === 'e') throw new Error(r.v);
    return r.v;                                     // 对象返回值就是句柄 number
}

// native 的回调（OC block / Java 接口）可能发生在非 JS 线程，
// C++ 侧会先排队，这里定时取出来执行（Pump 必须在 JS 调用栈里跑）
setInterval(function () { B.Pump(); }, 200);

// block 演示：参数是 id、返回值也是 id（同步回调，结果直接可见）
// ① NSNumber 不是 NSString → 回调拿到的是句柄 {"t":"h"}，JS 拿它继续调方法
// ② block 返回 {"h":句柄}，OC 采纳后能取回那个对象
function blockIdDemo() {
    const arr = invoke('NSMutableArray', 'array', []);
    [3.5, 1.25, 2.5].forEach(x => invoke('#' + arr, 'addObject:', [h(invoke('NSNumber', 'numberWithDouble:', [x]))]));

    globalThis.__nb_cb_1 = a => {                   // sig='q@?@@'：两个 id 参数，返回 long
        const p = JSON.parse(a);
        const x = invoke('#' + p[0].v, 'doubleValue', []);     // 用收到的 id 继续调用
        const y = invoke('#' + p[1].v, 'doubleValue', []);
        log('block 收到 id: ' + p[0].v + '=' + x + ' / ' + p[1].v + '=' + y);
        B.Release(p[0].v); B.Release(p[1].v);                   // 用完释放（通道 retain 过）
        return String(Math.sign(x - y));
    };
    const sorted = invoke('#' + arr, 'sortedArrayUsingComparator:', [{ t: 'bl', sig: 'q@?@@', cb: 1 }]);
    const part1 = 'id参数排序=' + invoke('#' + sorted, 'componentsJoinedByString:', [',']);

    globalThis.__nb_cb_2 = a => {                   // sig='@@?@@@'：返回 id，参数是 id
        const p = JSON.parse(a);
        B.Release(p[0].v);
        return JSON.stringify({ h: invoke('NSNumber', 'numberWithInt:', [42]) });   // 返回 id
    };
    // arguments 传 null：Apple 侧不支持用 JS 数组构造 NSArray（数组参数仅 Android 侧支持）
    const expr = invoke('NSExpression', 'expressionForBlock:arguments:', [{ t: 'bl', sig: '@@?@@@', cb: 2 }, null]);
    const holder = invoke('NSMutableArray', 'array', []);
    const val = invoke('#' + expr, 'expressionValueWithObject:context:', [h(holder), null]);
    const part2 = '返回id=' + invoke('#' + val, 'intValue', []);
    return part1 + '  |  ' + part2;
}

function openSettings() {
    try {
        // iOS 10+：openURL:options:completionHandler:
        // 老的 openURL: 在这个系统上会被拒绝（返回 NO），只能用它
        const url  = invoke('NSURL', 'URLWithString:', ['app-settings:']);
        const app  = invoke('UIApplication', 'sharedApplication', []);
        const opts = invoke('NSDictionary', 'dictionary', []);   // options 传空字典即可

        // completionHandler 是我们运行时构造的 OC block，异步告诉我们结果
        // 回调参数是"带类型"的数组：[{"t":"b","v":true}] 之类
        const cbId = 99;
        globalThis['__nb_cb_' + cbId] = function (a) {
            const args = JSON.parse(a);
            log('openURL 结果: ' + (args[0] ? args[0].v : a));   // true=成功打开
            return '';
        };
        invoke('#' + app, 'openURL:options:completionHandler:',
            [h(url), h(opts), { t: 'bl', sig: 'v@?B', cb: cbId }]);
        log('已请求打开系统设置');
        return;
    } catch (e) {
        log('iOS 路径失败: ' + e);
    }
    // Android：new Intent("android.settings.SETTINGS") → Activity.startActivity
    try {
        const intent = invoke('android.content.Intent', '<init>', ['android.settings.SETTINGS'], '(Ljava/lang/String;)V');
        invoke('@activity', 'startActivity', [h(intent)], '(Landroid/content/Intent;)V');
        log('已打开系统设置(Android)');
    } catch (e) {
        log('Android 路径失败: ' + e);
    }
}

try {
    let pc = UE.GameplayStatics.GetPlayerController(world, 0);
    // UE.UserWidget 是抽象类，Create 必返回 null，必须用非抽象子类
    let w = UE.WidgetBlueprintLibrary.Create(world, UE.HotUpdateWidget.StaticClass(), pc);
    w.AddToViewport(0);                              // 必须：UMG 在这一步才建好控件树
    let canvas = w.WidgetTree.RootWidget;

    // 容器：半透明红底，居中（位置不动）
    let bg = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
    bg.SetColorAndOpacity(new UE.LinearColor(1, 0, 0, 0.35));
    let bgSlot = canvas.AddChild(bg);

    // GetViewportSize 返回渲染 buffer，UMG 布局坐标系 = buffer / DPIScale（本机 0.728）
    let vp = UE.WidgetLayoutLibrary.GetViewportSize(world);
    const DS = 1.374;
    let vx = vp.X * DS;
    let vy = vp.Y * DS;
    let s = new UE.Vector2D(vx * 0.618, vy * 0.618);
    let p = new UE.Vector2D((vx - s.X) / 2, (vy - s.Y) / 2);
    bgSlot.SetSize(s);
    bgSlot.SetPosition(p);

    // 按钮：放容器中间，点击打开系统设置
    // 内容用 Image：UButton 运行时 new 的默认 Style 是空 brush，不画任何东西
    let btn = UE.NewObject(UE.Button.StaticClass(), w.WidgetTree);
    let icon = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
    icon.SetColorAndOpacity(new UE.LinearColor(0.2, 0.8, 1, 0.9));
    btn.AddChild(icon);
    let btnSlot = canvas.AddChild(btn);
    btnSlot.SetSize(new UE.Vector2D(s.X - 40, 120));
    btnSlot.SetPosition(new UE.Vector2D(p.X + 20, p.Y + (s.Y - 120) / 2));

    // 结果显示：Puerts 会自动把 JS 字符串转成 FText（PropertyTranslator.cpp:452）
    let txt = UE.NewObject(UE.TextBlock.StaticClass(), w.WidgetTree);
    let txtSlot = canvas.AddChild(txt);
    txtSlot.SetSize(new UE.Vector2D(s.X - 40, 100));
    txtSlot.SetPosition(new UE.Vector2D(p.X + 20, p.Y + 20));
    txt.SetText(T('点击按钮：用 OC block 排序'));

    btn.OnClicked.Add(function () {
        try {
            txt.SetText(T(blockIdDemo()));
            bg.SetColorAndOpacity(new UE.LinearColor(0.2, 0.9, 0.3, 0.45));   // 成功→绿
            openSettings();
        } catch (e) {
            txt.SetText(T('失败: ' + e));
            bg.SetColorAndOpacity(new UE.LinearColor(1, 0, 0, 0.45));         // 失败→红
        }
    });

    // 关闭按钮：容器右上角外侧，点了移除整个界面
    let closeBtn = UE.NewObject(UE.Button.StaticClass(), w.WidgetTree);
    let closeIcon = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
    closeIcon.SetColorAndOpacity(new UE.LinearColor(1, 1, 1, 0.9));
    closeBtn.AddChild(closeIcon);
    let closeSlot = canvas.AddChild(closeBtn);
    closeSlot.SetSize(new UE.Vector2D(64, 64));
    closeSlot.SetPosition(new UE.Vector2D(p.X + s.X - 64, p.Y - 64));
    closeBtn.OnClicked.Add(function () { w.RemoveFromViewport(); });

    log('界面已建');
} catch (e) {
    log('错误: ' + e);
}
