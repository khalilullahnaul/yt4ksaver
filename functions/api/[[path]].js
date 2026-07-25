export async function onRequest(context) {
    const url = new URL(context.request.url);
    const path = url.pathname;
    
    // Retrieve the backend URL from Cloudflare Pages Environment Variables
    // Example: BACKEND_API_URL = "https://api.yt4ksaver.com"
    const backendUrlString = context.env.BACKEND_API_URL || "https://khalilullahnaul-yt4ksaver.hf.space";
    
    let backendUrl;
    try {
        backendUrl = new URL(backendUrlString);
    } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid BACKEND_API_URL environment variable configuration" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
    
    const backendHost = backendUrl.host;
    
    // 1. If it's a download file request, redirect directly to the backend
    // This saves Cloudflare worker limits and streams directly at maximum speed
    if (path.startsWith('/api/file/')) {
        return Response.redirect(`${backendUrl.origin}${path}${url.search}`, 302);
    }
    
    // 2. For other API requests (like /api/download or /api/progress/*), proxy the request
    const targetUrl = `${backendUrl.origin}${path}${url.search}`;
    
    // Clone headers and overwrite the Host header to match the backend domain
    const newHeaders = new Headers(context.request.headers);
    newHeaders.set('Host', backendHost);
    
    const requestOptions = {
        method: context.request.method,
        headers: newHeaders,
        redirect: 'follow'
    };
    
    // Only set body for non-GET/HEAD methods
    if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
        requestOptions.body = context.request.body;
    }
    
    try {
        const response = await fetch(targetUrl, requestOptions);
        
        // Clone response to return it
        const newResponse = new Response(response.body, response);
        newResponse.headers.set('Access-Control-Allow-Origin', '*');
        
        return newResponse;
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to reach backend API', details: error.message }), {
            status: 502,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}
