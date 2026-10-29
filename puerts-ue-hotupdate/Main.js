// Main.js 2.3.0 —— 容器 + 中间一个按钮：点击创建一个红色 UIView(100x200) 加到主 window 上
const VERSION = '2.3.0';

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

// 点击：[[UIView alloc] initWithFrame:CGRectMake(...)] → 红色 → 加到主 window
// 每步都打日志：万一崩溃，最后一行就指明是哪一步
function addRedView() {
    const alloc = invoke('UIView', 'alloc', []);
    log('步骤1 alloc -> ' + alloc);

    const view = invoke('#' + alloc, 'initWithFrame:', [{ t: 'st', v: [20, 100, 100, 200] }]);  // x,y,w,h
    log('步骤2 initWithFrame -> ' + view);

    const red = invoke('UIColor', 'redColor', []);
    log('步骤3 UIColor.redColor -> ' + red);

    invoke('#' + view, 'setBackgroundColor:', [h(red)]);
    log('步骤4 setBackgroundColor 完成');

    const app = invoke('UIApplication', 'sharedApplication', []);
    log('步骤5 sharedApplication -> ' + app);

    const win = invoke('#' + app, 'keyWindow', []);
    log('步骤6 keyWindow -> ' + win);

    invoke('#' + win, 'addSubview:', [h(view)]);
    log('步骤7 addSubview 完成，句柄=' + view);
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
    btn.OnClicked.Add(function () {
        try { addRedView(); } catch (e) { log('错误: ' + e); }
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
