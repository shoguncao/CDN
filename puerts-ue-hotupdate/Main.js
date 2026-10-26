// Main.js 1.0.3 —— 建界面并加载 https://www.qq.com
const VERSION = '1.0.3';

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
    let browser = UE.NewObject(UE.WebBrowser.StaticClass(), w.WidgetTree);
    canvas.AddChild(browser).SetSize(UE.WidgetLayoutLibrary.GetViewportSize(world));
    browser.LoadURL('https://www.qq.com');
    log('网页已加载');
} catch (e) {
    log('错误: ' + e);
}
