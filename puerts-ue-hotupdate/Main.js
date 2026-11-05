// Main.js 5.7.3 —— maskView 挖洞方案（仅 iOS）；Android 只展示空容器
// iOS：网页放最底层，IOSView 挖洞露出它，洞内给关闭按钮「留岛」
// Android：原生视图逻辑全部跳过，容器 + 右上角 ✕ 仍正常显示
const VERSION = '5.7.3';

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
function invoke(target, method, args) {
    if (!B) { throw new Error('NativeBridge 不可用'); }
    const r = JSON.parse(B.Invoke(String(target), method,
        JSON.stringify((args || []).map(arg)), '', ''));
    if (r.t === 'e') throw new Error(r.v);
    return r.v;
}

// 平台判断：沿用 Main_demo.js 的写法 —— 调一个 iOS 独有的类，抛错就是 Android。
// 不额外加原生接口。B 不可用时也按 Android 处理（容器照常显示）。
let IS_IOS = false;
try { invoke('NSProcessInfo', 'processInfo', []); IS_IOS = true; } catch (e) { }

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

    // ---- 以下原生视图逻辑仅 iOS 执行 ----
    // Android 走到这里只保留上面的容器 + 右上角 ✕（空容器），不碰任何 iOS/ObjC 类
    if (IS_IOS) {
    // ---- ② 取 UE 的视图层级，以及 IOSView 自己的 bounds/frame ----
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
        log('Android：仅展示空容器 版本 ' + VERSION);
    }
} catch (e) {
    log('错误: ' + e);
}
