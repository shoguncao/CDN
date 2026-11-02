// Main.js 3.3.0 —— NativeBridge 能力演示页（三页：功能类型 / iOS / Android）
// 点按钮后显示「调用了什么 + 结果」，容器变绿=生效、变黄=失败；底部左右箭头翻页
const VERSION = '3.3.0';

let world = puerts.argv.getByName('World');
const PAD = ' '.repeat(24);                       // PrintString 位置写死在左上，靠空格避开刘海

function log(m) {
    UE.KismetSystemLibrary.PrintString(world, PAD + m, true, true, new UE.LinearColor(0.2, 0.8, 1, 1), 60);
}
// Puerts 默认定义 PUERTS_FTEXT_AS_OBJECT（JsEnv.Build.cs:87）：FText 是对象模式，
// SetText 直接传 JS 字符串会被当指针解析而崩溃，必须先用 Conv_StringToText 转换
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

// target: 类名 / '#句柄' / '@activity'；opts 传 'thread=current' 表示不切主线程
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
let asyncGot = false;

// 平台判断：随便调一个 iOS 才有的类，抛错就是 Android（不额外加原生接口）
let IS_IOS = true;
try { invoke('NSProcessInfo', 'processInfo', []); } catch (e) { IS_IOS = false; }
const CUR = IS_IOS ? 'ios' : 'android';
const OTHER = IS_IOS ? 'Android' : 'iOS';

// ============================================================ 第一页：功能类型（场景）
// 场景类功能两端实现完全不同，所以按平台各给一份
const SCENE_ANDROID = [
    { n: '打开系统设置', c: "new Intent('android.settings.SETTINGS')\n@activity.startActivity(intent)",
      f: () => { const it = invoke('android.content.Intent', '<init>', ['android.settings.SETTINGS']);
                 invoke('@activity', 'startActivity', [h(it)]);
                 return '已启动（设置界面会打开）'; } },
    { n: 'Toast 提示', c: "Toast.makeText(@activity.getApplicationContext(),'来自 JS',0).show()",
      f: () => { const ctx = invoke('@activity', 'getApplicationContext', []);
                 const toast = invoke('android.widget.Toast', 'makeText', [h(ctx), '来自 JS 的提示', 0]);
                 invoke('#' + toast, 'show', []);
                 return '已弹出 Toast（屏幕下方）'; } },
    { n: '读取应用信息', c: "@activity.getPackageManager().getPackageInfo(pkg,0)",
      f: () => { const pkg = invoke('@activity', 'getPackageName', []);
                 const pm = invoke('@activity', 'getPackageManager', []);
                 const info = invoke('#' + pm, 'getPackageInfo', [pkg, 0]);
                 return '包名=' + pkg + ' 句柄=' + info; } },
];

const SCENE_IOS = [
    { n: '打开系统设置', c: "NSURL('app-settings:') → UIApplication\nopenURL:options:completionHandler:",
      f: () => { const url = invoke('NSURL', 'URLWithString:', ['app-settings:']);
                 const app = invoke('UIApplication', 'sharedApplication', []);
                 const opts = invoke('NSDictionary', 'dictionary', []);
                 globalThis.__nb_cb_9 = a => { log('openURL 结果: ' + a); return ''; };
                 invoke('#' + app, 'openURL:options:completionHandler:',
                     [h(url), h(opts), { t: 'bl', sig: 'v@?B', cb: 9 }]);
                 return '已请求（设置界面会打开）'; } },

    { n: '创建红色 UIView', c: "[[UIView alloc] initWithFrame:CGRectMake(20,100,100,200)]\n→ setBackgroundColor → addSubview",
      f: () => { const v = invoke('#' + invoke('UIView', 'alloc', []),
                     'initWithFrame:', [{ t: 'st', v: [20, 100, 100, 200] }]);
                 invoke('#' + v, 'setBackgroundColor:', [h(invoke('UIColor', 'redColor', []))]);
                 const app = invoke('UIApplication', 'sharedApplication', []);
                 const win = invoke('#' + app, 'keyWindow', []);
                 let rvc = invoke('#' + win, 'rootViewController', []);
                 if (!rvc) { rvc = invoke('#' + invoke('UIViewController', 'alloc', []), 'init', []);
                             invoke('#' + win, 'setRootViewController:', [h(rvc)]); }
                 invoke('#' + invoke('#' + rvc, 'view', []), 'addSubview:', [h(v)]);
                 return '已添加（左侧红色 100×200）'; } },

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
];
const SCENE_DEMOS = IS_IOS ? SCENE_IOS : SCENE_ANDROID;
const asyncDemo = SCENE_IOS[SCENE_IOS.length - 1];

// ============================================================ 第二页：iOS 能力
const IOS_DEMOS = [
    { n: '类方法→对象句柄', c: "invoke('NSMutableArray','array',[])",
      f: () => '句柄 = ' + invoke('NSMutableArray', 'array', []) },
    { n: '实例方法+参数', c: "invoke('#'+a,'addObject:',['x'])\ninvoke('#'+a,'count',[])",
      f: () => { const a = invoke('NSMutableArray', 'array', []);
                 invoke('#' + a, 'addObject:', ['x']);
                 return 'count = ' + invoke('#' + a, 'count', []); } },
    { n: 'int 参数/返回', c: "invoke('NSNumber','numberWithInt:',[42]) → intValue",
      f: () => 'intValue = ' + invoke('#' + invoke('NSNumber', 'numberWithInt:', [42]), 'intValue', []) },
    { n: 'double 参数/返回', c: "invoke('NSNumber','numberWithDouble:',[3.5]) → doubleValue",
      f: () => 'doubleValue = ' + invoke('#' + invoke('NSNumber', 'numberWithDouble:', [3.5]), 'doubleValue', []) },
    { n: 'bool 参数/返回', c: "invoke('NSNumber','numberWithBool:',[true]) → boolValue",
      f: () => 'boolValue = ' + invoke('#' + invoke('NSNumber', 'numberWithBool:', [true]), 'boolValue', []) },
    { n: 'char* 参数', c: "invoke('NSString','stringWithUTF8String:',['abc'])",
      f: () => '返回 = ' + invoke('NSString', 'stringWithUTF8String:', ['abc']) },
    { n: 'Class(#) 参数', c: "invoke('#'+a,'isKindOfClass:',[{t:'s',v:'NSArray'}])",
      f: () => '返回 = ' + invoke('#' + invoke('NSMutableArray', 'array', []),
                    'isKindOfClass:', [{ t: 's', v: 'NSArray' }]) },
    { n: 'SEL(:) 参数', c: "invoke('#'+a,'respondsToSelector:',[{t:'s',v:'count'}])",
      f: () => '返回 = ' + invoke('#' + invoke('NSMutableArray', 'array', []),
                    'respondsToSelector:', [{ t: 's', v: 'count' }]) },
    { n: '结构体16B(NSRange)', c: "invoke('NSValue','valueWithRange:',[{t:'st',v:[3,7]}])\n→ rangeValue",
      f: () => 'rangeValue = [' + invoke('#' + invoke('NSValue', 'valueWithRange:', [{ t: 'st', v: [3, 7] }]),
                    'rangeValue', []).join(',') + ']' },
    { n: '结构体32B(CGRect)', c: "invoke('NSValue','valueWithRect:',[{t:'st',v:[10,20,100,200]}])\n→ rectValue",
      f: () => 'rectValue = [' + invoke('#' + invoke('NSValue', 'valueWithRect:', [{ t: 'st', v: [10, 20, 100, 200] }]),
                    'rectValue', []).join(',') + ']' },
    { n: '容器返回 j 字段', c: "B.Invoke('NSArray','arrayWithObject:',[{t:'s',v:'a'}])",
      f: () => { const r = JSON.parse(B.Invoke('NSArray', 'arrayWithObject:', JSON.stringify([arg('a')]), '', ''));
                 return '句柄=' + r.v + '  内容 j=' + r.j; } },
    { n: 'OC 常量(dlsym)', c: "B.Const('NSURLNameKey')",
      f: () => '值 = ' + JSON.parse(B.Const('NSURLNameKey')).v },
    { n: '对象参数(传句柄)', c: "invoke('#'+a,'addObject:',[{t:'h',v:inner}])",
      f: () => { const a = invoke('NSMutableArray', 'array', []);
                 const inner = invoke('NSMutableArray', 'array', []);
                 invoke('#' + a, 'addObject:', [h(inner)]);
                 return 'count = ' + invoke('#' + a, 'count', []); } },
    { n: '不切主线程(thread)', c: "invoke('NSValue','valueWithRange:',[{t:'st',v:[1,2]}],'','thread=current')",
      f: () => 'rangeValue = [' + invoke('#' + invoke('NSValue', 'valueWithRange:', [{ t: 'st', v: [1, 2] }], '', 'thread=current'),
                    'rangeValue', [], '', 'thread=current').join(',') + ']' },
    { n: 'block 回调(id参数)', c: "invoke('#'+a,'enumerateObjectsUsingBlock:',[{t:'bl',sig:'v@?@Q^B',cb:1}],'','thread=current')",
      f: () => { const a = invoke('NSMutableArray', 'array', []);
                 ['a', 'b', 'c'].forEach(x => invoke('#' + a, 'addObject:', [x]));
                 let n = 0;
                 globalThis.__nb_cb_1 = () => { n++; return ''; };
                 invoke('#' + a, 'enumerateObjectsUsingBlock:',
                     [{ t: 'bl', sig: 'v@?@Q^B', cb: 1 }], '', 'thread=current');
                 return 'block 被调用 ' + n + ' 次（应为 3）'; } },
    { n: 'C 函数(dispatch)', c: "B.CallCFunc('dispatch_get_global_queue','@qQ',[0,0])",
      f: () => { const r = callC('dispatch_get_global_queue', '@qQ', [0, 0]);
                 return '返回类型=' + r.t + ' 句柄=' + r.v; } },
    { n: '报错:类不存在', c: "invoke('NoSuchClassXX','foo',[])",
      f: () => expectErr(() => invoke('NoSuchClassXX', 'foo', [])) },
    { n: 'Release 后失效', c: "B.Release(a) 后再 invoke('#'+a,'count',[])",
      f: () => expectErr(() => { const a = invoke('NSMutableArray', 'array', []);
                                 B.Release(a); invoke('#' + a, 'count', []); }) },
];

// ============================================================ 第三页：Android 能力
const ANDROID_DEMOS = [
    { n: 'Java 静态方法', c: "invoke('java.lang.Math','max',[3,7])",
      f: () => 'Math.max(3,7) = ' + invoke('java.lang.Math', 'max', [3, 7]) },
    { n: '创建对象 <init>', c: "invoke('android.content.Intent','<init>',['android.settings.SETTINGS'])",
      f: () => '句柄 = ' + invoke('android.content.Intent', '<init>', ['android.settings.SETTINGS']) },
    { n: '@activity', c: "invoke('@activity','getPackageName',[])",
      f: () => '包名 = ' + invoke('@activity', 'getPackageName', []) },
    { n: 'Java 字段', c: "B.GetField('java.lang.Math','PI','')",
      f: () => 'Math.PI = ' + JSON.parse(B.GetField('java.lang.Math', 'PI', '')).v },
    { n: '报错:类不存在', c: "invoke('com.not.Exist','foo',[])",
      f: () => expectErr(() => invoke('com.not.Exist', 'foo', [])) },
];

const PAGES = [
    { name: '功能类型',              demos: SCENE_DEMOS },
    { name: 'iOS（当前系统不支持则留空）', platform: 'ios',     demos: IOS_DEMOS },
    { name: 'Android（同上）',        platform: 'android', demos: ANDROID_DEMOS },
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

    // 页标题
    const title = UE.NewObject(UE.TextBlock.StaticClass(), w.WidgetTree);
    const titleSlot = canvas.AddChild(title);
    titleSlot.SetSize(new UE.Vector2D(s.X - 140, 40));
    titleSlot.SetPosition(new UE.Vector2D(p.X + 20, p.Y + 10));

    // 结果区：显示"调用了什么 + 结果"
    const txt = UE.NewObject(UE.TextBlock.StaticClass(), w.WidgetTree);
    const txtSlot = canvas.AddChild(txt);
    txtSlot.SetSize(new UE.Vector2D(s.X - 40, 100));
    txtSlot.SetPosition(new UE.Vector2D(p.X + 20, p.Y + 55));
    txt.SetText(T('点击下面的按钮'));

    function show(d, result, ok) {
        txt.SetText(T('【' + d.n + '】\n' + d.c + '\n→ ' + result + (ok === false ? '  ✗' : '  ✓')));
        bg.SetColorAndOpacity(ok === false ? new UE.LinearColor(1, 0.9, 0.1, 0.5)     // 黄=失败
                                           : new UE.LinearColor(0.2, 0.9, 0.3, 0.35)); // 绿=生效
        log(d.n + ' → ' + result);
    }

    // 带文字的按钮（Button 只能有一个子节点，所以子节点放 TextBlock；背景调深提高对比度）
    function makeBtn(label, x, y, bw, bh, onClick, color) {
        const btn = UE.NewObject(UE.Button.StaticClass(), w.WidgetTree);
        btn.SetBackgroundColor(color || new UE.LinearColor(0.10, 0.32, 0.55, 1));
        const t = UE.NewObject(UE.TextBlock.StaticClass(), w.WidgetTree);
        t.SetText(T(label));                         // FText 必须转换
        btn.AddChild(t);
        const slot = canvas.AddChild(btn);
        slot.SetSize(new UE.Vector2D(bw, bh));
        slot.SetPosition(new UE.Vector2D(x, y));
        btn.OnClicked.Add(onClick);
        return btn;
    }

    // ---- 翻页 ----
    let pageIdx = 0;
    let pageBtns = [];

    function renderPage() {
        pageBtns.forEach(btn => canvas.RemoveChild(btn));
        pageBtns = [];
        const page = PAGES[pageIdx];
        title.SetText(T('第 ' + (pageIdx + 1) + '/' + PAGES.length + ' 页：' + page.name));
        if (page.platform && page.platform !== CUR) {          // 另一平台的页：只提示，不建按钮
            txt.SetText(T('此页是 ' + (page.platform === 'ios' ? 'iOS' : 'Android') +
                          ' 专用\n当前运行在 ' + (IS_IOS ? 'iOS' : 'Android') + '，接口不可用'));
            bg.SetColorAndOpacity(new UE.LinearColor(1, 1, 1, 0.2));
            return;
        }
        const bw = (s.X - 50) / 2;
        page.demos.forEach(function (d, i) {
            pageBtns.push(makeBtn(d.n,
                p.X + 20 + (i % 2) * (bw + 10),
                p.Y + 175 + ((i / 2) | 0) * 40,
                bw, 36,
                function () { try { show(d, d.f()); } catch (e) { show(d, '异常：' + e, false); } }));
        });
        txt.SetText(T('共 ' + page.demos.length + ' 项，点击测试'));
    }

    makeBtn('◀', p.X + s.X - 140, p.Y + 10, 55, 40,
        function () { pageIdx = (pageIdx + PAGES.length - 1) % PAGES.length; renderPage(); });
    makeBtn('▶', p.X + s.X - 80, p.Y + 10, 55, 40,
        function () { pageIdx = (pageIdx + 1) % PAGES.length; renderPage(); });

    // 关闭按钮：容器右上角外侧（红底 ✕）
    makeBtn('✕', p.X + s.X - 64, p.Y - 64, 64, 64,
        function () { w.RemoveFromViewport(); },
        new UE.LinearColor(0.6, 0.15, 0.15, 1));

    renderPage();
    log('能力演示页已建 版本 ' + VERSION);
} catch (e) {
    log('错误: ' + e);
}
