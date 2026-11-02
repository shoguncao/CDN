// Main.js 4.2.0 —— WebView 遮挡验证页（用 UE/Puerts 的 WebBrowser 控件，不是原生桥）
// 布局：左边一个按钮；右边底部展示网页，网页上方一个按钮
// 右下角还有一组"探针"（UMG 红块 + UMG 按钮），用来判定网页会不会遮住 UE 绘制的内容
const VERSION = '4.2.0';

let world = puerts.argv.getByName('World');
const PAD = ' '.repeat(24);                       // PrintString 位置写死在左上，靠空格避开刘海

function log(m) {
    UE.KismetSystemLibrary.PrintString(world, PAD + m, true, true, new UE.LinearColor(0.2, 0.8, 1, 1), 60);
}
// Puerts 默认定义 PUERTS_FTEXT_AS_OBJECT（JsEnv.Build.cs:87）：FText 是对象模式，
// SetText 直接传 JS 字符串会被当指针解析而崩溃，必须先用 Conv_StringToText 转换
function T(s) { return UE.KismetTextLibrary.Conv_StringToText(s); }

const URL = 'https://www.qq.com';

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
    }

    // 右半区：底部网页，网页上方一个按钮
    const rx = vx * 0.35, rw = vx * 0.60;
    const wvY = vy * 0.55, wvH = vy * 0.38;

    // ① 左边：只有一个按钮
    makeBtn('加载网页', vx * 0.05, vy * 0.42, vx * 0.28, 60, function () {
        try { browser.LoadURL(URL); show('已加载 ' + URL); }
        catch (e) { show('加载失败: ' + e, false); }
    });

    // ② 网页上方的按钮
    makeBtn('重新加载', rx, vy * 0.47, rw, 50, function () {
        try { browser.Reload(); show('已重新加载'); }
        catch (e) { show('重载失败: ' + e, false); }
    }, new UE.LinearColor(0.15, 0.45, 0.35, 1));

    // 探针：与网页完全重叠的 UMG 元素（先加，层级在网页之下）
    const probe = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
    probe.SetColorAndOpacity(new UE.LinearColor(1, 0.2, 0.2, 1));
    const probeSlot = canvas.AddChild(probe);
    probeSlot.SetSize(new UE.Vector2D(rw - 40, wvH - 40));
    probeSlot.SetPosition(new UE.Vector2D(rx + 20, wvY + 20));

    makeBtn('UE 按钮（被遮住就点不到）', rx + 40, wvY + 60, rw - 80, 50,
        function () { show('UE 按钮被点到了 → 该处 UE 仍在最上层'); },
        new UE.LinearColor(0.9, 0.6, 0.1, 1));

    // 网页本体：UE/Puerts 的方式（WebBrowserWidget 插件的 UMG 控件）
    // 注意：UE.NewObject 创建，不是我们 NativeBridge 造的 WKWebView
    const browser = UE.NewObject(UE.WebBrowser.StaticClass(), w.WidgetTree);
    const bSlot = canvas.AddChild(browser);
    bSlot.SetSize(new UE.Vector2D(rw, wvH));
    bSlot.SetPosition(new UE.Vector2D(rx, wvY));
    browser.LoadURL(URL);

    // 关闭按钮
    makeBtn('✕', vx - 84, 20, 64, 64, function () { w.RemoveFromViewport(); },
        new UE.LinearColor(0.6, 0.15, 0.15, 1));

    log('WebView 验证页已建（UE WebBrowser 控件）版本 ' + VERSION);
} catch (e) {
    log('错误: ' + e);
}
