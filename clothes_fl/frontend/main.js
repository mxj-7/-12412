const API_BASE = "http://localhost:8000";

// 测试模式按钮
const testModeBtn = document.getElementById('test-mode-btn');
if (testModeBtn) {
    testModeBtn.addEventListener('click', () => {
        window.location.href = 'test.html';
    });
}

// --- 图片上传 ---
const uploadBtn = document.getElementById('upload-btn');
const imageInput = document.getElementById('image-input');
const progressContainer = document.getElementById('upload-progress-container');
const progressText = document.getElementById('progress-text');
const progressPercentage = document.getElementById('progress-percentage');
const progressFill = document.getElementById('progress-fill');
const uploadStatus = document.getElementById('upload-status');

uploadBtn.addEventListener('click', async () => {
    console.log("1. 上传按钮被点击");

    const files = imageInput.files;
    console.log("2. 获取文件列表:", files);

    if (!files || files.length === 0) {
        alert("请先选择要上传的图片！");
        console.warn("没有选择文件。");
        return;
    }

    console.log(`3. 准备上传 ${files.length} 个文件`);
    
    // 显示进度条
    progressContainer.style.display = 'block';
    uploadBtn.disabled = true;
    uploadBtn.textContent = '上传中...';
    
    // 初始化进度
    let completedFiles = 0;
    const totalFiles = files.length;
    updateProgress(0, totalFiles, '开始上传...');
    uploadStatus.innerHTML = '';

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        try {
            console.log(`4. 正在上传: ${file.name}`);
            
            // 更新当前上传状态
            updateProgress(completedFiles, totalFiles, `正在上传: ${file.name}`);
            addStatusMessage(`正在处理: ${file.name}`, 'processing');
            
            const response = await fetch(`${API_BASE}/upload/`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                completedFiles++;
                console.log(`5. 成功上传: ${file.name}`);
                addStatusMessage(`✓ 成功上传: ${file.name}`, 'success');
                updateProgress(completedFiles, totalFiles, `已完成 ${completedFiles}/${totalFiles} 个文件`);
            } else {
                const errorData = await response.json();
                const errorMessage = `上传失败: ${errorData.detail || response.statusText}`;
                console.error(errorMessage, errorData);
                addStatusMessage(`✗ ${file.name}: ${errorMessage}`, 'error');
            }
        } catch (error) {
            console.error('上传过程中发生网络错误:', error);
            addStatusMessage(`✗ ${file.name}: 网络错误 - ${error.message}`, 'error');
        }
    }

    console.log("6. 所有文件处理完毕，重置表单并刷新图库");
    
    // 完成上传
    if (completedFiles === totalFiles) {
        updateProgress(totalFiles, totalFiles, `上传完成！成功上传 ${completedFiles} 个文件`);
        addStatusMessage(`🎉 批量上传完成！共成功上传 ${completedFiles} 个文件`, 'success');
    } else {
        updateProgress(completedFiles, totalFiles, `部分完成：${completedFiles}/${totalFiles} 个文件上传成功`);
        addStatusMessage(`⚠️ 部分文件上传失败，成功: ${completedFiles}，总计: ${totalFiles}`, 'error');
    }
    
    // 重置上传按钮
    setTimeout(() => {
        uploadBtn.disabled = false;
        uploadBtn.textContent = '上传';
        document.getElementById('upload-form').reset();
        loadGallery();
        
        // 3秒后隐藏进度条
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 3000);
    }, 1000);
});

// 更新进度条
function updateProgress(completed, total, message) {
    const percentage = Math.round((completed / total) * 100);
    progressFill.style.width = `${percentage}%`;
    progressPercentage.textContent = `${percentage}%`;
    progressText.textContent = message;
}

// 添加状态消息
function addStatusMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = type;
    messageDiv.textContent = message;
    uploadStatus.appendChild(messageDiv);
    
    // 自动滚动到最新消息
    uploadStatus.scrollTop = uploadStatus.scrollHeight;
}

// 加载图片库
async function loadGallery(query = "", tags = "") {
    console.log("🔍 开始加载图片库...");
    
    let url = `${API_BASE}/images/`;
    if (tags) {
        url = `${API_BASE}/search/?tags=${encodeURIComponent(tags)}`;
    }
    
    console.log("📡 请求URL:", url);
    
    try {
        const res = await fetch(url);
        console.log("📊 响应状态:", res.status, res.statusText);
        
        if (!res.ok) {
            console.error("❌ API请求失败:", res.status, res.statusText);
            return;
        }
        
        const data = await res.json();
        console.log("📦 返回的数据:", data);
        console.log("📊 图片数量:", data.length);
        
        const gallery = document.getElementById('gallery');
        gallery.innerHTML = '';
        
        if (data.length === 0) {
            gallery.innerHTML = '<p>暂无图片数据</p>';
            console.log("⚠️ 没有图片数据");
            return;
        }
        
        data.forEach((item, index) => {
            console.log(`🖼️ 渲染图片 ${index + 1}:`, item.filename, item.id);
            
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <img src="${API_BASE}/imagefile/${item.filename}" alt="服装图片" 
                     style="cursor: pointer;" 
                     onclick="window.location.href='detail.html?id=${item.id}'" 
                     onerror="console.error('图片加载失败:', '${item.filename}')">
                <button onclick="window.location.href='detail.html?id=${item.id}'">详情</button>
                <p>ID: ${item.id} | ${item.filename}</p>
            `;
            gallery.appendChild(card);
        });
        
        console.log("✅ 图片库加载完成");
        
    } catch (error) {
        console.error("❌ 加载图片库时发生错误:", error);
        const gallery = document.getElementById('gallery');
        gallery.innerHTML = '<p>加载失败，请检查网络连接</p>';
    }
}

// 搜索功能
const searchBtn = document.getElementById('search-btn');
const resetBtn = document.getElementById('reset-btn');
searchBtn.onclick = () => {
    const tag = document.getElementById('search-input').value.trim();
    loadGallery("", tag);
};
resetBtn.onclick = () => {
    document.getElementById('search-input').value = '';
    loadGallery();
};

// 初始加载
loadGallery();