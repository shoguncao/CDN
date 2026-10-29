// Main.js 2.7.0 —— 容器 + 中间一个按钮：点击创建一个红色 UIView(100x200) 加到界面上
// 判读方式：容器变绿=成功（左侧出现红方块）；容器变黄=失败（红=成功目标，故失败不用红色）
const VERSION = '2.7.0';

let world = puerts.argv.getByName('World');

// PrintString 的绘制位置引擎写死在左上，只能靠空格把字往右推，避开 iPhone 刘海
const PAD = ' '.repeat(24);

function log(m) {
    UE.KismetSystemLibrary.PrintString(world, PAD + m, true, true, new UE.LinearColor(0.2, 0.8, 1, 1), 60);
}

log('版本 ' + VERSION);

// ---- 通用原生调用通道（cpp.NativeBridge）----
const B = require('cpp').NativeBridge;

function arg(v) {                                   // JS 值 → {t, v}
    if (v === null || v === undefined) return { t: 'n', v: 0 };
    if (typeof v === 'boolean')        return { t: 'b', v: v };
    if (typeof v === 'string')         return { t: 's', v: v };
    if (typeof v === 'number')         return { t: Number.isInteger(v) ? 'i' : 'd', v: v };
    return v;                                       // 已编码的 {t:'h'} / {t:'st'}
}

const h = id => ({ t: 'h', v: id });                // 传对象句柄

function invoke(target, method, args) {
    const r = JSON.parse(B.Invoke(String(target), method, JSON.stringify((args || []).map(arg)), ''));
    if (r.t === 'e') throw new Error(r.v);
    return r.v;                                     // 对象返回值就是句柄 number
}

// 点击：造一个红色 UIView(100x200)，加到根控制器的 view 上
// 注意：不能往 UIWindow 直接 addSubview（iOS 16+ 会触发 UIKit 内部断言
// -[UIView(Internal) _didMoveFromWindow:toWindow:] 直接 abort，崩溃报告已确认），
// 必须加到 window.rootViewController.view。
function addRedView() {
    const view = invoke('#' + invoke('UIView', 'alloc', []), 'initWithFrame:', [{ t: 'st', v: [20, 100, 100, 200] }]);
    log('1 视图=' + view);
    invoke('#' + view, 'setBackgroundColor:', [h(invoke('UIColor', 'redColor', []))]);
    log('2 底色已设');

    const app = invoke('UIApplication', 'sharedApplication', []);
    const del = invoke('#' + app, 'delegate', []);
    const win = del ? invoke('#' + del, 'window', []) : invoke('#' + app, 'keyWindow', []);
    log('3 app=' + app + ' del=' + del + ' win=' + win);

    let rvc = invoke('#' + win, 'rootViewController', []);
    if (!rvc) {                                   // 没有根控制器就现造一个
        rvc = invoke('#' + invoke('UIViewController', 'alloc', []), 'init', []);
        invoke('#' + win, 'setRootViewController:', [h(rvc)]);
    }
    const root = invoke('#' + rvc, 'view', []);
    log('4 rvc=' + rvc + ' root=' + root);

    invoke('#' + root, 'addSubview:', [h(view)]);
    log('5 addSubview 完成');
}

try {
    const pc = UE.GameplayStatics.GetPlayerController(world, 0);
    // UE.UserWidget 是抽象类，Create 必返回 null，必须用非抽象子类
    const w = UE.WidgetBlueprintLibrary.Create(world, UE.HotUpdateWidget.StaticClass(), pc);
    w.AddToViewport(0);                              // 必须：UMG 在这一步才建好控件树
    const canvas = w.WidgetTree.RootWidget;

    // 容器：半透明红底，居中
    const bg = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
    bg.SetColorAndOpacity(new UE.LinearColor(1, 0, 0, 0.35));
    const bgSlot = canvas.AddChild(bg);

    // GetViewportSize 返回渲染 buffer，UMG 布局坐标系 = buffer / DPIScale（本机 0.728）
    const vp = UE.WidgetLayoutLibrary.GetViewportSize(world);
    const DS = 1.374;
    const vx = vp.X * DS;
    const vy = vp.Y * DS;
    const s = new UE.Vector2D(vx * 0.618, vy * 0.618);
    const p = new UE.Vector2D((vx - s.X) / 2, (vy - s.Y) / 2);
    bgSlot.SetSize(s);
    bgSlot.SetPosition(p);

    // 中间的按钮：内容用 Image，UButton 运行时 new 的默认 Style 是空 brush
    const btn = UE.NewObject(UE.Button.StaticClass(), w.WidgetTree);
    const icon = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
    icon.SetColorAndOpacity(new UE.LinearColor(0.2, 0.8, 1, 0.9));
    btn.AddChild(icon);
    const btnSlot = canvas.AddChild(btn);
    btnSlot.SetSize(new UE.Vector2D(s.X - 40, 120));
    btnSlot.SetPosition(new UE.Vector2D(p.X + 20, p.Y + (s.Y - 120) / 2));
    // 成功/失败用容器颜色反馈，来不及看日志也能判断。
    // 注意：失败色不能是红色 —— 成功的目标本身就是一个红色方块，会混淆
    btn.OnClicked.Add(function () {
        try {
            addRedView();
            bg.SetColorAndOpacity(new UE.LinearColor(0.2, 0.9, 0.3, 0.45));   // 绿=成功
        } catch (e) {
            log('错误: ' + e);
            bg.SetColorAndOpacity(new UE.LinearColor(1, 0.9, 0.1, 0.6));       // 黄=失败
        }
    });

    // 关闭按钮：容器右上角外侧
    const closeBtn = UE.NewObject(UE.Button.StaticClass(), w.WidgetTree);
    const closeIcon = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
    closeIcon.SetColorAndOpacity(new UE.LinearColor(1, 1, 1, 0.9));
    closeBtn.AddChild(closeIcon);
    const closeSlot = canvas.AddChild(closeBtn);
    closeSlot.SetSize(new UE.Vector2D(64, 64));
    closeSlot.SetPosition(new UE.Vector2D(p.X + s.X - 64, p.Y - 64));
    closeBtn.OnClicked.Add(function () { w.RemoveFromViewport(); });

    log('界面已建');
} catch (e) {
    log('错误: ' + e);
}
