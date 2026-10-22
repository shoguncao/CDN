// Main.js —— 从 CDN 下载后在内存中执行（热更业务脚本）
// 功能：在屏幕正中显示网页（大小为全屏一半）；缺少插件时给出提示而不是崩溃
//
// 每次改动请 +1：屏幕开头会打出这个版本号，用来确认客户端拉到的是哪一版
const VERSION = '1.0.1';

let world = puerts.argv.getByName('World');

function showMsg(msg, r, g, b) {
    let color = new UE.LinearColor(r, g, b, 1.0);
    UE.KismetSystemLibrary.PrintString(world, msg, true, true, color, 30.0);
}

// 先把版本号打到屏幕上：确认拉到的脚本是哪一版（热更是否生效）
showMsg('Main.js 版本: ' + VERSION, 0.2, 0.8, 1.0);

try {
    // 网页控件来自 WebBrowserWidget 插件，没启用时这里拿不到类。
    // 先检查再决定是否继续：不检查就往下走会崩进程（UE 内部断言 -> abort）
    let webClass = null;
    if (UE.WebBrowser && UE.WebBrowser.StaticClass) {
        webClass = UE.WebBrowser.StaticClass();
    }
    if (!webClass) {
        showMsg('无法显示网页：本包缺少 WebBrowserWidget 插件', 1.0, 0.3, 0.2);
        return;
    }

    // UUserWidget 必须用 CreateWidget 创建：
    // 用 new 会触发 UE 内部 check() 断言 -> abort -> 进程被杀，try/catch 兜不住
    let pc = UE.GameplayStatics.GetPlayerController(world, 0);
    let widget = UE.WidgetBlueprintLibrary.Create(world, UE.UserWidget.StaticClass(), pc);
    let tree = widget.WidgetTree;
    let canvas = tree.ConstructWidget(UE.CanvasPanel.StaticClass());
    tree.RootWidget = canvas;

    // 网页控件：居中，大小为全屏一半
    let browser = tree.ConstructWidget(webClass);
    let slot = canvas.AddChild(browser);
    slot.SetAnchors(new UE.Anchors(0.5, 0.5));
    slot.SetAlignment(new UE.Vector2D(0.5, 0.5));
    slot.SetSize(new UE.Vector2D(960, 540));

    browser.LoadURL('https://www.qq.com');
    widget.AddToViewport(0);

    showMsg('网页已加载', 0.2, 1.0, 0.3);
} catch (e) {
    showMsg('JS 错误: ' + e, 1.0, 0.2, 0.2);
}
