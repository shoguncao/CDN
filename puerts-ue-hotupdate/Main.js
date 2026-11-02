// Main.js 4.0.0 —— WebView 遮挡验证页
// 目的：验证"原生 WebView 会不会遮住 UE 绘制的内容"
// 布局：左边一个按钮；右边底部一个原生 WebView，其上方一个按钮
const VERSION = '4.0.0';

let world = puerts.argv.getByName('World');
const PAD = ' '.repeat(24);                       // PrintString 位置写死在左上，靠空格避开刘海

function log(m) {
    UE.KismetSystemLibrary.PrintString(world, PAD + m, true, true, new UE.LinearColor(0.2, 0.8, 1, 1), 60);
}
// Puerts 默认定义 PUERTS_FTEXT_AS_OBJECT（JsEnv.Build.cs:87）：FText 是对象模式，
// SetText 直接传 JS 字符串会被当指针解析而崩溃，必须先用 Conv_StringToText 转换
function T(s) { return UE.KismetTextLibrary.Conv_StringToText(s); }

const B = require('cpp').NativeBridge;

function arg(v) {
    if (v === null || v === undefined) return { t: 'n', v: 0 };
    if (typeof v === 'boolean')        return { t: 'b', v: v };
    if (typeof v === 'string')         return { t: 's', v: v };
    if (typeof v === 'number')         return { t: Number.isInteger(v) ? 'i' : 'd', v: v };
    return v;
}
const h = id => ({ t: 'h', v: id });              // 传对象句柄

// target: 类名 / '#句柄' / '@activity'；sig 现已不用（反射），opts 可传 'thread=current'
function invoke(target, method, args, sig, opts) {
    const r = JSON.parse(B.Invoke(String(target), method,
        JSON.stringify((args || []).map(arg)), sig || '', opts || ''));
    if (r.t === 'e') throw new Error(r.v);
    return r.v;
}

// 平台判断：调一个 iOS 才有的类，抛错就是 Android
let IS_IOS = true;
try { invoke('NSProcessInfo', 'processInfo', []); } catch (e) { IS_IOS = false; }

// ============================================================ 原生 WebView
// iOS：WKWebView（WebBrowserWidget 插件已引入 WebKit，无需改原生）
// Android：android.webkit.WebView，用 addContentView 加到 Activity 上
let webView = 0;                                   // webview 句柄

function createWebView(x, y, w, hh) {              // 参数是原生坐标（iOS=点，Android=像素）
    const url = 'https://www.qq.com';
    if (IS_IOS) {
        const wv = invoke('#' + invoke('WKWebView', 'alloc', []),
            'initWithFrame:', [{ t: 'st', v: [x, y, w, hh] }]);          // CGRect（32 字节结构体）
        const nsurl = invoke('NSURL', 'URLWithString:', [url]);
        const req   = invoke('NSURLRequest', 'requestWithURL:', [h(nsurl)]);
        invoke('#' + wv, 'loadRequest:', [h(req)]);

        const app = invoke('UIApplication', 'sharedApplication', []);
        const win = invoke('#' + app, 'keyWindow', []);
        let rvc = invoke('#' + win, 'rootViewController', []);
        if (!rvc) {
            rvc = invoke('#' + invoke('UIViewController', 'alloc', []), 'init', []);
            invoke('#' + win, 'setRootViewController:', [h(rvc)]);
        }
        invoke('#' + invoke('#' + rvc, 'view', []), 'addSubview:', [h(wv)]);
        return wv;
    }
    const ctx = invoke('@activity', 'getApplicationContext', []);
    const wv  = invoke('android.webkit.WebView', '<init>', [h(ctx)]);
    invoke('#' + wv, 'loadUrl', [url]);
    // 第 3 个参数是 gravity：BOTTOM|RIGHT = 0x50|0x05 = 0x55，让网页停在右下角
    const lp = invoke('android.widget.FrameLayout$LayoutParams', '<init>', [w, hh, 0x55]);
    invoke('@activity', 'addContentView', [h(wv), h(lp)]);
    return wv;
}

function reloadWebView() {
    if (!webView) { return '还没创建网页'; }
    invoke('#' + webView, IS_IOS ? 'reload' : 'reload', []);
    return '已重新加载';
}

// ============================================================ 界面
try {
    const pc = UE.GameplayStatics.GetPlayerController(world, 0);
    const w  = UE.WidgetBlueprintLibrary.Create(world, UE.HotUpdateWidget.StaticClass(), pc);
    w.AddToViewport(0);                              // 必须：UMG 在这一步才建好控件树
    const canvas = w.WidgetTree.RootWidget;

    const vp = UE.WidgetLayoutLibrary.GetViewportSize(world);
    const DS = 1.374;                                // 布局坐标系 = 原生坐标 * DS
    const vx = vp.X * DS, vy = vp.Y * DS;

    // 半透明底（方便观察 WebView 与 UE 内容的层次关系）
    const bg = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
    bg.SetColorAndOpacity(new UE.LinearColor(1, 1, 1, 0.12));
    const bgSlot = canvas.AddChild(bg);
    bgSlot.SetSize(new UE.Vector2D(vx, vy));
    bgSlot.SetPosition(new UE.Vector2D(0, 0));

    // 结果文字
    const txt = UE.NewObject(UE.TextBlock.StaticClass(), w.WidgetTree);
    const txtSlot = canvas.AddChild(txt);
    txtSlot.SetSize(new UE.Vector2D(vx * 0.9, 80));
    txtSlot.SetPosition(new UE.Vector2D(vx * 0.05, vy * 0.12));
    txt.SetText(T('WebView 遮挡验证：点左边按钮加载网页'));

    function show(text, ok) {
        txt.SetText(T(text));
        bg.SetColorAndOpacity(ok === false ? new UE.LinearColor(1, 0.9, 0.1, 0.25)   // 黄=失败
                                           : new UE.LinearColor(0.2, 0.9, 0.3, 0.2)); // 绿=成功
        log(text);
    }

    function makeBtn(label, x, y, bw, bh, onClick, color) {
        const btn = UE.NewObject(UE.Button.StaticClass(), w.WidgetTree);
        btn.SetBackgroundColor(color || new UE.LinearColor(0.10, 0.32, 0.55, 1));
        const t = UE.NewObject(UE.TextBlock.StaticClass(), w.WidgetTree);
        t.SetText(T(label));
        btn.AddChild(t);
        const slot = canvas.AddChild(btn);
        slot.SetSize(new UE.Vector2D(bw, bh));
        slot.SetPosition(new UE.Vector2D(x, y));
        btn.OnClicked.Add(onClick);
        return btn;
    }

    // 右半区：底部放原生 WebView，其上方一个按钮
    const rx  = vx * 0.35, rw = vx * 0.60;
    const wvY = vy * 0.55, wvH = vy * 0.38;          // WebView 区域（布局坐标）

    // ① 左边：只有一个按钮
    makeBtn('加载网页', vx * 0.05, vy * 0.42, vx * 0.28, 60, function () {
        try {
            if (webView) { show('网页已存在，句柄=' + webView); return; }
            webView = createWebView(rx / DS, wvY / DS, rw / DS, wvH / DS);   // 布局坐标 → 原生坐标
            show('网页已加载，句柄=' + webView);
        } catch (e) {
            show('加载失败: ' + e, false);
        }
    });

    // ② 右边、WebView 上方：一个按钮
    makeBtn('重新加载', rx, vy * 0.47, rw, 50, function () {
        try { show(reloadWebView()); } catch (e) { show('重载失败: ' + e, false); }
    }, new UE.LinearColor(0.15, 0.45, 0.35, 1));

    // 关闭按钮
    makeBtn('✕', vx - 84, 20, 64, 64, function () { w.RemoveFromViewport(); },
        new UE.LinearColor(0.6, 0.15, 0.15, 1));

    log('WebView 验证页已建 版本 ' + VERSION + '（' + (IS_IOS ? 'iOS' : 'Android') + '）');
} catch (e) {
    log('错误: ' + e);
}
