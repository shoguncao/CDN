// Main.js 5.6.4 —— 验证「原生网页画面 → UTexture2D → 画进 UMG」（纯 JS，未改 native）
// 关键：UE 已有 UFUNCTION KismetRenderingLibrary::ImportFileAsTexture2D
const VERSION = '5.6.4';

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

const URL = 'https://www.qq.com';
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
        wv = invoke('#' + invoke('WKWebView', 'alloc', []),
            'initWithFrame:configuration:',
            [{ t: 'st', v: [vp.X + 50, 0, WV_W, WV_H] }, h(cfg)]);   // x 在屏幕外

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

    // ② 纯 JS：WKWebView 快照 → PNG 文件 → ImportFileAsTexture2D → UMG
    //   关键：UE 已经把 FImageUtils 包成 UFUNCTION（KismetRenderingLibrary.h:137），
    //   ImportFileAsTexture2D 返回 UTexture2D*，Puerts 自动包装成 JS 能用的对象。
    //   所以这一步完全不需要改 native。
    let PNG = '', JPG = '', SAVED = '';
    try {
        const td = JSON.parse(B.CallCFunc('NSTemporaryDirectory', '@', '[]'));
        PNG = td.v + 'wb_cap.png';
        JPG = td.v + 'wb_cap.jpg';
        SAVED = UE.KismetSystemLibrary.GetProjectSavedDirectory() + 'wb_cap.png';
        log('PNG 路径=' + PNG);
        log('SAVED 路径=' + SAVED);
    } catch (e) {
        log('取路径失败: ' + e);
    }

    let frames = 0, errLogged = false, lastSt = '';

    // WKWebView 快照是异步 block 回调；桥会把参数编码成 JSON 数组字符串，
    // 用 Pump 取回（回调可能不在 JS 线程）
    globalThis.__nb_cb_7 = function (a) {
        try {
            const arr = JSON.parse(a);
            const uiImg = arr[0].v;                  // UIImage 句柄
            if (!uiImg) { if (lastSt !== 'empty') { log('快照为空'); lastSt = 'empty'; } return; }

            // PNG 数据写两个位置：iOS 临时目录 / UE 自己的 Saved 目录
            // （对照：UE 的 LoadFileToArray 能否读到沙盒 tmp 路径）
            const r = JSON.parse(B.CallCFunc('UIImagePNGRepresentation', '@@',
                JSON.stringify([{ t: 'h', v: uiImg }])));
            if (r.t === 'e' || !r.v) { log('PNG 转换失败: ' + r.v); return; }
            invoke('#' + r.v, 'writeToFile:atomically:', [PNG, true]);
            invoke('#' + r.v, 'writeToFile:atomically:', [SAVED, true]);

            // 对照路线：JPEG（排除 PNG 解码环节）
            let jpgOk = '';
            try {
                const j = JSON.parse(B.CallCFunc('UIImageJPEGRepresentation', '@@d',
                    JSON.stringify([{ t: 'h', v: uiImg }, { t: 'd', v: 0.85 }])));
                if (j.t !== 'e' && j.v) {
                    invoke('#' + j.v, 'writeToFile:atomically:', [JPG, true]);
                    jpgOk = UE.KismetRenderingLibrary.ImportFileAsTexture2D(world, JPG) ? 'OK' : 'null';
                } else { jpgOk = 'convFail'; }
            } catch (e2) { jpgOk = 'err:' + e2; }

            const texT = UE.KismetRenderingLibrary.ImportFileAsTexture2D(world, PNG);
            const texS = UE.KismetRenderingLibrary.ImportFileAsTexture2D(world, SAVED);
            const st = 'tmp=' + (texT ? 'OK' : 'null') + ' saved=' + (texS ? 'OK' : 'null') + ' J=' + jpgOk;
            if (st !== lastSt) { log(st); lastSt = st; }

            const tex = texT || texS;
            if (tex) {
                img.SetBrushFromTexture(tex);
                frames++;
                if (frames === 1) { log('★ 纯 JS 首帧纹理已显示（未改 native）'); }
                return;
            }

            // 全部失败 → 2 秒后挖 UE 日志（延后保证屏幕能看到，不被刷掉）
            if (!errLogged) {
                errLogged = true;
                setTimeout(function () {
                    try {
                        const logPath = UE.KismetSystemLibrary.GetProjectSavedDirectory() + 'Logs/PuertsUEDemo.log';
                        const txt = invoke('NSString', 'stringWithContentsOfFile:encoding:error:',
                            [logPath, 4, { t: 'n', v: 0 }]);
                        if (typeof txt === 'string' && txt.length) {
                            const hits = txt.split('\n')
                                .filter(l => l.indexOf('LogImageUtils') >= 0 || l.indexOf('Error creating texture') >= 0 || l.indexOf('LogTexture') >= 0)
                                .slice(-4).map(l => l.slice(-110));
                            log('UE日志(' + hits.length + '):');
                            hits.forEach(l => log(l));
                        } else { log('读不到日志文件'); }
                    } catch (e3) { log('读日志失败: ' + e3); }
                }, 2000);
            }
        } catch (e) {
            if (!errLogged) { log('纯 JS 抓帧失败: ' + e); errLogged = true; }
        }
    };

    setInterval(function () { B.Pump(); }, 100);

    setInterval(function () {
        if (!wv || !PNG) { return; }
        try {
            // takeSnapshotWithConfiguration:completionHandler:
            // block 签名 v@?@@（返回 void，block 自身 @?，参数 UIImage* / NSError*）
            invoke('#' + wv, 'takeSnapshotWithConfiguration:completionHandler:',
                [{ t: 'n', v: 0 }, { t: 'bl', sig: 'v@?@@', cb: 7 }]);
        } catch (e) {
            if (!errLogged) { log('takeSnapshot 失败: ' + e); errLogged = true; }
        }
    }, 500);

    log('网页纹理验证页已建 版本 ' + VERSION);
} catch (e) {
    log('错误: ' + e);
}
