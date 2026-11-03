// Main.js 4.6.0 —— WebView 遮挡验证页（用 UE/Puerts 的 WebBrowser 控件，不是原生桥）
// 布局：左边一个按钮；右边底部展示网页，网页上方一个按钮
// 右下角还有一组"探针"（UMG 红块 + UMG 按钮），用来判定网页会不会遮住 UE 绘制的内容
const VERSION = '4.8.0';

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

// target: 类名 / '#句柄'；opts 可传 'thread=current'
function invoke(target, method, args, sig, opts) {
    const r = JSON.parse(B.Invoke(String(target), method,
        JSON.stringify((args || []).map(arg)), sig || '', opts || ''));
    if (r.t === 'e') throw new Error(r.v);
    return r.v;
}

const URL = 'https://www.qq.com';

// 本地测试页：带一个点击计数器。点得到 → 计数增加；点不到 → 数字永远不变。
// 用来回答"网页里的按钮能不能被看见、能不能被点"。
const HTML = [
    '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body style="margin:0;padding:16px;font:16px -apple-system,sans-serif;background:#fff">',
    '<h3 style="margin:0 0 12px">网页内按钮点击测试</h3>',
    '<button id="b" style="width:100%;height:64px;font-size:20px;background:#0a84ff;color:#fff;border:0;border-radius:8px">点我</button>',
    '<div id="n" style="font-size:26px;margin-top:14px;color:#111">点击次数：0</div>',
    '<script>var c=0;document.getElementById("b").onclick=function(){c++;',
    'document.getElementById("n").textContent="点击次数："+c;};</script>',
    '</body></html>'
].join('');

try {
    const pc = UE.GameplayStatics.GetPlayerController(world, 0);
    const w  = UE.WidgetBlueprintLibrary.Create(world, UE.HotUpdateWidget.StaticClass(), pc);
    w.AddToViewport(0);                              // 必须：UMG 在这一步才建好控件树
    const canvas = w.WidgetTree.RootWidget;

    const vp = UE.WidgetLayoutLibrary.GetViewportSize(world);
    const DS = 1.374;                                // UMG 布局坐标系 = buffer / DPIScale
    const vx = vp.X * DS, vy = vp.Y * DS;

    // 半透明底，方便观察层次
    const bg = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
    bg.SetColorAndOpacity(new UE.LinearColor(1, 1, 1, 0.12));
    const bgSlot = canvas.AddChild(bg);
    bgSlot.SetSize(new UE.Vector2D(vx, vy));
    bgSlot.SetPosition(new UE.Vector2D(0, 0));

    // 结果文字
    const txt = UE.NewObject(UE.TextBlock.StaticClass(), w.WidgetTree);
    const txtSlot = canvas.AddChild(txt);
    txtSlot.SetSize(new UE.Vector2D(vx * 0.9, 80));
    txtSlot.SetPosition(new UE.Vector2D(vx * 0.05, vy * 0.10));
    txt.SetText(T('点左边按钮加载 ' + URL));

    function show(text, ok) {
        txt.SetText(T(text));
        bg.SetColorAndOpacity(ok === false ? new UE.LinearColor(1, 0.9, 0.1, 0.25)
                                           : new UE.LinearColor(0.2, 0.9, 0.3, 0.2));
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
        // 注意：返回的是 UButton，调用方可用 btn.Slot 取到 CanvasPanelSlot 调 SetZOrder
    }

    // 右半区：底部网页，网页上方一个按钮
    const rx = vx * 0.35, rw = vx * 0.60;
    const wvY = vy * 0.55, wvH = vy * 0.38;

    // ---- widget B：只装一个 WebBrowser，**从不 AddToViewport** ----
    // 原因：SWebBrowserView 只在首次绘制时缓存父窗口（SWebBrowserView.cpp:233），
    // 一旦在真实窗口里画过，后面再塞进 WidgetComponent 也不会重新判断 → 永远是原生模式。
    // 所以 B 从创建起就不进 viewport，只在"纹理模式"里作为组件内容被首次绘制。
    const w2 = UE.WidgetBlueprintLibrary.Create(world, UE.HotUpdateWidget.StaticClass(), pc);
    const canvas2 = w2.WidgetTree.RootWidget;
    const browser2 = UE.NewObject(UE.WebBrowser.StaticClass(), w2.WidgetTree);
    const b2Slot = canvas2.AddChild(browser2);
    b2Slot.SetSize(new UE.Vector2D(vx, vy));
    b2Slot.SetPosition(new UE.Vector2D(0, 0));
    browser2.LoadURL(URL);

    // ① 左边：只有一个按钮
    makeBtn('加载 www.qq.com', vx * 0.05, vy * 0.42, vx * 0.28, 60, function () {
        try { browser.LoadURL(URL); show('已加载 ' + URL + '（网页里的按钮能点吗？）'); }
        catch (e) { show('加载失败: ' + e, false); }
    });

    // ② 网页上方的按钮：加载本地测试页（点一下就 +1，用来判定能否点击）
    // 注意 UE 4.27 的 UWebBrowser 没有 Reload()，重新加载就再 LoadURL / LoadString 一次
    makeBtn('加载本地点击测试页', rx, vy * 0.47, rw, 50, function () {
        try { browser.LoadString(HTML, 'about:blank'); show('已加载本地测试页，点网页里的大按钮看计数'); }
        catch (e) { show('加载失败: ' + e, false); }
    }, new UE.LinearColor(0.15, 0.45, 0.35, 1));

    // 探针：与网页完全重叠的 UMG 元素（先加，层级在网页之下）
    const probe = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
    probe.SetColorAndOpacity(new UE.LinearColor(1, 0.2, 0.2, 1));
    const probeSlot = canvas.AddChild(probe);
    probeSlot.SetSize(new UE.Vector2D(rw - 40, wvH - 40));
    probeSlot.SetPosition(new UE.Vector2D(rx + 20, wvY + 20));

    // 对照实验：两个 UMG 按钮都放在网页区域内
    // A：不提层级（默认在网页之下）  B：SetZOrder(10) 提到网页之上
    makeBtn('UE按钮·下层', rx + 40, wvY + 60, rw - 80, 50,
        function () { show('【下层】UE 按钮被点到了'); },
        new UE.LinearColor(0.9, 0.6, 0.1, 1));

    // B：手动建，拿到 AddChild 返回的 slot 再提层级（不用 btn.Slot，避免类型不匹配）
    const topBtn = UE.NewObject(UE.Button.StaticClass(), w.WidgetTree);
    topBtn.SetBackgroundColor(new UE.LinearColor(0.8, 0.2, 0.8, 1));
    const topTxt = UE.NewObject(UE.TextBlock.StaticClass(), w.WidgetTree);
    topTxt.SetText(T('UE按钮·上层ZOrder=10'));
    topBtn.AddChild(topTxt);
    const topSlot = canvas.AddChild(topBtn);
    topSlot.SetSize(new UE.Vector2D(rw - 80, 50));
    topSlot.SetPosition(new UE.Vector2D(rx + 40, wvY + 130));
    topSlot.SetZOrder(10);                          // UMG 内部层级（对原生 webview 是否有效待测）
    topBtn.OnClicked.Add(function () {
        show('【上层】UE 按钮被点到了 → UMG 能盖在网页上');
    });

    // 网页本体：UE/Puerts 的方式（WebBrowserWidget 插件的 UMG 控件）
    // 注意：UE.NewObject 创建，不是我们 NativeBridge 造的 WKWebView
    const browser = UE.NewObject(UE.WebBrowser.StaticClass(), w.WidgetTree);
    const bSlot = canvas.AddChild(browser);
    bSlot.SetSize(new UE.Vector2D(rw, wvH));
    bSlot.SetPosition(new UE.Vector2D(rx, wvY));
    browser.LoadURL(URL);

    // ③ 镂空试验：网页放最底层 + UE 视图挖洞（maskView），看网页能否透过洞显示
    // 不用 CAShapeLayer+CGPath（要传裸指针，桥不支持）；改用 UIView.maskView：
    // mask 用真 UIView，backgroundColor 要 UIColor（对象），4 个子视图围出中间的洞
    makeBtn('镂空试验', vx * 0.05, vy * 0.52, vx * 0.28, 60, function () {
        try {
            const W = vp.X, H = vp.Y;                       // 原生坐标（点）
            const hx = rx / DS, hy = wvY / DS, hw = rw / DS, hh2 = wvH / DS;

            const app = invoke('UIApplication', 'sharedApplication', []);
            const win = invoke('#' + app, 'keyWindow', []);
            const subs = invoke('#' + win, 'subviews', []);
            const ue  = invoke('#' + subs, 'objectAtIndex:', [0]);
            log('UE 视图: ' + invoke('#' + ue, 'description', []));

            // 1) 网页放最底层
            const nsurl = invoke('NSURL', 'URLWithString:', [URL]);
            const req   = invoke('NSURLRequest', 'requestWithURL:', [h(nsurl)]);
            const wv = invoke('#' + invoke('WKWebView', 'alloc', []),
                'initWithFrame:', [{ t: 'st', v: [hx, hy, hw, hh2] }]);
            invoke('#' + wv, 'loadRequest:', [h(req)]);
            invoke('#' + win, 'addSubview:', [h(wv)]);
            invoke('#' + win, 'sendSubviewToBack:', [h(wv)]);

            // 2) 挖洞：整块透明 mask + 4 块不透明白底围出中间的洞
            const mask = invoke('#' + invoke('UIView', 'alloc', []),
                'initWithFrame:', [{ t: 'st', v: [0, 0, W, H] }]);
            invoke('#' + mask, 'setBackgroundColor:', [h(invoke('UIColor', 'clearColor', []))]);
            const white = invoke('UIColor', 'whiteColor', []);
            const rects = [
                [0, 0, W, hy],                               // 上
                [0, hy + hh2, W, H - hy - hh2],              // 下
                [0, hy, hx, hh2],                            // 左
                [hx + hw, hy, W - hx - hw, hh2]              // 右
            ];
            for (const r of rects) {
                const v = invoke('#' + invoke('UIView', 'alloc', []),
                    'initWithFrame:', [{ t: 'st', v: r }]);
                invoke('#' + v, 'setBackgroundColor:', [h(white)]);
                invoke('#' + mask, 'addSubview:', [h(v)]);
            }
            invoke('#' + ue, 'setMaskView:', [h(mask)]);
            show('镂空已设置：网页在最底层，UE 挖了洞。看右下角有没有网页显示出来');
        } catch (e) {
            show('镂空失败: ' + e, false);
        }
    }, new UE.LinearColor(0.5, 0.2, 0.6, 1));

    // ④ 纹理模式：把「只装网页的 widget B」交给 WidgetComponent（World 空间）
    // 两个关键点（都来自源码）：
    //  1) 只有 Space != Screen 才创建 SVirtualWindow（WidgetComponent.cpp:1631）
    //  2) SWebBrowserView 只在**首次绘制**时缓存父窗口（SWebBrowserView.cpp:233），
    //     所以 widget 一旦在真实窗口里画过，就再也切不到纹理模式了
    //     → 所以 B 必须从创建起就一直不进 viewport
    makeBtn('纹理·WidgetComponent', vx * 0.05, vy * 0.62, vx * 0.28, 46, function () {
        try {
            const cam  = UE.GameplayStatics.GetPlayerCameraManager(world, 0);
            const cLoc = cam.GetCameraLocation();
            const cRot = cam.GetCameraRotation();
            const fwd  = UE.KismetMathLibrary.GetForwardVector(cRot);

            // World 空间面片的世界尺寸 = DrawSize 数值（WidgetComponent.cpp:819，单位 cm）
            // 按相机 FOV 反算距离，让 720 的高度刚好铺满垂直视野
            const DW = 1280, DH = 720;
            const fovH = cam.GetFOVAngle();
            const aspect = vp.X / vp.Y;
            const tanV = Math.tan(fovH * Math.PI / 360) / aspect;
            const dist = (DH / 2) / tanV;
            const wLoc = new UE.Vector(cLoc.X + fwd.X * dist, cLoc.Y + fwd.Y * dist, cLoc.Z + fwd.Z * dist);

            const pawn = UE.GameplayStatics.GetPlayerPawn(world, 0);
            const comp = UE.NewObject(UE.WidgetComponent.StaticClass(), pawn);
            comp.SetWidgetSpace(UE.EWidgetSpace.World);    // ← World 才建虚拟窗口
            comp.SetWidget(w2);                            // w2 从没进过 viewport
            comp.SetDrawSize(new UE.Vector2D(DW, DH));
            comp.SetTwoSided(true);
            comp.RegisterComponent();

            // 反射名是 K2_SetWorldLocation（SceneComponent.h:495），第 3 参是 FHitResult&
            const wRot = UE.KismetMathLibrary.FindLookAtRotation(wLoc, cLoc);
            let placed = false;
            const tries = [
                ['K2_SetWorldLocationAndRotation', function () {
                    comp.K2_SetWorldLocationAndRotation(wLoc, wRot, false, new UE.HitResult(), false); }],
                ['K2_SetWorldLocation', function () {
                    comp.K2_SetWorldLocation(wLoc, false, new UE.HitResult(), false);
                    comp.K2_SetWorldRotation(wRot, false, new UE.HitResult(), false); }]
            ];
            for (const t of tries) {
                try { t[1](); placed = true; log('摆放成功: ' + t[0]); break; }
                catch (e) { log('摆放失败 ' + t[0] + ': ' + e); }
            }
            if (!placed) { log('⚠ 组件已注册但没摆好位置'); }

            log('纹理模式已设置：距离=' + Math.round(dist) + 'cm，DrawSize=' + DW + 'x' + DH);

            // 硬证据：纹理模式下 UE 会把那个原生 WKWebView 隐藏。
            // 递归遍历视图树找 WKWebView（它不一定是 window 的直接子视图），
            // 打印它的 hidden —— hidden=1 就是纹理模式生效
            setTimeout(function () {
                let n = 0;
                function dump(v, depth) {
                    if (depth > 8 || n > 40) { return; }
                    n++;
                    let desc = '';
                    try { desc = String(invoke('#' + v, 'description', [])); } catch (e) { }
                    if (desc.length > 62) { desc = desc.substring(0, 62); }
                    let hid = '?';
                    try { hid = invoke('#' + v, 'isHidden', []); } catch (e) { }
                    log('[' + depth + ']h=' + hid + ' ' + desc);
                    let subs = null, cnt = 0;
                    try {
                        subs = invoke('#' + v, 'subviews', []);
                        cnt  = invoke('#' + subs, 'count', []);
                    } catch (e) { return; }
                    for (let i = 0; i < cnt && i < 8; i++) {
                        dump(invoke('#' + subs, 'objectAtIndex:', [i]), depth + 1);
                    }
                }
                try {
                    const app2 = invoke('UIApplication', 'sharedApplication', []);
                    const del2 = invoke('#' + app2, 'delegate', []);
                    const win2 = del2 ? invoke('#' + del2, 'window', []) : invoke('#' + app2, 'keyWindow', []);
                    log('=== 视图树开始（win=' + win2 + '）===');
                    dump(win2, 0);
                    log('=== 视图树结束，共 ' + n + ' 个 ===');
                } catch (e) { log('检查视图树失败: ' + e); }
            }, 1500);

            show('已切 World 空间（距离 ' + Math.round(dist) + 'cm）。看 3D 场景里有没有网页面片');
        } catch (e) { show('切换失败: ' + e, false); }
    }, new UE.LinearColor(0.5, 0.2, 0.6, 1));

    // 关闭按钮
    makeBtn('✕', vx - 84, 20, 64, 64, function () { w.RemoveFromViewport(); },
        new UE.LinearColor(0.6, 0.15, 0.15, 1));

    log('WebView 验证页已建（UE WebBrowser 控件）版本 ' + VERSION);
} catch (e) {
    log('错误: ' + e);
}
