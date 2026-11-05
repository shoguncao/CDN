// Main.js 5.7.10 —— maskView 挖洞方案（iOS）/ 桥造 WebView（Android）
// iOS：网页放最底层，IOSView 挖洞露出它，洞内给关闭按钮「留岛」
// Android：桥造 WebView 放上层（5.7.9 层级实验已撤销，恢复 5.7.8 行为）
// 依赖桥新加的 RunOnUIThreadAndroid：invoke 默认切 UI 线程，thread=current 不切
const VERSION = '5.7.10';

let world = puerts.argv.getByName('World');
const PAD = ' '.repeat(24);

function log(m) {
    UE.KismetSystemLibrary.PrintString(world, PAD + m, true, true, new UE.LinearColor(0.2, 0.8, 1, 1), 60);
}
function T(s) { return UE.KismetTextLibrary.Conv_StringToText(s); }

// ---------- NativeBridge 调用封装 ----------
// Android 上也存在这个模块（JNI 分支），但为保险起见，加载失败不能连累容器显示
let B = null;
try { B = require('cpp').NativeBridge; } catch (e) { }
function arg(v) {
    if (v === null || v === undefined) return { t: 'n', v: 0 };
    if (typeof v === 'boolean')        return { t: 'b', v: v };
    if (typeof v === 'string')         return { t: 's', v: v };
    if (typeof v === 'number')         return { t: Number.isInteger(v) ? 'i' : 'd', v: v };
    return v;
}
const h = id => ({ t: 'h', v: id });
// sig: 显式方法签名；opts: 'thread=current' 表示不切 UI 线程（两端通用）
function invoke(target, method, args, sig, opts) {
    if (!B) { throw new Error('NativeBridge 不可用'); }
    const r = JSON.parse(B.Invoke(String(target), method,
        JSON.stringify((args || []).map(arg)), sig || '', opts || ''));
    if (r.t === 'e') throw new Error(r.v);
    return r.v;
}

// 平台判断：沿用 Main_demo.js 的写法 —— 调一个 iOS 独有的 Foundation 类，抛错就是 Android。
// 不额外加原生接口。B 不可用时也按 Android 处理（容器照常显示）。
// 显式 thread=current：纯数据类不碰 View，且不能让平台判断依赖尚未真机验证的
// UI 线程切换（否则 Android 上一旦切换失败，iOS 也会被误判）。
let IS_IOS = false;
try {
    invoke('NSProcessInfo', 'processInfo', [], '', 'thread=current');
    IS_IOS = true;
} catch (e) { }

const URL = 'https://hk.keyso.uk/youtube-embed-api-demo.html?autoplay=1';

try {
    const pc = UE.GameplayStatics.GetPlayerController(world, 0);
    const w  = UE.WidgetBlueprintLibrary.Create(world, UE.HotUpdateWidget.StaticClass(), pc);
    w.AddToViewport(0);
    const canvas = w.WidgetTree.RootWidget;

    const vp = UE.WidgetLayoutLibrary.GetViewportSize(world);
    const DS = 1.374;
    const vx = vp.X * DS, vy = vp.Y * DS;
    const s  = new UE.Vector2D(vx * 0.618, vy * 0.618);
    const p  = new UE.Vector2D((vx - s.X) / 2, (vy - s.Y) / 2);

    // 容器边框（在洞外，仍可见）
    const bg = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
    bg.SetColorAndOpacity(new UE.LinearColor(1, 1, 1, 0.2));
    const bgSlot = canvas.AddChild(bg);
    bgSlot.SetSize(s);
    bgSlot.SetPosition(p);

    // 右上角关闭按钮：mask 里给它「留岛」，整块恢复渲染，可盖在网页上
    const btn = UE.NewObject(UE.Button.StaticClass(), w.WidgetTree);
    btn.SetBackgroundColor(new UE.LinearColor(0.9, 0.2, 0.2, 1));
    const txt = UE.NewObject(UE.TextBlock.StaticClass(), w.WidgetTree);
    txt.SetText(T('✕'));
    btn.AddChild(txt);
    const btnSlot = canvas.AddChild(btn);
    btnSlot.SetSize(new UE.Vector2D(64, 64));
    btnSlot.SetPosition(new UE.Vector2D(p.X + s.X - 64, p.Y - 32));
    btn.OnClicked.Add(function () { w.RemoveFromViewport(); });

    // ---- ②① 分平台实现；③ maskView 只在 iOS 分支内 ----
    if (IS_IOS) {
    // ---- ② iOS：取 UE 的视图层级，以及 IOSView 自己的 bounds/frame ----
    // 坐标基准统一用 IOSView（Metal 游戏层）的 iOS 屏幕点，不做任何 UE<->iOS 换算：
    //   maskView 及其子视图的坐标系 = IOSView.bounds
    //   WKWebView 的坐标系         = IOSView.superview.bounds
    // 两者用 IOSView.frame 的 origin 对齐。
    // 不用 UIScreen.mainScreen.bounds：iOS 上它返回固定竖屏尺寸，横屏游戏会方向错。
    const app = invoke('UIApplication', 'sharedApplication', []);
    const del = invoke('#' + app, 'delegate', []);
    let iosView = 0, rootView = 0;
    try { iosView  = invoke('#' + del, 'IOSView', []); }  catch (e) { log('取 IOSView 失败: ' + e); }
    try { rootView = invoke('#' + del, 'RootView', []); } catch (e) { log('取 RootView 失败: ' + e); }
    if (!rootView) { rootView = invoke('#' + app, 'keyWindow', []); }
    if (!iosView) { throw new Error('拿不到 IOSView，无法设 maskView'); }

    const rect = v => (Array.isArray(v) ? v : (v && v.v ? v.v : [0, 0, 0, 0]));
    const ib = rect(invoke('#' + iosView, 'bounds', []));   // [bx,by,bw,bh] IOSView 自身坐标系
    const ifr = rect(invoke('#' + iosView, 'frame', []));   // [fx,fy,fw,fh] 在父视图坐标系
    const iw = ib[2], ih = ib[3];
    log('坐标 vp=' + Math.round(vp.X) + 'x' + Math.round(vp.Y)
        + ' IOSView.bounds=' + [ib[0], ib[1], iw, ih].map(Math.round).join(',')
        + ' frame=' + ifr.map(Math.round).join(','));
    if (iw <= 0 || ih <= 0) { throw new Error('IOSView.bounds 尺寸非法'); }

    // 洞：在 IOSView.bounds 坐标系里 0.618 居中（与 UMG 容器同一视觉位置，无需换算）
    const gap = 3;                                  // 让容器边框露出来（屏幕点）
    const hw = iw * 0.618 - gap * 2, hh = ih * 0.618 - gap * 2;
    const hx = ib[0] + (iw - hw) / 2, hy = ib[1] + (ih - hh) / 2;
    log('洞(IOSView坐标)=' + [hx, hy, hw, hh].map(Math.round).join(','));

    // ---- ① 造 WKWebView：frame 用父视图坐标系 = IOSView.frame.origin + 洞相对偏移 ----
    const cfg = invoke('#' + invoke('WKWebViewConfiguration', 'alloc', []), 'init', []);
    try { invoke('#' + cfg, 'setAllowsInlineMediaPlayback:', [true]); } catch (e) { }
    try { invoke('#' + cfg, 'setMediaTypesRequiringUserActionForPlayback:', [0]); } catch (e) { }
    const wvX = ifr[0] + (hx - ib[0]), wvY = ifr[1] + (hy - ib[1]);
    const wv = invoke('#' + invoke('WKWebView', 'alloc', []),
        'initWithFrame:configuration:',
        [{ t: 'st', v: [wvX, wvY, hw, hh] }, h(cfg)]);
    log('WKWebView.frame=' + [wvX, wvY, hw, hh].map(Math.round).join(','));
    const nsurl = invoke('NSURL', 'URLWithString:', [URL]);
    const req   = invoke('NSURLRequest', 'requestWithURL:', [h(nsurl)]);
    invoke('#' + wv, 'loadRequest:', [h(req)]);

    // 网页插到 IOSView 的同一个父视图、并位于它正下方（保证同坐标系）
    let parent = 0;
    try { parent = invoke('#' + iosView, 'superview', []); } catch (e) { }
    if (!parent) { parent = rootView; }
    invoke('#' + parent, 'insertSubview:belowSubview:', [h(wv), h(iosView)]);
    try {
        invoke('#' + parent, 'setBackgroundColor:', [h(invoke('UIColor', 'clearColor', []))]);
    } catch (e) { }

    // ---- ③ 给 IOSView 设 maskView：4 块不透明 UIView 围出中间的洞 ----
    // maskView 的 alpha 决定被遮罩 view 的可见性：不透明处显示、洞处透明 -> 露出下层网页
    // 注意 maskView 自身不能有 superview；这里只创建并赋值，不 addSubview 它
    // maskView.frame 必须与 IOSView.bounds 一致（含 origin）
    const maskV = invoke('#' + invoke('UIView', 'alloc', []), 'initWithFrame:',
        [{ t: 'st', v: [ib[0], ib[1], iw, ih] }]);
    const white = invoke('UIColor', 'whiteColor', []);
    function block(x, y, bw, bh) {
        if (bw <= 0 || bh <= 0) { return; }
        const v = invoke('#' + invoke('UIView', 'alloc', []), 'initWithFrame:',
            [{ t: 'st', v: [x, y, bw, bh] }]);
        invoke('#' + v, 'setBackgroundColor:', [h(white)]);
        invoke('#' + maskV, 'addSubview:', [h(v)]);
    }
    block(ib[0], ib[1], iw, hy - ib[1]);                                  // 上
    block(ib[0], hy + hh, iw, ib[1] + ih - (hy + hh));                     // 下
    block(ib[0], hy, hx - ib[0], hh);                                      // 左
    block(hx + hw, hy, ib[0] + iw - (hx + hw), hh);                        // 右

    // ---- ③b 关闭按钮「留岛」：把按钮那块也画成不透明，IOSView 恢复渲染 ----
    // UMG 布局坐标 -> IOSView 屏幕点：同一个全屏在两套坐标系下的比例，
    // k = IOSView.bounds / (vp * DS)。验证：p.X*k ≈ 洞 hx（差 gap）。
    const BTN = 64;
    const kx = iw / vx, ky = ih / vy;
    const buX = p.X + s.X - BTN, buY = p.Y - 32;      // 按钮 UMG 左上角
    const islandX = ib[0] + buX * kx;
    const islandY = ib[1] + buY * ky;
    const islandW = BTN * kx, islandH = BTN * ky;
    block(islandX, islandY, islandW, islandH);         // 岛上 = UE 层可见 = 按钮压在网页上
    log('按钮岛=' + [islandX, islandY, islandW, islandH].map(Math.round).join(',')
        + ' k=' + kx.toFixed(3) + '/' + ky.toFixed(3));

    invoke('#' + iosView, 'setMaskView:', [h(maskV)]);

    log('maskView 已设 版本 ' + VERSION);
    } else {
        // ---- ② Android：取 android:id/content 的真实尺寸 ----
        // addContentView 把 WebView 加到的是 content 容器，不是 DecorView。
        // 实测 NE2210 横屏：DecorView=2960x1440，content=2834x1440
        // （右侧 126px 是系统导航栏）。UMG 的 SurfaceView 与 content 同区，
        // 若按 DecorView 尺寸算 0.618 居中会整体右偏 63px。
        let dw = 0, dh = 0;
        try {
            const win = invoke('@activity', 'getWindow', []);
            const decor = invoke('#' + win, 'getDecorView', []);
            // android.R.id.content = 0x01020002 = 16908290
            let base = decor;
            try {
                const content = invoke('#' + decor, 'findViewById', [16908290]);
                if (content) { base = content; }
            } catch (e3) { }
            dw = invoke('#' + base, 'getWidth', []);
            dh = invoke('#' + base, 'getHeight', []);
        } catch (e2) { log('Android 取尺寸失败: ' + e2); }
        log('Android vp=' + Math.round(vp.X) + 'x' + Math.round(vp.Y)
            + ' content=' + dw + 'x' + dh);

        // 纯数据调用对照：显式不切线程，验证新的 thread=current 通道确实生效
        try {
            const pkg = invoke('@activity', 'getPackageName', [], '', 'thread=current');
            log('Android thread=current 包名=' + pkg);
        } catch (e2) { log('Android thread=current 失败: ' + e2); }

        // ---- ① Android：桥自己造 android.webkit.WebView，addContentView 放上层 ----
        // 依赖桥新加的 RunOnUIThreadAndroid：invoke 默认同步切 UI 线程，
        // 所以 WebView 构造 / WebSettings / addContentView 全在 UI 线程执行。
        // 不再用 UE.WebBrowser —— 它的层级被引擎写死在上层，下一步没法改到底层。
        // 用 DecorView 的 Context（Activity 主题），不要用 ApplicationContext：
        // WebView 里的媒体/全屏需要 Activity 主题，ApplicationContext 会踩坑
        let actCtx = 0;
        try {
            const win = invoke('@activity', 'getWindow', []);
            const decor = invoke('#' + win, 'getDecorView', []);
            actCtx = invoke('#' + decor, 'getContext', []);
        } catch (e2) { actCtx = invoke('@activity', 'getApplicationContext', []); }
        const awv = invoke('android.webkit.WebView', '<init>', [h(actCtx)]);
        const ws  = invoke('#' + awv, 'getSettings', []);
        invoke('#' + ws, 'setJavaScriptEnabled', [true]);
        invoke('#' + ws, 'setDomStorageEnabled', [true]);
        try { invoke('#' + ws, 'setMediaPlaybackRequiresUserGesture', [false]); } catch (e2) { }

        // 直接跟随 UMG 容器的实际屏幕矩形，不再两边各自按 0.618 猜。
        // UMG slot 是 Slate 单位，渲染链路：Slate * dpi -> viewport 像素,
        // 再 * (Android屏幕点 / viewport像素) -> Android 屏幕点。
        // 实测 NE2210: vp=1480x720, content=2960x1440, dpi=0.666
        //   k = 0.666 * (2960/1480) = 1.332
        //   UMG 容器 p=388,189 s=1257,611 -> (517,252,1675,814)
        // 旧算法按屏幕 0.618 -> (568,278,1823,884)，偏右下且大一圈（与截图一致）。
        let k;
        try {
            k = UE.WidgetLayoutLibrary.GetViewportScale(world) * (dw / vp.X);
        } catch (e2) {
            k = (1 / 1.374) * (dw / vp.X);      // 兜底：用 iOS 经验值的倒数估 dpi
        }
        const gap = 3;
        const aw = Math.max(1, s.X * k - gap * 2), ah = Math.max(1, s.Y * k - gap * 2);
        const ax = p.X * k + gap, ay = p.Y * k + gap;
        // FrameLayout$LayoutParams(int,int,int) 是唯一的三参构造，避开两参重载歧义
        const lp = invoke('android.widget.FrameLayout$LayoutParams', '<init>',
            [Math.round(aw), Math.round(ah), 0]);
        invoke('#' + lp, 'setMargins', [Math.round(ax), Math.round(ay), 0, 0]);
        invoke('@activity', 'addContentView', [h(awv), h(lp)]);
        invoke('#' + awv, 'loadUrl', [URL]);

        log('Android WebView=' + awv + ' k=' + k.toFixed(3)
            + ' frame=' + [ax, ay, aw, ah].map(Math.round).join(','));

        // 5.7.9 的 setZOrderOnTop 层级实验已撤销：本机 Android 9 / targetSdk 28
        // 运行时改 z-order 不生效（z 仍 -2），且 invalidate() 会让游戏 Surface
        // 不显示、只剩 WebView 内容。此路不通，恢复 5.7.8 的行为。

        // ---- 延迟核对：确认窗口稳定后 WebView 的落点仍与 UMG 容器一致 ----
        // 5.7.7 的诊断实测：稳定后 content 仍是 2960x1440（并非之前推测的 resize），
        // 真正错因是 UMG slot 与 WebView 用了两套坐标系。这里保留读数用于复核：
        //   A: 稳定后的 content 尺寸 + WebView 实际落在父容器里的矩形
        //   B: UE viewport / DPI scale / UMG 容器 slot 坐标
        if (typeof setTimeout === 'function') {
            setTimeout(function () {
                try {
                    const win = invoke('@activity', 'getWindow', []);
                    const decor = invoke('#' + win, 'getDecorView', []);
                    let base = decor;
                    try {
                        const c = invoke('#' + decor, 'findViewById', [16908290]);
                        if (c) { base = c; }
                    } catch (e3) { }
                    const cw = invoke('#' + base, 'getWidth', []);
                    const ch = invoke('#' + base, 'getHeight', []);
                    const l = invoke('#' + awv, 'getLeft', []);
                    const t = invoke('#' + awv, 'getTop', []);
                    const w = invoke('#' + awv, 'getWidth', []);
                    const h = invoke('#' + awv, 'getHeight', []);
                    log('定位A content=' + cw + 'x' + ch
                        + ' WebView LTWH=' + [l, t, w, h].join(','));
                    let dpi = 0;
                    try { dpi = UE.WidgetLayoutLibrary.GetViewportScale(world); } catch (e3) { }
                    log('定位B vp=' + Math.round(vp.X) + 'x' + Math.round(vp.Y)
                        + ' dpi=' + Number(dpi).toFixed(3)
                        + ' UMG p=' + Math.round(p.X) + ',' + Math.round(p.Y)
                        + ' s=' + Math.round(s.X) + ',' + Math.round(s.Y)
                        + ' DS=1.374');
                } catch (e2) { log('定位诊断失败: ' + e2); }
            }, 2000);
        }

        log('Android：桥造 WebView 已加到上层 版本 ' + VERSION);
    }
} catch (e) {
    log('错误: ' + e);
}
