// Main.js 5.4.7 —— 容器（宽高为屏幕 0.618，居中）+ 右上角关闭按钮 + 中间网页
const VERSION = '5.4.7';

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

    // ① 建 w2，放一个 WebBrowser，摆在屏幕右侧外面、只露 100 像素（已验证能显示）
    let w2 = null;
    try {
        w2 = UE.WidgetBlueprintLibrary.Create(world, UE.HotUpdateWidget.StaticClass(), pc);
        w2.AddToViewport(0);
        const canvas2 = w2.WidgetTree.RootWidget;
        const b2 = UE.NewObject(UE.WebBrowser.StaticClass(), w2.WidgetTree);
        const s2 = canvas2.AddChild(b2);
        s2.SetSize(new UE.Vector2D(vx * 0.70, vy * 0.70));
        s2.SetPosition(new UE.Vector2D(vx - 100, vy * 0.20));   // 右边露 100
        b2.LoadURL('https://www.qq.com');
        log('w2 网页已显示（右边露 100）根节点=' + (canvas2 ? '有' : 'null'));

        // 顺带打印 UWebBrowser 上有没有取纹理接口（预期全是 undefined）
        let probe = '';
        for (const n of ['GetTexture', 'GetRenderTarget', 'GetViewportTexture']) {
            probe += n + '=' + (typeof b2[n]) + ' ';
        }
        log('UWebBrowser 取纹理接口: ' + probe);
    } catch (e) {
        log('建 w2 网页失败: ' + e);
    }

    // ② 取「w2」的纹理：唯一接口是 UWidgetComponent::GetRenderTarget（WidgetComponent.h:187）
    //    w2 本身没有这个接口，所以要把它交给 WidgetComponent，再取组件画的 RT。
    //    注意：这需要先 w2.RemoveFromViewport()（一个 widget 不能同时属于 viewport 和组件），
    //    所以右边那 100 像素的网页会消失。
    try {
        w2.RemoveFromViewport();
        const comp = UE.NewObject(UE.WidgetComponent.StaticClass(),
            UE.GameplayStatics.GetPlayerPawn(world, 0));
        comp.SetWidgetSpace(UE.EWidgetSpace.World);
        comp.SetDrawSize(new UE.Vector2D(1280, 720));
        comp.RegisterComponent();
        comp.SetTickWhenOffscreen(true);
        comp.SetComponentTickEnabled(true);
        comp.SetWidget(w2);                       // 就是 w2，不新建 widget

        let n = 0;
        const t = setInterval(function () {
            n++;
            const r = comp.GetRenderTarget();
            log('w2 的 GetRenderTarget(' + n + ') → ' + (r ? String(r) : 'null'));
            if (r) {
                try {
                    const px = UE.KismetRenderingLibrary.ReadRenderTargetPixel(world, r, 640, 360);
                    log('w2 RT 中心像素=' + JSON.stringify(px));
                } catch (e) { log('读像素失败: ' + e); }
            }
            if (n >= 3) { clearInterval(t); }
        }, 1000);
    } catch (e) {
        log('取 w2 纹理失败: ' + e);
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
