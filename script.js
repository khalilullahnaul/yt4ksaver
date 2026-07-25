document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // --- Elements ---
    const options = document.querySelectorAll('.option');
    const downloadBtn = document.getElementById('download-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const urlInput = document.getElementById('url-input');
    const statusMessage = document.getElementById('status-message');
    const spinner = document.getElementById('spinner');
    const btnText = document.querySelector('.btn-text');
    
    const videoPreview = document.getElementById('video-preview');
    const thumbnail = document.getElementById('thumbnail');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    const trimToggle = document.getElementById('trim-toggle');
    const trimInputs = document.getElementById('trim-inputs');
    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');

    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const recentDownloadsSection = document.getElementById('recent-downloads');
    const recentList = document.getElementById('recent-list');

    const thumbBtn = document.getElementById('download-thumb-btn');
    const subBtn = document.getElementById('download-sub-btn');

    let selectedFormat = '4k';
    const ytRegex = /^(?:https?\:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    
    let eventSource = null;
    let currentTaskId = null;

    // --- Theme Management (Default: Dark Mode) ---
    if (darkModeToggle) {
        const isLightThemeSaved = localStorage.getItem('theme') === 'light';
        if (isLightThemeSaved) {
            document.body.classList.add('light-mode');
            darkModeToggle.innerHTML = '<i data-lucide="moon" class="toggle-icon"></i>';
        } else {
            darkModeToggle.innerHTML = '<i data-lucide="sun" class="toggle-icon"></i>';
        }
        lucide.createIcons();

        darkModeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            const isLight = document.body.classList.contains('light-mode');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            darkModeToggle.innerHTML = isLight ? 
                '<i data-lucide="moon" class="toggle-icon"></i>' : 
                '<i data-lucide="sun" class="toggle-icon"></i>';
            lucide.createIcons();
        });
    }

    // --- Downloader Homepage Specific Features ---
    if (downloadBtn && urlInput) {
        // --- Trimming Toggle ---
        if (trimToggle && trimInputs) {
            trimToggle.addEventListener('change', () => {
                trimInputs.style.display = trimToggle.checked ? 'flex' : 'none';
            });
        }

        // --- Thumbnail Detection ---
        urlInput.addEventListener('input', () => {
            const url = urlInput.value.trim();
            const match = url.match(ytRegex);
            
            if (match && match[1]) {
                const videoId = match[1];
                const thumbUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
                if (thumbnail) thumbnail.src = thumbUrl;
                if (thumbBtn) thumbBtn.href = thumbUrl;
                if (videoPreview) videoPreview.style.display = 'block';
            } else {
                if (videoPreview) videoPreview.style.display = 'none';
            }
        });

        // --- Tab Switching Logic ---
        const tabVideoBtn = document.getElementById('tab-video-btn');
        const tabAudioBtn = document.getElementById('tab-audio-btn');
        const paneVideo = document.getElementById('pane-video');
        const paneAudio = document.getElementById('pane-audio');

        if (tabVideoBtn && tabAudioBtn && paneVideo && paneAudio) {
            tabVideoBtn.addEventListener('click', () => {
                tabVideoBtn.classList.add('active');
                tabAudioBtn.classList.remove('active');
                paneVideo.style.display = 'block';
                paneAudio.style.display = 'none';

                // Set first video option as active and update selectedFormat
                const firstVideoOpt = paneVideo.querySelector('.option');
                if (firstVideoOpt) {
                    options.forEach(opt => opt.classList.remove('active'));
                    firstVideoOpt.classList.add('active');
                    selectedFormat = firstVideoOpt.getAttribute('data-format');
                }
            });

            tabAudioBtn.addEventListener('click', () => {
                tabAudioBtn.classList.add('active');
                tabVideoBtn.classList.remove('active');
                paneAudio.style.display = 'block';
                paneVideo.style.display = 'none';

                // Set first audio option as active and update selectedFormat
                const firstAudioOpt = paneAudio.querySelector('.option');
                if (firstAudioOpt) {
                    options.forEach(opt => opt.classList.remove('active'));
                    firstAudioOpt.classList.add('active');
                    selectedFormat = firstAudioOpt.getAttribute('data-format');
                }
            });
        }

        // --- Option Selection ---
        options.forEach(option => {
            option.addEventListener('click', () => {
                options.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                selectedFormat = option.getAttribute('data-format');
            });
        });

        // --- Load Recent Downloads (LocalStorage) ---
        const clearHistoryBtn = document.getElementById('clear-history-btn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => {
                localStorage.removeItem('recent_downloads');
                if (recentDownloadsSection) recentDownloadsSection.style.display = 'none';
                if (recentList) recentList.innerHTML = '';
            });
        }

        function loadRecentDownloads() {
            if (!recentDownloadsSection || !recentList) return;
            const recents = JSON.parse(localStorage.getItem('recent_downloads') || '[]');
            if (recents.length > 0) {
                recentDownloadsSection.style.display = 'block';
                recentList.innerHTML = '';
                recents.forEach((item, index) => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span class="recent-item-title">
                            <i data-lucide="check-circle-2" style="width: 16px; height: 16px; color: #10b981; flex-shrink: 0;"></i>
                            <span>${escapeHtml(item.title || 'Video')}</span>
                            <span class="recent-format-tag">${escapeHtml(item.format || 'MP4')}</span>
                        </span>
                        <span class="recent-actions">
                            <span style="font-size: 0.8rem; opacity: 0.7;">${item.date}</span>
                            ${item.url ? `<button class="extra-btn redownload-btn" data-url="${escapeHtml(item.url)}" title="Refill URL" style="padding: 4px 8px; font-size: 0.75rem; background: var(--bg-main); color: var(--text-primary); border-color: var(--border-color); cursor: pointer;"><i data-lucide="rotate-cw" style="width: 12px; height: 12px;"></i> Re-fill</button>` : ''}
                        </span>
                    `;
                    recentList.appendChild(li);
                });
                lucide.createIcons();

                // Add listeners to re-fill buttons
                document.querySelectorAll('.redownload-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const targetUrl = btn.getAttribute('data-url');
                        if (targetUrl && urlInput) {
                            urlInput.value = targetUrl;
                            urlInput.dispatchEvent(new Event('input'));
                            window.scrollTo({ top: urlInput.offsetTop - 100, behavior: 'smooth' });
                        }
                    });
                });
            } else {
                recentDownloadsSection.style.display = 'none';
            }
        }
        loadRecentDownloads();

        function addRecentDownload(title, format, url = '', download_url = '') {
            const recents = JSON.parse(localStorage.getItem('recent_downloads') || '[]');
            const date = new Date().toLocaleDateString();
            
            // Deduplicate by URL or title
            const filtered = recents.filter(item => item.url !== url && item.title !== title);
            filtered.unshift({ title, format, url, download_url, date, timestamp: Date.now() });
            
            // Keep up to 8 recent downloads in localStorage
            if (filtered.length > 8) filtered.pop();
            
            localStorage.setItem('recent_downloads', JSON.stringify(filtered));
            loadRecentDownloads();
        }

        function escapeHtml(str) {
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        // --- Extra Buttons (Subtitles) ---
        if (subBtn) {
            subBtn.addEventListener('click', async () => {
                const url = urlInput.value.trim();
                if (!ytRegex.test(url)) return showStatus('Enter valid URL first.', 'error');
                subBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Fetching...';
                lucide.createIcons();
                try {
                    const response = await fetch('/api/download', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ url: url, format: 'subtitle' })
                    });
                    const data = await response.json();
                    if (data.task_id) {
                        const es = new EventSource(`/api/progress/${data.task_id}`);
                        es.onmessage = (event) => {
                            const res = JSON.parse(event.data);
                            if (res.status === 'finished') {
                                window.location.href = res.download_url;
                                subBtn.innerHTML = '<i data-lucide="type"></i>';
                                lucide.createIcons();
                                es.close();
                            } else if (res.status === 'error' || res.status === 'not_found') {
                                showStatus(res.error || 'No subtitles found.', 'error');
                                subBtn.innerHTML = '<i data-lucide="type"></i>';
                                lucide.createIcons();
                                es.close();
                            }
                        };
                    }
                } catch(e) {
                    subBtn.innerHTML = '<i data-lucide="type"></i>';
                    lucide.createIcons();
                }
            });
        }

        // --- Main Download Action ---
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                if (eventSource) eventSource.close();
                resetUI();
                showStatus('Download paused/canceled.', 'error');
            });
        }

        function resetUI() {
            if (btnText) btnText.textContent = 'Paste Link & Download';
            if (spinner) spinner.style.display = 'none';
            if (downloadBtn) {
                downloadBtn.style.display = 'flex';
                downloadBtn.disabled = false;
            }
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (progressContainer) progressContainer.style.display = 'none';
            if (progressBar) progressBar.style.width = '0%';
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
        }

        downloadBtn.addEventListener('click', async () => {
            const url = urlInput.value.trim();
            if (!url || !ytRegex.test(url)) return showStatus('Please enter a valid YouTube URL.', 'error');

            const payload = { url: url, format: selectedFormat };
            if (trimToggle && trimToggle.checked) {
                if (startTimeInput && startTimeInput.value) payload.start_time = startTimeInput.value.trim();
                if (endTimeInput && endTimeInput.value) payload.end_time = endTimeInput.value.trim();
            }

            if (btnText) btnText.textContent = 'Starting...';
            if (spinner) spinner.style.display = 'block';
            if (downloadBtn) downloadBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'flex';
            if (statusMessage) statusMessage.classList.remove('show');
            
            if (progressContainer) progressContainer.style.display = 'block';
            if (progressBar) progressBar.style.width = '0%';
            if (progressText) progressText.textContent = '0%';

            try {
                const response = await fetch('/api/download', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });
                const data = await response.json();

                if (response.ok && data.success) {
                    currentTaskId = data.task_id;
                    
                    // Start SSE for real progress
                    eventSource = new EventSource(`/api/progress/${currentTaskId}`);
                    eventSource.onmessage = (event) => {
                        const res = JSON.parse(event.data);
                        
                        if (res.status === 'downloading') {
                            if (progressBar) progressBar.style.width = `${res.progress}%`;
                            if (progressText) progressText.textContent = `${Math.floor(res.progress)}%`;
                        } else if (res.status === 'processing') {
                            if (progressBar) progressBar.style.width = `100%`;
                            if (progressText) progressText.textContent = `Merging File...`;
                        } else if (res.status === 'finished') {
                            eventSource.close();
                            showStatus(`Success! Downloading your ${selectedFormat.toUpperCase()} file...`, 'success');
                            addRecentDownload(res.title, selectedFormat.toUpperCase(), url, res.download_url);
                            setTimeout(() => {
                                window.location.href = res.download_url;
                                resetUI();
                            }, 1000);
                        } else if (res.status === 'error' || res.status === 'not_found') {
                            eventSource.close();
                            showStatus(`Error: ${res.error || 'Failed to download'}`, 'error');
                            resetUI();
                        }
                    };
                    
                    eventSource.onerror = () => {
                        eventSource.close();
                        resetUI();
                        showStatus('Connection lost. Please try again.', 'error');
                    };

                } else {
                    showStatus(`Error: ${data.error || 'Failed to start download'}`, 'error');
                    resetUI();
                }
            } catch (error) {
                showStatus('An error occurred. Please make sure the backend server is running.', 'error');
                resetUI();
            }
        });

        function showStatus(message, type) {
            if (statusMessage) {
                statusMessage.textContent = message;
                statusMessage.className = `status show ${type}`;
            }
        }
    }
});
