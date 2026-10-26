// Main.js 1.0.5 —— 建界面并加载 https://www.qq.com
const VERSION = '1.0.5';

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
    // 半透明底板：用来看清容器实际占的位置和大小（确认无误后删掉这两行）
    let bg = UE.NewObject(UE.Border.StaticClass(), w.WidgetTree);
    bg.SetBrushColor(new UE.LinearColor(1, 0, 0, 0.35));
    let bgSlot = canvas.AddChild(bg);

    let browser = UE.NewObject(UE.WebBrowser.StaticClass(), w.WidgetTree);
    let slot = canvas.AddChild(browser);
    browser.LoadURL('https://www.qq.com');

    // 尺寸晚一帧再设：iOS 的原生 WebView 在控件刚加进来时按初始几何创建，
    // 立刻 SetSize 它跟不上（画面只占一小块），等布局完再设就会跟着变
    let vp = UE.WidgetLayoutLibrary.GetViewportSize(world);
    setTimeout(function () {
        let s = new UE.Vector2D(vp.X * 0.618, vp.Y * 0.618);
        let p = new UE.Vector2D((vp.X - s.X) / 2, (vp.Y - s.Y) / 2);   // 居中
        [bgSlot, slot].forEach(function (sl) { sl.SetSize(s); sl.SetPosition(p); });
    }, 100);

    log('网页已加载');
} catch (e) {
    log('错误: ' + e);
}
