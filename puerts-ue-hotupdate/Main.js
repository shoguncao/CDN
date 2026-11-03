// Main.js 5.2.1 —— 容器(0.618) + 右上角关闭按钮 + 中间网页
// 网页内容是**我们自己写的页面**（用 LoadString 塞 HTML，不需要另外部署）：
//   下层 = iframe 里的外部网页（www.qq.com）
//   上层 = 运营层（DOM，绝对定位盖在网页上，可点）
//   点运营按钮 → 跳 myapp://xxx → 游戏用 OnUrlChanged 拦截
const VERSION = '5.2.1';

let world = puerts.argv.getByName('World');
const PAD = ' '.repeat(24);                       // PrintString 位置写死在左上，靠空格避开刘海

function log(m) {
    UE.KismetSystemLibrary.PrintString(world, PAD + m, true, true, new UE.LinearColor(0.2, 0.8, 1, 1), 60);
}
// Puerts 默认定义 PUERTS_FTEXT_AS_OBJECT（JsEnv.Build.cs:87）：FText 是对象模式，
// SetText 直接传 JS 字符串会被当指针解析而崩溃，必须先用 Conv_StringToText 转换
function T(s) { return UE.KismetTextLibrary.Conv_StringToText(s); }

// 我们自己的页面：iframe 嵌一个外部网页（这里是 qq.com），运营层盖在上面
// 验证的机制：外部网页我们改不了，但只要**外层页面是我们自己的**，
// 就能在它之上画运营层（可点），并通过 myapp:// 回传游戏
const PAGE_URL = 'https://www.qq.com';
const HTML = [
    '<html><head><meta name="viewport" content="width=device-width,initial-scale=1">',
    '<style>',
    '  html,body{margin:0;height:100%;overflow:hidden;font:15px -apple-system,sans-serif}',
    '  iframe{position:absolute;left:0;top:0;width:100%;height:100%;border:0}',
    '  #ops{position:absolute;left:0;right:0;bottom:0;padding:10px 12px;background:rgba(0,0,0,.6);color:#fff}',
    '  #ops .title{margin-bottom:8px;opacity:.9}',
    '  #ops a{display:inline-block;margin:0 8px 0 0;padding:9px 14px;background:#ff5a5f;color:#fff;',
    '         border-radius:8px;text-decoration:none;font-size:15px}',
    '</style></head><body>',
    '<iframe src="' + PAGE_URL + '"></iframe>',
    '<div id="ops">',
    '  <div class="title">运营层（盖在网页之上，可点）</div>',
    '  <a href="myapp://recharge?id=1">充值</a>',
    '  <a href="myapp://gift?id=2">领取礼包</a>',
    '  <a href="myapp://close">关闭</a>',
    '</div>',
    '</body></html>'
].join('');

try {
    const pc = UE.GameplayStatics.GetPlayerController(world, 0);
    // UE.UserWidget 是抽象类，Create 必返回 null，必须用非抽象子类
    const w = UE.WidgetBlueprintLibrary.Create(world, UE.HotUpdateWidget.StaticClass(), pc);
    w.AddToViewport(0);                              // 必须：UMG 在这一步才建好控件树
    const canvas = w.WidgetTree.RootWidget;

    const vp = UE.WidgetLayoutLibrary.GetViewportSize(world);
    const DS = 1.374;                                // UMG 布局坐标系 = 渲染 buffer / DPIScale
    const vx = vp.X * DS, vy = vp.Y * DS;
    const s  = new UE.Vector2D(vx * 0.618, vy * 0.618);
    const p  = new UE.Vector2D((vx - s.X) / 2, (vy - s.Y) / 2);

    // 容器：半透明底
    const bg = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
    bg.SetColorAndOpacity(new UE.LinearColor(1, 1, 1, 0.2));
    const bgSlot = canvas.AddChild(bg);
    bgSlot.SetSize(s);
    bgSlot.SetPosition(p);

    // 网页：比容器小一圈，露出容器边框。内容是我们自己的 HTML
    const browser = UE.NewObject(UE.WebBrowser.StaticClass(), w.WidgetTree);
    const bSlot = canvas.AddChild(browser);
    const m = 5;
    bSlot.SetSize(new UE.Vector2D(s.X - m, s.Y - m));
    bSlot.SetPosition(new UE.Vector2D(p.X + m / 2, p.Y + m / 2));

    // 网页 → 游戏：拦截自定义协议
    browser.OnUrlChanged.Add(function (text) {
        const u = String(text);
        if (u.indexOf('myapp://') !== 0) { return; }
        const cmd = u.slice(8);
        log('网页指令: ' + cmd);
        if (cmd.indexOf('close') === 0) { w.RemoveFromViewport(); }
        // 例：myapp://recharge?id=1 → 在这里拉起你们的充值流程
    });

    browser.LoadString(HTML, PAGE_URL);

    // 关闭按钮：故意横跨容器上边沿——上半露在网页外，下半被网页盖住，
    // 用来直观看到"原生 WebView 压在所有 UE 内容之上"
    const btn = UE.NewObject(UE.Button.StaticClass(), w.WidgetTree);
    btn.SetBackgroundColor(new UE.LinearColor(0.9, 0.2, 0.2, 1));
    const txt = UE.NewObject(UE.TextBlock.StaticClass(), w.WidgetTree);
    txt.SetText(T('✕'));
    btn.AddChild(txt);
    const btnSlot = canvas.AddChild(btn);
    btnSlot.SetSize(new UE.Vector2D(64, 64));
    btnSlot.SetPosition(new UE.Vector2D(p.X + s.X - 64, p.Y - 32));
    btn.OnClicked.Add(function () { w.RemoveFromViewport(); });

    log('网页页面已建 版本 ' + VERSION + '（' + PAGE_URL + '）');
} catch (e) {
    log('错误: ' + e);
}
