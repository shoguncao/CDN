// Main.js 1.2.0 —— 建界面并加载 https://www.qq.com
const VERSION = '1.2.0';

let world = puerts.argv.getByName('World');

// PrintString 的绘制位置引擎写死在左上角，改不了坐标，只能靠空格把文字往右推，
// 避开 iPhone 横屏时的刘海（不够就加大下面的数字）
const PAD = ' '.repeat(24);

function log(m) {
    UE.KismetSystemLibrary.PrintString(world, PAD + m, true, true, new UE.LinearColor(0.2, 0.8, 1, 1), 60);
}

log('版本 ' + VERSION);

try {
    let pc = UE.GameplayStatics.GetPlayerController(world, 0);
    // 不能用 UE.UserWidget：它是抽象类，Create 必返回 null
    let w = UE.WidgetBlueprintLibrary.Create(world, UE.HotUpdateWidget.StaticClass(), pc);
    w.AddToViewport(0);                          // 必须：UMG 在这一步才建好控件树
    let canvas = w.WidgetTree.RootWidget;
    // 不能用 tree.ConstructWidget（不是 UFUNCTION，反射调不到），用 UE.NewObject
    // 半透明底板：用来看清容器实际占的位置和大小（确认无误后删掉这几行）
    // 注意不能用 Border：它默认的 Background brush 是空的（DrawAs=NoDrawingType），什么都不画
    let bg = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
    bg.SetColorAndOpacity(new UE.LinearColor(1, 0, 0, 0.35));
    let bgSlot = canvas.AddChild(bg);
    bgSlot.SetZOrder(1);      // 提到网页上层：iOS 的 WebView 是原生视图盖在最上面，不提层级会被它完全挡住

    let browser = UE.NewObject(UE.WebBrowser.StaticClass(), w.WidgetTree);
    let slot = canvas.AddChild(browser);
    browser.LoadURL('https://www.qq.com');

    // 同步设置尺寸（不能用 setTimeout：puerts 的定时器线程只在 WITH_NODEJS 时创建，
    // 而 iOS 打包 UseNodejs=false，setTimeout 根本不会触发）
    let vp = UE.WidgetLayoutLibrary.GetViewportSize(world);
    log('viewport=' + vp.X + 'x' + vp.Y);
    let s = new UE.Vector2D(vp.X * 0.618, vp.Y * 0.618);
    let p = new UE.Vector2D((vp.X - s.X) / 2, (vp.Y - s.Y) / 2);   // 居中
    bgSlot.SetSize(s);                                             // 容器（UMG 绘制，位置正确）
    bgSlot.SetPosition(p);
    let m = 3;                                                     // 网页比容器小 3px，红边露出来

    // 网页要补偿：iOS 上原生 WebView 的 frame 会被 IOSView.contentScaleFactor 缩小
    // （IOSPlatformWebBrowser.cpp:116-118 除以 CSF），而 UE 渲染 buffer 由
    // r.MobileContentScaleFactor 决定，两者不匹配 -> 位置和尺寸整体 x0.728（本机实测）。
    // 治本：r.MobileContentScaleFactor=0（原生分辨率，与 nativeScale 一致），届时 COMP 改回 1
    const COMP = 1.374;
    slot.SetSize(new UE.Vector2D((s.X - m) * COMP, (s.Y - m) * COMP));
    slot.SetPosition(new UE.Vector2D((p.X + m / 2) * COMP, (p.Y + m / 2) * COMP));

    // 右上角关闭按钮
    // 必须放在网页区域之外：iOS 的 WebView 是原生 UIView，盖在所有 UE 内容之上，
    // 落在它范围内的 UMG 按钮会被盖住且点不到
    let bs = 64;
    let btn = UE.NewObject(UE.Button.StaticClass(), w.WidgetTree);
    // 按钮内容用 Image：UButton 运行时 new 的默认 Style 是空 brush（不画），TextBlock 又没字体，都不可见
    let icon = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
    icon.SetColorAndOpacity(new UE.LinearColor(1, 1, 1, 0.9));
    btn.AddChild(icon);
    let btnSlot = canvas.AddChild(btn);
    btnSlot.SetZOrder(2);
    btnSlot.SetSize(new UE.Vector2D(bs, bs));
    btnSlot.SetPosition(new UE.Vector2D(p.X + s.X - bs, p.Y - bs));   // 右下角贴住容器右上角
    btn.OnClicked.Add(function () { w.RemoveFromViewport(); });

    canvas.ForceLayoutPrepass();                                   // 立即重算布局

    log('网页已加载');
} catch (e) {
    log('错误: ' + e);
}
