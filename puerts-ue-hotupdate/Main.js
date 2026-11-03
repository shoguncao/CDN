// Main.js 6.0.0 —— 网页「离屏渲染成纹理」再画进 UE
// 目的：让 UMG/Puerts 的控件能盖在网页之上（原生 WebView 直接叠加做不到）
// 做法：
//   1) 用我们自己的桥造一个 WKWebView（可自定义 configuration：内联播放、免手势自动播放）
//   2) 加到视图层级但 setHidden:YES —— 它只作为"离屏渲染源"
//   3) 定时调用 NativeBridgeLib.CaptureViewToTexture 抓成 UTexture2D
//   4) 用 UMG 的 UImage 把纹理画出来 → 于是 UMG 控件可以正常盖在它上面
const VERSION = '6.0.0';

let world = puerts.argv.getByName('World');
const PAD = ' '.repeat(24);

function log(m) {
    UE.KismetSystemLibrary.PrintString(world, PAD + m, true, true, new UE.LinearColor(0.2, 0.8, 1, 1), 60);
}
function T(s) { return UE.KismetTextLibrary.Conv_StringToText(s); }

// ---------- NativeBridge 调用封装 ----------
const B = require('cpp').NativeBridge;
function arg(v) {
    if (v === null || v === undefined) return { t: 'n', v: 0 };
    if (typeof v === 'boolean')        return { t: 'b', v: v };
    if (typeof v === 'string')         return { t: 's', v: v };
    if (typeof v === 'number')         return { t: Number.isInteger(v) ? 'i' : 'd', v: v };
    return v;
}
const h = id => ({ t: 'h', v: id });
function invoke(target, method, args, sig, opts) {
    const r = JSON.parse(B.Invoke(String(target), method,
        JSON.stringify((args || []).map(arg)), sig || '', opts || ''));
    if (r.t === 'e') throw new Error(r.v);
    return r.v;
}

// ---------- 网页内容（我们自己的页面 + YouTube IFrame API，便于播控） ----------
const VIDEO_ID = 'M7lc1UVf-VE';        // YouTube 官方示例视频（允许嵌入）
const WEB_W = 480, WEB_H = 270;        // 离屏网页尺寸（点）
const HTML = [
    '<html><head><meta name="viewport" content="width=device-width,initial-scale=1">',
    '<style>html,body{margin:0;height:100%;overflow:hidden;background:#000}',
    '#p{position:absolute;left:0;top:0;width:100%;height:100%}</style></head><body>',
    '<div id="p"></div>',
    '<script src="https://www.youtube.com/iframe_api"></script>',
    '<script>var player;function onYouTubeIframeAPIReady(){player=new YT.Player("p",{',
    '  videoId:"' + VIDEO_ID + '",playerVars:{playsinline:1,rel:0,autoplay:1,mute:1,controls:0},',
    '  events:{onReady:function(e){e.target.playVideo();}}});}</script>',
    '</body></html>'
].join('');

try {
    const pc = UE.GameplayStatics.GetPlayerController(world, 0);
    const w  = UE.WidgetBlueprintLibrary.Create(world, UE.HotUpdateWidget.StaticClass(), pc);
    w.AddToViewport(0);
    const canvas = w.WidgetTree.RootWidget;

    const vp = UE.WidgetLayoutLibrary.GetViewportSize(world);
    const DS = 1.374;
    const vx = vp.X * DS, vy = vp.Y * DS;

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

    // ---------- ① 显示纹理的 UMG 图片 ----------
    const imgW = vx * 0.7, imgH = imgW * WEB_H / WEB_W;
    const imgX = (vx - imgW) / 2, imgY = vy * 0.30;
    const img = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
    const imgSlot = canvas.AddChild(img);
    imgSlot.SetSize(new UE.Vector2D(imgW, imgH));
    imgSlot.SetPosition(new UE.Vector2D(imgX, imgY));

    // ---------- ② 盖在纹理网页之上的 UMG 控件（本方案的核心验证点） ----------
    makeBtn('【UMG】盖在网页上·点得到吗', imgX + imgW * 0.1, imgY + imgH * 0.35, imgW * 0.8, 46,
        function () { log('★ UMG 按钮被点到 → UMG 能盖在网页之上'); },
        new UE.LinearColor(0.9, 0.5, 0.1, 1));

    const barY = imgY + imgH + 12;
    makeBtn('播放', imgX, barY, imgW * 0.3, 44,
        function () { runJs('player && player.playVideo()'); log('已调用 playVideo()'); });
    makeBtn('暂停', imgX + imgW * 0.35, barY, imgW * 0.3, 44,
        function () { runJs('player && player.pauseVideo()'); log('已调用 pauseVideo()'); });
    makeBtn('静音切换', imgX + imgW * 0.7, barY, imgW * 0.3, 44,
        function () { runJs('if(player){var m=player.isMuted();m?player.unMute():player.mute();}'); });

    // 关闭按钮（网页区域外）
    makeBtn('✕', vx - 74, 10, 64, 64,
        function () { w.RemoveFromViewport(); }, new UE.LinearColor(0.6, 0.15, 0.15, 1));

    // ---------- ③ 造隐藏的 WKWebView（可自定义 configuration） ----------
    let wv = 0;
    try {
        const cfg = invoke('#' + invoke('WKWebViewConfiguration', 'alloc', []), 'init', []);
        try { invoke('#' + cfg, 'setAllowsInlineMediaPlayback:', [true]); } catch (e) { log('内联播放设置失败: ' + e); }
        try { invoke('#' + cfg, 'setMediaTypesRequiringUserActionForPlayback:', [0]); } catch (e) { }   // 0=免用户手势

        wv = invoke('#' + invoke('WKWebView', 'alloc', []),
            'initWithFrame:configuration:',
            [{ t: 'st', v: [0, 0, WEB_W, WEB_H] }, h(cfg)]);

        const url = invoke('NSURL', 'URLWithString:', ['https://www.youtube.com']);
        const req = invoke('NSURLRequest', 'requestWithURL:', [h(url)]);
        invoke('#' + wv, 'loadHTMLString:baseURL:', [HTML, h(url)]);

        const app = invoke('UIApplication', 'sharedApplication', []);
        const del = invoke('#' + app, 'delegate', []);
        const win = del ? invoke('#' + del, 'window', []) : invoke('#' + app, 'keyWindow', []);
        invoke('#' + win, 'addSubview:', [h(wv)]);
        invoke('#' + wv, 'setHidden:', [true]);        // 只作为离屏渲染源
        log('离屏网页已建 句柄=' + wv);
    } catch (e) {
        log('建离屏网页失败: ' + e);
    }

    // 在网页里执行 JS（播控用；回调走 block）
    function runJs(code) {
        if (!wv) { return; }
        try {
            globalThis.__nb_cb_1 = function () { };
            invoke('#' + wv, 'evaluateJavaScript:completionHandler:',
                [code, { t: 'bl', sig: 'v@?@@', cb: 1 }]);
        } catch (e) { log('执行 JS 失败: ' + e); }
    }

    // ---------- ④ 定时抓纹理 → 贴到 UMG 图片 ----------
    let frames = 0, errLogged = false;
    setInterval(function () {
        if (!wv) { return; }
        try {
            const tex = UE.NativeBridgeLib.CaptureViewToTexture(wv, WEB_W, WEB_H);
            if (!tex) {
                if (!errLogged) { log('抓纹理返回空（可能视图未渲染）'); errLogged = true; }
                return;
            }
            img.SetBrushFromTexture(tex);
            frames++;
            if (frames === 1) { log('首帧纹理已显示 → 看 UMG 按钮能否盖在网页上'); }
            if (frames % 25 === 0) { log('已刷新 ' + frames + ' 帧'); }
        } catch (e) {
            if (!errLogged) { log('CaptureViewToTexture 失败: ' + e); errLogged = true; }
        }
    }, 400);

    log('网页纹理页已建 版本 ' + VERSION);
} catch (e) {
    log('错误: ' + e);
}
