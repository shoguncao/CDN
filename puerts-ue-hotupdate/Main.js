// Main.js 3.1.0 —— NativeBridge 能力演示页
// 每个按钮演示一项能力：点击后显示「调用了什么 + 结果」，容器变绿=生效，变黄=失败
const VERSION = '3.1.0';

let world = puerts.argv.getByName('World');
const PAD = ' '.repeat(24);                       // PrintString 位置写死在左上，靠空格避开刘海

function log(m) {
    UE.KismetSystemLibrary.PrintString(world, PAD + m, true, true, new UE.LinearColor(0.2, 0.8, 1, 1), 60);
}
// Puerts 默认定义了 PUERTS_FTEXT_AS_OBJECT（JsEnv.Build.cs:87）：
// FText 是对象模式，SetText 直接传 JS 字符串会被当指针解析而崩溃，必须先转换
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

// target: 类名（类方法）或 '#句柄'（实例方法）；opts 传 'thread=current' 表示不切主线程
function invoke(target, method, args, sig, opts) {
    const r = JSON.parse(B.Invoke(String(target), method,
        JSON.stringify((args || []).map(arg)), sig || '', opts || ''));
    if (r.t === 'e') throw new Error(r.v);
    return r.v;
}
// C 函数：sig 第一个类型编码是返回值，其余为参数
function callC(name, sig, args) {
    const r = JSON.parse(B.CallCFunc(name, sig, JSON.stringify((args || []).map(arg))));
    if (r.t === 'e') throw new Error(r.v);
    return r;
}
// 期望抛错的用例：把错误文本当作"生效的证据"返回
function expectErr(fn) {
    try { fn(); return '未按预期报错 ✗'; } catch (e) { return '按预期报错：' + e; }
}

// 异步回调（OC block 常在非 JS 线程触发）会先排队，靠 Pump 取回
setInterval(() => B.Pump(), 200);

// ============================================================ 每项能力一个按钮
// n=按钮名  c=展示用的调用代码  f=执行并返回结果字符串
let asyncGot = false;

const DEMOS = [
    { n: '类方法→句柄', c: "invoke('NSMutableArray','array',[])",
      f: () => '句柄 = ' + invoke('NSMutableArray', 'array', []) },

    { n: '实例方法+参数', c: "invoke('#'+a,'addObject:',['x'])\ninvoke('#'+a,'count',[])",
      f: () => { const a = invoke('NSMutableArray', 'array', []);
                 invoke('#' + a, 'addObject:', ['x']);
                 return 'count = ' + invoke('#' + a, 'count', []); } },

    { n: 'int', c: "invoke('NSNumber','numberWithInt:',[42]) → intValue",
      f: () => 'intValue = ' + invoke('#' + invoke('NSNumber', 'numberWithInt:', [42]), 'intValue', []) },

    { n: 'double', c: "invoke('NSNumber','numberWithDouble:',[3.5]) → doubleValue",
      f: () => 'doubleValue = ' + invoke('#' + invoke('NSNumber', 'numberWithDouble:', [3.5]), 'doubleValue', []) },

    { n: 'bool', c: "invoke('NSNumber','numberWithBool:',[true]) → boolValue",
      f: () => 'boolValue = ' + invoke('#' + invoke('NSNumber', 'numberWithBool:', [true]), 'boolValue', []) },

    { n: 'char* 参数', c: "invoke('NSString','stringWithUTF8String:',['abc'])",
      f: () => '返回 = ' + invoke('NSString', 'stringWithUTF8String:', ['abc']) },

    { n: 'Class(#) 参数', c: "invoke('#'+a,'isKindOfClass:',[{t:'s',v:'NSArray'}])",
      f: () => '返回 = ' + invoke('#' + invoke('NSMutableArray', 'array', []),
                    'isKindOfClass:', [{ t: 's', v: 'NSArray' }]) },

    { n: 'SEL(:) 参数', c: "invoke('#'+a,'respondsToSelector:',[{t:'s',v:'count'}])",
      f: () => '返回 = ' + invoke('#' + invoke('NSMutableArray', 'array', []),
                    'respondsToSelector:', [{ t: 's', v: 'count' }]) },

    { n: '结构体 16B', c: "invoke('NSValue','valueWithRange:',[{t:'st',v:[3,7]}])\n→ rangeValue",
      f: () => 'rangeValue = [' + invoke('#' + invoke('NSValue', 'valueWithRange:', [{ t: 'st', v: [3, 7] }]),
                    'rangeValue', []).join(',') + ']' },

    { n: '结构体 32B', c: "invoke('NSValue','valueWithRect:',[{t:'st',v:[10,20,100,200]}])\n→ rectValue",
      f: () => 'rectValue = [' + invoke('#' + invoke('NSValue', 'valueWithRect:', [{ t: 'st', v: [10, 20, 100, 200] }]),
                    'rectValue', []).join(',') + ']' },

    { n: '容器 j 字段', c: "B.Invoke('NSArray','arrayWithObject:',[{t:'s',v:'a'}])",
      f: () => { const r = JSON.parse(B.Invoke('NSArray', 'arrayWithObject:', JSON.stringify([arg('a')]), '', ''));
                 return '句柄=' + r.v + '  内容 j=' + r.j; } },

    { n: 'OC 常量', c: "B.Const('NSURLNameKey')",
      f: () => '值 = ' + JSON.parse(B.Const('NSURLNameKey')).v },

    { n: '对象参数', c: "invoke('#'+a,'addObject:',[{t:'h',v:inner}])",
      f: () => { const a = invoke('NSMutableArray', 'array', []);
                 const inner = invoke('NSMutableArray', 'array', []);
                 invoke('#' + a, 'addObject:', [h(inner)]);
                 return 'count = ' + invoke('#' + a, 'count', []); } },

    { n: 'thread=current', c: "invoke('NSValue','valueWithRange:',[{t:'st',v:[1,2]}],'','thread=current')",
      f: () => 'rangeValue = [' + invoke('#' + invoke('NSValue', 'valueWithRange:', [{ t: 'st', v: [1, 2] }], '', 'thread=current'),
                    'rangeValue', [], '', 'thread=current').join(',') + ']' },

    { n: 'block 回调', c: "invoke('#'+a,'enumerateObjectsUsingBlock:',[{t:'bl',sig:'v@?@Q^B',cb:1}],'','thread=current')",
      f: () => { const a = invoke('NSMutableArray', 'array', []);
                 ['a', 'b', 'c'].forEach(x => invoke('#' + a, 'addObject:', [x]));
                 let n = 0;
                 globalThis.__nb_cb_1 = () => { n++; return ''; };
                 invoke('#' + a, 'enumerateObjectsUsingBlock:',
                     [{ t: 'bl', sig: 'v@?@Q^B', cb: 1 }], '', 'thread=current');
                 return 'block 被调用 ' + n + ' 次（应为 3）'; } },

    { n: 'C 函数', c: "B.CallCFunc('dispatch_get_global_queue','@qQ',[0,0])",
      f: () => { const r = callC('dispatch_get_global_queue', '@qQ', [0, 0]);
                 return '返回类型=' + r.t + ' 句柄=' + r.v; } },

    { n: 'UIView(红块)', c: "[[UIView alloc] initWithFrame:CGRectMake(20,100,100,200)]\n→ setBackgroundColor → addSubview",
      f: () => { const v = invoke('#' + invoke('UIView', 'alloc', []),
                     'initWithFrame:', [{ t: 'st', v: [20, 100, 100, 200] }]);
                 invoke('#' + v, 'setBackgroundColor:', [h(invoke('UIColor', 'redColor', []))]);
                 const app = invoke('UIApplication', 'sharedApplication', []);
                 const win = invoke('#' + app, 'keyWindow', []);
                 let rvc = invoke('#' + win, 'rootViewController', []);
                 if (!rvc) { rvc = invoke('#' + invoke('UIViewController', 'alloc', []), 'init', []);
                             invoke('#' + win, 'setRootViewController:', [h(rvc)]); }
                 invoke('#' + invoke('#' + rvc, 'view', []), 'addSubview:', [h(v)]);
                 return '已添加到界面（左侧红色 100×200）'; } },

    { n: '异步回调+Pump', c: "invoke('#'+q,'addOperationWithBlock:',[{t:'bl',sig:'v@?',cb:2}])\n→ 靠 Pump 取回",
      f: () => { asyncGot = false;
                 globalThis.__nb_cb_2 = () => { asyncGot = true; return ''; };
                 const q = invoke('#' + invoke('NSOperationQueue', 'alloc', []), 'init', []);
                 invoke('#' + q, 'addOperationWithBlock:', [{ t: 'bl', sig: 'v@?', cb: 2 }]);
                 let waited = 0;
                 const t = setInterval(function () {
                     waited += 200;
                     if (asyncGot) { clearInterval(t); show(asyncDemo, '回调已收到 ✓（' + waited + 'ms）'); }
                     else if (waited >= 3000) { clearInterval(t); show(asyncDemo, '3 秒未收到 ✗', false); }
                 }, 200);
                 return '已投递到后台队列，等待回调…'; } },

    { n: '错误：类不存在', c: "invoke('NoSuchClassXX','foo',[])",
      f: () => expectErr(() => invoke('NoSuchClassXX', 'foo', [])) },

    { n: 'Release 失效', c: "B.Release(a) 后再 invoke('#'+a,'count',[])",
      f: () => expectErr(() => { const a = invoke('NSMutableArray', 'array', []);
                                 B.Release(a); invoke('#' + a, 'count', []); }) },
];

try {
    const pc = UE.GameplayStatics.GetPlayerController(world, 0);
    const w = UE.WidgetBlueprintLibrary.Create(world, UE.HotUpdateWidget.StaticClass(), pc);
    w.AddToViewport(0);                              // 必须：UMG 在这一步才建好控件树
    const canvas = w.WidgetTree.RootWidget;

    // 容器：居中；颜色用作"是否生效"的反馈
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

    // 结果区：显示"调用了什么 + 结果"
    const txt = UE.NewObject(UE.TextBlock.StaticClass(), w.WidgetTree);
    const txtSlot = canvas.AddChild(txt);
    txtSlot.SetSize(new UE.Vector2D(s.X - 40, 150));
    txtSlot.SetPosition(new UE.Vector2D(p.X + 20, p.Y + 15));
    txt.SetText(T('点击下面的按钮'));

    const asyncDemo = DEMOS.find(x => x.n.indexOf('异步') === 0);   // 异步那项（回调在外面异步到达）

function show(d, result, ok) {
        txt.SetText(T('【' + d.n + '】\n' + d.c + '\n→ ' + result + (ok === false ? '  ✗' : '  ✓')));
        bg.SetColorAndOpacity(ok === false ? new UE.LinearColor(1, 0.9, 0.1, 0.5)     // 黄=失败
                                           : new UE.LinearColor(0.2, 0.9, 0.3, 0.35)); // 绿=生效
        log(d.n + ' → ' + result);
    }

    // 能力按钮：两列平铺在结果区下方；内容用 Image（UButton 运行时 new 的默认 Style 是空 brush）
    const bw = (s.X - 50) / 2;
    DEMOS.forEach(function (d, i) {
        const btn = UE.NewObject(UE.Button.StaticClass(), w.WidgetTree);
        const icon = UE.NewObject(UE.Image.StaticClass(), w.WidgetTree);
        icon.SetColorAndOpacity(new UE.LinearColor(0.2, 0.8, 1, 0.9));
        btn.AddChild(icon);
        const slot = canvas.AddChild(btn);
        slot.SetSize(new UE.Vector2D(bw, 40));
        slot.SetPosition(new UE.Vector2D(p.X + 20 + (i % 2) * (bw + 10), p.Y + 170 + ((i / 2) | 0) * 45));
        btn.OnClicked.Add(function () {
            try { show(d, d.f()); } catch (e) { show(d, '异常：' + e, false); }
        });
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

    log('能力演示页已建 版本 ' + VERSION);
} catch (e) {
    log('错误: ' + e);
}
