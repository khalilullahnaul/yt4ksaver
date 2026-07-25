import os
import uuid
import threading
import time
import json
from datetime import datetime
from flask import Flask, request, jsonify, send_file, Response, redirect
from flask_cors import CORS
import yt_dlp

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

DOWNLOAD_DIR = 'downloads'
os.makedirs(DOWNLOAD_DIR, exist_ok=True)
SITE_BRAND = os.getenv('SITE_BRAND', 'yt4ksaver.com')

# Global store for download progress
tasks_progress = {}

def cleanup_old_files():
    while True:
        try:
            now = time.time()
            for filename in os.listdir(DOWNLOAD_DIR):
                filepath = os.path.join(DOWNLOAD_DIR, filename)
                if os.path.isfile(filepath):
                    if os.stat(filepath).st_mtime < now - 3600:
                        os.remove(filepath)
            
            # Cleanup old tasks in memory
            for task_id in list(tasks_progress.keys()):
                if tasks_progress[task_id].get('status') in ['finished', 'error']:
                    # Remove after 10 minutes
                    if tasks_progress[task_id].get('timestamp', 0) < now - 600:
                        del tasks_progress[task_id]

        except Exception as e:
            print(f"Cleanup error: {e}")
        time.sleep(3600)

threading.Thread(target=cleanup_old_files, daemon=True).start()

# --- FOUNDATION: Host Redirection (Practice 4) ---
@app.before_request
def enforce_canonical_host():
    host = request.host
    # Don't redirect on local development
    if any(local in host for local in ['localhost', '127.0.0.1', '0.0.0.0', '192.168.']):
        return
    
    canonical_host = 'yt4ksaver.com'
    # Check headers from reverse proxy (Render/Heroku/AWS use X-Forwarded-Proto)
    scheme = request.headers.get('X-Forwarded-Proto', request.scheme)
    
    if host.startswith('www.') or scheme != 'https' or host != canonical_host:
        # Redirect permanently to canonical https://yt4ksaver.com/...
        url = f"https://{canonical_host}{request.path}"
        if request.query_string:
            url += f"?{request.query_string.decode('utf-8')}"
        return redirect(url, code=301)

# --- PERFORMANCE & TRUST: HSTS & Cache-Control (Practice 5 & 17) ---
@app.after_request
def add_security_and_cache_headers(response):
    # Enable HSTS (Practice 5)
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    
    # Custom Cache-Control (Practice 17)
    path = request.path
    if any(path.endswith(ext) for ext in ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ico']):
        response.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    return response

def download_worker(task_id, url, format_type, start_time, end_time):
    tasks_progress[task_id] = {'status': 'starting', 'progress': 0, 'timestamp': time.time()}
    
    file_id = str(uuid.uuid4())
    output_template = os.path.join(DOWNLOAD_DIR, f'[{SITE_BRAND}] %(title)s_{file_id}.%(ext)s')

    def progress_hook(d):
        if d['status'] == 'downloading':
            p_str = d.get('_percent_str', '0%').strip('\x1b[0;94m').strip('\x1b[0m').replace('%', '')
            try:
                progress = float(p_str)
                tasks_progress[task_id]['progress'] = progress
                tasks_progress[task_id]['status'] = 'downloading'
            except:
                pass
        elif d['status'] == 'finished':
            tasks_progress[task_id]['status'] = 'processing'

    ydl_opts = {
        'outtmpl': output_template,
        'noplaylist': True,
        'quiet': True,
        'progress_hooks': [progress_hook],
    }

    if start_time and end_time:
        # Use ffmpeg for section downloading
        ydl_opts['download_ranges'] = yt_dlp.utils.download_range_func(None, [(yt_dlp.utils.parse_duration(start_time), yt_dlp.utils.parse_duration(end_time))])

    if format_type == '4k':
        ydl_opts['format'] = 'bestvideo[height<=2160]+bestaudio/best[height<=2160]'
        ydl_opts['merge_output_format'] = 'mp4'
    elif format_type == '1440p':
        ydl_opts['format'] = 'bestvideo[height<=1440]+bestaudio/best[height<=1440]'
        ydl_opts['merge_output_format'] = 'mp4'
    elif format_type == '1080p':
        ydl_opts['format'] = 'bestvideo[height<=1080]+bestaudio/best[height<=1080]'
        ydl_opts['merge_output_format'] = 'mp4'
    elif format_type == '720p':
        ydl_opts['format'] = 'bestvideo[height<=720]+bestaudio/best[height<=720]'
        ydl_opts['merge_output_format'] = 'mp4'
    elif format_type == '480p':
        ydl_opts['format'] = 'bestvideo[height<=480]+bestaudio/best[height<=480]'
        ydl_opts['merge_output_format'] = 'mp4'
    elif format_type == '360p':
        ydl_opts['format'] = 'bestvideo[height<=360]+bestaudio/best[height<=360]'
        ydl_opts['merge_output_format'] = 'mp4'
    elif format_type == '144p':
        ydl_opts['format'] = 'bestvideo[height<=144]+bestaudio/best[height<=144]'
        ydl_opts['merge_output_format'] = 'mp4'
    elif format_type == 'mp3':
        ydl_opts['format'] = 'bestaudio/best'
        ydl_opts['postprocessors'] = [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }]
    elif format_type == 'subtitle':
        ydl_opts['writesubtitles'] = True
        ydl_opts['writeautomaticsub'] = True
        ydl_opts['skip_download'] = True
        ydl_opts['subtitleslangs'] = ['en', 'all']
        ydl_opts['subtitlesformat'] = 'srt'
    else:
        tasks_progress[task_id] = {'status': 'error', 'error': 'Invalid format'}
        return

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(url, download=True)
            
            if format_type == 'subtitle':
                # find the subtitle file
                base = ydl.prepare_filename(info_dict)
                base_no_ext = os.path.splitext(base)[0]
                download_url = ''
                for ext in ['.en.srt', '.srt', '.vtt']:
                    if os.path.exists(base_no_ext + ext):
                        download_url = f'/api/file/{os.path.basename(base_no_ext + ext)}'
                        break
                
                if not download_url:
                    tasks_progress[task_id] = {'status': 'error', 'error': 'No subtitles found.'}
                    return
                else:
                    tasks_progress[task_id] = {'status': 'finished', 'download_url': download_url}
                    return

            downloaded_file = ydl.prepare_filename(info_dict)
            if format_type == 'mp3':
                downloaded_file = os.path.splitext(downloaded_file)[0] + '.mp3'
            
            if not os.path.exists(downloaded_file):
                base = os.path.splitext(downloaded_file)[0]
                for ext in ['.mp4', '.mkv', '.webm', '.mp3']:
                    if os.path.exists(base + ext):
                        downloaded_file = base + ext
                        break
            
            filename = os.path.basename(downloaded_file)
            tasks_progress[task_id] = {
                'status': 'finished',
                'download_url': f'/api/file/{filename}',
                'title': info_dict.get('title', 'Video')
            }
            
    except Exception as e:
        tasks_progress[task_id] = {'status': 'error', 'error': str(e)}

# --- Static & Page Routes ---
@app.route('/')
def index():
    try:
        last_mod_time = os.path.getmtime('index.html')
        last_updated_str = datetime.fromtimestamp(last_mod_time).strftime('%B %Y')
    except:
        last_updated_str = datetime.now().strftime('%B %Y')
    
    with open('index.html', 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = content.replace('{{ last_updated }}', last_updated_str)
    return Response(content, mimetype='text/html')

@app.route('/faq')
@app.route('/faq.html')
def faq():
    try:
        last_mod_time = os.path.getmtime('faq.html')
        last_updated_str = datetime.fromtimestamp(last_mod_time).strftime('%B %Y')
    except:
        last_updated_str = datetime.now().strftime('%B %Y')
    
    with open('faq.html', 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = content.replace('{{ last_updated }}', last_updated_str)
    return Response(content, mimetype='text/html')

@app.route('/blog')
@app.route('/blog.html')
def blog():
    try:
        with open('blog.html', 'r', encoding='utf-8') as f:
            content = f.read()
        return Response(content, mimetype='text/html')
    except:
        return "Blog listing page not found", 404

@app.route('/robots.txt')
def serve_robots():
    return send_file('robots.txt', mimetype='text/plain')

@app.route('/sitemap.xml')
def serve_sitemap():
    return send_file('sitemap.xml', mimetype='application/xml')

@app.route('/llms.txt')
def serve_llms():
    return send_file('llms.txt', mimetype='text/plain')

# --- API Routes ---
@app.route('/api/download', methods=['POST'])
def start_download():
    data = request.json
    url = data.get('url')
    format_type = data.get('format', '4k')
    start_time = data.get('start_time')
    end_time = data.get('end_time')

    if not url:
        return jsonify({'error': 'URL is required'}), 400

    task_id = str(uuid.uuid4())
    threading.Thread(target=download_worker, args=(task_id, url, format_type, start_time, end_time), daemon=True).start()
    
    return jsonify({'success': True, 'task_id': task_id})

@app.route('/api/progress/<task_id>')
def progress_stream(task_id):
    def generate():
        while True:
            if task_id in tasks_progress:
                data = tasks_progress[task_id]
                yield f"data: {json.dumps(data)}\n\n"
                if data.get('status') in ['finished', 'error']:
                    break
            else:
                yield f"data: {json.dumps({'status': 'not_found'})}\n\n"
                break
            time.sleep(1)
    return Response(generate(), mimetype='text/event-stream')

@app.route('/api/file/<filename>')
def serve_file(filename):
    filepath = os.path.join(DOWNLOAD_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    
    # Strip internal _{uuid} token if present for clean user download name
    name_without_ext, ext = os.path.splitext(filename)
    if '_' in name_without_ext:
        clean_name = name_without_ext.rsplit('_', 1)[0] + ext
    else:
        clean_name = filename

    if not clean_name.startswith(f'[{SITE_BRAND}]'):
        clean_name = f'[{SITE_BRAND}] {clean_name}'

    return send_file(filepath, as_attachment=True, download_name=clean_name)

# --- Error Handlers (Practice 20) ---
@app.errorhandler(404)
def page_not_found(e):
    try:
        with open('404.html', 'r', encoding='utf-8') as f:
            content = f.read()
        return Response(content, status=404, mimetype='text/html')
    except:
        return "404 Page Not Found", 404

@app.errorhandler(500)
def internal_server_error(e):
    try:
        with open('500.html', 'r', encoding='utf-8') as f:
            content = f.read()
        return Response(content, status=500, mimetype='text/html')
    except:
        return "500 Internal Server Error", 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
