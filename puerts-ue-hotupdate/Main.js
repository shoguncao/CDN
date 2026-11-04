// Main.js 5.5.0 —— 验证「原生网页画面 → UTexture2D → 画进 UMG」
// 配套 native：UNativeBridgeLib::CaptureViewToTexture(handle, w, h)
const VERSION = '5.5.0';

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

    // ② 定时把网页画面抓成 UTexture2D 并显示
    let frames = 0, errLogged = false;
    setInterval(function () {
        if (!wv) { return; }
        try {
            const tex = UE.NativeBridgeLib.CaptureViewToTexture(wv, WV_W, WV_H);
            if (!tex) {
                if (!errLogged) { log('CaptureViewToTexture 返回 null'); errLogged = true; }
                return;
            }
            img.SetBrushFromTexture(tex);
            frames++;
            if (frames === 1) { log('★ 首帧纹理已显示（看容器里有没有网页）'); }
            if (frames % 20 === 0) { log('已刷新 ' + frames + ' 帧'); }
        } catch (e) {
            if (!errLogged) { log('抓纹理失败: ' + e); errLogged = true; }
        }
    }, 500);

    log('网页纹理验证页已建 版本 ' + VERSION);
} catch (e) {
    log('错误: ' + e);
}
