// Main.js 1.3.0 —— 建界面并加载 https://www.qq.com
const VERSION = '1.3.0';

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

    // 注意：GetViewportSize 返回的是渲染 buffer 尺寸，而 UMG 布局坐标系 = buffer / DPIScale
    // （本机实测 1704 的 buffer 对应约 2340 的布局系，即 DPIScale≈0.728，需反向放大）。
    // 容器/网页/按钮必须统一用换算后的坐标，否则互相错位
    const DS = 1.374;
    let vx = vp.X * DS;
    let vy = vp.Y * DS;
    let s = new UE.Vector2D(vx * 0.618, vy * 0.618);
    let p = new UE.Vector2D((vx - s.X) / 2, (vy - s.Y) / 2);       // 居中
    bgSlot.SetSize(s);                                             // 容器
    bgSlot.SetPosition(p);
    let m = 3;                                                     // 网页比容器小 3px，红边露出来
    slot.SetSize(new UE.Vector2D(s.X - m, s.Y - m));
    slot.SetPosition(new UE.Vector2D(p.X + m / 2, p.Y + m / 2));

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
