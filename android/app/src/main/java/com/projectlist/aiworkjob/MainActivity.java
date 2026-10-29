package com.projectlist.aiworkjob;

import android.app.Activity;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final String HOST="app.aiworkjob.local",ORIGIN="https://"+HOST;
    private static final String CSP="default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";
    private static final Set<String> ASSETS=new HashSet<>(Arrays.asList("index.html","app.js","catalog.js","domain.js","icons.js","styles.css","icon.svg","snapshot.json","config.js","studio.html","studio.js","studio.css","deliverable.html","deliverable.js","deliverable.css","fonts/PretendardVariable.woff2"));
    private WebView web;
    private JobRepository repository;
    @Override public void onCreate(Bundle state){
        super.onCreate(state);repository=new JobRepository(this);web=new WebView(this);web.setBackgroundColor(Color.rgb(247,248,252));setContentView(web);
        if(Build.VERSION.SDK_INT>=30)web.setOnApplyWindowInsetsListener((v,insets)->{android.graphics.Insets b=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());v.setPadding(b.left,b.top,b.right,b.bottom);return insets;});else web.setFitsSystemWindows(true);
        WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setSupportMultipleWindows(false);s.setSafeBrowsingEnabled(true);s.setTextZoom(100);
        CookieManager.getInstance().setAcceptCookie(false);WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags&android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE)!=0);
        web.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                Uri u=request.getUrl();if(!internal(u))return text("text/plain","Forbidden",403);
                if(!"GET".equals(request.getMethod()))return text("text/plain","Method not allowed",405);
                String p=u.getPath();try{
                    if("/api/jobs".equals(p))return text("application/json",repository.feed(u.getQueryParameter("country")).toString(),200);
                    if("/api/check".equals(p)){JSONObject result=repository.check(u.getQueryParameter("url"));return text("application/json",result.toString(),"closed".equals(result.optString("status"))?410:200);}
                    String asset="/".equals(p)?"index.html":p.substring(1);if(!ASSETS.contains(asset))return text("text/plain","Not found",404);
                    return new WebResourceResponse(mime(asset),"UTF-8",200,"OK",headers(),getAssets().open(asset));
                }catch(Exception ignored){return text("application/json","{\"error\":\"source_unavailable\"}",503);}
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){Uri u=request.getUrl();if(!request.isForMainFrame())return true;if(internal(u))return !("/".equals(u.getPath())||"/index.html".equals(u.getPath())||"/deliverable.html".equals(u.getPath())||"/studio.html".equals(u.getPath()));if("https".equals(u.getScheme())&&u.getUserInfo()==null)try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(ActivityNotFoundException ignored){}return true;}
        });web.setWebChromeClient(new WebChromeClient());
        if(Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,this::back);
        web.loadUrl(ORIGIN+"/index.html");
    }
    private static boolean internal(Uri uri){return "https".equals(uri.getScheme())&&HOST.equals(uri.getHost())&&uri.getUserInfo()==null&&(uri.getPort()==-1||uri.getPort()==443);}
    private static Map<String,String> headers(){Map<String,String> h=new HashMap<>();h.put("Content-Security-Policy",CSP);h.put("X-Content-Type-Options","nosniff");h.put("Referrer-Policy","no-referrer");h.put("Cache-Control","no-cache");return h;}
    private static WebResourceResponse text(String type,String body,int code){return new WebResourceResponse(type,"UTF-8",code,code==200?"OK":"Unavailable",headers(),new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));}
    private static String mime(String f){if(f.endsWith(".js"))return "text/javascript";if(f.endsWith(".css"))return "text/css";if(f.endsWith(".json"))return "application/json";if(f.endsWith(".svg"))return "image/svg+xml";if(f.endsWith(".woff2"))return "font/woff2";return "text/html";}
    private void back(){if(web.getUrl()!=null&&(web.getUrl().contains("/deliverable.html")||web.getUrl().contains("/studio.html"))){if(web.canGoBack())web.goBack();else web.loadUrl(ORIGIN+"/index.html#work");return;}web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(d){d.close();return true;}return window.aiworkjobBack?window.aiworkjobBack():false;})()",handled->{if(!"true".equals(handled))finish();});}
    @android.annotation.SuppressLint("GestureBackNavigation")
    @Override public void onBackPressed(){back();}
    @Override protected void onPause(){if(web!=null)web.onPause();super.onPause();}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
    @Override protected void onDestroy(){if(web!=null){web.stopLoading();web.destroy();web=null;}super.onDestroy();}
}
