// Main.js 5.4.0 —— 容器（宽高为屏幕 0.618，居中）+ 右上角关闭按钮 + 中间网页
const VERSION = '5.4.0';

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

    // ---- 验证：Puerts 本身能渲染纹理吗（全 JS，未改 native）----
    //   建一张渲染目标纹理（CreateRenderTarget2D 是 UFUNCTION）→ 填成红色
    //   → 用 UImage 显示。用 SetBrushResourceObject（收 UObject*，能接
    //     UTextureRenderTarget2D）；SetBrushFromTexture 只收 UTexture2D，接不了 RT
    const rtW = 512, rtH = 288;
    const rt  = UE.KismetRenderingLibrary.CreateRenderTarget2D(world, rtW, rtH);
    UE.KismetRenderingLibrary.ClearRenderTarget2D(world, rt, new UE.LinearColor(1, 0.2, 0.2, 1));
    log('纹理已建 rt=' + rt);

    const img = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
    const iSlot = canvas.AddChild(img);
    iSlot.SetSize(new UE.Vector2D(s.X - 5, s.Y - 5));
    iSlot.SetPosition(new UE.Vector2D(p.X + 2.5, p.Y + 2.5));
    img.SetBrushResourceObject(rt);

    // 30fps 更新纹理，颜色在 10 秒内 红→绿→红 渐变一次
    //   帧率 30fps → 每 1000/30 ≈ 33ms 一帧；周期 10s → 300 帧走完一个来回
    //   t   = 帧号 / 30                       （秒）
    //   s   = 0.5 * (1 - cos(2π·t / 10))      （0→1→0，余弦缓动比线性三角波平滑）
    //   颜色 = (1-s, s, 0, 1)                 （s=0 红，s=1 绿）
    const FPS = 30, PERIOD = 10;
    let tick = 0;
    setInterval(function () {
        tick++;
        const t = tick / FPS;
        const k = 0.5 * (1 - Math.cos(2 * Math.PI * t / PERIOD));
        UE.KismetRenderingLibrary.ClearRenderTarget2D(world, rt,
            new UE.LinearColor(1 - k, k, 0, 1));
    }, Math.round(1000 / FPS));

    // ① 展示网页：不直接加到 UMG 画布，而是交给 WidgetComponent（World 空间 → 虚拟窗口）
    //    World 空间下组件会建 SVirtualWindow（WidgetComponent.cpp:1631），把网页承载的那棵
    //    控件树画进一张渲染目标 → 以 3D 面片的形式显示在场景里（同时也就有 RT 可取纹理）。
    //    注意：承载网页的 widget 从头到尾不 AddToViewport，否则浏览器会把父窗口
    //    缓存成"真实窗口"（SWebBrowserView.cpp:233 只记录一次），就再也进不了纹理模式。
    try {
        const w2  = UE.WidgetBlueprintLibrary.Create(world, UE.HotUpdateWidget.StaticClass(), pc);
        const wt2 = w2.WidgetTree;
        let root2 = wt2.RootWidget;
        if (!root2) {                       // 未进 viewport 的 widget，根节点还没建
            root2 = UE.NewObject(UE.CanvasPanel.StaticClass(), wt2);
            wt2.RootWidget = root2;
        }
        const b2 = UE.NewObject(UE.WebBrowser.StaticClass(), wt2);
        const s2 = root2.AddChild(b2);
        s2.SetSize(new UE.Vector2D(1280, 720));
        s2.SetPosition(new UE.Vector2D(0, 0));
        b2.LoadURL('https://www.qq.com');

        // 摆到相机正前方（World 空间的面片要摆好位置才看得见）
        const cam  = UE.GameplayStatics.GetPlayerCameraManager(world, 0);
        const cLoc = cam.GetCameraLocation();
        const fwd  = UE.KismetMathLibrary.GetForwardVector(cam.GetCameraRotation());
        const DW = 1280, DH = 720;
        const tanV = Math.tan(cam.GetFOVAngle() * Math.PI / 360) / (vp.X / vp.Y);
        const dist = (DH / 2) / tanV;                       // 让面片高度铺满垂直视野
        const wLoc = new UE.Vector(cLoc.X + fwd.X * dist, cLoc.Y + fwd.Y * dist, cLoc.Z + fwd.Z * dist);

        const pawn = UE.GameplayStatics.GetPlayerPawn(world, 0);
        const comp = UE.NewObject(UE.WidgetComponent.StaticClass(), pawn);
        comp.SetWidgetSpace(UE.EWidgetSpace.World);          // World 才建虚拟窗口
        comp.SetDrawSize(new UE.Vector2D(DW, DH));
        comp.RegisterComponent();
        try { comp.SetTickWhenOffscreen(true); } catch (e) { log('SetTickWhenOffscreen 失败: ' + e); }
        comp.SetWidget(w2);
        comp.K2_SetWorldLocationAndRotation(wLoc,
            UE.KismetMathLibrary.FindLookAtRotation(wLoc, cLoc), false, new UE.HitResult(), false);
        log('网页已交给 WidgetComponent（World 空间，相机前方 ' + Math.round(dist) + 'cm）');

        // ② 取纹理：GetRenderTarget() 是 UFUNCTION（WidgetComponent.h:187）
        //    渲染目标要等组件画过第一帧才存在，所以每 500ms 试一次，拿到就停
        let tries = 0;
        const timer = setInterval(function () {
            tries++;
            const rt2 = comp.GetRenderTarget();
            if (rt2) {
                clearInterval(timer);
                log('② 取到纹理 ✓ 对象=' + UE.KismetSystemLibrary.GetObjectName(rt2));
                img.SetBrushResourceObject(rt2);      // 把中间那块图片换成组件纹理
            } else if (tries >= 10) {
                clearInterval(timer);
                log('② 试了 10 次仍拿不到纹理 ✗');
            }
        }, 500);
    } catch (e) {
        log('建 WidgetComponent 失败: ' + e);
    }

    // 关闭按钮：容器右上角外侧
    const btn = UE.NewObject(UE.Button.StaticClass(), w.WidgetTree);
    btn.SetBackgroundColor(new UE.LinearColor(0.9, 0.2, 0.2, 1));
    const txt = UE.NewObject(UE.TextBlock.StaticClass(), w.WidgetTree);
    txt.SetText(T('✕'));
    btn.AddChild(txt);
    const btnSlot = canvas.AddChild(btn);
    btnSlot.SetSize(new UE.Vector2D(64, 64));
    btnSlot.SetPosition(new UE.Vector2D(p.X + s.X - 64, p.Y - 32));
    btn.OnClicked.Add(function () { w.RemoveFromViewport(); });

    log('纹理验证页已建 版本 ' + VERSION);
} catch (e) {
    log('错误: ' + e);
}
