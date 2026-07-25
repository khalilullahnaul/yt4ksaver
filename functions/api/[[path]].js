export async function onRequest(context) {
    const url = new URL(context.request.url);
    const path = url.pathname;
    
    // Define the Hugging Face Space hostname
    // You can change this if your Space name or username is different
    const hfHost = 'khalilullahnaul-yt4ksaver.hf.space';
    
    // 1. If it's a download file request, redirect directly to Hugging Face
    // This saves Cloudflare worker limits and streams directly at maximum speed
    if (path.startsWith('/api/file/')) {
        return Response.redirect(`https://${hfHost}${path}${url.search}`, 302);
    }
    
    // 2. For other API requests (like /api/download or /api/progress/*), proxy the request
    const targetUrl = `https://${hfHost}${path}${url.search}`;
    
    // Clone headers and overwrite the Host header to match Hugging Face
    const newHeaders = new Headers(context.request.headers);
    newHeaders.set('Host', hfHost);
    
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
