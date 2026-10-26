// Main.js 1.4.0 —— 建界面并加载 https://www.qq.com
const VERSION = '1.4.0';

let world = puerts.argv.getByName('World');

// PrintString 的绘制位置引擎写死在左上，只能靠空格把字往右推，避开 iPhone 刘海
const PAD = ' '.repeat(24);

function log(m) {
    UE.KismetSystemLibrary.PrintString(world, PAD + m, true, true, new UE.LinearColor(0.2, 0.8, 1, 1), 60);
}

log('版本 ' + VERSION);

try {
    let pc = UE.GameplayStatics.GetPlayerController(world, 0);
    // UE.UserWidget 是抽象类，Create 必返回 null，必须用非抽象子类
    let w = UE.WidgetBlueprintLibrary.Create(world, UE.HotUpdateWidget.StaticClass(), pc);
    w.AddToViewport(0);                          // 必须：UMG 在这一步才建好控件树
    let canvas = w.WidgetTree.RootWidget;

    // 容器：半透明红底，网页比它小一圈让边框露出来
    // ZOrder 提到网页上层，否则被 iOS 原生 WebView（盖在所有 UE 内容之上）完全遮住
    let bg = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
    bg.SetColorAndOpacity(new UE.LinearColor(1, 0, 0, 0.35));
    let bgSlot = canvas.AddChild(bg);
    bgSlot.SetZOrder(1);

    // tree.ConstructWidget 不是 UFUNCTION（反射调不到），用 UE.NewObject
    let browser = UE.NewObject(UE.WebBrowser.StaticClass(), w.WidgetTree);
    let slot = canvas.AddChild(browser);
    browser.LoadURL('https://www.qq.com');

    // GetViewportSize 返回渲染 buffer，UMG 布局坐标系 = buffer / DPIScale（本机 0.728）
    let vp = UE.WidgetLayoutLibrary.GetViewportSize(world);
    const DS = 1.374;
    let vx = vp.X * DS;
    let vy = vp.Y * DS;
    let s = new UE.Vector2D(vx * 0.618, vy * 0.618);
    let p = new UE.Vector2D((vx - s.X) / 2, (vy - s.Y) / 2);
    bgSlot.SetSize(s);
    bgSlot.SetPosition(p);
    let m = 5;                                     // 网页比容器小 5px，红边露出约 2.5px/边
    slot.SetSize(new UE.Vector2D(s.X - m, s.Y - m));
    slot.SetPosition(new UE.Vector2D(p.X + m / 2, p.Y + m / 2));

    // 关闭按钮：必须放在网页区域之外，否则被 iOS 原生 WebView（盖在所有 UE 内容之上）挡住
    // 内容用 Image：UButton 运行时 new 的默认 Style 是空 brush，不画任何东西
    let btn = UE.NewObject(UE.Button.StaticClass(), w.WidgetTree);
    let icon = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
    icon.SetColorAndOpacity(new UE.LinearColor(1, 1, 1, 0.9));
    btn.AddChild(icon);
    let btnSlot = canvas.AddChild(btn);
    btnSlot.SetSize(new UE.Vector2D(64, 64));
    btnSlot.SetPosition(new UE.Vector2D(p.X + s.X - 64, p.Y - 64));
    btn.OnClicked.Add(function () { w.RemoveFromViewport(); });

    log('网页已加载');
} catch (e) {
    log('错误: ' + e);
}
