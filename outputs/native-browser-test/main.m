#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
@interface Host:NSObject<NSApplicationDelegate,WKScriptMessageHandler,WKUIDelegate>
@property NSWindow *window;
@property WKWebView *appView;
@property WKWebView *lovable;
@property NSMutableArray *popups;
@end
@implementation Host
-(void)applicationDidFinishLaunching:(NSNotification*)notification {
 self.popups=[NSMutableArray array];
 self.window=[[NSWindow alloc] initWithContentRect:NSMakeRect(100,100,1280,850) styleMask:NSWindowStyleMaskTitled|NSWindowStyleMaskClosable|NSWindowStyleMaskResizable|NSWindowStyleMaskMiniaturizable backing:NSBackingStoreBuffered defer:NO];
 self.window.title=@"Co-founder — Native browser test";
 WKWebViewConfiguration *config=[WKWebViewConfiguration new];config.websiteDataStore=WKWebsiteDataStore.defaultDataStore;
 [config.userContentController addScriptMessageHandler:self name:@"businessBrowser"];
 self.appView=[[WKWebView alloc] initWithFrame:self.window.contentView.bounds configuration:config];self.appView.autoresizingMask=NSViewWidthSizable|NSViewHeightSizable;[self.window.contentView addSubview:self.appView];
 WKWebViewConfiguration *remote=[WKWebViewConfiguration new];remote.websiteDataStore=WKWebsiteDataStore.defaultDataStore;
 self.lovable=[[WKWebView alloc] initWithFrame:NSZeroRect configuration:remote];self.lovable.UIDelegate=self;self.lovable.hidden=YES;[self.window.contentView addSubview:self.lovable];
 [self.appView loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:@"http://127.0.0.1:5174/#/business/lovable"]]];
 [self.lovable loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:@"https://lovable.dev/projects/aa411508-5d3c-4416-a543-bcc3d9414ea3"]]];
 [self.window makeKeyAndOrderFront:nil];[NSApp activateIgnoringOtherApps:YES];
}
-(void)userContentController:(WKUserContentController*)controller didReceiveScriptMessage:(WKScriptMessage*)message {
 NSURL *url=message.frameInfo.request.URL;
 if(!message.frameInfo.mainFrame||![url.host isEqualToString:@"127.0.0.1"]||url.port.intValue!=5174||![message.body isKindOfClass:NSDictionary.class])return;
 NSDictionary *b=message.body;if(![b[@"visible"] boolValue]){self.lovable.hidden=YES;return;}
 for(NSString *k in @[@"x",@"y",@"width",@"height"])if(![b[k] isKindOfClass:NSNumber.class]||!isfinite([b[k] doubleValue]))return;
 NSRect bounds=self.window.contentView.bounds;double x=[b[@"x"] doubleValue],y=[b[@"y"] doubleValue],w=[b[@"width"] doubleValue],h=[b[@"height"] doubleValue];
 if(w<=0||h<=0)return;self.lovable.frame=NSIntersectionRect(NSMakeRect(x,bounds.size.height-y-h,w,h),bounds);self.lovable.hidden=NO;
}
-(WKWebView*)webView:(WKWebView*)view createWebViewWithConfiguration:(WKWebViewConfiguration*)configuration forNavigationAction:(WKNavigationAction*)action windowFeatures:(WKWindowFeatures*)features {
 WKWebView *child=[[WKWebView alloc] initWithFrame:NSMakeRect(0,0,1000,750) configuration:configuration];child.UIDelegate=self;
 NSWindow *popup=[[NSWindow alloc] initWithContentRect:child.frame styleMask:NSWindowStyleMaskTitled|NSWindowStyleMaskClosable|NSWindowStyleMaskResizable backing:NSBackingStoreBuffered defer:NO];popup.title=@"Lovable";popup.contentView=child;[self.popups addObject:popup];[popup makeKeyAndOrderFront:nil];return child;
}
-(void)webViewDidClose:(WKWebView*)view {[view.window close];}
-(BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication*)sender{return YES;}
@end
int main(){@autoreleasepool{NSApplication *app=NSApplication.sharedApplication;[app setActivationPolicy:NSApplicationActivationPolicyRegular];NSMenu *menu=[NSMenu new];NSMenuItem *item=[NSMenuItem new];[menu addItem:item];NSMenu *sub=[NSMenu new];[sub addItemWithTitle:@"Quit Co-founder" action:@selector(terminate:) keyEquivalent:@"q"];item.submenu=sub;app.mainMenu=menu;Host *host=[Host new];app.delegate=host;[app run];}return 0;}
