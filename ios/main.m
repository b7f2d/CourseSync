// SPDX-License-Identifier: GPL-3.0-only
#import <UIKit/UIKit.h>
#import <JavaScriptCore/JavaScriptCore.h>
#import <EventKit/EventKit.h>
#import <Security/Security.h>
#import <UserNotifications/UserNotifications.h>
#import <WebKit/WebKit.h>

typedef void (^Reply)(id, NSString *);
static id Null(id value) { return value ?: NSNull.null; }
static NSString *Str(id value) { return [value isKindOfClass:NSString.class] ? value : @""; }
static BOOL Bool(id value) { return [value respondsToSelector:@selector(boolValue)] && [value boolValue]; }
static NSDate *Date(id value) { return [NSDate dateWithTimeIntervalSince1970:[value doubleValue] / 1000]; }
static id Stamp(NSDate *date) { return date ? @([date timeIntervalSince1970] * 1000) : NSNull.null; }
static NSDictionary *Error(NSString *code) { return @{@"error":code}; }

@interface CourseApp : UIResponder <UIApplicationDelegate, NSURLSessionTaskDelegate, WKScriptMessageHandlerWithReply, WKNavigationDelegate>
@property (nonatomic, strong) UIWindow *window;
@property UIViewController *root;
@property UIButton *button;
@property UILabel *status;
@property JSContext *context;
@property EKEventStore *store;
@property NSMutableDictionary<NSString *, EKEvent *> *events;
@property NSString *directory;
@property NSURLSession *session;
@property UIViewController *sliderScreen;
@property JSValue *sliderHandler;
@property JSValue *sliderDone;
@end

@implementation CourseApp
- (BOOL)application:(UIApplication *)app didFinishLaunchingWithOptions:(NSDictionary *)options {
    self.store = [EKEventStore new];
    NSURL *base = [NSFileManager.defaultManager URLForDirectory:NSApplicationSupportDirectory inDomain:NSUserDomainMask appropriateForURL:nil create:YES error:nil];
    self.directory = base.path;
    self.root = [UIViewController new];
    self.root.view.backgroundColor = UIColor.systemBackgroundColor;
    UILabel *title = [UILabel new];
    title.text = @"CourseSync";
    title.font = [UIFont preferredFontForTextStyle:UIFontTextStyleLargeTitle];
    self.status = [UILabel new];
    self.status.text = @"南京财经大学 · 本地课表同步";
    self.status.numberOfLines = 0;
    self.button = [UIButton buttonWithType:UIButtonTypeSystem];
    [self.button setTitle:@"打开课表同步" forState:UIControlStateNormal];
    [self.button addTarget:self action:@selector(run) forControlEvents:UIControlEventTouchUpInside];
    UIStackView *stack = [[UIStackView alloc] initWithArrangedSubviews:@[title,self.status,self.button]];
    stack.axis = UILayoutConstraintAxisVertical;
    stack.alignment = UIStackViewAlignmentCenter;
    stack.spacing = 18;
    stack.translatesAutoresizingMaskIntoConstraints = NO;
    [self.root.view addSubview:stack];
    [NSLayoutConstraint activateConstraints:@[
        [stack.centerXAnchor constraintEqualToAnchor:self.root.view.centerXAnchor],
        [stack.centerYAnchor constraintEqualToAnchor:self.root.view.centerYAnchor],
        [stack.widthAnchor constraintLessThanOrEqualToAnchor:self.root.view.safeAreaLayoutGuide.widthAnchor multiplier:0.9]
    ]];
    self.window = [[UIWindow alloc] initWithFrame:UIScreen.mainScreen.bounds];
    self.window.rootViewController = self.root;
    [self.window makeKeyAndVisible];
    NSURLSessionConfiguration *configuration = NSURLSessionConfiguration.ephemeralSessionConfiguration;
    configuration.HTTPCookieStorage = nil;
    configuration.HTTPShouldSetCookies = NO;
    configuration.URLCache = nil;
    self.session = [NSURLSession sessionWithConfiguration:configuration delegate:self delegateQueue:nil];
    return YES;
}

- (void)run {
    if (self.context) return;
    self.button.enabled = NO;
    self.events = [NSMutableDictionary new];
    JSContext *context = [JSContext new];
    self.context = context;
    __weak CourseApp *weakSelf = self;
    __weak JSContext *weakContext = context;
    context.exceptionHandler = ^(JSContext *ctx, JSValue *exception) {
        if (weakSelf.context == ctx) [weakSelf finish:@"无法运行课表同步。"];
    };
    context[@"__native"] = ^id(NSString *operation, NSDictionary *value) {
        return [weakSelf sync:operation value:value];
    };
    context[@"__asyncNative"] = ^(NSString *operation, NSDictionary *value, JSValue *callback) {
        [weakSelf async:operation value:value reply:^(id result, NSString *error) {
            dispatch_async(dispatch_get_main_queue(), ^{
                if (weakSelf.context == callback.context)
                    [callback callWithArguments:@[Null(result),Null(error)]];
            });
        }];
    };
    context[@"__delay"] = ^(double milliseconds, JSValue *callback) {
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(MAX(0, milliseconds) * NSEC_PER_MSEC)), dispatch_get_main_queue(), ^{
            if (weakSelf.context == callback.context) [callback callWithArguments:@[]];
        });
    };
    context[@"__slider"] = ^(NSString *html, NSString *title, JSValue *handler, JSValue *done) {
        [weakSelf showSlider:html title:title handler:handler done:done];
    };
    context[@"__finish"] = ^(NSString *message) {
        JSContext *finishingContext = weakContext;
        dispatch_async(dispatch_get_main_queue(), ^{
            if (finishingContext && weakSelf.context == finishingContext) [weakSelf finish:message];
        });
    };
    NSURL *script = [NSBundle.mainBundle URLForResource:@"CourseSync" withExtension:@"js"];
    NSString *source = script ? [NSString stringWithContentsOfURL:script encoding:NSUTF8StringEncoding error:nil] : nil;
    if (!source) { [self finish:@"应用资源缺失。"]; return; }
    [context evaluateScript:source withSourceURL:script];
}

- (void)finish:(NSString *)message {
    self.context = nil;
    self.events = nil;
    if (self.sliderScreen) [self closeSlider];
    self.button.enabled = YES;
    self.status.text = message.length ? message : @"南京财经大学 · 本地课表同步";
}

- (NSString *)path:(id)value {
    NSString *path = Str(value).stringByStandardizingPath;
    return [path hasPrefix:[self.directory stringByAppendingString:@"/"]] ? path : nil;
}

- (NSDictionary *)calendar:(EKCalendar *)calendar {
    return @{@"identifier":calendar.calendarIdentifier, @"title":calendar.title ?: @"",
             @"allowsContentModifications":@(calendar.allowsContentModifications), @"isSubscribed":@(calendar.subscribed),
             @"source":@{@"title":calendar.source.title ?: @"", @"type":calendar.source.sourceType == EKSourceTypeCalDAV ? @"calDAV" : @"other"}};
}

- (NSDictionary *)event:(EKEvent *)event {
    NSString *handle = NSUUID.UUID.UUIDString;
    self.events[handle] = event;
    return @{@"handle":handle, @"identifier":event.eventIdentifier ?: @"", @"calendar":[self calendar:event.calendar],
             @"title":event.title ?: @"", @"notes":event.notes ?: @"", @"location":event.location ?: @"",
             @"startDate":Stamp(event.startDate), @"endDate":Stamp(event.endDate), @"occurrenceDate":Stamp(event.occurrenceDate),
             @"isAllDay":@(event.allDay), @"isDetached":@(event.isDetached), @"hasRecurrenceRules":@(event.hasRecurrenceRules),
             @"recurrenceRules":event.hasRecurrenceRules ? @[@{}] : @[], @"attendees":event.hasAttendees ? @[@YES] : @[]};
}

- (id)sync:(NSString *)operation value:(NSDictionary *)v {
    NSFileManager *files = NSFileManager.defaultManager;
    NSString *path = [self path:v[@"path"]];
    if ([operation isEqual:@"root"]) return self.directory;
    if ([operation isEqual:@"uuid"]) return NSUUID.UUID.UUIDString;
    if ([operation isEqual:@"random"]) {
        NSUInteger count = MIN([v[@"count"] unsignedIntegerValue], 4096);
        NSMutableData *bytes = [NSMutableData dataWithLength:count];
        if (SecRandomCopyBytes(kSecRandomDefault, count, bytes.mutableBytes) != errSecSuccess) return Error(@"CRYPTO");
        return [self byteArray:bytes];
    }
    if ([operation isEqual:@"bytes"]) return [self byteArray:[[NSData alloc] initWithBase64EncodedString:Str(v[@"base64"]) options:0]];
    if ([operation isEqual:@"exists"]) return @(path && [files fileExistsAtPath:path]);
    if ([operation isEqual:@"mkdir"]) return path && [files createDirectoryAtPath:path withIntermediateDirectories:[v[@"recursive"] boolValue] attributes:nil error:nil] ? @YES : Error(@"STATE_WRITE");
    if ([operation isEqual:@"list"]) return (path ? [files contentsOfDirectoryAtPath:path error:nil] : nil) ?: Error(@"STATE_READ");
    if ([operation isEqual:@"read"]) return (path ? [NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:nil] : nil) ?: Error(@"STATE_READ");
    if ([operation isEqual:@"base64"]) return (path ? [[NSData dataWithContentsOfFile:path] base64EncodedStringWithOptions:0] : nil) ?: Error(@"STATE_READ");
    if ([operation isEqual:@"write"]) return path && [Str(v[@"value"]) writeToFile:path atomically:YES encoding:NSUTF8StringEncoding error:nil] ? @YES : Error(@"STATE_WRITE");
    if ([operation isEqual:@"unlink"]) return path && [files removeItemAtPath:path error:nil] ? @YES : Error(@"STATE_WRITE");
    if ([operation isEqual:@"move"]) {
        NSString *to = [self path:v[@"to"]];
        return path && to && [files moveItemAtPath:path toPath:to error:nil] ? @YES : Error(@"BUSY");
    }
    if ([operation hasPrefix:@"key"]) return [self key:operation value:v];
    if ([operation isEqual:@"progress"]) { self.status.text = Str(v[@"value"]); return @YES; }
    if ([operation isEqual:@"removePending"]) {
        [UNUserNotificationCenter.currentNotificationCenter removePendingNotificationRequestsWithIdentifiers:v[@"ids"]];
        return @YES;
    }
    if ([operation isEqual:@"events"]) {
        NSMutableArray *calendars = [NSMutableArray new];
        for (NSString *identifier in v[@"calendars"]) {
            EKCalendar *calendar = [self.store calendarWithIdentifier:identifier];
            if (calendar) [calendars addObject:calendar];
        }
        if (!calendars.count) return Error(@"CALENDAR_MISSING");
        NSPredicate *predicate = [self.store predicateForEventsWithStartDate:Date(v[@"start"]) endDate:Date(v[@"end"]) calendars:calendars];
        NSMutableArray *result = [NSMutableArray new];
        for (EKEvent *event in [self.store eventsMatchingPredicate:predicate]) [result addObject:[self event:event]];
        return result;
    }
    if ([operation isEqual:@"saveEvent"] || [operation isEqual:@"removeEvent"]) {
        NSString *handle = Str(v[@"handle"]);
        EKEvent *event = handle.length ? self.events[handle] : nil;
        if (handle.length && !event) return Error(@"CALENDAR_VERIFY");
        if (event.hasRecurrenceRules || event.isDetached || event.hasAttendees) return Error(@"MANAGED_SERIES");
        if ([operation isEqual:@"removeEvent"]) {
            return event && [self.store removeEvent:event span:EKSpanThisEvent commit:YES error:nil] ? @YES : Error(@"CALENDAR_VERIFY");
        }
        EKCalendar *calendar = [self.store calendarWithIdentifier:Str(v[@"calendar"])];
        if (!calendar.allowsContentModifications || calendar.subscribed) return Error(@"CALENDAR_READONLY");
        if (event && ![event.calendar.calendarIdentifier isEqual:calendar.calendarIdentifier]) return Error(@"FOREIGN_EVENT");
        event = event ?: [EKEvent eventWithEventStore:self.store];
        event.calendar = calendar;
        event.title = Str(v[@"title"]);
        event.notes = Str(v[@"notes"]);
        event.location = Str(v[@"location"]);
        event.allDay = [v[@"isAllDay"] boolValue];
        event.timeZone = [NSTimeZone timeZoneWithName:Str(v[@"timeZone"])];
        event.startDate = Date(v[@"start"]);
        event.endDate = Date(v[@"end"]);
        if (![self.store saveEvent:event span:EKSpanThisEvent commit:YES error:nil]) return Error(@"CALENDAR_VERIFY");
        if (!handle.length) handle = NSUUID.UUID.UUIDString;
        self.events[handle] = event;
        return @{@"identifier":event.eventIdentifier ?: @"", @"handle":handle};
    }
    return Error(@"NATIVE_UNAVAILABLE");
}

- (NSArray *)byteArray:(NSData *)data {
    NSMutableArray *bytes = [NSMutableArray arrayWithCapacity:data.length];
    const uint8_t *buffer = data.bytes;
    for (NSUInteger i=0; i<data.length; i++) [bytes addObject:@(buffer[i])];
    return bytes;
}

- (id)key:(NSString *)operation value:(NSDictionary *)v {
    BOOL cloud = [v[@"synchronizable"] boolValue];
    NSMutableDictionary *query = [@{(__bridge id)kSecClass:(__bridge id)kSecClassGenericPassword,
        (__bridge id)kSecAttrService:@"CourseSync.Standalone",
        (__bridge id)kSecAttrAccount:Str(v[@"key"]),
        (__bridge id)kSecAttrSynchronizable:@(cloud)} mutableCopy];
    if ([operation isEqual:@"keyRead"]) {
        query[(__bridge id)kSecReturnData] = @YES;
        CFTypeRef output = NULL;
        OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &output);
        if (status == errSecItemNotFound) return NSNull.null;
        if (status != errSecSuccess) return Error(@"CREDENTIALS_UNAVAILABLE");
        return Null([[NSString alloc] initWithData:CFBridgingRelease(output) encoding:NSUTF8StringEncoding]);
    }
    if ([operation isEqual:@"keyDelete"]) {
        OSStatus status = SecItemDelete((__bridge CFDictionaryRef)query);
        return @(status == errSecSuccess || status == errSecItemNotFound);
    }
    NSData *data = [Str(v[@"value"]) dataUsingEncoding:NSUTF8StringEncoding];
    NSDictionary *update = @{(__bridge id)kSecValueData:data};
    OSStatus status = SecItemUpdate((__bridge CFDictionaryRef)query, (__bridge CFDictionaryRef)update);
    if (status == errSecItemNotFound) {
        [query addEntriesFromDictionary:update];
        query[(__bridge id)kSecAttrAccessible] = (__bridge id)(cloud ? kSecAttrAccessibleAfterFirstUnlock : kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly);
        status = SecItemAdd((__bridge CFDictionaryRef)query, NULL);
    }
    return @(status == errSecSuccess);
}

- (void)async:(NSString *)operation value:(NSDictionary *)v reply:(Reply)reply {
    if ([operation isEqual:@"dialog"] || [operation isEqual:@"fields"]) {
        [self dialog:v fields:[operation isEqual:@"fields"] reply:reply]; return;
    }
    if ([operation isEqual:@"request"]) { [self request:v reply:reply]; return; }
    if ([operation isEqual:@"access"] || [operation isEqual:@"calendars"]) {
        [self.store requestFullAccessToEventsWithCompletion:^(BOOL granted, NSError *error) {
            dispatch_async(dispatch_get_main_queue(), ^{
                if (!granted) { reply(nil, @"CALENDAR_PERMISSION"); return; }
                NSMutableArray *rows = [NSMutableArray new];
                for (EKCalendar *calendar in [self.store calendarsForEntityType:EKEntityTypeEvent]) [rows addObject:[self calendar:calendar]];
                reply(rows,nil);
            });
        }];
        return;
    }
    if ([operation isEqual:@"newCalendar"]) {
        EKSource *source = nil;
        for (EKSource *candidate in self.store.sources) {
            if (candidate.sourceType == EKSourceTypeCalDAV && [candidate.title caseInsensitiveCompare:@"iCloud"] == NSOrderedSame) {
                source = candidate; break;
            }
        }
        if (!source) { reply(nil,@"CALENDAR_NOT_ICLOUD"); return; }
        NSString *title = Str(v[@"title"]);
        for (EKCalendar *existing in [self.store calendarsForEntityType:EKEntityTypeEvent]) {
            if ([existing.source.sourceIdentifier isEqual:source.sourceIdentifier] &&
                [existing.title localizedCaseInsensitiveCompare:title] == NSOrderedSame) {
                reply(nil,@"CALENDAR_NAME_IN_USE"); return;
            }
        }
        EKCalendar *calendar = [EKCalendar calendarForEntityType:EKEntityTypeEvent eventStore:self.store];
        calendar.source = source;
        calendar.title = title;
        if (![self.store saveCalendar:calendar commit:YES error:nil]) { reply(nil,@"CALENDAR_CREATE_FAILED"); return; }
        reply([self calendar:calendar],nil); return;
    }
    UNUserNotificationCenter *notifications = UNUserNotificationCenter.currentNotificationCenter;
    if ([operation isEqual:@"pending"]) {
        [notifications getPendingNotificationRequestsWithCompletionHandler:^(NSArray<UNNotificationRequest *> *requests) {
            NSMutableArray *result = [NSMutableArray new];
            for (UNNotificationRequest *request in requests) {
                UNTimeIntervalNotificationTrigger *trigger = (id)request.trigger;
                NSDate *next = [trigger isKindOfClass:UNTimeIntervalNotificationTrigger.class] ? trigger.nextTriggerDate : nil;
                [result addObject:@{@"identifier":request.identifier,@"content":@{@"body":request.content.body},@"when":Stamp(next)}];
            }
            reply(result,nil);
        }];
        return;
    }
    if ([operation isEqual:@"notify"]) {
        [notifications requestAuthorizationWithOptions:UNAuthorizationOptionAlert | UNAuthorizationOptionSound completionHandler:^(BOOL granted, NSError *error) {
            if (!granted) { reply(nil,@"NOTIFICATION_PERMISSION"); return; }
            UNMutableNotificationContent *content = [UNMutableNotificationContent new];
            content.title = Str(v[@"title"]);
            content.body = Str(v[@"body"]);
            content.sound = [v[@"silent"] boolValue] ? nil : UNNotificationSound.defaultSound;
            UNNotificationTrigger *trigger = [v[@"when"] isKindOfClass:NSNumber.class] ? [UNTimeIntervalNotificationTrigger triggerWithTimeInterval:MAX(1,[Date(v[@"when"]) timeIntervalSinceNow]) repeats:NO] : nil;
            NSString *identifier = Str(v[@"identifier"]);
            UNNotificationRequest *request = [UNNotificationRequest requestWithIdentifier:identifier.length ? identifier : NSUUID.UUID.UUIDString content:content trigger:trigger];
            [notifications addNotificationRequest:request withCompletionHandler:^(NSError *failure) { reply(@YES,failure ? @"NOTIFICATION_FAILED" : nil); }];
        }];
        return;
    }
    if ([operation isEqual:@"export"]) {
        NSMutableArray *items = [NSMutableArray new];
        NSURL *folder = [[NSURL fileURLWithPath:NSTemporaryDirectory()] URLByAppendingPathComponent:NSUUID.UUID.UUIDString];
        [NSFileManager.defaultManager createDirectoryAtURL:folder withIntermediateDirectories:YES attributes:nil error:nil];
        for (NSDictionary *file in v[@"files"]) {
            NSURL *url = [folder URLByAppendingPathComponent:Str(file[@"name"]).lastPathComponent];
            NSData *data = [[NSData alloc] initWithBase64EncodedString:Str(file[@"base64"]) options:0];
            if ([data writeToURL:url atomically:YES]) [items addObject:url];
        }
        if (!items.count) { reply(nil,@"EXPORT_FAILED"); return; }
        UIActivityViewController *screen = [[UIActivityViewController alloc] initWithActivityItems:items applicationActivities:nil];
        screen.popoverPresentationController.sourceView = self.button;
        screen.completionWithItemsHandler = ^(UIActivityType type, BOOL completed, NSArray *returned, NSError *error) {
            [NSFileManager.defaultManager removeItemAtURL:folder error:nil];
            reply(@(completed),error ? @"EXPORT_FAILED" : nil);
        };
        [self.root presentViewController:screen animated:YES completion:nil]; return;
    }
    reply(nil,@"NATIVE_UNAVAILABLE");
}

- (void)dialog:(NSDictionary *)v fields:(BOOL)fields reply:(Reply)reply {
    if (Str(v[@"image"]).length) {
        UIImage *image = [UIImage imageWithData:[[NSData alloc] initWithBase64EncodedString:Str(v[@"image"]) options:0]];
        if (!image) { reply(nil,@"CAPTCHA"); return; }
        [self imageDialog:v image:image fields:fields reply:reply]; return;
    }
    UIAlertController *alert = [UIAlertController alertControllerWithTitle:Str(v[@"title"]) message:Str(v[@"message"]) preferredStyle:UIAlertControllerStyleAlert];
    __weak UIAlertController *weakAlert = alert;
    for (NSDictionary *field in v[@"fields"]) {
        [alert addTextFieldWithConfigurationHandler:^(UITextField *input) {
            input.placeholder = Str(field[@"label"]);
            input.text = Str(field[@"value"]);
            input.secureTextEntry = Bool(field[@"secure"]);
            input.autocorrectionType = UITextAutocorrectionTypeNo;
            input.autocapitalizationType = UITextAutocapitalizationTypeNone;
            NSString *kind = Str(field[@"kind"]);
            if ([kind isEqual:@"username"]) input.textContentType = UITextContentTypeUsername;
            if ([kind isEqual:@"password"]) input.textContentType = UITextContentTypePassword;
            if ([kind isEqual:@"sms"] || [kind isEqual:@"totp"]) {
                input.textContentType = UITextContentTypeOneTimeCode;
                input.keyboardType = UIKeyboardTypeNumberPad;
            }
        }];
    }
    NSArray *actions = fields ? @[@{@"label": Str(v[@"confirmLabel"]).length ? v[@"confirmLabel"] : @"继续"}] : v[@"actions"];
    [actions enumerateObjectsUsingBlock:^(NSDictionary *action, NSUInteger index, BOOL *stop) {
        UIAlertAction *item = [UIAlertAction actionWithTitle:Str(action[@"label"])
            style:Bool(action[@"destructive"]) ? UIAlertActionStyleDestructive : UIAlertActionStyleDefault handler:^(UIAlertAction *chosen) {
            if (!fields) { [self afterAlert:^{ reply(@(index),nil); }]; return; }
            NSMutableArray *values = [NSMutableArray new];
            for (UITextField *field in weakAlert.textFields) [values addObject:field.text ?: @""];
            [self afterAlert:^{ reply(values,nil); }];
        }];
        [alert addAction:item];
    }];
    if (fields || Bool(v[@"cancelButton"])) {
        NSString *cancel = Str(v[@"cancelLabel"]);
        [alert addAction:[UIAlertAction actionWithTitle:cancel.length ? cancel : @"取消" style:UIAlertActionStyleCancel handler:^(UIAlertAction *chosen) { [self afterAlert:^{ reply(nil,nil); }]; }]];
    }
    [self.root presentViewController:alert animated:YES completion:nil];
}

- (void)imageDialog:(NSDictionary *)v image:(UIImage *)image fields:(BOOL)fields reply:(Reply)reply {
    UIViewController *screen = [UIViewController new];
    screen.view.backgroundColor = UIColor.systemBackgroundColor;
    screen.title = Str(v[@"title"]);
    UIImageView *preview = [[UIImageView alloc] initWithImage:image];
    preview.contentMode = UIViewContentModeScaleAspectFit;
    [preview.heightAnchor constraintEqualToConstant:86].active = YES;
    UITextField *field = [UITextField new];
    NSArray *inputs = v[@"fields"];
    field.placeholder = fields ? Str([inputs firstObject][@"label"]) : @"";
    field.borderStyle = UITextBorderStyleRoundedRect;
    field.autocapitalizationType = UITextAutocapitalizationTypeNone;
    field.autocorrectionType = UITextAutocorrectionTypeNo;
    UIStackView *stack = [[UIStackView alloc] initWithArrangedSubviews:fields ? @[preview,field] : @[preview]];
    stack.axis = UILayoutConstraintAxisVertical;
    stack.spacing = 16;
    stack.translatesAutoresizingMaskIntoConstraints = NO;
    [screen.view addSubview:stack];
    [NSLayoutConstraint activateConstraints:@[
        [stack.leadingAnchor constraintEqualToAnchor:screen.view.safeAreaLayoutGuide.leadingAnchor constant:24],
        [stack.trailingAnchor constraintEqualToAnchor:screen.view.safeAreaLayoutGuide.trailingAnchor constant:-24],
        [stack.topAnchor constraintEqualToAnchor:screen.view.safeAreaLayoutGuide.topAnchor constant:24]
    ]];
    __weak UIViewController *weakScreen = screen;
    screen.navigationItem.leftBarButtonItem = [[UIBarButtonItem alloc] initWithPrimaryAction:[UIAction actionWithTitle:@"取消" image:nil identifier:nil handler:^(UIAction *action) {
        [weakScreen dismissViewControllerAnimated:YES completion:^{ reply(nil,fields ? nil : @"CANCELLED"); }];
    }]];
    screen.navigationItem.rightBarButtonItem = [[UIBarButtonItem alloc] initWithPrimaryAction:[UIAction actionWithTitle:@"继续" image:nil identifier:nil handler:^(UIAction *action) {
        NSString *value = field.text ?: @"";
        if (fields && !value.length) return;
        [weakScreen dismissViewControllerAnimated:YES completion:^{ reply(fields ? @[value] : @YES,nil); }];
    }]];
    UINavigationController *navigation = [[UINavigationController alloc] initWithRootViewController:screen];
    navigation.modalInPresentation = YES;
    [self.root presentViewController:navigation animated:YES completion:nil];
}

- (void)afterAlert:(dispatch_block_t)completion {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 400 * NSEC_PER_MSEC), dispatch_get_main_queue(), completion);
}

- (void)request:(NSDictionary *)v reply:(Reply)reply {
    NSURL *url = [NSURL URLWithString:Str(v[@"url"])];
    if (![url.scheme isEqual:@"https"] || url.user || url.password || url.port ||
        ![@[@"authserver.nufe.edu.cn",@"jwxt.nufe.edu.cn"] containsObject:url.host]) {
        reply(nil,@"DOMAIN_BLOCKED"); return;
    }
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
    request.HTTPMethod = Str(v[@"method"]);
    request.timeoutInterval = MAX(1,[v[@"timeout"] doubleValue]);
    request.allHTTPHeaderFields = v[@"headers"];
    request.HTTPBody = Str(v[@"body"]).length ? [Str(v[@"body"]) dataUsingEncoding:NSUTF8StringEncoding] : nil;
    [[self.session dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        if (error || ![response isKindOfClass:NSHTTPURLResponse.class]) {
            reply(nil,error.code == NSURLErrorTimedOut ? @"NETWORK_TIMEOUT" : @"NETWORK"); return;
        }
        NSHTTPURLResponse *http = (id)response;
        NSMutableDictionary *headers = [NSMutableDictionary new];
        [http.allHeaderFields enumerateKeysAndObjectsUsingBlock:^(id key, id value, BOOL *stop) {
            headers[[key description].lowercaseString] = [value description];
        }];
        NSString *encoding = http.textEncodingName;
        NSStringEncoding textEncoding = NSUTF8StringEncoding;
        if (encoding.length) {
            CFStringEncoding mapped = CFStringConvertIANACharSetNameToEncoding((__bridge CFStringRef)encoding);
            if (mapped != kCFStringEncodingInvalidId) textEncoding = CFStringConvertEncodingToNSStringEncoding(mapped);
        }
        NSString *body = [[NSString alloc] initWithData:data ?: NSData.data encoding:textEncoding];
        NSString *location = headers[@"location"];
        NSString *redirect = location.length ? [NSURL URLWithString:location relativeToURL:url].absoluteURL.absoluteString : nil;
        reply(@{@"status":@(http.statusCode),@"headers":headers,@"mimeType":http.MIMEType ?: @"",
                @"base64":[data base64EncodedStringWithOptions:0] ?: @"",@"text":body ?: @"",@"redirect":redirect ?: @""},nil);
    }] resume];
}

- (void)URLSession:(NSURLSession *)session task:(NSURLSessionTask *)task willPerformHTTPRedirection:(NSHTTPURLResponse *)response newRequest:(NSURLRequest *)request completionHandler:(void (^)(NSURLRequest *))completion {
    completion(nil);
}

- (void)showSlider:(NSString *)html title:(NSString *)title handler:(JSValue *)handler done:(JSValue *)done {
    self.sliderHandler = handler;
    self.sliderDone = done;
    WKWebViewConfiguration *config = [WKWebViewConfiguration new];
    config.websiteDataStore = WKWebsiteDataStore.nonPersistentDataStore;
    [config.userContentController addScriptMessageHandlerWithReply:self contentWorld:WKContentWorld.pageWorld name:@"nufeSlider"];
    WKWebView *view = [[WKWebView alloc] initWithFrame:CGRectZero configuration:config];
    view.navigationDelegate = self;
    self.sliderScreen = [UIViewController new];
    self.sliderScreen.view = view;
    self.sliderScreen.title = title;
    self.sliderScreen.navigationItem.leftBarButtonItem = [[UIBarButtonItem alloc] initWithBarButtonSystemItem:UIBarButtonSystemItemCancel target:self action:@selector(closeSlider)];
    UINavigationController *navigation = [[UINavigationController alloc] initWithRootViewController:self.sliderScreen];
    navigation.modalInPresentation = YES;
    [self.root presentViewController:navigation animated:YES completion:^{ [view loadHTMLString:html baseURL:nil]; }];
}

- (void)webView:(WKWebView *)view decidePolicyForNavigationAction:(WKNavigationAction *)action decisionHandler:(void (^)(WKNavigationActionPolicy))decision {
    decision([action.request.URL.absoluteString isEqual:@"about:blank"] ? WKNavigationActionPolicyAllow : WKNavigationActionPolicyCancel);
}

- (void)userContentController:(WKUserContentController *)controller didReceiveScriptMessage:(WKScriptMessage *)message replyHandler:(void (^)(id, NSString *))reply {
    BOOL accepted = message.frameInfo.mainFrame && [[self.sliderHandler callWithArguments:@[message.body]] toBool];
    reply(@(accepted),nil);
    if (accepted) [self closeSlider];
}

- (void)closeSlider {
    WKWebView *view = (id)self.sliderScreen.view;
    [view.configuration.userContentController removeScriptMessageHandlerForName:@"nufeSlider" contentWorld:WKContentWorld.pageWorld];
    JSValue *done = self.sliderDone;
    self.sliderHandler = nil;
    self.sliderDone = nil;
    [self.sliderScreen.navigationController dismissViewControllerAnimated:YES completion:^{
        if (done && self.context == done.context) [done callWithArguments:@[]];
    }];
    self.sliderScreen = nil;
}
@end

int main(int argc, char **argv) {
    @autoreleasepool { return UIApplicationMain(argc,argv,nil,NSStringFromClass(CourseApp.class)); }
}

