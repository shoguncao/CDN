(function() {
	if ("TIEM Ingame Browser/0.1" == navigator.userAgent) /*兼容老版本*/
		return;
	if (-1 == navigator.userAgent.indexOf("TIEM Ingame Browser/")) /*不是微社区自研浏览器就直接返回*/
		return;
	if (typeof(window.customBrowserInterface) != "object") {
		window.customBrowserInterface = {};
		
		customBrowserInterface.isCustomBrowser = function() { /*是否是微社区自研浏览器*/
			return navigator.userAgent.indexOf("TIEM Ingame Browser/") != -1;
		};
		
		customBrowserInterface.getCustomUserAgent = function() {
			if (this.isCustomBrowser()) /*获取自定义的UserAgent*/
				return navigator.userAgent;
			var params = {};
			params.method = "getCustomUserAgent";
			return prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.getVersion = function() { /*获取浏览器版本号*/
			try {
				var userAgent = this.getCustomUserAgent();
				var regex = /TIEM Ingame Browser\/[0-9]+.[0-9]/;
				var result = userAgent.match(regex);
				if (null == result || 0 == result.length)
					return 0.0;
				userAgent = result[result.length - 1];
				var index = userAgent.lastIndexOf("/");
				if (-1 != index)
					return parseFloat(userAgent.substring(index + 1));
			}
			catch (ex) {
			}
			return 0.0;
		};
		
		customBrowserInterface.isAndroid = function() {
			var params = {};
			params.method = "isAndroid";
			return prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.getAccountType = function() {
			var params = {};
			params.method = "getAccountType";
			return prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.getDeviceInfo = function() {
			var params = {};
			params.method = "getDeviceInfo";
			return prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.getNetworkType = function() {
			var params = {};
			params.method = "getNetworkType";
			return prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.closeWebview = function() {
			var params = {};
			params.method = "closeWebview";
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.addShortcut = function(name, imgUrl, url) {
			var params = {};
			params.method = "addShortcut";
			if (imgUrl && url) {
				params.name = name;
				params.imgUrl = imgUrl;
				params.url = url;
			}
			else
				params.url = name;		
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.isPlatformInstalled = function(platformType) {
			var params = {};
			params.method = "isPlatformInstalled";
			params.platformType = platformType;
			return prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.sendToQQ = function(scene, title, desc, url, imgUrl) {
			var params = {};
			params.method = "sendToQQ";
			params.scene = scene;
			params.title = title;
			params.desc = desc;
			params.url = url;
			params.imgUrl = imgUrl;
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.sendToWeixinWithUrl = function(scene, title, desc, url, imgUrl) {
			var params = {};
			params.method = "sendToWeixinWithUrl";
			params.scene = scene;
			params.title = title;
			params.desc = desc;
			params.url = url;
			params.imgUrl = imgUrl;
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.sendToWeixin = function(title, desc, imgUrl, messageExt, userOpenId) {
			var params = {};
			params.method = "sendToWeixin";
			params.title = title;
			params.desc = desc;
			params.imgUrl = imgUrl;
			params.messageExt = messageExt;
			params.userOpenId = userOpenId;
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.hideUi = function() {
			var params = {};
			params.method = "hideUi";
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.showUi = function() {
			var params = {};
			params.method = "showUi";
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.imagePicker = function() {
			var params = {};
			params.method = "imagePicker";
			return prompt(JSON.stringify(params));
		};
			
		customBrowserInterface.encrypt = function(data, key) {
			if (0 == key.indexOf("-----")) {
				var lines = key.split("\n");
				key = "";
				for (var i = 1; i < lines.length - 1; i++)
					key += lines[i];
			}
			var params = {};
			params.method = "encrypt";
			params.data = data;		
			params.key = key;		
			return prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.decrypt = function(data, key) {
			if (0 == key.indexOf("-----")) {
				var lines = key.split("\n");
				key = "";
				for (var i = 1; i < lines.length - 1; i++)
					key += lines[i];
			}
			var params = {};
			params.method = "decrypt";
			params.data = data;		
			params.key = key;		
			return prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.delegateLogin = function(wxAppid) {
			var params = {};
			params.method = "delegateLogin";
			params.wxAppid = wxAppid;
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.sendToGame = function(data) {
			var params = {};
			params.method = "sendToGame";
			params.data = data;
			prompt(JSON.stringify(params));
		};
			
		customBrowserInterface.enterPictureInPictureMode = function(videoElement) {
			if (customBrowserInterface.isAndroid()) { /*Android 8.0及以上版本支持画中画*/
				var params = {};
				params.method = "enterPictureInPictureMode";
				prompt(JSON.stringify(params));
			}
			else if (videoElement && videoElement.webkitSupportsPresentationMode && "function" === typeof(videoElement.webkitSetPresentationMode)) /*iPad(iOS9及以上版本)、MAC(OS 10.12及以上版本)支持画中画*/
				videoElement.webkitSetPresentationMode(videoElement.webkitPresentationMode === "picture-in-picture" ? "inline" : "picture-in-picture");
		};
		
		customBrowserInterface.supportVideoPlayer = function() {
			var params = {};
			params.method = "supportVideoPlayer";
			return prompt(JSON.stringify(params));
		};

		customBrowserInterface.fullScreenPlay = function(vid, title) {
			var params = {};
			params.method = "fullScreenPlay";
			params.vid = vid;
			params.title = title;
			return prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.customPlay = function(vid, title, left, top, width, height) {
			var params = {};
			params.method = "customPlay";
			params.vid = vid;
			params.title = title;
			params.left = left;
			params.top = top;
			params.width = width;
			params.height = height;
			return prompt(JSON.stringify(params));
		};
			
		customBrowserInterface.hideVideoPlayer = function() {
			var params = {};
			params.method = "hideVideoPlayer";
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.showInFullScreen = function(isFullScreen) {
			var params = {};
			params.method = "showInFullScreen";
			params.isFullScreen = isFullScreen;
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.setAllowScroll = function(isAllowScroll) {
			var params = {};
			params.method = "setAllowScroll";
			params.isAllowScroll = isAllowScroll;
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.resizeCustomPlayer = function(left, top, width, height) {
			var params = {};
			params.method = "resizeCustomPlayer";
			params.left = left;
			params.top = top;
			params.width = width;
			params.height = height;
			return prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.hasNotchScreen = function() {
			var params = {};
			params.method = "hasNotchScreen";
			return prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.hadInstalled = function(urlScheme) {
			var params = {};
			params.method = "hadInstalled";
			params.urlScheme = urlScheme;
			return prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.openMiniProgram = function(id, path) {
			var params = {};
			params.method = "openMiniProgram";
			params.id = id;
			params.path = path;
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.isStableVersion = function() {
			var params = {};
			params.method = "isStableVersion";
			return prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.requestAccess = function(mediaType) {
			var params = {};
			params.method = "requestAccess";
			params.mediaType = mediaType;
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.canAccess = function(mediaType) {
			var params = {};
			params.method = "canAccess";
			params.mediaType = mediaType;
			return prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.startRecordAudio = function() {
			var params = {};
			params.method = "startRecordAudio";
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.stopRecordAudio = function() {
			var params = {};
			params.method = "stopRecordAudio";
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.playRecordedAudio = function() {
			var params = {};
			params.method = "playRecordedAudio";
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.speak = function(content) {
			var params = {};
			params.method = "speak";
			params.content = content;
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.getAudioContent = function(audioId) {
			var params = {};
			params.method = "getAudioContent";
			params.audioId = audioId;
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.openShortVideo = function(game, loginStatus, id, tag) {
			var params = {};
			params.method = "openShortVideo";
			params.game = game;
			params.loginStatus = loginStatus;
			params.id = (id ? id : "");
			params.tag = (tag ? tag : "");
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.unitySendMessage = function(gameObjectName, methodName, message) {
			var params = {};
			params.method = "unitySendMessage";
			params.gameObjectName = gameObjectName;
			params.methodName = methodName;
			params.message = message;
			prompt(JSON.stringify(params));
		};

		/*
			reminderBefore为数组类型，表示提前多少分钟提醒，如：[1, 3, 9]表示开始前1分钟、3分钟、9分钟各提醒一次
			示例：customBrowserInterface.addEventReminder("标题", "详情", "2021-12-21 18:55:00", "2021-12-21 19:55:00", [1, 3, 9], function(status) {
				// status取值:	1:订阅成功 -1:参数错误 -2:用户拒绝
			});
		*/
		customBrowserInterface.addEventReminder = function(title, detail, startDate, endDate, reminderBefore, responseCallback) {
			if (!this.responseCallbacks)
				this.responseCallbacks = {};
			if (!this.uniqueId)
				this.uniqueId = 0;
			var callbackId = "cb_" + (this.uniqueId++) + "_" + new Date().getTime();
			this.responseCallbacks[callbackId] = responseCallback;
			
			var params = {};
			params.method = "addEventReminder";
			params.title = title;
			params.detail = detail;
			params.startDate = startDate;
			params.endDate = endDate;
			params.reminderBefore = reminderBefore;
			params.callbackId = callbackId;
			prompt(JSON.stringify(params));
		};
		
		/*打开权限设置*/
		customBrowserInterface.openPermissionSettings = function() {
			var params = {};
			params.method = "openPermissionSettings";
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.getAccountInfo = function() {
			var params = {};
			params.method = "getAccountInfo";
			return prompt(JSON.stringify(params));
		};
		
		/*
			获取用户位置信息，返回值：{"code":1, "longitude":0.0, "latitude":0.0}，longitude、latitude分别为经度、维度
			示例：customBrowserInterface.getLocationInfo(function(result) {
				// result.code取值:	1:获取成功 -1:获取失败 -2:用户拒绝
				// result.code为-2时表示用户拒绝授权，如果还想获取用户位置信息，就需要调用customBrowserInterface.openPermissionSettings();打开APP的权限设置
			});
		*/
		customBrowserInterface.getLocationInfo = function(responseCallback) {
			if (!this.responseCallbacks)
				this.responseCallbacks = {};
			if (!this.uniqueId)
				this.uniqueId = 0;
			var callbackId = "cb_" + (this.uniqueId++) + "_" + new Date().getTime();
			this.responseCallbacks[callbackId] = responseCallback;
			
			var params = {};
			params.method = "getLocationInfo";
			params.callbackId = callbackId;
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.getBoxLoginStatus = function() {
			var params = {};
			params.method = "getBoxLoginStatus";
			return prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.jumpToTab = function(tabId) {
			var params = {};
			params.method = "jumpToTab";
			params.tabId = tabId;
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.dispatchHippyEvent = function(eventName, data) {
			var params = {};
			params.method = "dispatchHippyEvent";
			params.eventName = eventName;
			params.data = data;
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.uploadPhotos = function(moduleId, game, bid, loginStatus, opkey, maxCountLimit, responseCallback) {
			if (!this.responseCallbacks)
				this.responseCallbacks = {};
			if (!this.uniqueId)
				this.uniqueId = 0;
			var callbackId = "cb_" + (this.uniqueId++) + "_" + new Date().getTime();
			this.responseCallbacks[callbackId] = responseCallback;
			
			var params = {};
			params.method = "uploadPhotos";
			params.moduleId = moduleId;
			params.game = game;
			params.bid = bid;
			params.loginStatus = loginStatus;
			params.opkey = opkey;
			params.maxCountLimit = maxCountLimit;
			params.callbackId = callbackId;
			prompt(JSON.stringify(params));
		};

		customBrowserInterface.openMsdkUrl = function(url) {
			var params = {};
			params.method = "openMsdkUrl";
			params.url = url;
			prompt(JSON.stringify(params));
		};

		customBrowserInterface.performAction = function(action) {
			var params = {};
			params.method = "performAction";
			params.action = action;
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.openNewWindow = function(url, animated) {
			var params = {};
			params.method = "openNewWindow";
			params.url = url;
			params.animated = animated;
			prompt(JSON.stringify(params));
		};

		customBrowserInterface.getVoiceText = function(params, responseCallback) {
			if (!this.responseCallbacks)
				this.responseCallbacks = {};
			if (!this.uniqueId)
				this.uniqueId = 0;
			var callbackId = "cb_" + (this.uniqueId++) + "_" + new Date().getTime();
			this.responseCallbacks[callbackId] = responseCallback;
			
			params.method = "getVoiceText";
			params.callbackId = callbackId;
			prompt(JSON.stringify(params));
		};

		customBrowserInterface.stopVoiceToText = function() {
			var params = {};
			params.method = "stopVoiceToText";
			prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.getVoicePermission = function(responseCallback) {
			if (!this.responseCallbacks)
				this.responseCallbacks = {};
			if (!this.uniqueId)
				this.uniqueId = 0;
			var callbackId = "cb_" + (this.uniqueId++) + "_" + new Date().getTime();
			this.responseCallbacks[callbackId] = responseCallback;
			
			var params = {};
			params.method = "getVoicePermission";
			params.callbackId = callbackId;
			prompt(JSON.stringify(params));
		};

		customBrowserInterface.cancelVoiceToText = function() {
			var params = {};
			params.method = "cancelVoiceToText";
			prompt(JSON.stringify(params));
		};

		customBrowserInterface.getTabs = function() {
			var params = {};
			params.method = "getTabs";
			return prompt(JSON.stringify(params));
		};
		
		customBrowserInterface.openApp = function(packageName, url) {
			var params = {};
			params.method = "openApp";
			params.packageName = packageName;
			params.url = url;
			prompt(JSON.stringify(params));
		};
	}
	
	/*window.onpageshow在每次加载页面时都会触发，不管页面是不是来自于缓存；只要加载了browser_adapt.js就会自动隐藏UI*/
	var onpageshow = window.onpageshow;
	window.onpageshow = function(event) { /*WKWebView"返回"时会直接从缓存中读取页面而不会执行JS代码(event.persisted为true)，但会触发window.onpageshow事件*/
		if (typeof(onpageshow) == "function")
			onpageshow(event);
		customBrowserInterface.hideUi(); /*隐藏UI*/
	};

	customBrowserInterface.hideUi(); /*隐藏UI*/
})();