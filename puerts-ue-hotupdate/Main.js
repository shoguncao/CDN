// Main.js 1.7.0 —— 建界面，点击按钮调用原生打开系统设置
const VERSION = '1.7.0';

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

function invoke(target, method, args, sig) {
    const r = JSON.parse(B.Invoke(String(target), method, JSON.stringify((args || []).map(arg)), sig || ''));
    if (r.t === 'e') throw new Error(r.v);
    return r.v;                                     // 对象返回值就是句柄 number
}

function openSettings() {
    try {
        // iOS 10+：openURL:options:completionHandler:
        // 老的 openURL: 在这个系统上会被拒绝（返回 NO），只能用它
        const url  = invoke('NSURL', 'URLWithString:', ['app-settings:']);
        const app  = invoke('UIApplication', 'sharedApplication', []);
        const opts = invoke('NSDictionary', 'dictionary', []);   // options 传空字典即可

        // completionHandler 是我们运行时构造的 OC block，异步告诉我们结果
        const cbId = 99;
        globalThis['__nb_cb_' + cbId] = function (a) {
            log('openURL 回调: ' + a);                  // [1]=成功打开，[0]=失败
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
    btn.OnClicked.Add(function () {
        try { openSettings(); } catch (e) { log('错误: ' + e); }
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
