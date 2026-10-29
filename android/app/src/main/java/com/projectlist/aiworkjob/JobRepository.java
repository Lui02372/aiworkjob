package com.projectlist.aiworkjob;

import android.content.Context;
import android.net.Uri;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.*;
import java.util.ArrayList;
import java.util.List;

/** Reads only official public endpoints. Never sends the user's profile or work records. */
final class JobRepository {
    private final Context context;
    private static final Set<String> COUNTRIES=new HashSet<>(Arrays.asList("South Korea","United States","United Kingdom","Canada","Australia","Japan","Germany"));
    private static final String[] QUERIES={"content marketing","graphic designer","video editor","automation developer","research analyst"};
    JobRepository(Context context){this.context=context.getApplicationContext();}
    synchronized JSONObject feed(String country) throws Exception {
        if(country==null)country="South Korea";
        if(!COUNTRIES.contains(country))throw new IllegalArgumentException("unsupported country");
        String key="feed-"+country;
        String cached=context.getSharedPreferences("public-jobs",0).getString(key,null);
        if(cached!=null){JSONObject data=new JSONObject(cached);if(System.currentTimeMillis()-data.optLong("fetchedAt")<86400000L){data.put("cached",true);return removeExpired(data);}}
        JSONArray jobs=new JSONArray();Set<String> ids=new HashSet<>();int successes=0;
        ExecutorService pool=Executors.newFixedThreadPool(5);
        CompletionService<JSONObject> completion=new ExecutorCompletionService<>(pool);
        List<Future<JSONObject>> tasks=new ArrayList<>();
        final String selectedCountry=country;
        for(String query:QUERIES)tasks.add(completion.submit(()->get("https://himalayas.app/jobs/api/search?q="+Uri.encode(query)+"&country="+Uri.encode(selectedCountry)+"&sort=recent")));
        long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(21);
        try {
            for(int n=0;n<QUERIES.length;n++){
                long remaining=deadline-System.nanoTime();if(remaining<=0)break;
                Future<JSONObject> task=completion.poll(remaining,TimeUnit.NANOSECONDS);if(task==null)break;
                try{JSONArray list=task.get().optJSONArray("jobs");if(list==null)continue;successes++;
                    for(int i=0;i<list.length();i++){JSONObject job=list.getJSONObject(i);String id=job.optString("guid");if(validSource(id)&&validSource(job.optString("applicationLink"))&&job.optLong("expiryDate")*1000>System.currentTimeMillis()&&ids.add(id))jobs.put(job);}
                }catch(Exception ignored){}
            }
        }finally{for(Future<JSONObject> task:tasks)task.cancel(true);pool.shutdownNow();}
        if(successes==0)throw new java.io.IOException("source unavailable");
        JSONObject result=new JSONObject().put("jobs",jobs).put("source","Himalayas").put("sourceUrl","https://himalayas.app/").put("fetchedAt",System.currentTimeMillis()).put("country",country).put("partial",successes!=QUERIES.length).put("cached",false);
        context.getSharedPreferences("public-jobs",0).edit().putString(key,result.toString()).apply();return result;
    }
    private JSONObject removeExpired(JSONObject data)throws Exception {JSONArray list=data.getJSONArray("jobs"),active=new JSONArray();for(int i=0;i<list.length();i++){JSONObject j=list.getJSONObject(i);if(j.optLong("expiryDate")*1000>System.currentTimeMillis())active.put(j);}data.put("jobs",active);return data;}
    static boolean validSource(String value){try{Uri u=Uri.parse(value);return "https".equals(u.getScheme())&&"himalayas.app".equals(u.getHost())&&u.getUserInfo()==null&&(u.getPort()==-1||u.getPort()==443)&&u.getPath()!=null&&u.getPath().matches("/companies/[a-zA-Z0-9_%.-]+/jobs/[a-zA-Z0-9_%.-]+/?");}catch(Exception ignored){return false;}}
    JSONObject check(String value)throws Exception {if(!validSource(value))throw new IllegalArgumentException("invalid source");Uri uri=Uri.parse(value);try{return new JSONObject().put("status","open").put("job",get("https://himalayas.app/jobs/api"+uri.getEncodedPath()).getJSONObject("job"));}catch(ClosedJob closed){return new JSONObject().put("status","closed");}}
    private static JSONObject get(String address)throws Exception {
        HttpURLConnection connection=(HttpURLConnection)new URL(address).openConnection();connection.setConnectTimeout(8000);connection.setReadTimeout(12000);connection.setInstanceFollowRedirects(false);connection.setRequestProperty("User-Agent","aiworkjob/0.1 (Android public jobs integration)");
        try {int code=connection.getResponseCode();if(code==410)throw new ClosedJob();if(code!=200)throw new java.io.IOException("source status "+code);
            try(InputStream input=connection.getInputStream();ByteArrayOutputStream output=new ByteArrayOutputStream()){byte[] buffer=new byte[8192];int n,total=0;while((n=input.read(buffer))!=-1){total+=n;if(total>6000000)throw new java.io.IOException("response too large");output.write(buffer,0,n);}return new JSONObject(output.toString(StandardCharsets.UTF_8.name()));}
        }finally{connection.disconnect();}
    }
    private static final class ClosedJob extends java.io.IOException {private static final long serialVersionUID=1L;}
}
