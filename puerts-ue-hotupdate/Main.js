// Main.js 3.0.0 —— NativeBridge 功能自测页面
// 两个按钮：①运行同步用例（覆盖所有类型与能力）②测试异步回调（block + Pump）
// 判读：容器变绿=全部通过，变黄=有失败；结果明细显示在文字块里
const VERSION = '3.0.0';

let world = puerts.argv.getByName('World');
const PAD = ' '.repeat(24);                       // PrintString 位置写死在左上，靠空格避开刘海

function log(m) {
    UE.KismetSystemLibrary.PrintString(world, PAD + m, true, true, new UE.LinearColor(0.2, 0.8, 1, 1), 60);
}
// Puerts 默认定义了 PUERTS_FTEXT_AS_OBJECT（JsEnv.Build.cs:87），
// 即 FText 是对象模式：SetText 直接传 JS 字符串会被当指针解析而崩溃，必须先转换
function T(s) { return UE.KismetTextLibrary.Conv_StringToText(s); }

const B = require('cpp').NativeBridge;

function arg(v) {
    if (v === null || v === undefined) return { t: 'n', v: 0 };
    if (typeof v === 'boolean')        return { t: 'b', v: v };
    if (typeof v === 'string')         return { t: 's', v: v };
    if (typeof v === 'number')         return { t: Number.isInteger(v) ? 'i' : 'd', v: v };
    return v;
}
const h = id => ({ t: 'h', v: id });              // 传对象句柄

// target: 类名（类方法）或 '#句柄'（实例方法）；opts: 'thread=current' 表示不切主线程
function invoke(target, method, args, sig, opts) {
    const r = JSON.parse(B.Invoke(String(target), method,
        JSON.stringify((args || []).map(arg)), sig || '', opts || ''));
    if (r.t === 'e') throw new Error(r.v);
    return r.v;
}
// 调用 C 函数：sig 第一个类型编码是返回值，其余为参数
function callC(name, sig, args) {
    const r = JSON.parse(B.CallCFunc(name, sig, JSON.stringify((args || []).map(arg))));
    if (r.t === 'e') throw new Error(r.v);
    return r;
}

// 异步回调（OC block 常在非 JS 线程触发）先排队，靠 Pump 取回
setInterval(() => B.Pump(), 200);

// ============================================================ 同步用例
// 每项返回 '' 表示通过，非空字符串表示失败原因
const CASES = [
    ['类方法→对象句柄', () => typeof invoke('NSMutableArray', 'array', []) === 'number' ? '' : '不是数字'],

    ['实例方法+参数', () => {
        const a = invoke('NSMutableArray', 'array', []);
        invoke('#' + a, 'addObject:', ['x']);
        return invoke('#' + a, 'count', []) === 1 ? '' : 'count 不对';
    }],

    ['int 参数与返回', () =>
        invoke('#' + invoke('NSNumber', 'numberWithInt:', [42]), 'intValue', []) === 42 ? '' : '值不对'],

    ['double 参数与返回', () =>
        invoke('#' + invoke('NSNumber', 'numberWithDouble:', [3.5]), 'doubleValue', []) === 3.5 ? '' : '值不对'],

    ['bool 参数与返回', () =>
        invoke('#' + invoke('NSNumber', 'numberWithBool:', [true]), 'boolValue', []) === 1 ? '' : '值不为 1'],

    ['char* 参数 + NSString 返回', () =>
        invoke('NSString', 'stringWithUTF8String:', ['abc']) === 'abc' ? '' : '返回值不对'],

    ['Class(#) 参数', () => {
        const a = invoke('NSMutableArray', 'array', []);
        return invoke('#' + a, 'isKindOfClass:', [{ t: 's', v: 'NSArray' }]) === 1 ? '' : '返回非 1';
    }],

    ['SEL(:) 参数', () => {
        const a = invoke('NSMutableArray', 'array', []);
        return invoke('#' + a, 'respondsToSelector:', [{ t: 's', v: 'count' }]) === 1 ? '' : '返回非 1';
    }],

    ['结构体参数与返回(16B)', () => {
        const v = invoke('NSValue', 'valueWithRange:', [{ t: 'st', v: [3, 7] }]);
        return invoke('#' + v, 'rangeValue', []).join(',') === '3,7' ? '' : '值不对';
    }],

    ['大结构体(32B 嵌套)', () => {
        const v = invoke('NSValue', 'valueWithRect:', [{ t: 'st', v: [10, 20, 100, 200] }]);
        return invoke('#' + v, 'rectValue', []).join(',') === '10,20,100,200' ? '' : '值不对';
    }],

    ['容器返回 + j 字段', () => {
        const r = JSON.parse(B.Invoke('NSArray', 'arrayWithObject:', JSON.stringify([arg('a')]), '', ''));
        return r.t === 'h' && r.j === '["a"]' ? '' : 't=' + r.t + ' j=' + r.j;
    }],

    ['OC 常量(dlsym)', () => JSON.parse(B.Const('NSURLNameKey')).v === 'NSURLNameKey' ? '' : '值不对'],

    ['对象参数(传句柄)', () => {
        const a = invoke('NSMutableArray', 'array', []);
        const inner = invoke('NSMutableArray', 'array', []);
        invoke('#' + a, 'addObject:', [h(inner)]);
        return invoke('#' + a, 'count', []) === 1 ? '' : 'count 不对';
    }],

    ['thread=current 选项', () => {
        const v = invoke('NSValue', 'valueWithRange:', [{ t: 'st', v: [1, 2] }], '', 'thread=current');
        return invoke('#' + v, 'rangeValue', [], '', 'thread=current').join(',') === '1,2' ? '' : '值不对';
    }],

    ['block 同步回调(带 id 参数)', () => {
        const a = invoke('NSMutableArray', 'array', []);
        ['a', 'b', 'c'].forEach(x => invoke('#' + a, 'addObject:', [x]));
        let n = 0;
        globalThis.__nb_cb_1 = () => { n++; return ''; };
        invoke('#' + a, 'enumerateObjectsUsingBlock:',
            [{ t: 'bl', sig: 'v@?@Q^B', cb: 1 }], '', 'thread=current');   // 不切线程，回调才能直接进 JS
        return n === 3 ? '' : '回调次数=' + n;
    }],

    ['C 函数(dispatch_get_global_queue)', () =>
        callC('dispatch_get_global_queue', '@qQ', [0, 0]).t === 'h' ? '' : '返回值不是句柄'],

    ['错误处理：类不存在', () => {
        try { invoke('NoSuchClassXX', 'foo', []); return '竟然没报错'; } catch (e) { return ''; }
    }],

    ['Release 后句柄失效', () => {
        const a = invoke('NSMutableArray', 'array', []);
        B.Release(a);
        try { invoke('#' + a, 'count', []); return '释放后仍可用'; } catch (e) { return ''; }
    }],
];

function runSyncTests() {
    let pass = 0;
    const bad = [];
    for (const [name, fn] of CASES) {
        try {
            const why = fn();
            if (why === '') { pass++; } else { bad.push('✗ ' + name + '：' + why); }
        } catch (e) {
            bad.push('✗ ' + name + '：' + e);
        }
    }
    return { pass: pass, total: CASES.length, bad: bad };
}

// ============================================================ 异步用例（block 在别的队列触发 → Pump）
let asyncDone = false;

function startAsyncTest() {
    asyncDone = false;
    globalThis.__nb_cb_2 = () => { asyncDone = true; return ''; };
    const q = invoke('#' + invoke('NSOperationQueue', 'alloc', []), 'init', []);
    invoke('#' + q, 'addOperationWithBlock:', [{ t: 'bl', sig: 'v@?', cb: 2 }]);   // 加到后台队列
    return q;
}

try {
    const pc = UE.GameplayStatics.GetPlayerController(world, 0);
    const w = UE.WidgetBlueprintLibrary.Create(world, UE.HotUpdateWidget.StaticClass(), pc);
    w.AddToViewport(0);                              // 必须：UMG 在这一步才建好控件树
    const canvas = w.WidgetTree.RootWidget;

    // 容器：半透明底，居中；颜色用作成功/失败反馈
    const bg = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
    bg.SetColorAndOpacity(new UE.LinearColor(1, 1, 1, 0.2));
    const bgSlot = canvas.AddChild(bg);

    const vp = UE.WidgetLayoutLibrary.GetViewportSize(world);
    const DS = 1.374;                                // UMG 布局坐标系 = 渲染 buffer / DPIScale
    const vx = vp.X * DS, vy = vp.Y * DS;
    const s = new UE.Vector2D(vx * 0.618, vy * 0.618);
    const p = new UE.Vector2D((vx - s.X) / 2, (vy - s.Y) / 2);
    bgSlot.SetSize(s);
    bgSlot.SetPosition(p);

    // 结果文字块（多行）
    const txt = UE.NewObject(UE.TextBlock.StaticClass(), w.WidgetTree);
    const txtSlot = canvas.AddChild(txt);
    txtSlot.SetSize(new UE.Vector2D(s.X - 40, s.Y - 140));
    txtSlot.SetPosition(new UE.Vector2D(p.X + 20, p.Y + 20));
    txt.SetText(T('点击按钮开始测试'));

    // 按钮：内容用 Image，UButton 运行时 new 的默认 Style 是空 brush
    function addBtn(label, top, onClick) {
        const btn = UE.NewObject(UE.Button.StaticClass(), w.WidgetTree);
        const icon = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
        icon.SetColorAndOpacity(new UE.LinearColor(0.2, 0.8, 1, 0.9));
        btn.AddChild(icon);
        const slot = canvas.AddChild(btn);
        slot.SetSize(new UE.Vector2D(s.X - 40, 60));
        slot.SetPosition(new UE.Vector2D(p.X + 20, top));
        btn.OnClicked.Add(onClick);
        return btn;
    }

    function show(text, ok) {
        txt.SetText(T(text));
        bg.SetColorAndOpacity(ok ? new UE.LinearColor(0.2, 0.9, 0.3, 0.35)    // 绿=通过
                                : new UE.LinearColor(1, 0.9, 0.1, 0.5));      // 黄=失败
        log(text.replace(/\n/g, ' | '));
    }

    addBtn('run', p.Y + s.Y - 130, function () {
        try {
            const r = runSyncTests();
            show('同步用例：' + r.pass + '/' + r.total + ' 通过\n' +
                 (r.bad.length ? r.bad.join('\n') : '全部通过'), r.bad.length === 0);
        } catch (e) {
            show('测试崩溃: ' + e, false);
        }
    });

    addBtn('async', p.Y + s.Y - 65, function () {
        try {
            startAsyncTest();
            txt.SetText(T('异步回调：等待中…（靠 Pump 取回）'));
            let waited = 0;
            const timer = setInterval(function () {
                waited += 200;
                if (asyncDone) {
                    clearInterval(timer);
                    show('异步回调：收到 ✓', true);
                } else if (waited >= 3000) {
                    clearInterval(timer);
                    show('异步回调：3 秒未收到 ✗', false);
                }
            }, 200);
        } catch (e) {
            show('异步测试失败: ' + e, false);
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

    log('测试页面已建 版本 ' + VERSION);
} catch (e) {
    log('错误: ' + e);
}
