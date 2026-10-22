// Main.js —— 诊断版：把创建 UMG 容器相关的 API 状态全打到屏幕上
const VERSION = '1.0.2';

let world = puerts.argv.getByName('World');

function log(msg) {
    let color = new UE.LinearColor(0.2, 0.8, 1.0, 1.0);
    UE.KismetSystemLibrary.PrintString(world, msg, true, true, color, 60.0);
}

log('=== 版本 ' + VERSION + ' ===');
log('World: ' + (world ? 'OK' : 'null'));
log('WidgetBlueprintLibrary: ' + (typeof UE.WidgetBlueprintLibrary));
log('UserWidget: ' + (typeof UE.UserWidget));
log('WebBrowser: ' + (typeof UE.WebBrowser));

try {
    log('StaticClass 类型: ' + (typeof UE.UserWidget.StaticClass));
    let cls = UE.UserWidget.StaticClass();
    log('cls = ' + cls);
} catch (e) {
    log('StaticClass 出错: ' + e);
}

try {
    let pc = UE.GameplayStatics.GetPlayerController(world, 0);
    log('pc = ' + pc);

    let w = UE.WidgetBlueprintLibrary.Create(world, UE.UserWidget.StaticClass(), pc);
    log('Create 返回 = ' + w);
    if (w) {
        log('WidgetTree = ' + w.WidgetTree);
    }
} catch (e) {
    log('Create 出错: ' + e);
}
