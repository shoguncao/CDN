// Main.js 5.6.8 —— 验证「原生网页画面 → UTexture2D → 画进 UMG」（纯 JS，未改 native）
// 关键：UE 已有 UFUNCTION KismetRenderingLibrary::ImportFileAsTexture2D
const VERSION = '5.6.8';

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
function invoke(target, method, args) {
    const r = JSON.parse(B.Invoke(String(target), method,
        JSON.stringify((args || []).map(arg)), '', ''));
    if (r.t === 'e') throw new Error(r.v);
    return r.v;
}

const URL = 'https://hk.keyso.uk/youtube-embed-api-demo.html?autoplay=1';
const WV_W = 480, WV_H = 270;       // 离屏网页尺寸（点）

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

    // 容器
    const bg = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
    bg.SetColorAndOpacity(new UE.LinearColor(1, 1, 1, 0.2));
    const bgSlot = canvas.AddChild(bg);
    bgSlot.SetSize(s);
    bgSlot.SetPosition(p);

    // 显示纹理的 UMG 图片
    const img = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
    const iSlot = canvas.AddChild(img);
    iSlot.SetSize(new UE.Vector2D(s.X - 5, s.Y - 5));
    iSlot.SetPosition(new UE.Vector2D(p.X + 2.5, p.Y + 2.5));

    // 关闭按钮
    const btn = UE.NewObject(UE.Button.StaticClass(), w.WidgetTree);
    btn.SetBackgroundColor(new UE.LinearColor(0.9, 0.2, 0.2, 1));
    const txt = UE.NewObject(UE.TextBlock.StaticClass(), w.WidgetTree);
    txt.SetText(T('✕'));
    btn.AddChild(txt);
    const btnSlot = canvas.AddChild(btn);
    btnSlot.SetSize(new UE.Vector2D(64, 64));
    btnSlot.SetPosition(new UE.Vector2D(p.X + s.X - 64, p.Y - 32));
    btn.OnClicked.Add(function () { w.RemoveFromViewport(); });

    // ① 用桥造一个原生 WKWebView，放在屏幕外，只当渲染源
    let wv = 0;
    try {
        const cfg = invoke('#' + invoke('WKWebViewConfiguration', 'alloc', []), 'init', []);
        try { invoke('#' + cfg, 'setAllowsInlineMediaPlayback:', [true]); } catch (e) { }
        // 方案 A：放开 WKWebView 自动播放策略（0 = WKAudiovisualMediaTypeNone）
        try { invoke('#' + cfg, 'setMediaTypesRequiringUserActionForPlayback:', [0]); } catch (e) { }
        wv = invoke('#' + invoke('WKWebView', 'alloc', []),
            'initWithFrame:configuration:',
            [{ t: 'st', v: [vp.X - 100, 0, WV_W, WV_H] }, h(cfg)]);   // 屏幕右侧露出 100 宽

        const nsurl = invoke('NSURL', 'URLWithString:', [URL]);
        const req   = invoke('NSURLRequest', 'requestWithURL:', [h(nsurl)]);
        invoke('#' + wv, 'loadRequest:', [h(req)]);

        const app = invoke('UIApplication', 'sharedApplication', []);
        const del = invoke('#' + app, 'delegate', []);
        const win = del ? invoke('#' + del, 'window', []) : invoke('#' + app, 'keyWindow', []);
        invoke('#' + win, 'addSubview:', [h(wv)]);
        log('离屏网页已建 句柄=' + wv);
    } catch (e) {
        log('建离屏网页失败: ' + e);
    }

    // ② 纯 JS：WKWebView 快照 → PNG 字节（base64 中转）→ ImportBufferAsTexture2D → UMG
    //   文件路线（ImportFileAsTexture2D）已确认 UE 读不进/读不出沙盒路径，
    //   本轮彻底绕开文件系统，直接走 ImportBufferAsTexture2D（TArray<uint8> 版）。
    //   这是终局判定：buffer 也 null → UE 的 Import*AsTexture2D 在 iOS 打包下不可用。
    let frames = 0, errLogged = false, lastSt = '';

    function b64decode(s) {
        const T = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        const out = new Uint8Array(Math.floor(s.length * 3 / 4));
        let acc = 0, bits = 0, p = 0;
        for (let i = 0; i < s.length; i++) {
            const c = T.indexOf(s[i]);
            if (c < 0) { continue; }                 // 跳过 = 和换行
            acc = (acc << 6) | c; bits += 6;
            if (bits >= 8) { bits -= 8; out[p++] = (acc >> bits) & 0xff; }
        }
        return out.subarray(0, p);
    }

    // WKWebView 快照是异步 block 回调；桥会把参数编码成 JSON 数组字符串，
    // 用 Pump 取回（回调可能不在 JS 线程）
    globalThis.__nb_cb_7 = function (a) {
        try {
            const arr = JSON.parse(a);
            const uiImg = arr[0].v;                  // UIImage 句柄
            if (!uiImg) { if (lastSt !== 'empty') { log('快照为空'); lastSt = 'empty'; } return; }

            // UIImagePNGRepresentation(UIImage*) -> NSData*（UIKit C 函数）
            const r = JSON.parse(B.CallCFunc('UIImagePNGRepresentation', '@@',
                JSON.stringify([{ t: 'h', v: uiImg }])));
            if (r.t === 'e' || !r.v) { log('PNG 转换失败: ' + r.v); return; }

            // NSData -> base64 字符串 -> JS 本地解码成字节数组
            const b64 = invoke('#' + r.v, 'base64EncodedStringWithOptions:', [0]);
            const bin = b64decode(b64);
            if (!bin.length) { if (lastSt !== 'b64empty') { log('base64 解码为空(串长' + b64.length + ')'); lastSt = 'b64empty'; } return; }

            // 塞进 UE 容器 → ImportBufferAsTexture2D
            const uarr = UE.NewArray(UE.BuiltinByte);
            for (let i = 0; i < bin.length; i++) { uarr.Add(bin[i]); }
            const tex = UE.KismetRenderingLibrary.ImportBufferAsTexture2D(world, uarr);

            const st = 'buffer=' + (tex ? 'OK' : 'null') + ' bytes=' + bin.length;
            if (st !== lastSt) { log(st); lastSt = st; }
            if (tex) {
                img.SetBrushFromTexture(tex);
                frames++;
                if (frames === 1) { log('★ 纯 JS 首帧纹理已显示（未改 native）'); }
            } else if (!errLogged) {
                errLogged = true;
                log('ImportBufferAsTexture2D 也 null → 与文件无关，在 UE 解码/建纹理层');
            }
        } catch (e) {
            if (!errLogged) { log('纯 JS 抓帧失败: ' + e); errLogged = true; }
        }
    };

    setInterval(function () { B.Pump(); }, 100);

    setInterval(function () {
        if (!wv) { return; }
        try {
            // 快照宽度缩到 240（PNG 小，字节逐个 Add 才不慢）
            const cfg = invoke('#' + invoke('WKSnapshotConfiguration', 'alloc', []), 'init', []);
            try { invoke('#' + cfg, 'setSnapshotWidth:', [{ t: 'd', v: 240 }]); } catch (e2) { }
            // takeSnapshotWithConfiguration:completionHandler:
            // block 签名 v@?@@（返回 void，block 自身 @?，参数 UIImage* / NSError*）
            invoke('#' + wv, 'takeSnapshotWithConfiguration:completionHandler:',
                [h(cfg), { t: 'bl', sig: 'v@?@@', cb: 7 }]);
        } catch (e) {
            if (!errLogged) { log('takeSnapshot 失败: ' + e); errLogged = true; }
        }
    }, 500);

    log('网页纹理验证页已建 版本 ' + VERSION);
} catch (e) {
    log('错误: ' + e);
}
