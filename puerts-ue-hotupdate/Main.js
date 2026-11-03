// Main.js 5.0.1 —— 容器（宽高为屏幕 0.618，居中）+ 右上角关闭按钮 + 中间网页
const VERSION = '5.0.1';

let world = puerts.argv.getByName('World');
const PAD = ' '.repeat(24);                       // PrintString 位置写死在左上，靠空格避开刘海

function log(m) {
    UE.KismetSystemLibrary.PrintString(world, PAD + m, true, true, new UE.LinearColor(0.2, 0.8, 1, 1), 60);
}
// Puerts 默认定义 PUERTS_FTEXT_AS_OBJECT（JsEnv.Build.cs:87）：FText 是对象模式，
// SetText 直接传 JS 字符串会被当指针解析而崩溃，必须先用 Conv_StringToText 转换
function T(s) { return UE.KismetTextLibrary.Conv_StringToText(s); }

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

    // 网页：比容器小一圈，露出容器边框
    const browser = UE.NewObject(UE.WebBrowser.StaticClass(), w.WidgetTree);
    const bSlot = canvas.AddChild(browser);
    const m = 5;
    bSlot.SetSize(new UE.Vector2D(s.X - m, s.Y - m));
    bSlot.SetPosition(new UE.Vector2D(p.X + m / 2, p.Y + m / 2));
    browser.LoadURL('https://www.qq.com');

    // 关闭按钮：故意横跨容器上边沿——上半露在网页外，下半被网页盖住，
    // 用它可以直观看到"原生 WebView 压在所有 UE 内容之上"这一事实
    // （要能点到，就得放在网页矩形之外）
    const btn = UE.NewObject(UE.Button.StaticClass(), w.WidgetTree);
    btn.SetBackgroundColor(new UE.LinearColor(0.9, 0.2, 0.2, 1));
    const txt = UE.NewObject(UE.TextBlock.StaticClass(), w.WidgetTree);
    txt.SetText(T('✕'));
    btn.AddChild(txt);
    const btnSlot = canvas.AddChild(btn);
    btnSlot.SetSize(new UE.Vector2D(64, 64));
    btnSlot.SetPosition(new UE.Vector2D(p.X + s.X - 64, p.Y - 32));   // 一半在网页外，一半被盖住
    btn.OnClicked.Add(function () { w.RemoveFromViewport(); });

    log('网页页面已建 版本 ' + VERSION);
} catch (e) {
    log('错误: ' + e);
}
